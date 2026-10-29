import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createHash } from 'crypto';
import { patchJobState, getJob } from '@/lib/mcp/wizard-jobs';
import {
  validatePluginSource,
  formatPluginSourceIssues,
} from '@/lib/plugins/source-validation';
import {
  deriveSourceMap,
  diffSourceMaps,
  summarizeSourceMap,
  tokenize,
  scoreIntentMatch,
  type SourceMap,
  type SourceMapDiff,
  type SymbolIndexEntry,
} from '../shared/source-map';
import { deriveAST } from './code-ast';
import { getPluginSourceFiles as getModules, withPluginSourceFiles, persistPluginSourceEdit } from './plugin-source-state';
import {
  appendPluginLedgerEvent,
  validatePluginRunState,
} from './plugin-run-ledger';

// ============================================================================
// SOURCE-MAP TOOLS — recon + search + line-edit + preview
//
// These tools implement the recon→plan→act loop:
//
//   RECON:   getSourceMap         — produces the semantic tree view
//   SEARCH:  findSymbol, readLines, searchInFile, grepPlugin, findDataFieldUsages
//   EDIT:    editLines, insertAt, deleteLines   (line-based, deterministic)
//   PREVIEW: previewEdit          (diff + validation, no commit)
//
// The current editSceneCode requires verbatim string matching which is fragile
// against whitespace drift and fails on duplicate patterns. Line-based edits
// are deterministic — the agent already knows line numbers from getSourceMap
// / readAST / readLines.
//
// All edits go through the same guard + ledger flow as editSceneCode so the
// existing orchestrator feedback loop is preserved.
// ============================================================================

// ─── Helpers ────────────────────────────────────────────────────────────────

interface PendingPlugin {
  pluginId?: string;
  pluginName?: string;
  sceneCode?: string;
  modules?: Record<string, string> | null;
  schemaJson?: string;
  dependencies?: Record<string, string>;
  runLedger?: any;
  sourceMap?: SourceMap;
  roleOverrides?: Record<string, string>;
  [key: string]: any;
}

function withCurrentSourceHash<T extends Record<string, any>>(pending: T): T {
  // Delegate to the existing source-hash logic in plugin-creator-tools.
  // We re-implement here to avoid a circular import; the hash is the same
  // shape (sha256 of sceneCode + modules + schema + dependencies).
  function stableStringify(value: unknown): string {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
    return `{${entries.join(',')}}`;
  }
  const payload = {
    sceneCode: pending.sceneCode ?? '',
    modules: pending.modules ?? null,
    schemaJson: pending.schemaJson ?? '',
    dependencies: pending.dependencies ?? {},
  };
  return {
    ...pending,
    sourceHash: createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 16),
  };
}

function refreshSourceMap(pending: PendingPlugin): { pending: PendingPlugin; sourceMap: SourceMap; diff: SourceMapDiff } {
  const previousMap = pending.sourceMap ?? null;
  const modules = getModules(pending);
  const sourceMap = deriveSourceMap(modules, {
    roleOverrides: pending.roleOverrides,
    pluginId: pending.pluginId,
  });
  const diff = diffSourceMaps(previousMap, sourceMap);
  return { pending: { ...pending, sourceMap }, sourceMap, diff };
}

function formatGuardFailure(guard: any): string {
  const parts: string[] = [];
  if (guard.missingRequirements?.length > 0) parts.push(`Missing hard requirement(s): ${guard.missingRequirements.join('; ')}`);
  if (guard.importIssues?.length > 0) parts.push(`Import issue(s): ${guard.importIssues.map((i: any) => `${i.file} imports ${i.specifier}: ${i.message}`).join('; ')}`);
  if (guard.visualIssues?.length > 0) parts.push(`Visual issue(s): ${guard.visualIssues.map((i: any) => `${i.file}: ${i.message}`).join('; ')}`);
  return parts.join('\n');
}

// ─── Tool: getSourceMap (RECON) ──────────────────────────────────────────────

