import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createHash } from 'crypto';
import { createPluginFromSource } from '@/lib/plugins/create-plugin';
import { bundlePreview } from '@/lib/plugins/preview-bundler';
import { formatDependencyPolicyChanges, normalizePluginDependencies } from '@/lib/plugins/dependency-policy';
import {
  formatPluginSourceIssues,
  validatePluginSchemaReservedFields,
  validatePluginSource,
} from '@/lib/plugins/source-validation';
import { patchJobState, getJob } from '@/lib/mcp/wizard-jobs';
import { deriveAST, type PluginAST, type FileAST } from './code-ast';
import { isMultiFile } from './module-bundler';
import { getPluginSourceFiles, withPluginSourceFiles, persistPluginSourceEdit } from './plugin-source-state';
import {
  appendPluginLedgerEvent,
  attachPluginExecutionState,
  createPluginExecutionState,
  createPluginRunLedger,
  summarizePluginExecution,
  updatePluginExecutionStep,
  validatePluginRunState,
  type PluginGuardResult,
  type PluginStepIssue,
  type PluginWorkCategory,
} from './plugin-run-ledger';
import { sourceMapTools } from './source-map-tools';
import { recordPlanDeviationTool } from './plan-deviation';
import { loadForkedPluginSourceTool } from './load-forked-plugin-source';

// ============================================================================
// PLUGIN CREATOR — ReAct AGENT TOOLBOX
//
// Composable tools the specialist agents use freely in any order:
//
//   setInitialScene  — emit schema + scene code in one call (CREATE)
//   readSceneCode    — read current Scene.tsx
//   editSceneCode    — surgical string replace in Scene.tsx
//   readSchema       — read current schema JSON
//   editSchema       — surgical string replace in schema JSON
//   compilePreview   — REAL esbuild check; returns errors with line numbers
//   savePendingPlugin — persist + emit preview-ready SSE event
//   validateAndBuild — final sandbox build + S3 + DB (after user approval)
//
// No more generateSchemaJson / planScene / generateSceneCode / reviewSceneCode.
// The agent thinks; the tools just persist / validate / observe.
// ============================================================================

// ─── Dependency policy ──────────────────────────────────────────────────────
function formatGuardFailure(guard: PluginGuardResult): string {
  const parts: string[] = [];
  if (guard.missingRequirements.length > 0) {
    parts.push(`Missing hard requirement(s): ${guard.missingRequirements.join('; ')}`);
  }
  if (guard.importIssues.length > 0) {
    parts.push(`Import issue(s): ${guard.importIssues.map((issue) => `${issue.file} imports ${issue.specifier}: ${issue.message}`).join('; ')}`);
  }
  if (guard.visualIssues.length > 0) {
    parts.push(`Visual issue(s): ${guard.visualIssues.map((issue) => `${issue.file}: ${issue.message}`).join('; ')}`);
  }
  return parts.join('\n');
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function currentPluginSourcePayload(pending: Record<string, any>) {
  return {
    sceneCode: pending.sceneCode ?? '',
    modules: pending.modules ?? null,
    schemaJson: pending.schemaJson ?? '',
    dependencies: pending.dependencies ?? {},
  };
}

function computePluginSourceHash(pending: Record<string, any>): string {
  return createHash('sha256')
    .update(stableStringify(currentPluginSourcePayload(pending)))
    .digest('hex')
    .slice(0, 16);
}

function withCurrentSourceHash<T extends Record<string, any>>(pending: T): T {
  return {
    ...pending,
    sourceHash: computePluginSourceHash(pending),
  };
}

// ─── Schema validation (deterministic, fast) ────────────────────────────────

function validateSchemaShape(schemaJson: string): { ok: true; fieldNames: string[]; warnings: string[] } | { ok: false; issues: string[]; warnings: string[] } {
  let parsed: any;
  try {
    parsed = JSON.parse(schemaJson);
  } catch (e: any) {
    return { ok: false, issues: [`Schema is not valid JSON: ${e?.message}`], warnings: [] };
  }

  const issues: string[] = [];
  const warnings: string[] = [];
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    issues.push('Schema root must be an object.');
    return { ok: false, issues, warnings };
  }
  if (!parsed.properties || typeof parsed.properties !== 'object') {
    issues.push('Schema must have a "properties" object at the root.');
    return { ok: false, issues, warnings };
  }

  const fieldNames = Object.keys(parsed.properties);
  if (fieldNames.length === 0) {
    issues.push('Schema "properties" is empty — at least one field is required.');
  }

  const reservedFieldCheck = validatePluginSchemaReservedFields(parsed);
  if (!reservedFieldCheck.ok) {
    issues.push(...reservedFieldCheck.issues.map((issue) => issue.message));
  }

  // Sanity: media fields should follow naming convention so the media pipeline
  // picks them up. Warn but don't fail — agent can decide.
  for (const [name, def] of Object.entries<any>(parsed.properties)) {
    if (def?.editor === 'image' && !/(?:Url|Image|image)$/.test(name)) {
      warnings.push(`Image field "${name}" should end in "Url", "Image", or follow the imageUrl/bgImageUrl naming convention.`);
    }
  }

  if (issues.length > 0) return { ok: false, issues, warnings };
  return { ok: true, fieldNames, warnings };
}

const workCategorySchema = z.enum(['core_remotion_logic', 'glue_code', 'validation']);
const stepStatusSchema = z.enum(['pending', 'in_progress', 'done', 'blocked']);

