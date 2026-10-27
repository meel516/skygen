import { createHash } from 'crypto';
import {
  deriveAST,
  type PluginAST,
  type FileAST,
  type ExportInfo,
} from '../tools/code-ast';

// ============================================================================
// SOURCE MAP — semantic tree view of a plugin's source code
//
// The source map is the orchestrator's RECON artifact. It is produced BEFORE
// planning in modify mode (and recommended in create mode once a skeleton
// exists) so the planner can reference real files, real symbols, real line
// ranges, and real data-field usages instead of guessing.
//
// Components:
//   - FileSummary: per-file role + exports + sections + imports + hash
//   - SymbolIndex: name → file + line range + SUMMARY + reads + calls + tokens
//                  (covers BOTH exported and internal/non-exported symbols)
//   - DataFieldUsages: reverse index from data.<field> → every read site
//   - PerFileHashes: file content hash for diff-aware recompilation
//
// Per-symbol summaries are derived deterministically from the AST + source
// text — no LLM call, no embeddings. The summary captures:
//   - kind (function/const/type/interface)
//   - data.<field> reads (extracted via regex)
//   - Remotion API calls (useCurrentFrame, interpolate, spring, ...)
//   - other internal calls (capped at 5)
// The tokens field pre-tokenizes name + summary + reads + calls + file role
// for fast intent matching in findAnchor.
//
// The source map is cached on pendingPlugin.sourceMap and re-derived
// whenever any file changes. Each FileSummary.hash is independent so callers
// can answer "did this file change?" without re-hashing everything.
// ============================================================================

export interface FileSummary {
  path: string;
  totalLines: number;
  /** Semantic role, e.g. "hero reveal animation" or "MapLibre camera controller" */
  role: string;
  /** How the role was derived — 'agent' means explicitly set via setFileRole */
  roleSource: 'jsdoc' | 'section' | 'filename' | 'agent' | 'unknown';
  exports: ExportInfo[];
  sections: { name: string; lines: [number, number] }[];
  imports: { specifier: string; kind: 'local' | 'external'; resolved?: string; line: number }[];
  /** sha256(fileContent).slice(0,16) — for diff tracking */
  hash: string;
}

/**
 * Symbol kind — extended beyond ExportInfo['type'] to include non-exported
 * ("internal") symbols that extractExports in code-ast.ts misses. This matters
 * because findAnchor often needs to locate internal helpers like `useSpringIn`
 * that aren't exported from their module.
 */
export type SymbolKind =
  | ExportInfo['type']              // 'function' | 'const' | 'type' | 'interface' | 'default'
  | 'internal-function'             // function Name(...) {} — no export
  | 'internal-const'                // const/let/var Name = ... — no export
  | 'internal-class';               // class Name { ... } — no export

export interface SymbolIndexEntry {
  name: string;
  kind: SymbolKind;
  file: string;
  lines: [number, number];

  // ─── NEW: semantic context for intent matching ───────────────────────
  /** True if this symbol is exported (was in the original AST). False for internal. */
  exported: boolean;
  /** Deterministic one-line summary, e.g. "function useScoreFlash; reads [homeScore, awayScore]; remotion [spring, interpolate]" */
  summary: string;
  /** sha256(symbolSourceText).slice(0,16) — changes when the symbol's body changes */
  sourceHash: string;
  /** data.<field> names read inside this symbol's body */
  reads: string[];
  /** Function/symbol names called inside this symbol's body (includes Remotion APIs) */
  calls: string[];
  /** Pre-tokenized name + summary + reads + calls + file role, for fast intent matching */
  tokens: string[];
}

export interface DataFieldUsage {
  /** Field name without `data.` prefix, e.g. "players" */
  field: string;
  /** Full access path as it appears in code, e.g. "data.players[0].name" */
  path: string;
  file: string;
  line: number;
  lineText: string;
}