export const getSourceMapTool = createTool({
  id: 'get-source-map',
  description:
    'RECON step. Produce a semantic source map of the current pending plugin: per-file role + exports + sections + imports + per-file hash, plus a symbol index and reverse data-field usage index. ' +
    'Call this BEFORE recordPluginPlan in modify mode (it is mandatory — the guard rejects plans without a recent recon event). ' +
    'In create mode, call this once after setInitialScene so subsequent edits can reference real files/symbols/line numbers. ' +
    'Returns the full source map plus a human-readable summary. The map is cached on pendingPlugin.sourceMap and refreshed automatically after every edit.',
  inputSchema: z.object({
    threadId: z.string(),
    refresh: z.boolean().optional().default(false).describe('Force re-derivation even if cached. Defaults to false (use cache).'),
  }),
  execute: async (inputData) => {
    const { threadId, refresh } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found. Call setInitialScene first.' };
    }

    let sourceMap: SourceMap;
    let diff: SourceMapDiff | null = null;
    if (refresh || !pending.sourceMap) {
      const refreshed = refreshSourceMap(pending);
      sourceMap = refreshed.sourceMap;
      diff = refreshed.diff;
      const nextPending = appendPluginLedgerEvent(
        { ...refreshed.pending, lastReconAt: new Date().toISOString() },
        {
          type: 'validation',
          summary: `Recon: ${sourceMap.files.length} files, ${sourceMap.symbols.length} symbols, ${sourceMap.dataFieldUsages.length} data-field usages. Overall hash ${sourceMap.overallHash}.`,
          warnings: diff ? `Added ${diff.added.length}, removed ${diff.removed.length}, changed ${diff.changed.length}` : undefined,
        },
      );
      await patchJobState(threadId, (s: any) => ({ ...s, pendingPlugin: nextPending }));
    } else {
      sourceMap = pending.sourceMap;
    }

    console.log(`[get-source-map] ✅ ${sourceMap.files.length} files, hash ${sourceMap.overallHash} for thread ${threadId.slice(0, 8)}`);
    return {
      ok: true as const,
      sourceMap,
      summary: summarizeSourceMap(sourceMap),
      diff: diff ?? null,
    };
  },
});

// ─── Tool: setFileRole ───────────────────────────────────────────────────────

export const setFileRoleTool = createTool({
  id: 'set-file-role',
  description:
    'Override the semantic role tag of a file in the source map (e.g. "hero reveal animation"). Use this when the agent-created file has a non-obvious purpose that filename/section heuristics got wrong. The role travels with the source map and helps future recon calls understand the file without re-reading it.',
  inputSchema: z.object({
    threadId: z.string(),
    filePath: z.string(),
    role: z.string().describe('Short semantic role, e.g. "MapLibre camera controller"'),
  }),
  execute: async (inputData) => {
    const { threadId, filePath, role } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    const roleOverrides = { ...(pending.roleOverrides ?? {}), [filePath]: role };
    const modules = getModules(pending);
    if (!modules[filePath]) {
      return { ok: false as const, error: `File "${filePath}" not found in plugin modules.` };
    }
    const sourceMap = deriveSourceMap(modules, { roleOverrides, pluginId: pending.pluginId });
    const nextPending = appendPluginLedgerEvent(
      { ...pending, roleOverrides, sourceMap },
      { type: 'edit', filePath, summary: `Set role for ${filePath}: "${role}".` },
    );
    await patchJobState(threadId, (s: any) => ({ ...s, pendingPlugin: nextPending }));
    return { ok: true as const, filePath, role };
  },
});

// ─── Tool: findSymbol ────────────────────────────────────────────────────────

export const findSymbolTool = createTool({
  id: 'find-symbol',
  description:
    'Find a symbol (function, const, type, interface, default export) by name across all plugin files. Returns file + line range + kind. Use this instead of readModule when you know the symbol name and just need to locate it.',
  inputSchema: z.object({
    threadId: z.string(),
    name: z.string().describe('Symbol name (exact match). Use listSymbols for discovery.'),
    kind: z.enum(['function', 'const', 'type', 'interface', 'default']).optional(),
  }),
  execute: async (inputData) => {
    const { threadId, name, kind } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending?.sourceMap) {
      return { ok: false as const, error: 'No source map available. Call getSourceMap first.' };
    }
    const matches = pending.sourceMap.symbols.filter((s) => {
      if (s.name !== name) return false;
      if (kind && s.kind !== kind) return false;
      return true;
    });
    return {
      ok: true as const,
      matches,
      count: matches.length,
    };
  },
});