export const recordPluginPlanTool = createTool({
  id: 'record-plugin-plan',
  description:
    'Register the sequential execution plan and frozen contracts for a plugin run. Call this BEFORE code generation. ' +
    'Use core_remotion_logic for hard Remotion/motion work and glue_code for schema/import/data wiring. ' +
    'RECON GATE: in modify mode, this tool REJECTS if no getSourceMap call has been recorded recently. Always call getSourceMap first in modify mode. ' +
    'REASON+ACT: each step should include hypothesis (what you expect to happen and why), evidence (source-map symbols / line ranges / ledger events supporting the hypothesis), and failureMode (what it probably means if the hypothesis is wrong). This makes the audit trail useful.',
  inputSchema: z.object({
    threadId: z.string(),
    pluginId: z.string(),
    mode: z.enum(['create', 'modify']).default('create'),
    frozenContracts: z.object({
      schemaPaths: z.array(z.string()).default([]),
      files: z.array(z.string()).default([]),
      dependencies: z.record(z.string(), z.string()).default({}),
      generationFields: z.array(z.string()).default([]),
      notes: z.array(z.string()).optional(),
    }),
    steps: z.array(z.object({
      id: z.string(),
      title: z.string(),
      category: workCategorySchema,
      owner: z.enum(['orchestrator', 'schema_agent', 'remotion_coder', 'dependency_agent', 'validator']),
      goal: z.string(),
      files: z.array(z.string()).default([]),
      hypothesis: z.string().optional().describe('What you expect to happen and why, e.g. "editing useSpringIn will fix the blank enter phase because the spring config currently produces NaN"'),
      evidence: z.array(z.string()).optional().describe('Source-map symbols / line ranges / ledger events supporting the hypothesis'),
      failureMode: z.string().optional().describe('If this does not fix it, the real cause is probably...'),
      dependsOn: z.array(z.string()).optional().describe('Step ids this step depends on (for future parallel execution)'),
    })).min(1),
  }),
  execute: async (inputData) => {
    // ─── RECON GATE ─────────────────────────────────────────────────────
    // In modify mode (or if a fork was loaded), require a recent getSourceMap call.
    const job = await getJob(inputData.threadId);
    const state = job?.state as any;
    const remixId = state?.pluginRemix?.pluginId;
    if (remixId && (inputData.pluginId !== remixId || !state?.pendingPlugin)) {
      return { ok: false as const, error: `This chat edits remix ${remixId}. Load its existing source and use that exact pluginId before planning.` };
    }
    if (remixId) inputData.mode = 'modify';
    const hasExistingPlugin = inputData.mode === 'modify' || !!state?.pendingPlugin;

    if (hasExistingPlugin) {
      const lastReconAt = state?.pendingPlugin?.lastReconAt ?? state?.pluginExecution?.lastReconAt ?? null;
      const reconStale = !lastReconAt || (Date.now() - new Date(lastReconAt).getTime()) > 5 * 60 * 1000;
      if (reconStale) {
        return {
          ok: false as const,
          error: 'Recon gate: modifying an existing plugin requires a recent getSourceMap call. Call getSourceMap({ threadId }) first, then re-issue recordPluginPlan.',
          lastReconAt,
          requiredAction: 'getSourceMap',
        };
      }
      const overallHash = state?.pendingPlugin?.sourceMap?.overallHash ?? null;
      inputData.frozenContracts.notes = [...(inputData.frozenContracts.notes ?? []), `reconOverallHash=${overallHash ?? 'unknown'}`];
    }

    const execution = createPluginExecutionState({
      pluginId: inputData.pluginId,
      mode: inputData.mode,
      frozenContracts: inputData.frozenContracts,
      steps: inputData.steps,
      lastReconAt: hasExistingPlugin
        ? state?.pendingPlugin?.lastReconAt ?? null
        : null,
      lastReconOverallHash: hasExistingPlugin
        ? state?.pendingPlugin?.sourceMap?.overallHash ?? null
        : null,
    });

    await patchJobState(inputData.threadId, (state: any) => {
      const pendingPlugin = state.pendingPlugin
        ? attachPluginExecutionState(state.pendingPlugin, execution)
        : state.pendingPlugin;
      return { ...state, pluginExecution: execution, pendingPlugin };
    });

    return {
      ok: true as const,
      execution,
      summary: summarizePluginExecution(execution),
      message: `Registered ${execution.steps.length} sequential plugin step(s) with hypothesis/evidence/failureMode.`,
    };
  },
});

export const updatePluginStepTool = createTool({
  id: 'update-plugin-step',
  description:
    'Update one execution-plan step in the plugin ledger. Call this before starting a step and after completing/blocking it. ' +
    'Use issues to distinguish core_remotion_logic failures from glue_code failures.',
  inputSchema: z.object({
    threadId: z.string(),
    stepId: z.string(),
    status: stepStatusSchema,
    summary: z.string().optional(),
    issues: z.array(z.object({
      type: z.string(),
      area: workCategorySchema,
      detail: z.string(),
      fixed: z.boolean().optional(),
    })).optional(),
  }),
  execute: async (inputData) => {
    let updatedExecution: ReturnType<typeof updatePluginExecutionStep> | null = null;
    await patchJobState(inputData.threadId, (state: any) => {
      const existingExecution = state.pluginExecution ?? state.pendingPlugin?.runLedger?.execution;
      if (!existingExecution) return state;

      updatedExecution = updatePluginExecutionStep(existingExecution, {
        stepId: inputData.stepId,
        status: inputData.status,
        summary: inputData.summary,
        issues: inputData.issues as PluginStepIssue[] | undefined,
      });

      let pendingPlugin = state.pendingPlugin;
      if (pendingPlugin?.runLedger) {
        const now = new Date().toISOString();
        pendingPlugin = {
          ...pendingPlugin,
          runLedger: {
            ...pendingPlugin.runLedger,
            execution: updatedExecution,
            events: [
              ...pendingPlugin.runLedger.events.slice(-24),
              {
                type: 'step',
                summary: `${inputData.stepId} -> ${inputData.status}${inputData.summary ? `: ${inputData.summary}` : ''}`,
                errors: inputData.issues?.filter((issue) => !issue.fixed).map((issue) => issue.detail),
                at: now,
              },
            ],
            updatedAt: now,
          },
        };
      }

      return { ...state, pluginExecution: updatedExecution, pendingPlugin };
    });

    if (!updatedExecution) {
      return { ok: false as const, error: 'No plugin execution plan found. Call recordPluginPlan first.' };
    }

    return {
      ok: true as const,
      execution: updatedExecution,
      summary: summarizePluginExecution(updatedExecution),
    };
  },
});

// ─── Tool: setInitialScene — CREATE-mode emission ──────────────────────────
//
// Agent emits schema + scene code as tool args in one call. We persist both
// to job state as `pendingPlugin`. No LLM call — the model already wrote the
// code in its message; this just stores it.