export interface SourceMap {
  version: 1;
  pluginId: string;
  generatedAt: string;
  files: FileSummary[];
  symbols: SymbolIndexEntry[];
  dataFieldUsages: DataFieldUsage[];
  /** file path → hash, mirroring files[].hash for fast lookup */
  perFileHashes: Record<string, string>;
  /** Top-level hash of all files combined, for "did anything change?" checks */
  overallHash: string;
}

// ─── Role extraction ────────────────────────────────────────────────────────

const FILENAME_ROLE_HINTS: Array<{ pattern: RegExp; role: string }> = [
  { pattern: /^Scene\.tsx$/, role: 'composition root' },
  { pattern: /theme\./i, role: 'theme tokens (colors, fonts, spacing)' },
  { pattern: /animations?\./i, role: 'animation timeline helpers' },
  { pattern: /components?\./i, role: 'shared sub-components' },
  { pattern: /layout\./i, role: 'positioning / AbsoluteFill structure' },
  { pattern: /utils?\./i, role: 'utility helpers' },
  { pattern: /map/i, role: 'map / geographic layer' },
  { pattern: /chart/i, role: 'chart / data visualization' },
  { pattern: /camera/i, role: 'camera controller' },
  { pattern: /particle/i, role: 'particle system' },
];

function extractRoleFromJSDoc(code: string): string | null {
  // Match: /** @role hero reveal animation */ or // @role: hero reveal animation
  const m = code.match(/(?:\/\*\*?|\/\/)\s*@role\s*[:\s]\s*([^\n*]+)/);
  return m ? m[1].trim() : null;
}

function extractRoleFromFirstSection(fileAst: FileAST): string | null {
  if (fileAst.sections.length === 0) return null;
  return fileAst.sections[0].name;
}

function deriveRoleFromFilename(filePath: string): string {
  for (const hint of FILENAME_ROLE_HINTS) {
    if (hint.pattern.test(filePath)) return hint.role;
  }
  const base = filePath.split('/').pop() ?? filePath;
  return `module (${base})`;
}

function deriveFileRole(filePath: string, code: string, fileAst: FileAST): { role: string; roleSource: FileSummary['roleSource'] } {
  const jsdoc = extractRoleFromJSDoc(code);
  if (jsdoc) return { role: jsdoc, roleSource: 'jsdoc' };

  const section = extractRoleFromFirstSection(fileAst);
  if (section) return { role: section, roleSource: 'section' };

  return { role: deriveRoleFromFilename(filePath), roleSource: 'filename' };
}

// ─── Per-file hash ──────────────────────────────────────────────────────────

function hashFile(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

function hashOverall(entries: Array<{ path: string; hash: string }>): string {
  const stable = entries
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((e) => `${e.path}:${e.hash}`)
    .join('|');
  return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

// ─── Import resolution (mirrors plugin-run-ledger logic but lighter) ─────────

function classifyImport(specifier: string): 'local' | 'external' {
  return specifier.startsWith('.') || specifier.startsWith('/') ? 'local' : 'external';
}

const IMPORT_LINE_REGEX = /^\s*import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/;

function extractImportsWithLines(code: string): { specifier: string; line: number }[] {
  const out: { specifier: string; line: number }[] = [];
  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(IMPORT_LINE_REGEX);
    if (m && m[1]) out.push({ specifier: m[1], line: i + 1 });
  }
  return out;
}

function resolveLocalPath(fromFile: string, specifier: string, modulePaths: Set<string>): string | undefined {
  const baseDir = fromFile.includes('/') ? fromFile.slice(0, fromFile.lastIndexOf('/')) : '';
  const join = (a: string, b: string) => (a ? `${a}/${b}` : b);
  const candidates: string[] = [];
  const parts = (baseDir ? join(baseDir, specifier) : specifier).split('/');
  const cleaned: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') { cleaned.pop(); continue; }
    cleaned.push(p);
  }
  const base = cleaned.join('/');
  for (const ext of ['', '.ts', '.tsx', '.js', '.jsx']) {
    candidates.push(`${base}${ext}`);
  }
  for (const ext of ['.ts', '.tsx', '.js', '.jsx']) {
    candidates.push(`${base}/index${ext}`);
  }
  return candidates.find((c) => modulePaths.has(c));
}