// ─── Tool: listSymbols ───────────────────────────────────────────────────────

export const listSymbolsTool = createTool({
  id: 'list-symbols',
  description:
    'List all symbols across all plugin files. Returns name + file + line range + kind. Use this for discovery before findSymbol when you only have a partial idea of the name.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string().optional().describe('Restrict to one file'),
    kind: z.enum(['function', 'const', 'type', 'interface', 'default']).optional(),
  }),
  execute: async (inputData) => {
    const { threadId, file, kind } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending?.sourceMap) {
      return { ok: false as const, error: 'No source map available. Call getSourceMap first.' };
    }
    const matches = pending.sourceMap.symbols.filter((s) => {
      if (file && s.file !== file) return false;
      if (kind && s.kind !== kind) return false;
      return true;
    });
    return { ok: true as const, symbols: matches, count: matches.length };
  },
});

// ─── Tool: readLines ─────────────────────────────────────────────────────────

export const readLinesTool = createTool({
  id: 'read-lines',
  description:
    'Read a range of lines from a plugin file, with optional context padding. Use this when getSourceMap or findSymbol told you the line range and you only need that range — do NOT pull the whole file with readModule. ' +
    'Lines are 1-indexed and inclusive on both ends. Context adds N lines before startLine and after endLine.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    context: z.number().int().min(0).max(20).optional().default(0).describe('Extra lines of padding before and after the range'),
  }),
  execute: async (inputData) => {
    const { threadId, file, startLine, endLine, context } = inputData;
    if (endLine < startLine) {
      return { ok: false as const, error: 'endLine must be >= startLine' };
    }
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    const modules = getModules(pending);
    const code = modules[file];
    if (!code) {
      return { ok: false as const, error: `File "${file}" not found. Available: ${Object.keys(modules).join(', ')}` };
    }
    const lines = code.split('\n');
    const totalLines = lines.length;
    const padStart = Math.max(1, startLine - context);
    const padEnd = Math.min(totalLines, endLine + context);
    const selected = lines.slice(padStart - 1, padEnd).map((line, i) => ({
      line: padStart + i,
      text: line,
    }));
    return {
      ok: true as const,
      file,
      startLine: padStart,
      endLine: padEnd,
      totalLines,
      lines: selected,
    };
  },
});

// ─── Tool: searchInFile ──────────────────────────────────────────────────────

export const searchInFileTool = createTool({
  id: 'search-in-file',
  description:
    'Search for a pattern inside ONE file. Pattern is a regex string. Returns matching lines with N lines of context before/after. Use this when you need to find every place a particular identifier or pattern appears in one file.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string(),
    pattern: z.string().describe('JavaScript regex pattern (e.g. "useEffect\\(", "data\\.players")'),
    contextLines: z.number().int().min(0).max(10).optional().default(2),
  }),
  execute: async (inputData) => {
    const { threadId, file, pattern, contextLines } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    const modules = getModules(pending);
    const code = modules[file];
    if (!code) {
      return { ok: false as const, error: `File "${file}" not found. Available: ${Object.keys(modules).join(', ')}` };
    }
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (e: any) {
      return { ok: false as const, error: `Invalid regex pattern: ${e?.message}` };
    }
    const lines = code.split('\n');
    const matches: Array<{ line: number; lineText: string; before: string[]; after: string[] }> = [];
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        const before = lines.slice(Math.max(0, i - contextLines), i);
        const after = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines));
        matches.push({ line: i + 1, lineText: lines[i], before, after });
      }
      regex.lastIndex = 0;
    }
    return { ok: true as const, file, pattern, matches, count: matches.length };
  },
});

// ─── Tool: grepPlugin ────────────────────────────────────────────────────────