export const setInitialSceneTool = createTool({
  id: 'set-initial-scene',
  description:
    'Emit the initial schema and Scene.tsx for a new plugin. Call this exactly ONCE at the start of a CREATE flow. For single-file mode, pass sceneCode. For multi-file mode, pass modules (Record<string, string> mapping file paths to code, must include Scene.tsx). Returns { ok, fieldNames } or { ok: false, issues } if the schema is malformed. After this succeeds, call compilePreview to verify the code bundles.',
  inputSchema: z.object({
    threadId: z.string(),
    pluginId: z.string(),
    pluginName: z.string(),
    description: z.string(),
    schemaJson: z.string().describe('Full JSON Schema (draft-07) — must have root "properties" and root "defaults". Skygen editor seeds pluginData from schema.defaults. Do not rely only on properties.<field>.default.'),
    sceneCode: z.string().optional().describe('Full Scene.tsx source code (single-file mode)'),
    modules: z.record(z.string(), z.string()).optional().describe('Multi-file mode: map of file paths to code. Must include "Scene.tsx". E.g. { "Scene.tsx": "...", "animations.ts": "...", "theme.ts": "..." }'),
    dependencies: z.record(z.string(), z.string()).optional().describe('npm packages the scene imports (e.g. { "recharts": "^2.15.4" })'),
    userId: z.string().nullable().optional(),
  }),
  execute: async (inputData) => {
    const { threadId, pluginId, pluginName, description, schemaJson, sceneCode, modules, dependencies, userId } = inputData;
    const existingJob = await getJob(threadId);
    if (!existingJob) return { ok: false as const, error: 'Chat session not found.' };
    if (existingJob.state?.pendingPlugin || existingJob.state?.pluginRemix || existingJob.state?.pluginExecution?.mode === 'modify') {
      return {
        ok: false as const,
        error: 'Existing plugin code cannot be replaced by setInitialScene. Read it with getSourceMap/readLines and apply focused edits. Use a new chat to create a new plugin.',
      };
    }

    // Validate: need either sceneCode or modules
    const hasModules = modules && Object.keys(modules).length > 0;
    const hasSceneCode = !!sceneCode;
    if (!hasModules && !hasSceneCode) {
      return { ok: false as const, issues: ['Must provide either sceneCode or modules.'], error: 'No code provided.' };
    }

    const schemaCheck = validateSchemaShape(schemaJson);
    if (!schemaCheck.ok) {
      console.log(`[set-initial-scene] ❌ schema invalid for thread ${threadId.slice(0, 8)}: ${schemaCheck.issues[0]}`);
      return {
        ok: false as const,
        issues: schemaCheck.issues,
        error: `Schema invalid: ${schemaCheck.issues.join('; ')}`,
      };
    }

    const depPolicy = normalizePluginDependencies(dependencies);
    const cleanDeps = depPolicy.dependencies;
    const depPolicyWarnings = formatDependencyPolicyChanges(depPolicy);
    for (const message of depPolicyWarnings) {
      console.warn(`[set-initial-scene] ${message}`);
    }

    // Determine effective scene code and modules
    let effectiveModules: Record<string, string>;
    if (hasModules) {
      effectiveModules = modules!;
    } else {
      effectiveModules = { 'Scene.tsx': sceneCode! };
    }

    const sourceCheck = validatePluginSource(effectiveModules);
    if (!sourceCheck.ok) {
      const formatted = formatPluginSourceIssues(sourceCheck.issues);
      console.log(`[set-initial-scene] source invalid for thread ${threadId.slice(0, 8)}: ${formatted.split('\n')[0]}`);
      return {
        ok: false as const,
        issues: sourceCheck.issues.map((issue) => `${issue.file}:${issue.line} ${issue.message}`),
        error: `Plugin source failed validation:\n${formatted}`,
        hint: 'Fix the Scene props/data boundary. animation, theme, and motionProfile are host props, not data fields.',
      };
    }

    // Derive AST
    const ast = deriveAST(effectiveModules);

    let pendingPlugin: Record<string, any> = {
      pluginId,
      pluginName,
      description,
      sceneCode: effectiveModules['Scene.tsx'] ?? sceneCode ?? '',
      modules: isMultiFile(effectiveModules) ? effectiveModules : undefined,
      schemaJson,
      dependencies: cleanDeps,
      userId,
      ast,
    };

    const existingExecution = (existingJob?.state as any)?.pluginExecution ?? null;
    pendingPlugin.runLedger = createPluginRunLedger(pendingPlugin, `${pluginName}\n${description}`);
    pendingPlugin = attachPluginExecutionState(pendingPlugin, existingExecution) as Record<string, any>;
    const guard = validatePluginRunState(pendingPlugin);
    const hasCriticalErrors = guard.missingRequirements.length > 0 || guard.importIssues.length > 0;
    if (hasCriticalErrors) {
      return {
        ok: false as const,
        error: `Plugin guard failed before storing:\n${formatGuardFailure(guard)}`,
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        warnings: guard.warnings,
        hint: 'If the user required a concept like MapLibre, implement it or report the dependency/build blocker. Do not silently replace it with a fallback.',
      };
    }
    pendingPlugin = appendPluginLedgerEvent(withCurrentSourceHash(pendingPlugin), {
      type: 'init',
      summary: `Stored ${Object.keys(effectiveModules).length} file(s), ${schemaCheck.fieldNames.length} schema field(s).`,
      warnings: [...depPolicyWarnings, ...guard.warnings],
    }) as Record<string, any>;

    await patchJobState(threadId, (current) => ({ ...current, pendingPlugin }));

    const fileCount = Object.keys(effectiveModules).length;
    console.log(`[set-initial-scene] ✅ stored ${fileCount} files, ${schemaCheck.fieldNames.length} fields for thread ${threadId.slice(0, 8)}`);
    return {
      ok: true as const,
      fieldNames: schemaCheck.fieldNames,
      warnings: [...depPolicyWarnings, ...guard.warnings],
      dependencies: cleanDeps,
      guard: {
        hardRequirements: guard.hardRequirements.map((term) => term.id),
        files: guard.snapshot.files,
        dependencies: guard.snapshot.dependencies,
      },
      message: `Stored. ${schemaCheck.fieldNames.length} schema fields, ${fileCount} file(s). Now call compilePreview to verify.`,
    };
  },
});

