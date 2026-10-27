import { createHash } from 'crypto';
import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { patchJobState, getJob } from '@/lib/mcp/wizard-jobs';
import {
  validatePluginSource,
  formatPluginSourceIssues,
} from '@/lib/plugins/source-validation';
import { deriveAST } from './code-ast';
import {
  appendPluginLedgerEvent,
  validatePluginRunState,
} from './plugin-run-ledger';
import { mergeDeltas, conflictToRepairStep } from './merge-deltas.tool';
import { deriveSourceMap } from '../shared/source-map';
import { derivePluginArchitectureNotes } from '../shared/plugin-architecture';
import type { StepDelta } from '../shared/types';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function computeSourceHash(pending: Record<string, any>): string {
  const payload = {
    sceneCode: pending.sceneCode ?? '',
    modules: pending.modules ?? null,
    schemaJson: pending.schemaJson ?? '',
    dependencies: pending.dependencies ?? {},
  };
  return createHash('sha256').update(stableStringify(payload)).digest('hex').slice(0, 16);
}

function parseSchema(schemaJson: string | undefined): Record<string, any> {
  try {
    return JSON.parse(schemaJson ?? '{}');
  } catch {
    return {};
  }
}

function withMergedSchema(baseSchema: Record<string, any>, fields: Array<{ name: string; def: Record<string, any> }>): string {
  if (fields.length === 0) return JSON.stringify(baseSchema, null, 2);
  const properties = {
    ...(baseSchema.properties ?? {}),
    ...Object.fromEntries(fields.map((field) => [field.name, field.def])),
  };
  const nextSchema = { ...baseSchema, properties };

  if (baseSchema.defaults && typeof baseSchema.defaults === 'object') {
    const defaults: Record<string, any> = {};
    for (const field of fields) {
      if (field.def.default !== undefined) defaults[field.name] = field.def.default;
    }
    if (Object.keys(defaults).length > 0) {
      nextSchema.defaults = { ...baseSchema.defaults, ...defaults };
    }
  }

  return JSON.stringify(nextSchema, null, 2);
}

const symbolPatchSchema = z.object({
  symbolName: z.string(),
  symbolKind: z.enum(['component', 'function', 'const', 'hook', 'type', 'interface', 'default', 'imports']),
  operation: z.enum(['add', 'replace', 'delete']),
  newContent: z.string().optional(),
  anchorComment: z.string().optional(),
});

const stepDeltaSchema = z.object({
  stepId: z.string(),
  depth: z.number().int().min(0).optional(),
  newFiles: z.record(z.string(), z.string()).optional(),
  fileEdits: z.array(z.object({
    path: z.string(),
    symbolPatches: z.array(symbolPatchSchema),
    fullReplace: z.boolean().optional(),
  })).optional(),
  newSchemaFields: z.array(z.object({
    name: z.string(),
    def: z.record(z.string(), z.any()),
  })).optional(),
  newDependencies: z.record(z.string(), z.string()).optional(),
  hypothesis: z.string().optional(),
  evidence: z.array(z.string()).optional(),
  failureMode: z.string().optional(),
  summary: z.string().optional(),
});

export const applyStepDeltaTool = createTool({
  id: 'apply-step-delta',
  description:
    'Apply one structured StepDelta from a plugin coder into pendingPlugin. ' +
    'Use this only when the coder explicitly returned a StepDelta JSON object. ' +
    'The tool merges modules/schema/dependencies, validates source, runs the plugin guard, and returns repair steps for conflicts.',
  inputSchema: z.object({
    threadId: z.string(),
    delta: stepDeltaSchema,
  }),
  execute: async (inputData) => {
    const { threadId, delta } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found. Call setInitialScene first.' };
    }

    const baseModules = pending.modules && Object.keys(pending.modules).length > 0
      ? { ...pending.modules }
      : { 'Scene.tsx': pending.sceneCode ?? '' };
    const baseSchema = parseSchema(pending.schemaJson);
    const baseSchemaFields = baseSchema.properties ?? {};
    const baseDependencies = pending.dependencies ?? {};
    const mergeResult = mergeDeltas([delta as StepDelta], baseModules, baseSchemaFields, baseDependencies);

    if (mergeResult.hasConflicts) {
      return {
        ok: false as const,
        error: `Delta has ${mergeResult.conflicts.length} merge conflict(s). State was not persisted.`,
        conflicts: mergeResult.conflicts,
        repairSteps: mergeResult.conflicts.map(conflictToRepairStep),
      };
    }

    const sourceCheck = validatePluginSource(mergeResult.mergedModules);
    if (!sourceCheck.ok) {
      return {
        ok: false as const,
        error: `Merged source failed validation:\n${formatPluginSourceIssues(sourceCheck.issues)}`,
        conflicts: mergeResult.conflicts,
      };
    }

    const schemaJson = withMergedSchema(baseSchema, mergeResult.mergedSchemaFields);
    const isMulti = Object.keys(mergeResult.mergedModules).length > 1;
    const sourceMap = deriveSourceMap(mergeResult.mergedModules, {
      roleOverrides: pending.roleOverrides,
      pluginId: pending.pluginId,
    });
    const nextPending = {
      ...pending,
      sceneCode: mergeResult.mergedModules['Scene.tsx'] ?? pending.sceneCode ?? '',
      modules: isMulti ? mergeResult.mergedModules : undefined,
      schemaJson,
      dependencies: mergeResult.mergedDependencies,
      ast: deriveAST(mergeResult.mergedModules),
      sourceMap,
      pluginArchitecture: derivePluginArchitectureNotes(mergeResult.mergedModules, sourceMap, pending.pluginArchitecture),
      sourceHash: computeSourceHash({
        sceneCode: mergeResult.mergedModules['Scene.tsx'] ?? '',
        modules: isMulti ? mergeResult.mergedModules : null,
        schemaJson,
        dependencies: mergeResult.mergedDependencies,
      }),
    };

    const guard = validatePluginRunState(nextPending);
    const hasCriticalErrors = guard.missingRequirements.length > 0 || guard.importIssues.length > 0;
    if (hasCriticalErrors) {
      return {
        ok: false as const,
        error: 'Merged state failed plugin guard. State was not persisted.',
        guardFailures: {
          missingRequirements: guard.missingRequirements,
          importIssues: guard.importIssues,
        },
      };
    }

    const finalPending = appendPluginLedgerEvent(nextPending, {
      type: 'edit',
      summary: `Applied StepDelta ${delta.stepId}: ${Object.keys(delta.newFiles ?? {}).length} new file(s), ${(delta.fileEdits ?? []).length} file edit(s), ${mergeResult.mergedSchemaFields.length} schema field(s).`,
      warnings: guard.warnings,
    });

    await patchJobState(threadId, (state: any) => ({ ...state, pendingPlugin: finalPending }));

    return {
      ok: true as const,
      sourceHash: finalPending.sourceHash,
      hasConflicts: false,
      conflicts: [],
      stepSummary: delta.summary ?? null,
      message: `Applied StepDelta ${delta.stepId}.`,
    };
  },
});