export const grepPluginTool = createTool({
  id: 'grep-plugin',
  description:
    'Cross-file search across the entire plugin. Pattern is a regex string. filePattern (optional) restricts to file paths matching a glob (e.g. "features/**"). Use this when you need every file:line that reads data.players, calls useEffect, or references a specific identifier.',
  inputSchema: z.object({
    threadId: z.string(),
    pattern: z.string(),
    filePattern: z.string().optional().describe('Glob filter for file paths, e.g. "features/**" or "*.tsx"'),
    contextLines: z.number().int().min(0).max(5).optional().default(0),
  }),
  execute: async (inputData) => {
    const { threadId, pattern, filePattern, contextLines } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    let regex: RegExp;
    try {
      regex = new RegExp(pattern);
    } catch (e: any) {
      return { ok: false as const, error: `Invalid regex pattern: ${e?.message}` };
    }
    let globRegex: RegExp | null = null;
    if (filePattern) {
      // Convert simple glob to regex. Supports * (segment) and ** (recursive).
      const re = filePattern
        .replace(/\./g, '\\.')
        .replace(/\*\*/g, '{{DOUBLE_STAR}}')
        .replace(/\*/g, '[^/]*')
        .replace(/\{\{DOUBLE_STAR\}\}/g, '.*');
      globRegex = new RegExp(`^${re}$`);
    }
    const modules = getModules(pending);
    const matches: Array<{ file: string; line: number; lineText: string; before: string[]; after: string[] }> = [];
    for (const [file, code] of Object.entries(modules)) {
      if (globRegex && !globRegex.test(file)) continue;
      const lines = code.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          const before = lines.slice(Math.max(0, i - contextLines), i);
          const after = lines.slice(i + 1, Math.min(lines.length, i + 1 + contextLines));
          matches.push({ file, line: i + 1, lineText: lines[i], before, after });
        }
        regex.lastIndex = 0;
      }
    }
    return { ok: true as const, pattern, matches, count: matches.length };
  },
});

// ─── Tool: findDataFieldUsages ───────────────────────────────────────────────

export const findDataFieldUsagesTool = createTool({
  id: 'find-data-field-usages',
  description:
    'Find every file:line that reads data.<field> for a given schema field name. CRITICAL for safe schema edits — call this BEFORE editing or renaming a schema field, so you know which code sites need to change in lockstep.',
  inputSchema: z.object({
    threadId: z.string(),
    field: z.string().describe('Schema field name (without data. prefix), e.g. "players" or "title"'),
  }),
  execute: async (inputData) => {
    const { threadId, field } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending?.sourceMap) {
      return { ok: false as const, error: 'No source map available. Call getSourceMap first.' };
    }
    const usages = pending.sourceMap.dataFieldUsages.filter((u) => u.field === field);
    // Group by file for readability
    const byFile: Record<string, Array<{ line: number; path: string; lineText: string }>> = {};
    for (const u of usages) {
      if (!byFile[u.file]) byFile[u.file] = [];
      byFile[u.file].push({ line: u.line, path: u.path, lineText: u.lineText });
    }
    return {
      ok: true as const,
      field,
      usages,
      byFile,
      count: usages.length,
      hint: usages.length === 0
        ? `No code reads data.${field}. Safe to remove from schema.`
        : `data.${field} is read at ${usages.length} site(s). Update them in lockstep if you rename/remove the field.`,
    };
  },
});

// ─── Tool: findAnchor — natural-language intent → best matching symbol ───────
//
// This is the SEMANTIC GREP tool. The agent describes what it wants to edit
// in natural language ("the spring config for the hero enter animation") and
// gets back the best-matching symbol + line range. It then calls readLines
// to verify and editLines to make the change.
//
// Backed by AST + per-symbol summaries + keyword matching. NO embeddings.
// This is the AST+summaries tier — gets ~70% of the value of embeddings at
// ~10% of the cost. Embeddings can slot in later by replacing scoreIntentMatch.