// ─── Tool: readSceneCode ────────────────────────────────────────────────────

export const readSceneCodeTool = createTool({
  id: 'read-scene-code',
  description: 'Read the current Scene.tsx from job state. Returns the full source code as a string. Call this before editSceneCode so you know the exact text to match. For multi-file plugins, this returns the Scene.tsx entry file only — use readModule for other files.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (inputData) => {
    const job = await getJob(inputData.threadId);
    const pending = (job?.state as any)?.pendingPlugin;
    if (!pending?.sceneCode) {
      console.log(`[read-scene-code] ❌ no pendingPlugin for thread ${inputData.threadId.slice(0, 8)}`);
      return { ok: false as const, error: 'No pending plugin found. Call setInitialScene first to create one.' };
    }
    // If multi-file, return the Scene.tsx entry specifically
    const sceneCode = getPluginSourceFiles(pending)['Scene.tsx'];
    console.log(`[read-scene-code] ✅ returned ${sceneCode.length} chars for thread ${inputData.threadId.slice(0, 8)}`);
    return { ok: true as const, sceneCode };
  },
});

// ─── Tool: editSceneCode ────────────────────────────────────────────────────

export const editSceneCodeTool = createTool({
  id: 'edit-scene-code',
  description: 'Surgically replace a block of code in Scene.tsx (or a specific file in multi-file mode via filePath). oldString must appear EXACTLY ONCE in the target file. Use the smallest unique block that contains your change. Call multiple times for multiple separate edits. Always call readSceneCode or readModule first to get the exact current text.',
  inputSchema: z.object({
    threadId: z.string(),
    oldString: z.string().describe('Exact code block to replace — must appear exactly once'),
    newString: z.string().describe('Replacement code'),
    filePath: z.string().optional().describe('For multi-file mode: which file to edit (e.g. "animations.ts", "theme.ts"). Defaults to "Scene.tsx".'),
  }),
  execute: async (inputData) => {
    const { threadId, oldString, newString, filePath } = inputData;
    const targetFile = filePath ?? 'Scene.tsx';
    const job = await getJob(threadId);
    const current = (job?.state as any)?.pendingPlugin;
    if (!current) {
      console.log(`[edit-scene-code] ❌ no pendingPlugin in job state for thread ${threadId.slice(0, 8)}`);
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    // Get the target code
    let targetCode: string;
    const modules = getPluginSourceFiles(current);
    if (modules[targetFile] === undefined) {
      return { ok: false as const, error: `File "${targetFile}" not found. Available files: ${Object.keys(modules).join(', ')}` };
    }
    targetCode = modules[targetFile];

    const occurrences = targetCode.split(oldString).length - 1;
    if (occurrences === 0) {
      console.log(`[edit-scene-code] ❌ oldString not found in ${targetFile} (${oldString.length} chars) for thread ${threadId.slice(0, 8)}`);
      return {
        ok: false as const,
        error: `oldString not found in ${targetFile}. Call readModule or readSceneCode and use an exact verbatim match (including whitespace).`,
      };
    }
    if (occurrences > 1) {
      console.log(`[edit-scene-code] ❌ oldString appears ${occurrences} times in ${targetFile} for thread ${threadId.slice(0, 8)}`);
      return {
        ok: false as const,
        error: `oldString appears ${occurrences} times in ${targetFile} — it must be unique. Add more surrounding context to make it unique.`,
      };
    }

    const updatedCode = targetCode.replace(oldString, newString);
    const candidateModules = { ...modules, [targetFile]: updatedCode };
    const sourceCheck = validatePluginSource(candidateModules);
    if (!sourceCheck.ok) {
      const formatted = formatPluginSourceIssues(sourceCheck.issues);
      return {
        ok: false as const,
        error: `Edit would leave invalid plugin source:\n${formatted}`,
        hint: 'Use the Scene animation prop directly. Do not read animation from data or schema fields.',
      };
    }

    const candidatePending = {
      ...withPluginSourceFiles(current, candidateModules),
      ast: deriveAST(candidateModules),
      // String edits change line numbers too; force the next recon to refresh.
      sourceMap: undefined,
    };
    const guard = validatePluginRunState(candidatePending);
    const hasCriticalErrors = guard.missingRequirements.length > 0 || guard.importIssues.length > 0;
    if (hasCriticalErrors) {
      return {
        ok: false as const,
        error: `Edit blocked by plugin guard:\n${formatGuardFailure(guard)}`,
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        warnings: guard.warnings,
        hint: 'Make a smaller patch that preserves hard requirements and resolves every local import.',
      };
    }

    const nextPending = appendPluginLedgerEvent(withCurrentSourceHash(candidatePending), {
      type: 'edit',
      filePath: targetFile,
      summary: `Replaced ${oldString.length} chars with ${newString.length} chars.`,
      changedChars: updatedCode.length - targetCode.length,
      warnings: guard.warnings,
    });

    if (!await persistPluginSourceEdit(threadId, nextPending)) {
      return { ok: false as const, error: 'The edited source could not be verified in saved state. Re-read the file before retrying.' };
    }

    const sizeDelta = updatedCode.length - targetCode.length;
    console.log(`[edit-scene-code] ✅ replaced ${oldString.length}→${newString.length} chars in ${targetFile} (Δ${sizeDelta >= 0 ? '+' : ''}${sizeDelta}) for thread ${threadId.slice(0, 8)}`);
    return {
      ok: true as const,
      warnings: guard.warnings,
      guard: {
        hardRequirements: guard.hardRequirements.map((term) => term.id),
        files: guard.snapshot.files,
      },
      message: `${targetFile} updated.`,
    };
  },
});

// ─── Tool: readSchema ───────────────────────────────────────────────────────

export const readSchemaTool = createTool({
  id: 'read-schema',
  description: 'Read the current schema JSON from job state. Use this when you need to add, rename, or remove fields.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (inputData) => {
    const job = await getJob(inputData.threadId);
    const schemaJson = (job?.state as any)?.pendingPlugin?.schemaJson ?? null;
    if (!schemaJson) {
      console.log(`[read-schema] ❌ no pendingPlugin for thread ${inputData.threadId.slice(0, 8)}`);
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    console.log(`[read-schema] ✅ returned ${schemaJson.length} chars for thread ${inputData.threadId.slice(0, 8)}`);
    return { ok: true as const, schemaJson };
  },
});

// ─── Tool: editSchema ───────────────────────────────────────────────────────

export const editSchemaTool = createTool({
  id: 'edit-schema',
  description: 'Surgically replace a block in the schema JSON. Same uniqueness rules as editSceneCode. Use this when adding/renaming/removing fields. After editing the schema, you usually need to editSceneCode too so the scene reads the new field.',
  inputSchema: z.object({
    threadId: z.string(),
    oldString: z.string().describe('Exact text to replace — must appear exactly once'),
    newString: z.string().describe('Replacement text'),
  }),
  execute: async (inputData) => {
    const { threadId, oldString, newString } = inputData;
    const job = await getJob(threadId);
    const current = (job?.state as any)?.pendingPlugin;
    if (!current?.schemaJson) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    const occurrences = current.schemaJson.split(oldString).length - 1;
    if (occurrences === 0) {
      console.log(`[edit-schema] ❌ oldString not found in thread ${threadId.slice(0, 8)}`);
      return {
        ok: false as const,
        error: 'oldString not found in schema. Call readSchema and use an exact match.',
      };
    }
    if (occurrences > 1) {
      console.log(`[edit-schema] ❌ oldString appears ${occurrences} times in thread ${threadId.slice(0, 8)}`);
      return {
        ok: false as const,
        error: `oldString appears ${occurrences} times — must be unique.`,
      };
    }

    const updatedSchema = current.schemaJson.replace(oldString, newString);

    // Validate the updated schema before persisting
    const check = validateSchemaShape(updatedSchema);
    if (!check.ok) {
      return {
        ok: false as const,
        error: `Edit would produce invalid schema: ${check.issues.join('; ')}`,
      };
    }

    const candidatePending = { ...current, schemaJson: updatedSchema };
    const guard = validatePluginRunState(candidatePending);
    const hasCriticalErrors = guard.missingRequirements.length > 0 || guard.importIssues.length > 0;
    if (hasCriticalErrors) {
      return {
        ok: false as const,
        error: `Schema edit blocked by plugin guard:\n${formatGuardFailure(guard)}`,
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        warnings: guard.warnings,
      };
    }

    const nextPending = appendPluginLedgerEvent(withCurrentSourceHash(candidatePending), {
      type: 'schema-edit',
      summary: `Schema text changed by ${updatedSchema.length - current.schemaJson.length} chars.`,
      changedChars: updatedSchema.length - current.schemaJson.length,
      warnings: guard.warnings,
    });

    await patchJobState(threadId, (s: any) => ({
      ...s,
      pendingPlugin: nextPending,
    }));

    console.log(`[edit-schema] ✅ updated for thread ${threadId.slice(0, 8)}, ${check.fieldNames.length} fields`);
    return { ok: true as const, fieldNames: check.fieldNames, warnings: guard.warnings, message: 'Schema updated.' };
  },
});

// ─── Tool: compilePreview ───────────────────────────────────────────────────
//
// THE validator. Runs the same esbuild config as the browser preview. On failure
// returns the error with line numbers. The agent reads the code, makes targeted
// edits, and retries.

interface CompileErrorLocation {
  text: string;
  file: string;
  line: number;
  column: number;
}

export const compilePreviewTool = createTool({
  id: 'compile-preview',
  description:
    'Compile the current Scene.tsx with the real esbuild config (same one the browser uses). For multi-file plugins, compiles the actual module files. Returns structured errors with line numbers on failure. On success, returns { ok: true }.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (inputData) => {
    const { threadId } = inputData;
    const job = await getJob(threadId);
    const current = (job?.state as any)?.pendingPlugin;
    if (!current?.sceneCode) {
      return { ok: false as const, error: 'No pending plugin found. Call setInitialScene first.' };
    }

    const depPolicy = normalizePluginDependencies(current.dependencies);
    const depPolicyWarnings = formatDependencyPolicyChanges(depPolicy);
    for (const message of depPolicyWarnings) {
      console.warn(`[compile-preview] ${message}`);
    }
    const currentWithNormalizedDeps = { ...current, dependencies: depPolicy.dependencies };
    const sourceHash = computePluginSourceHash(currentWithNormalizedDeps);
    const currentWithHash = { ...currentWithNormalizedDeps, sourceHash };

    const filesToValidate = currentWithHash.modules && isMultiFile(currentWithHash.modules)
      ? currentWithHash.modules
      : { 'Scene.tsx': currentWithHash.sceneCode };
    const sourceCheck = validatePluginSource(filesToValidate);
    if (!sourceCheck.ok) {
      const formatted = formatPluginSourceIssues(sourceCheck.issues);
      return {
        ok: false as const,
        error: `Plugin source failed validation:\n${formatted}`,
        locations: sourceCheck.issues.map((issue) => ({
          text: issue.message,
          file: issue.file,
          line: issue.line,
          column: 0,
        })),
        hint: 'Call readSceneCode/readModule, then editSceneCode to remove data.animation usage. animation is its own Scene prop.',
      };
    }

    console.log(`[compile-preview] ▶ compiling ${Object.keys(filesToValidate).length} file(s) for thread ${threadId.slice(0, 8)}`);
    const guard = validatePluginRunState(currentWithHash);
    if (!guard.ok) {
      return {
        ok: false as const,
        error: `Plugin guard failed before compile:\n${formatGuardFailure(guard)}`,
        locations: [],
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        warnings: [...depPolicyWarnings, ...guard.warnings],
        hint: 'Fix the missing requirement/import first. Do not compile a plugin that dropped hard requirements.',
      };
    }

    const result = await bundlePreview(currentWithHash.sceneCode, currentWithHash.pluginId ?? 'preview', {
      dependencies: currentWithHash.dependencies,
      modules: currentWithHash.modules,
    });

    if (!result.ok) {
      console.log(`[compile-preview] ❌ ${result.error.slice(0, 200)}`);

      const locations: CompileErrorLocation[] = (result.diagnostics ?? [])
        .filter((d) => d.line > 0)
        .map((d) => ({
          text: d.text,
          file: d.file,
          line: d.line,
          column: d.column,
        }));

      return {
        ok: false as const,
        error: result.error,
        locations,
        warnings: [...depPolicyWarnings, ...guard.warnings],
        hint: 'Call readSceneCode to see the actual code around the error line, then use editSceneCode to fix it. After editing, call compilePreview again.',
      };
    }

    console.log(`[compile-preview] ✅ ${result.bundleJs.length} bytes`);
    const nextPending = appendPluginLedgerEvent({
      ...currentWithHash,
      lastCompiledSourceHash: sourceHash,
      lastCompileOk: true,
      lastBundleBytes: result.bundleJs.length,
      lastCompiledAt: new Date().toISOString(),
    }, {
      type: 'compile',
      summary: `Preview compilation successful (${result.bundleJs.length} bytes, sourceHash ${sourceHash}).`,
      warnings: [...depPolicyWarnings, ...guard.warnings],
    });
    await patchJobState(threadId, (s: any) => ({ ...s, pendingPlugin: nextPending }));

    return {
      ok: true as const,
      sourceHash,
      lastCompiledSourceHash: sourceHash,
      bundleBytes: result.bundleJs.length,
      warnings: [...depPolicyWarnings, ...guard.warnings],
      guard: {
        hardRequirements: guard.hardRequirements.map((term) => term.id),
        files: guard.snapshot.files,
        dependencies: guard.snapshot.dependencies,
      },
      message: 'Compilation successful. Call savePendingPlugin to trigger the real browser preview.',
    };
  },
});