export const applyStepDeltasTool = createTool({
  id: 'apply-step-deltas',
  description:
    'Apply multiple structured StepDeltas atomically. Use this for a manually coordinated parallel wave where each coder returned a delta.',
  inputSchema: z.object({
    threadId: z.string(),
    deltas: z.array(stepDeltaSchema).min(1),
  }),
  execute: async (inputData) => {
    const { threadId, deltas } = inputData;
    const job = await getJob(threadId);
    const pending = (job?.state as any)?.pendingPlugin;
    if (!pending) {
      return { ok: false as const, error: 'No pending plugin found. Call setInitialScene first.' };
    }

    const baseModules = pending.modules && Object.keys(pending.modules).length > 0
      ? { ...pending.modules }
      : { 'Scene.tsx': pending.sceneCode ?? '' };
    const baseSchema = parseSchema(pending.schemaJson);
    const mergeResult = mergeDeltas(
      deltas as StepDelta[],
      baseModules,
      baseSchema.properties ?? {},
      pending.dependencies ?? {},
    );

    if (mergeResult.hasConflicts) {
      return {
        ok: false as const,
        error: `Delta wave has ${mergeResult.conflicts.length} merge conflict(s). State was not persisted.`,
        conflicts: mergeResult.conflicts,
        repairSteps: mergeResult.conflicts.map(conflictToRepairStep),
      };
    }

    const sourceCheck = validatePluginSource(mergeResult.mergedModules);
    if (!sourceCheck.ok) {
      return {
        ok: false as const,
        error: `Merged source failed validation:\n${formatPluginSourceIssues(sourceCheck.issues)}`,
      };
    }

    const schemaJson = withMergedSchema(baseSchema, mergeResult.mergedSchemaFields);
    const isMulti = Object.keys(mergeResult.mergedModules).length > 1;
    const sourceMap = deriveSourceMap(mergeResult.mergedModules, {
      roleOverrides: pending.roleOverrides,
      pluginId: pending.pluginId,
    });
    const nextPending = {
      ...pending,
      sceneCode: mergeResult.mergedModules['Scene.tsx'] ?? pending.sceneCode ?? '',
      modules: isMulti ? mergeResult.mergedModules : undefined,
      schemaJson,
      dependencies: mergeResult.mergedDependencies,
      ast: deriveAST(mergeResult.mergedModules),
      sourceMap,
      pluginArchitecture: derivePluginArchitectureNotes(mergeResult.mergedModules, sourceMap, pending.pluginArchitecture),
      sourceHash: computeSourceHash({
        sceneCode: mergeResult.mergedModules['Scene.tsx'] ?? '',
        modules: isMulti ? mergeResult.mergedModules : null,
        schemaJson,
        dependencies: mergeResult.mergedDependencies,
      }),
    };

    const guard = validatePluginRunState(nextPending);
    const hasCriticalErrors = guard.missingRequirements.length > 0 || guard.importIssues.length > 0;
    if (hasCriticalErrors) {
      return {
        ok: false as const,
        error: 'Merged state failed plugin guard. State was not persisted.',
        guardFailures: {
          missingRequirements: guard.missingRequirements,
          importIssues: guard.importIssues,
        },
      };
    }

    const finalPending = appendPluginLedgerEvent(nextPending, {
      type: 'edit',
      summary: `Applied ${deltas.length} StepDeltas atomically.`,
      warnings: guard.warnings,
    });

    await patchJobState(threadId, (state: any) => ({ ...state, pendingPlugin: finalPending }));

    return {
      ok: true as const,
      sourceHash: finalPending.sourceHash,
      hasConflicts: false,
      conflicts: [],
      appliedCount: deltas.length,
      message: `Applied ${deltas.length} StepDelta(s).`,
    };
  },
});