export const findAnchorTool = createTool({
  id: 'find-anchor',
  description:
    'Find the symbol + line range that best matches a natural-language intent. ' +
    'Use this as the PRIMARY anchor-finding tool when you know WHAT you want to edit (semantically) but not WHERE it is or what it is named. ' +
    'Examples: intent="the spring config for the hero enter animation" → returns the symbol + line range. intent="where the score gets flashed" → returns the symbol + line range. ' +
    'Backed by AST extraction (covers both exported AND internal/non-exported symbols) + per-symbol semantic summaries (reads, calls, Remotion APIs) + tokenized keyword matching. No embeddings. ' +
    'Returns top-K matches with scores; pick the best one, call readLines to verify, then editLines to make the change. ' +
    'If no matches, call listSymbols to see every available symbol and refine your intent.',
  inputSchema: z.object({
    threadId: z.string(),
    intent: z.string().describe('Natural-language description of what you want to find, e.g. "where the score gets flashed" or "the MapLibre camera setup"'),
    file: z.string().optional().describe('Restrict search to one file path'),
    topK: z.number().int().min(1).max(10).optional().default(3).describe('How many top matches to return'),
    minScore: z.number().min(0).max(1).optional().default(0.15).describe('Minimum match score (0..1). Below this, matches are filtered out.'),
  }),
  execute: async (inputData) => {
    const { threadId, intent, file, topK, minScore } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending?.sourceMap) {
      return { ok: false as const, error: 'No source map available. Call getSourceMap first.' };
    }

    const intentTokens = tokenize(intent);
    if (intentTokens.length === 0) {
      return {
        ok: false as const,
        error: 'Intent produced no searchable tokens (all stop words or too short). Be more specific — include the symbol\'s purpose, what data it reads, or what Remotion APIs it uses.',
        intent,
      };
    }

    const candidates: Array<{ symbol: SymbolIndexEntry; score: number }> = [];
    for (const symbol of pending.sourceMap.symbols) {
      if (file && symbol.file !== file) continue;
      const score = scoreIntentMatch(intentTokens, symbol);
      if (score >= minScore) {
        candidates.push({ symbol, score });
      }
    }

    candidates.sort((a, b) => b.score - a.score);
    const top = candidates.slice(0, topK);

    if (top.length === 0) {
      return {
        ok: true as const,
        intent,
        intentTokens,
        matches: [],
        count: 0,
        hint: 'No symbols matched. Try different keywords, or call listSymbols to see all available symbols.',
      };
    }

    return {
      ok: true as const,
      intent,
      intentTokens,
      matches: top.map((c) => ({
        name: c.symbol.name,
        kind: c.symbol.kind,
        exported: c.symbol.exported,
        file: c.symbol.file,
        lines: c.symbol.lines,
        summary: c.symbol.summary,
        reads: c.symbol.reads,
        calls: c.symbol.calls,
        score: Number(c.score.toFixed(3)),
      })),
      count: top.length,
      hint: `Call readLines({ file: "${top[0].symbol.file}", startLine: ${top[0].symbol.lines[0]}, endLine: ${top[0].symbol.lines[1]} }) to verify, then editLines to make the change.`,
    };
  },
});

// ─── Internal helper: apply a line-range replacement ─────────────────────────

interface ApplyLineEditArgs {
  threadId: string;
  file: string;
  startLine: number;  // 1-indexed, inclusive
  endLine: number;    // 1-indexed, inclusive
  newLines: string[]; // new content for that range
  description: string;
}

// Return type is permissive — error paths return extra diagnostic fields
// (hint, missingRequirements, importIssues, warnings) just like editSceneCode.
type LineEditResult =
  | { ok: true; result: any }
  | { ok: false; error: string; [extra: string]: any };