// ─── Tool: savePendingPlugin — emits SSE preview-ready event ────────────────

export const savePendingPluginTool = createTool({
  id: 'save-pending-plugin',
  description: 'Save the current pendingPlugin and trigger a browser preview. Call this after compilePreview returns ok. Returns { ok: true, pluginId, name }.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (inputData, ctx) => {
    const { threadId } = inputData;
    const job = await getJob(threadId);
    const pendingPlugin = (job?.state as any)?.pendingPlugin;
    if (!pendingPlugin) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    const sourceHash = computePluginSourceHash(pendingPlugin);
    const pendingWithHash = { ...pendingPlugin, sourceHash };
    if (pendingWithHash.lastCompiledSourceHash !== sourceHash || !pendingWithHash.lastCompileOk) {
      return {
        ok: false as const,
        error:
          `Cannot save plugin preview because source changed after the last compile. ` +
          `current sourceHash=${sourceHash}, lastCompiledSourceHash=${pendingWithHash.lastCompiledSourceHash ?? 'none'}. ` +
          'Call compilePreview again, then savePendingPlugin.',
        sourceHash,
        lastCompiledSourceHash: pendingWithHash.lastCompiledSourceHash ?? null,
      };
    }

    const filesToValidate = pendingWithHash.modules && isMultiFile(pendingWithHash.modules)
      ? pendingWithHash.modules
      : { 'Scene.tsx': pendingWithHash.sceneCode };
    const sourceCheck = validatePluginSource(filesToValidate);
    if (!sourceCheck.ok) {
      const formatted = formatPluginSourceIssues(sourceCheck.issues);
      return {
        ok: false as const,
        error: `Cannot save plugin preview because source failed validation:\n${formatted}`,
        hint: 'Fix reserved Scene prop usage first. Use animation.enter/hold/exit from props, not data.animation.',
      };
    }

    const guard = validatePluginRunState(pendingWithHash);
    if (!guard.ok) {
      return {
        ok: false as const,
        error: `Cannot save plugin preview because the plugin guard failed:\n${formatGuardFailure(guard)}`,
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        warnings: guard.warnings,
      };
    }

    const previewBuildId = `${sourceHash}-${Date.now().toString(36)}`;
    const guardedPendingPlugin = appendPluginLedgerEvent({
      ...pendingWithHash,
      previewBuildId,
      previewSourceHash: sourceHash,
      previewSavedAt: new Date().toISOString(),
    }, {
      type: 'compile',
      summary: `Saved pending plugin preview for sourceHash ${sourceHash}.`,
      warnings: guard.warnings,
    });

    // Re-emit pendingPlugin to trigger UI refresh (state may have been edited)
    await patchJobState(threadId, (current) => ({ ...current, pendingPlugin: guardedPendingPlugin }));

    try {
      await ctx?.writer?.custom?.({
        type: 'data-wizard-progress',
        data: {
          phase: 'create-plugin',
          status: 'preview-ready',
          toolCallId: `save-pending-${Date.now()}`,
          pluginId: pendingWithHash.pluginId,
          pluginName: pendingWithHash.pluginName,
          sourceHash,
          previewSourceHash: sourceHash,
          previewBuildId,
          pendingPlugin: guardedPendingPlugin,
        },
        transient: false,
      });
    } catch { /* writer may be undefined outside streaming context */ }

    console.log(`[save-pending-plugin] ✅ ${pendingWithHash.pluginId} (${sourceHash})`);
    return {
      ok: true as const,
      pluginId: pendingWithHash.pluginId,
      name: pendingWithHash.pluginName,
      sourceHash,
      previewBuildId,
      warnings: guard.warnings,
    };
  },
});