// ─── Data field usage extraction ─────────────────────────────────────────────

/**
 * Scan every module for `data.<field>` access patterns and return one entry
 * per occurrence. This is the reverse index the planner uses to answer
 * "if I rename `players` to `athletes`, which files/lines break?"
 */
function extractDataFieldUsages(modules: Record<string, string>): DataFieldUsage[] {
  const usages: DataFieldUsage[] = [];
  // Match data.<identifier> with optional chained access. Capture the first identifier.
  // We deliberately keep this conservative — false negatives are fine, false positives are not.
  const pattern = /\bdata\.([A-Za-z_$][A-Za-z0-9_$]*)/g;

  for (const [file, code] of Object.entries(modules)) {
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let m: RegExpExecArray | null;
      pattern.lastIndex = 0;
      while ((m = pattern.exec(line)) !== null) {
        const field = m[1];
        // Capture the surrounding access path, e.g. "data.players[0].name"
        const after = line.slice(m.index);
        const pathMatch = after.match(/^data\.[A-Za-z_$][A-Za-z0-9_$]*(?:\[[^\]]*\]|\.[A-Za-z_$][A-Za-z0-9_$]*)*/);
        usages.push({
          field,
          path: pathMatch ? pathMatch[0] : `data.${field}`,
          file,
          line: i + 1,
          lineText: line.trim(),
        });
      }
    }
  }

  return usages;
}

// ─── Internal (non-exported) symbol extraction ───────────────────────────────
//
// extractExports in code-ast.ts only catches `export function/const/type/...`.
// For findAnchor to be useful, we also need to locate INTERNAL helpers like
// `function useSpringIn()` or `const HERO_THEME = {...}` that aren't exported
// from their module. This walker finds them.
//
// The heuristic is line-regex based, mirroring extractExports' style. We
// deliberately skip:
//   - lines inside JSX (heuristic: line starts with `<` or contains `=>` near JSX)
//   - lines that are property accesses (e.g. `obj.method = ...`)
//   - lines that are object/array element assignments
// This catches the vast majority of top-level internal declarations without
// false positives. Edge cases (deeply nested helpers) may be missed — that's
// acceptable, they're rare in Remotion plugin code.

interface InternalSymbol {
  name: string;
  kind: 'internal-function' | 'internal-const' | 'internal-class';
  lines: [number, number];
}

const KEYWORDS = new Set([
  'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue',
  'return', 'function', 'class', 'interface', 'type', 'enum', 'namespace',
  'import', 'export', 'from', 'default', 'try', 'catch', 'finally', 'throw',
  'new', 'delete', 'typeof', 'instanceof', 'in', 'of', 'this', 'super',
  'extends', 'implements', 'static', 'public', 'private', 'protected',
  'readonly', 'async', 'await', 'yield', 'void', 'null', 'undefined',
  'true', 'false', 'const', 'let', 'var',
]);