async function applyLineEdit(args: ApplyLineEditArgs): Promise<LineEditResult> {
  const { threadId, file, startLine, endLine, newLines, description } = args;
  if (startLine < 1 || endLine < startLine) {
    return { ok: false, error: `Invalid line range: startLine=${startLine}, endLine=${endLine}` };
  }
  const job = await getJob(threadId);
  const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
  if (!pending) {
    return { ok: false, error: 'No pending plugin found.' };
  }
  const isMulti = pending.modules && Object.keys(pending.modules).length > 1;
  const modules = getModules(pending);
  const code = modules[file];
  if (!code) {
    return {
      ok: false,
      error: `File "${file}" not found. Available: ${isMulti ? Object.keys(modules).join(', ') : 'Scene.tsx (single-file mode)'}`,
    };
  }

  const lines = code.split('\n');
  const totalLines = lines.length;
  if (endLine > totalLines) {
    return { ok: false, error: `endLine ${endLine} exceeds file length ${totalLines}.` };
  }

  const before = lines.slice(0, startLine - 1);
  const after = lines.slice(endLine);
  const updatedLines = [...before, ...newLines, ...after];
  const updatedCode = updatedLines.join('\n');

  // Source validation (same gate as editSceneCode)
  const candidateModules = { ...modules, [file]: updatedCode };
  const sourceCheck = validatePluginSource(candidateModules);
  if (!sourceCheck.ok) {
    const formatted = formatPluginSourceIssues(sourceCheck.issues);
    return {
      ok: false,
      error: `Edit would leave invalid plugin source:\n${formatted}`,
      hint: 'Use the Scene animation prop directly. Do not read animation from data or schema fields.',
    };
  }

  // Build the candidate pending plugin
  const candidatePending: PendingPlugin = {
    ...withPluginSourceFiles(pending, candidateModules),
    ast: deriveAST(candidateModules),
  };

  // Refresh source map so subsequent searches see the new state
  const refreshed = refreshSourceMap(candidatePending);

  // Guard
  const guard = validatePluginRunState(refreshed.pending);
  const hasCriticalErrors = guard.missingRequirements.length > 0 || guard.importIssues.length > 0;
  if (hasCriticalErrors) {
    return {
      ok: false,
      error: `Edit blocked by plugin guard:\n${formatGuardFailure(guard)}`,
      missingRequirements: guard.missingRequirements,
      importIssues: guard.importIssues,
      warnings: guard.warnings,
      hint: 'Make a smaller patch that preserves hard requirements and resolves every local import.',
    };
  }

  const nextPending = appendPluginLedgerEvent(withCurrentSourceHash(refreshed.pending as any), {
    type: 'edit',
    filePath: file,
    summary: `${description} (lines ${startLine}-${endLine} → ${newLines.length} line(s))`,
    changedChars: updatedCode.length - code.length,
    warnings: guard.warnings,
  });

  if (!await persistPluginSourceEdit(threadId, nextPending)) {
    return { ok: false, error: 'The edited source could not be verified in saved state. Re-read the file before retrying.' };
  }

  const linesDelta = newLines.length - (endLine - startLine + 1);
  console.log(`[line-edit] ✅ ${file} ${startLine}-${endLine} → ${newLines.length} line(s) (Δ${linesDelta >= 0 ? '+' : ''}${linesDelta}) for thread ${threadId.slice(0, 8)}`);

  return {
    ok: true,
    result: {
      file,
      replacedRange: { startLine, endLine },
      newRange: { startLine, endLine: startLine + newLines.length - 1 },
      linesDelta,
      warnings: guard.warnings,
      sourceMapDiff: refreshed.diff,
      message: `${file} updated.`,
    },
  };
}

// ─── Tool: editLines ─────────────────────────────────────────────────────────

export const editLinesTool = createTool({
  id: 'edit-lines',
  description:
    'Replace a range of lines in a plugin file with new content. Deterministic — no string matching, no uniqueness requirement. Use this as the DEFAULT edit tool. Always call getSourceMap/readLines first to know the exact line range. ' +
    'Lines are 1-indexed and inclusive on both ends. newLines replaces lines startLine..endLine verbatim.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    newLines: z.array(z.string()).describe('New content (array of lines, no trailing newline). Pass [] to delete the range.'),
  }),
  execute: async (inputData) => {
    const result = await applyLineEdit({
      threadId: inputData.threadId,
      file: inputData.file,
      startLine: inputData.startLine,
      endLine: inputData.endLine,
      newLines: inputData.newLines,
      description: 'editLines',
    });
    if (!result.ok) return result;
    return { ok: true as const, ...result.result };
  },
});

// ─── Tool: insertAt ──────────────────────────────────────────────────────────

export const insertAtTool = createTool({
  id: 'insert-at',
  description:
    'Insert new content AFTER a given line in a plugin file. Use this to add a new function, a new export, a new import, etc. — without needing to anchor on existing text. Pass afterLine=0 to insert at the top of the file.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string(),
    afterLine: z.number().int().min(0).describe('Insert AFTER this line. Use 0 to insert at the top of the file.'),
    content: z.string().describe('Content to insert (may be multi-line — use \\n)'),
  }),
  execute: async (inputData) => {
    const { threadId, file, afterLine, content } = inputData;
    const newLines = content.split('\n');
    // Insert: replace the empty range [afterLine+1, afterLine] with newLines
    const result = await applyLineEdit({
      threadId,
      file,
      startLine: afterLine + 1,
      endLine: afterLine,
      newLines,
      description: `insertAt(afterLine=${afterLine})`,
    });
    if (!result.ok) return result;
    return { ok: true as const, ...result.result };
  },
});