// ─── Tool: validateAndBuild — final sandbox build (after user approval) ─────

type BuildStep = 'schema' | 'scene' | 'build';

function classifyError(error: string): BuildStep {
  const lower = error.toLowerCase();
  if (lower.includes('schemajson') || lower.includes('"properties"')) return 'schema';
  if (lower.includes('plugin source failed validation')) return 'scene';
  if (
    lower.includes('sandbox build failed') ||
    lower.includes('error ts') ||
    lower.includes('syntaxerror') ||
    lower.includes('expected') ||
    lower.includes('transform failed') ||
    lower.includes('build.mjs')
  ) return 'scene';
  return 'build';
}

export const validateAndBuildTool = createTool({
  id: 'validate-and-build',
  description:
    'Final build: compatibility check → sandbox build → S3 upload → DB insert. Use after user approves the preview. Returns { ok: true, pluginId, ... } or { ok: false, error, step }.',
  inputSchema: z.object({
    pluginId: z.string(),
    pluginName: z.string(),
    description: z.string(),
    sceneCode: z.string(),
    modules: z.record(z.string(), z.string()).optional(),
    schemaJson: z.string(),
    dependencies: z.record(z.string(), z.string()).optional(),
    userId: z.string().nullable().optional(),
  }),
  execute: async (inputData) => {
    const { pluginId, pluginName, description, sceneCode, modules, schemaJson, dependencies, userId } = inputData;

    const result = await createPluginFromSource({
      id: pluginId,
      name: pluginName,
      description,
      category: 'custom',
      sceneCode,
      modules,
      schemaJson,
      dependencies,
      userId: userId ?? null,
    });

    if (!result.ok) {
      return {
        ok: false as const,
        error: result.error,
        errors: result.errors,
        step: classifyError(result.error),
      };
    }

    return {
      ok: true as const,
      pluginId: result.pluginId,
      name: result.name,
      builtInSandbox: result.builtInSandbox,
      warnings: result.warnings,
    };
  },
});