function extractInternalSymbols(code: string, exportedNames: Set<string>): InternalSymbol[] {
  const lines = code.split('\n');
  const out: InternalSymbol[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip JSX lines (heuristic)
    if (/^[<(]/.test(trimmed) || /=>\s*[<(]/.test(trimmed)) continue;
    // Skip property assignments (obj.foo = ...)
    if (/^[A-Za-z_$][\w$]*\./.test(trimmed) && trimmed.includes('=')) continue;
    // Skip comment lines
    if (/^\s*(\/\/|\/\*|\*)/.test(line)) continue;

    // function Name(...) — no `export` prefix
    let m = line.match(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*[\(<]/);
    if (m && !exportedNames.has(m[1]) && !KEYWORDS.has(m[1])) {
      const end = findFunctionEnd(lines, i);
      out.push({ name: m[1], kind: 'internal-function', lines: [i + 1, end + 1] });
      continue;
    }

    // const/let/var Name = ... (arrow function OR object OR primitive)
    // Must be at line start (allowing whitespace), not inside a destructure.
    m = line.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/);
    if (m && !exportedNames.has(m[1]) && !KEYWORDS.has(m[1])) {
      // Skip destructuring: const { a, b } = ...
      if (line.match(/^(?:export\s+)?(?:const|let|var)\s*\{/)) continue;
      // Skip array destructuring: const [a, b] = ...
      if (line.match(/^(?:export\s+)?(?:const|let|var)\s*\[/)) continue;
      // Only treat as symbol if it looks like a function/object/class instance,
      // not a primitive used inline. We accept anything that's not a simple
      // primitive (number/string/boolean literal) — those are usually config
      // values worth indexing too.
      const end = findConstEnd(lines, i);
      out.push({ name: m[1], kind: 'internal-const', lines: [i + 1, end + 1] });
      continue;
    }

    // class Name { ... } — no `export` prefix
    m = line.match(/^class\s+([A-Za-z_$][\w$]*)/);
    if (m && !exportedNames.has(m[1]) && !KEYWORDS.has(m[1])) {
      const end = findBlockEnd(lines, i);
      out.push({ name: m[1], kind: 'internal-class', lines: [i + 1, end + 1] });
      continue;
    }
  }

  return out;
}

// We need findFunctionEnd / findConstEnd / findBlockEnd here too. code-ast.ts
// has them but doesn't export them, so we re-implement locally.
function findFunctionEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth === 0) return i;
  }
  return lines.length - 1;
}

function findConstEnd(lines: string[], startLine: number): number {
  const line = lines[startLine];
  if (line.includes('=>') && line.includes('{')) {
    return findFunctionEnd(lines, startLine);
  }
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].trimEnd().endsWith(';')) return i;
  }
  return startLine;
}

function findBlockEnd(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') { depth++; foundOpen = true; }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth === 0) return i;
  }
  for (let i = startLine; i < lines.length; i++) {
    if (lines[i].includes(';')) return i;
  }
  return lines.length - 1;
}

// ─── Per-symbol summary derivation (deterministic, no LLM) ───────────────────
//
// For each symbol we extract from its source text:
//   - data.<field> reads (regex)
//   - Remotion API calls (regex against known set)
//   - Other function calls (regex, minus keywords)
// These are combined into a one-line summary the agent can scan.
//
// The summary is NOT a natural-language description — it's a structured
// string of facts. This keeps it deterministic and token-cheap. The agent
// (or the findAnchor tool's tokenization) does the semantic matching.

const REMOTION_APIS = [
  'useCurrentFrame', 'useVideoConfig', 'interpolate', 'spring', 'Easing',
  'AbsoluteFill', 'Sequence', 'Audio', 'Img', 'Video', 'Composition',
  'delayRender', 'continueRender', 'prefetch', 'random', 'staticFile',
];

const REACT_APIS = [
  'useState', 'useEffect', 'useRef', 'useMemo', 'useCallback',
  'useReducer', 'useContext', 'useLayoutEffect',
];

const JS_BUILTINS = new Set([
  'Math', 'Date', 'JSON', 'Object', 'Array', 'String', 'Number', 'Boolean',
  'Promise', 'Map', 'Set', 'Symbol', 'Reflect', 'Proxy', 'console',
  'parseInt', 'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval',
  'clearTimeout', 'clearInterval', 'encodeURI', 'decodeURI',
  'encodeURIComponent', 'decodeURIComponent',
]);

interface DerivedSummary {
  summary: string;
  reads: string[];
  calls: string[];
}