// ─── Tool: deleteLines ───────────────────────────────────────────────────────

export const deleteLinesTool = createTool({
  id: 'delete-lines',
  description:
    'Delete a range of lines from a plugin file. Equivalent to editLines with newLines=[]. Use this for removing dead code, unused imports, or stale helpers.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
  }),
  execute: async (inputData) => {
    const result = await applyLineEdit({
      threadId: inputData.threadId,
      file: inputData.file,
      startLine: inputData.startLine,
      endLine: inputData.endLine,
      newLines: [],
      description: 'deleteLines',
    });
    if (!result.ok) return result;
    return { ok: true as const, ...result.result };
  },
});

// ─── Tool: previewEdit (diff-only, no commit) ────────────────────────────────

export const previewEditTool = createTool({
  id: 'preview-edit',
  description:
    'Preview what an editLines / insertAt / deleteLines call WOULD do, without committing it. Returns a unified diff plus a validation flag (would the resulting code pass source validation + guard?). Use this for risky changes — verify intent before mutating state.',
  inputSchema: z.object({
    threadId: z.string(),
    file: z.string(),
    startLine: z.number().int().min(1),
    endLine: z.number().int().min(1),
    newLines: z.array(z.string()),
  }),
  execute: async (inputData) => {
    const { threadId, file, startLine, endLine, newLines } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin as PendingPlugin | undefined;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    const modules = getModules(pending);
    const code = modules[file];
    if (!code) {
      return { ok: false as const, error: `File "${file}" not found.` };
    }
    const lines = code.split('\n');
    if (endLine > lines.length) {
      return { ok: false as const, error: `endLine ${endLine} exceeds file length ${lines.length}.` };
    }

    const before = lines.slice(0, startLine - 1);
    const after = lines.slice(endLine);
    const updatedLines = [...before, ...newLines, ...after];
    const updatedCode = updatedLines.join('\n');

    // Build unified diff
    const diff: string[] = [];
    diff.push(`--- a/${file}`);
    diff.push(`+++ b/${file}`);
    // Group changes — simplified unified format
    const oldRange = lines.slice(startLine - 1, endLine);
    diff.push(`@@ -${startLine},${oldRange.length} +${startLine},${newLines.length} @@`);
    for (const line of oldRange) diff.push(`-${line}`);
    for (const line of newLines) diff.push(`+${line}`);

    // Validate
    const candidateModules = { ...modules, [file]: updatedCode };
    const sourceCheck = validatePluginSource(candidateModules);
    const candidatePending = withPluginSourceFiles(pending, candidateModules);
    const refreshed = refreshSourceMap(candidatePending);
    const guard = validatePluginRunState(refreshed.pending);

    return {
      ok: true as const,
      diff: diff.join('\n'),
      wouldPassValidation: sourceCheck.ok && guard.ok,
      sourceValidation: sourceCheck.ok
        ? { ok: true }
        : { ok: false, issues: sourceCheck.issues.map((i: any) => `${i.file}:${i.line} ${i.message}`) },
      guard: {
        ok: guard.ok,
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        visualIssues: guard.visualIssues,
        warnings: guard.warnings,
      },
      hint: sourceCheck.ok && guard.ok
        ? 'Safe to apply. Call editLines with the same args to commit.'
        : 'Edit would fail validation. Adjust the new content or fix the underlying issue first.',
    };
  },
});

// ─── Toolbox bundle ──────────────────────────────────────────────────────────

export const sourceMapTools = {
  getSourceMap: getSourceMapTool,
  setFileRole: setFileRoleTool,
  findAnchor: findAnchorTool,            // ← NEW: semantic grep by intent
  findSymbol: findSymbolTool,
  listSymbols: listSymbolsTool,
  readLines: readLinesTool,
  searchInFile: searchInFileTool,
  grepPlugin: grepPluginTool,
  findDataFieldUsages: findDataFieldUsagesTool,
  editLines: editLinesTool,
  insertAt: insertAtTool,
  deleteLines: deleteLinesTool,
  previewEdit: previewEditTool,
};