// ─── Tool: readModule — read a specific module file ─────────────────────────

export const readModuleTool = createTool({
  id: 'read-module',
  description: 'Read a specific module file from the pending plugin. Returns the code and its AST section (exports, line ranges). For Scene.tsx, defaults to readSceneCode behavior but includes AST.',
  inputSchema: z.object({
    threadId: z.string(),
    filePath: z.string().describe('File to read (e.g. "animations.ts", "theme.ts", "Scene.tsx")'),
  }),
  execute: async (inputData) => {
    const { threadId, filePath } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    const modules = getPluginSourceFiles(pending);
    const code = modules[filePath];
    let fileAst: FileAST | null = null;

    if (code === undefined) {
      return {
        ok: false as const,
        error: `File "${filePath}" not found. Available: ${Object.keys(modules).join(', ')}`,
      };
    }

    // Get AST for this file
    const fullAst: PluginAST | null = pending.ast ?? null;
    if (fullAst?.files?.[filePath]) {
      fileAst = fullAst.files[filePath];
    } else {
      fileAst = deriveAST({ [filePath]: code }).files[filePath] ?? null;
    }

    console.log(`[read-module] ✅ ${filePath} (${code.length} chars) for thread ${threadId.slice(0, 8)}`);
    return { ok: true as const, filePath, code, ast: fileAst };
  },
});

// ─── Tool: readAST — return the full AST of all modules ──────────────────────

export const readASTTool = createTool({
  id: 'read-ast',
  description: 'Return the full AST (structural map) of all plugin files. Shows exports, sections, and line ranges for each file. Use this to understand code layout before making surgical edits.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (inputData) => {
    const { threadId } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    // Re-derive AST from current code (ensures accuracy)
    const ast = deriveAST(getPluginSourceFiles(pending));

    // Cache the updated AST
    await patchJobState(threadId, (s: any) => ({
      ...s,
      pendingPlugin: { ...pending, ast },
    }));

    const fileNames = Object.keys(ast.files);
    console.log(`[read-ast] ✅ ${fileNames.length} files: ${fileNames.join(', ')} for thread ${threadId.slice(0, 8)}`);
    return { ok: true as const, ast, files: fileNames };
  },
});

// ─── Tool: inspectPluginState — compact ledger/import/guard context ──────────

export const inspectPluginStateTool = createTool({
  id: 'inspect-plugin-state',
  description:
    'Inspect the current pending plugin without reading full source. Returns files, dependencies, import graph, hard requirements, missing requirements, warnings, and recent ledger events. Call this before complex edits or when a fix unexpectedly changes architecture.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (inputData) => {
    const { threadId } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    const guard = validatePluginRunState(pending);
    const ledger = pending.runLedger ?? null;
    const execution = ledger?.execution ?? (job?.state as any)?.pluginExecution ?? null;
    const sourceHash = computePluginSourceHash(pending);
    const lastCompiledSourceHash = pending.lastCompiledSourceHash ?? null;
    const previewSourceHash = pending.previewSourceHash ?? null;
    const compileState = lastCompiledSourceHash === sourceHash && pending.lastCompileOk
      ? 'compiled-current'
      : 'source-changed-after-compile';
    const previewState = previewSourceHash === sourceHash
      ? 'preview-current'
      : 'preview-stale-or-not-saved';
    return {
      ok: guard.ok,
      pluginId: pending.pluginId,
      pluginName: pending.pluginName,
      sourceVersion: {
        sourceHash,
        lastCompiledSourceHash,
        previewSourceHash,
        previewBuildId: pending.previewBuildId ?? null,
        lastBundleBytes: pending.lastBundleBytes ?? null,
        lastCompiledAt: pending.lastCompiledAt ?? null,
        previewSavedAt: pending.previewSavedAt ?? null,
        compileState,
        previewState,
      },
      files: guard.snapshot.files,
      dependencies: guard.snapshot.dependencies,
      imports: guard.snapshot.imports,
      hardRequirements: guard.hardRequirements.map((term) => ({
        id: term.id,
        aliases: term.aliases,
        reason: term.reason,
      })),
      missingRequirements: guard.missingRequirements,
      importIssues: guard.importIssues,
      warnings: guard.warnings,
      execution,
      executionSummary: summarizePluginExecution(execution),
      recentEvents: ledger?.events?.slice(-8) ?? [],
      hint: guard.ok
        ? 'State is consistent. Use readAST/readModule for targeted edits.'
        : 'Fix missing requirements/import issues before compilePreview or savePendingPlugin.',
    };
  },
});

// ─── Tool: updateDependencies — surgically edit the pendingPlugin dep manifest ─