function deriveSymbolSummary(
  name: string,
  kind: SymbolKind,
  sourceText: string,
): DerivedSummary {
  // ─── Extract data.<field> reads ──────────────────────────────────────
  const reads: string[] = [];
  const readPattern = /\bdata\.([A-Za-z_$][A-Za-z0-9_$]*)/g;
  let m: RegExpExecArray | null;
  while ((m = readPattern.exec(sourceText)) !== null) {
    if (!reads.includes(m[1])) reads.push(m[1]);
  }

  // ─── Extract Remotion + React API calls ──────────────────────────────
  const frameworkCalls: string[] = [];
  for (const api of [...REMOTION_APIS, ...REACT_APIS]) {
    const pattern = new RegExp(`\\b${api}\\b`);
    if (pattern.test(sourceText) && !frameworkCalls.includes(api)) {
      frameworkCalls.push(api);
    }
  }

  // ─── Extract other function calls (custom helpers, etc.) ─────────────
  const otherCalls: string[] = [];
  const callPattern = /\b([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
  while ((m = callPattern.exec(sourceText)) !== null) {
    const callee = m[1];
    if (KEYWORDS.has(callee)) continue;
    if (JS_BUILTINS.has(callee)) continue;
    if (frameworkCalls.includes(callee)) continue;
    if (callee === name) continue;  // self-recursion, not interesting
    if (!otherCalls.includes(callee)) otherCalls.push(callee);
  }

  // ─── Build summary string ────────────────────────────────────────────
  const parts: string[] = [`${kind} ${name}`];
  if (reads.length > 0) parts.push(`reads [${reads.join(', ')}]`);
  if (frameworkCalls.length > 0) parts.push(`remotion/react [${frameworkCalls.join(', ')}]`);
  if (otherCalls.length > 0) parts.push(`calls [${otherCalls.slice(0, 5).join(', ')}${otherCalls.length > 5 ? ', …' : ''}]`);

  return {
    summary: parts.join('; '),
    reads,
    calls: [...frameworkCalls, ...otherCalls],
  };
}

// ─── Tokenization + intent matching ──────────────────────────────────────────
//
// Tokenize splits any text (symbol name, summary, file role, or user intent)
// into normalized tokens. We split on:
//   - whitespace
//   - camelCase boundaries (useSpringIn → use, spring, in)
//   - snake_case boundaries
//   - kebab-case boundaries
//   - punctuation
// Then lowercase + strip simple plurals + remove stop words.

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'of', 'to', 'is', 'are', 'was', 'were',
  'where', 'what', 'which', 'who', 'whom', 'find', 'show', 'get',
  'give', 'me', 'my', 'i', 'want', 'need', 'this', 'that', 'these',
  'those', 'and', 'or', 'but', 'in', 'on', 'at', 'by', 'with',
  'from', 'as', 'into', 'about', 'how', 'why', 'when', 'it', 'its',
  'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'should', 'could', 'can', 'may', 'might', 'must',
  'use', 'using', 'used',  // "use" appears in hook names but is noise in intent
  'go', 'going', 'gone',
]);

export function tokenize(text: string): string[] {
  const tokens = text
    // Split camelCase boundaries: useSpringIn → use Spring In
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Split snake_case and kebab-case: use_spring_in / use-spring-in → use spring in
    .replace(/[_\-]/g, ' ')
    // Split on any non-alphanumeric
    .split(/[^a-zA-Z0-9]+/)
    .map((t) => t.toLowerCase())
    // Simple morphology: strip plural -s and past-tense -ed so intent matches
    // symbol names. "animations" → "animation", "flashed" → "flash",
    // "config" stays "config" (length 6, ends with 'g', no -s/-ed).
    .map((t) => {
      if (t.length > 4 && t.endsWith('ed')) return t.slice(0, -2);
      if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss')) return t.slice(0, -1);
      return t;
    })
    .filter((t) => t.length > 1 && !STOP_WORDS.has(t));

  return [...new Set(tokens)];
}

/**
 * Score how well a symbol matches an intent.
 *
 * Uses a weighted F-score-like metric:
 *   recall = matchedIntentTokens / totalIntentTokens    (how much of intent is covered)
 *   precision = matchedSymbolTokens / totalSymbolTokens  (how focused the symbol is)
 *
 * Recall is weighted higher (0.7) — we'd rather find a symbol that covers
 * all the intent keywords even if it also has extra noise, than a tiny symbol
 * that only matches one keyword perfectly.
 *
 * Returns 0..1.
 */
export function scoreIntentMatch(
  intentTokens: string[],
  symbol: Pick<SymbolIndexEntry, 'tokens'>,
): number {
  if (intentTokens.length === 0) return 0;
  if (symbol.tokens.length === 0) return 0;

  const symbolTokenSet = new Set(symbol.tokens);
  let matched = 0;
  for (const t of intentTokens) {
    if (symbolTokenSet.has(t)) matched++;
  }
  if (matched === 0) return 0;

  const recall = matched / intentTokens.length;
  const precision = matched / symbolTokenSet.size;

  // F1-style: recall weighted higher
  return recall * 0.7 + precision * 0.3;
}

/**
 * Build the pre-tokenized set for a symbol: name + summary + reads + calls +
 * the parent file's role. Including the file role gives every symbol in
 * (e.g.) an "animations" file a small bonus for intent tokens like "animation"
 * or "spring" — usually correct, since helpers in animation files tend to be
 * animation-related.
 */
function buildSymbolTokens(
  symbol: { name: string; summary: string; reads: string[]; calls: string[] },
  fileRole: string,
): string[] {
  const raw = [
    symbol.name,
    symbol.summary,
    symbol.reads.join(' '),
    symbol.calls.join(' '),
    fileRole,
  ].join(' ');
  return tokenize(raw);
}

// ─── Main entry ─────────────────────────────────────────────────────────────

export interface DeriveSourceMapOptions {
  /** Optional agent-supplied role overrides: { "features/hero/index.tsx": "hero reveal" } */
  roleOverrides?: Record<string, string>;
  /** Plugin id from pendingPlugin.pluginId */
  pluginId?: string;
}

export function deriveSourceMap(
  modules: Record<string, string>,
  options: DeriveSourceMapOptions = {},
): SourceMap {
  const ast: PluginAST = deriveAST(modules);
  const modulePaths = new Set(Object.keys(modules));
  const files: FileSummary[] = [];
  const symbols: SymbolIndexEntry[] = [];
  const perFileHashes: Record<string, string> = {};

  for (const [path, code] of Object.entries(modules)) {
    const fileAst = ast.files[path];
    if (!fileAst) continue;

    const roleOverride = options.roleOverrides?.[path];
    const roleInfo = roleOverride
      ? { role: roleOverride, roleSource: 'agent' as const }
      : deriveFileRole(path, code, fileAst);

    const imports = extractImportsWithLines(code).map(({ specifier, line }) => {
      const kind = classifyImport(specifier);
      const resolved = kind === 'local' ? resolveLocalPath(path, specifier, modulePaths) : undefined;
      return { specifier, kind, resolved, line };
    });

    const hash = hashFile(code);
    perFileHashes[path] = hash;

    files.push({
      path,
      totalLines: fileAst.totalLines,
      role: roleInfo.role,
      roleSource: roleInfo.roleSource,
      exports: fileAst.exports,
      sections: fileAst.sections,
      imports,
      hash,
    });

    // ─── Build symbol index: exported symbols + internal (non-exported) ──
    const lines = code.split('\n');
    const exportedNames: Set<string> = new Set(fileAst.exports.map((e: ExportInfo) => e.name));

    // Exported symbols (from AST)
    for (const exp of fileAst.exports) {
      const sourceText = lines.slice(exp.lines[0] - 1, exp.lines[1]).join('\n');
      const derived = deriveSymbolSummary(exp.name, exp.type, sourceText);
      const sourceHash = hashFile(sourceText);
      const tokens = buildSymbolTokens(
        { name: exp.name, summary: derived.summary, reads: derived.reads, calls: derived.calls },
        roleInfo.role,
      );
      symbols.push({
        name: exp.name,
        kind: exp.type,
        file: path,
        lines: exp.lines,
        exported: true,
        summary: derived.summary,
        sourceHash,
        reads: derived.reads,
        calls: derived.calls,
        tokens,
      });
    }

    // Internal (non-exported) symbols
    const internalSymbols = extractInternalSymbols(code, exportedNames);
    for (const internal of internalSymbols) {
      const sourceText = lines.slice(internal.lines[0] - 1, internal.lines[1]).join('\n');
      const derived = deriveSymbolSummary(internal.name, internal.kind, sourceText);
      const sourceHash = hashFile(sourceText);
      const tokens = buildSymbolTokens(
        { name: internal.name, summary: derived.summary, reads: derived.reads, calls: derived.calls },
        roleInfo.role,
      );
      symbols.push({
        name: internal.name,
        kind: internal.kind,
        file: path,
        lines: internal.lines,
        exported: false,
        summary: derived.summary,
        sourceHash,
        reads: derived.reads,
        calls: derived.calls,
        tokens,
      });
    }
  }

  const overallHash = hashOverall(files.map((f) => ({ path: f.path, hash: f.hash })));
  const dataFieldUsages = extractDataFieldUsages(modules);

  return {
    version: 1,
    pluginId: options.pluginId ?? 'unknown',
    generatedAt: new Date().toISOString(),
    files,
    symbols,
    dataFieldUsages,
    perFileHashes,
    overallHash,
  };
}