export const updateDependenciesTool = createTool({
  id: 'update-dependencies',
  description:
    'Surgically edit the pendingPlugin\'s npm dependency manifest WITHOUT touching Scene.tsx or schema. ' +
    'Use this when a peer-dep / resolution error blocks compilePreview or buildAndSavePlugin and the source code is already correct. ' +
    'Pass { add, remove } — add merges into the manifest (overwriting existing entries by name), remove deletes the listed names. ' +
    'The app already provides React/Remotion and Skygen-supported Three/R3F/Drei packages, so dependency policy keeps those out of the plugin manifest. Use dependencies for additional packages only. ' +
    'After this, call compilePreview then savePendingPlugin to refresh the preview. To REPLACE a dep with a compatible version, add the new version under the same name (overwrites).',
  inputSchema: z.object({
    threadId: z.string(),
    add: z.record(z.string(), z.string()).optional().describe('Map of { packageName: semver-range } to add or overwrite, e.g. { "@react-three/fiber": "^9.0.0" }'),
    remove: z.array(z.string()).optional().describe('Package names to remove from the manifest, e.g. ["@react-spring/three", "@react-three/drei"]'),
  }),
  execute: async (rawInput: any) => {
    const context = rawInput?.context ?? rawInput;
    const { threadId, add, remove } = context;
    const job = await getJob(threadId);
    const pendingPlugin = (job?.state as any)?.pendingPlugin;
    if (!pendingPlugin) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }

    const current = { ...(pendingPlugin.dependencies ?? {}) };
    let added = 0;
    let removed = 0;
    if (add) {
      for (const [name, range] of Object.entries(add)) {
        if (typeof name !== 'string' || typeof range !== 'string') continue;
        current[name] = range;
        added += 1;
      }
    }
    if (Array.isArray(remove)) {
      for (const name of remove) {
        if (typeof name !== 'string') continue;
        if (current[name] !== undefined) {
          delete current[name];
          removed += 1;
        }
      }
    }

    const depPolicy = normalizePluginDependencies(current);
    const normalizedDeps = depPolicy.dependencies;
    const depPolicyWarnings = formatDependencyPolicyChanges(depPolicy);
    const candidatePending = { ...pendingPlugin, dependencies: normalizedDeps };
    const guard = validatePluginRunState(candidatePending);
    const nextPending = appendPluginLedgerEvent(withCurrentSourceHash(candidatePending), {
      type: 'dependency-edit',
      summary: `Dependencies changed: added ${added}, removed ${removed}; dependency policy kept ${depPolicy.stripped.length} app-provided/invalid package(s) out of the plugin manifest.`,
      warnings: [...depPolicyWarnings, ...guard.warnings],
      errors: guard.ok ? [] : [...guard.missingRequirements, ...guard.importIssues.map((issue) => issue.message)],
    });

    await patchJobState(threadId, (state) => ({
      ...state,
      pendingPlugin: nextPending,
    }));

    return {
      ok: true as const,
      dependencies: normalizedDeps,
      added,
      removed,
      normalized: depPolicy.normalized,
      stripped: depPolicy.stripped,
      guard: {
        ok: guard.ok,
        missingRequirements: guard.missingRequirements,
        importIssues: guard.importIssues,
        warnings: guard.warnings,
      },
      hint: 'Dependencies updated. Call compilePreview to verify the sandbox build passes, then savePendingPlugin to refresh the browser preview.',
    };
  },
});

// ─── Tool: listDependencies — show what\'s currently declared ────────────────

export const listDependenciesTool = createTool({
  id: 'list-dependencies',
  description: 'Read the current pendingPlugin dependency manifest. Call this when you see a peer-dep or resolution error to see exactly what is declared before deciding what to add or remove.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async (rawInput: any) => {
    const context = rawInput?.context ?? rawInput;
    const { threadId } = context;
    const job = await getJob(threadId);
    const pendingPlugin = (job?.state as any)?.pendingPlugin;
    if (!pendingPlugin) {
      return { ok: false as const, error: 'No pending plugin found.' };
    }
    return {
      ok: true as const,
      dependencies: pendingPlugin.dependencies ?? {},
      pluginId: pendingPlugin.pluginId,
    };
  },
});

// ─── Toolbox bundle for orchestrator agent ───────────────────────────────────
//
// Two bundles are exported:
//   - pluginCreatorTools       : legacy set (backward compatible)
//   - pluginCreatorToolsV2     : recon→plan→act set with source-map tools +
//                                line edits + deviation ledger + everything
//                                from pluginCreatorTools. Use this for new
//                                orchestrator deployments.
//
// Old tools (readModule/editSceneCode/readAST) remain available so existing
// agents and prompts keep working. New tools (getSourceMap/findSymbol/
// readLines/editLines/etc.) are the recommended path.

export const pluginCreatorTools = {
  recordPluginPlan: recordPluginPlanTool,
  updatePluginStep: updatePluginStepTool,
  setInitialScene: setInitialSceneTool,
  readSceneCode: readSceneCodeTool,
  editSceneCode: editSceneCodeTool,
  readModule: readModuleTool,
  readAST: readASTTool,
  inspectPluginState: inspectPluginStateTool,
  readSchema: readSchemaTool,
  editSchema: editSchemaTool,
  compilePreview: compilePreviewTool,
  savePendingPlugin: savePendingPluginTool,
  updateDependencies: updateDependenciesTool,
  listDependencies: listDependenciesTool,
  loadForkedPluginSource: loadForkedPluginSourceTool,
};

export const pluginCreatorToolsV2 = {
  ...pluginCreatorTools,
  // ─── Recon (mandatory before recordPluginPlan in modify mode) ──────────
  getSourceMap: sourceMapTools.getSourceMap,
  setFileRole: sourceMapTools.setFileRole,
  // ─── Semantic grep + symbol / line search ───────────────────────────────
  findAnchor: sourceMapTools.findAnchor,        // ← NEW: natural-language intent → symbol + line range
  findSymbol: sourceMapTools.findSymbol,
  listSymbols: sourceMapTools.listSymbols,
  readLines: sourceMapTools.readLines,
  searchInFile: sourceMapTools.searchInFile,
  grepPlugin: sourceMapTools.grepPlugin,
  findDataFieldUsages: sourceMapTools.findDataFieldUsages,
  // ─── Line-based edits (deterministic, no string matching) ───────────────
  editLines: sourceMapTools.editLines,
  insertAt: sourceMapTools.insertAt,
  deleteLines: sourceMapTools.deleteLines,
  previewEdit: sourceMapTools.previewEdit,
  // ─── Reason+Act audit trail ──────────────────────────────────────────────
  recordPlanDeviation: recordPlanDeviationTool,
};