// ─── Diff helpers ────────────────────────────────────────────────────────────

export interface SourceMapDiff {
  added: string[];
  removed: string[];
  changed: string[];   // path present in both, hash differs
  unchanged: string[];
}

export function diffSourceMaps(before: SourceMap | null, after: SourceMap): SourceMapDiff {
  if (!before) {
    return {
      added: after.files.map((f) => f.path),
      removed: [],
      changed: [],
      unchanged: [],
    };
  }

  const beforeHashes = before.perFileHashes;
  const afterHashes = after.perFileHashes;
  const beforePaths = new Set(Object.keys(beforeHashes));
  const afterPaths = new Set(Object.keys(afterHashes));

  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  const unchanged: string[] = [];

  for (const p of afterPaths) {
    if (!beforePaths.has(p)) added.push(p);
    else if (beforeHashes[p] !== afterHashes[p]) changed.push(p);
    else unchanged.push(p);
  }
  for (const p of beforePaths) {
    if (!afterPaths.has(p)) removed.push(p);
  }

  return { added, removed, changed, unchanged };
}

// ─── Pretty-printers for the agent ───────────────────────────────────────────

export function summarizeSourceMap(sm: SourceMap): string {
  const lines: string[] = [];
  lines.push(`SOURCE MAP (overall ${sm.overallHash}, ${sm.files.length} file(s), ${sm.symbols.length} symbol(s), ${sm.dataFieldUsages.length} data-field usage(s))`);
  for (const f of sm.files) {
    const exportNames = f.exports.map((e) => `${e.name}${e.kind === 'default' ? '(default)' : ''}`).join(', ') || '—';
    const unresolved = f.imports.filter((i) => i.kind === 'local' && !i.resolved);
    lines.push(`  • ${f.path} [${f.hash}] (${f.totalLines} lines) — ${f.role}`);
    lines.push(`    exports: ${exportNames}`);
    if (unresolved.length > 0) {
      lines.push(`    ⚠ unresolved local imports: ${unresolved.map((u) => u.specifier).join(', ')}`);
    }
    // Per-symbol summaries (truncated to first 8 per file to keep output readable)
    const fileSymbols = sm.symbols.filter((s) => s.file === f.path);
    if (fileSymbols.length > 0) {
      const shown = fileSymbols.slice(0, 8);
      for (const s of shown) {
        const expTag = s.exported ? '' : ' (internal)';
        lines.push(`    – ${s.name}${expTag} [${s.kind}] L${s.lines[0]}-${s.lines[1]}: ${s.summary}`);
      }
      if (fileSymbols.length > 8) {
        lines.push(`    … and ${fileSymbols.length - 8} more symbol(s)`);
      }
    }
  }
  if (sm.dataFieldUsages.length > 0) {
    const byField = new Map<string, number>();
    for (const u of sm.dataFieldUsages) {
      byField.set(u.field, (byField.get(u.field) ?? 0) + 1);
    }
    const fieldSummary = [...byField.entries()].map(([f, c]) => `${f}(${c})`).join(', ');
    lines.push(`  data fields read: ${fieldSummary}`);
  }
  return lines.join('\n');
}
