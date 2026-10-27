import { deriveAST } from './code-ast';
import type { StepDelta, SymbolPatch } from '../shared/types';

export interface MergeConflict {
  kind: 'file_collision' | 'symbol_collision' | 'schema_field_collision' | 'dependency_version_mismatch';
  path?: string;
  symbolName?: string;
  fieldName?: string;
  packageName?: string;
  owners: string[];
  detail: string;
  suggestedResolution: 'repair_single' | 'replan';
}

export interface MergeResult {
  mergedModules: Record<string, string>;
  mergedSchemaFields: Array<{ name: string; def: Record<string, any> }>;
  mergedDependencies: Record<string, string>;
  conflicts: MergeConflict[];
  stepSummaries: Array<{ stepId: string; summary?: string }>;
  hasConflicts: boolean;
}

interface SymbolLocation {
  startLine: number;
  endLine: number;
}

function findBlockEndByBraces(lines: string[], startLine: number): number {
  let depth = 0;
  let foundOpen = false;
  for (let i = startLine; i < lines.length; i++) {
    for (const ch of lines[i]) {
      if (ch === '{') {
        depth++;
        foundOpen = true;
      }
      if (ch === '}') depth--;
    }
    if (foundOpen && depth === 0) return i;
  }
  return lines.length - 1;
}

function findConstEnd(lines: string[], startLine: number): number {
  const line = lines[startLine] ?? '';
  if (line.includes('=>') && line.includes('{')) {
    return findBlockEndByBraces(lines, startLine);
  }
  for (let i = startLine; i < lines.length; i++) {
    if ((lines[i] ?? '').trimEnd().endsWith(';')) return i;
  }
  return startLine;
}

function findSymbolInCode(code: string, symbolName: string): SymbolLocation | null {
  const ast = deriveAST({ '_': code });
  const direct = ast.files._?.exports.find((entry) => entry.name === symbolName);
  if (direct) return { startLine: direct.lines[0], endLine: direct.lines[1] };

  const lines = code.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    let match = line.match(/^(?:export\s+)?function\s+(\w+)/);
    if (match?.[1] === symbolName) {
      return { startLine: i + 1, endLine: findBlockEndByBraces(lines, i) + 1 };
    }
    match = line.match(/^(?:export\s+)?(?:const|let|var)\s+(\w+)/);
    if (match?.[1] === symbolName) {
      return { startLine: i + 1, endLine: findConstEnd(lines, i) + 1 };
    }
    match = line.match(/^(?:export\s+)?(?:type|interface)\s+(\w+)/);
    if (match?.[1] === symbolName) {
      return { startLine: i + 1, endLine: findBlockEndByBraces(lines, i) + 1 };
    }
  }

  return null;
}

function applyImportPatch(code: string, patch: SymbolPatch): { ok: true; code: string } | { ok: false; error: string } {
  if (patch.operation === 'add') {
    if (!patch.newContent) return { ok: false, error: 'imports add requires newContent' };
    if (code.includes(patch.newContent)) return { ok: true, code };
    const lines = code.split('\n');
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^\s*import\s/.test(lines[i] ?? '')) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, patch.newContent);
    return { ok: true, code: lines.join('\n') };
  }

  if (patch.operation === 'delete') {
    const lines = code
      .split('\n')
      .filter((line) => !(line.trimStart().startsWith('import') && line.includes(patch.symbolName)));
    return { ok: true, code: lines.join('\n') };
  }

  return { ok: false, error: `unsupported imports operation ${patch.operation}` };
}

function applySymbolPatch(code: string, patch: SymbolPatch): { ok: true; code: string } | { ok: false; error: string } {
  if (patch.symbolKind === 'imports') {
    return applyImportPatch(code, patch);
  }

  const location = findSymbolInCode(code, patch.symbolName);
  if (patch.operation === 'delete') {
    if (!location) return { ok: false, error: `delete ${patch.symbolName}: symbol not found` };
    const lines = code.split('\n');
    return { ok: true, code: [...lines.slice(0, location.startLine - 1), ...lines.slice(location.endLine)].join('\n') };
  }

  if (!patch.newContent) {
    return { ok: false, error: `${patch.operation} ${patch.symbolName}: newContent required` };
  }

  const content = patch.anchorComment ? `${patch.anchorComment}\n${patch.newContent}` : patch.newContent;
  if (patch.operation === 'add' || !location) {
    const separator = code.endsWith('\n') || code.length === 0 ? '' : '\n';
    return { ok: true, code: `${code}${separator}${content}\n` };
  }

  const lines = code.split('\n');
  return {
    ok: true,
    code: [...lines.slice(0, location.startLine - 1), content, ...lines.slice(location.endLine)].join('\n'),
  };
}

function compareVersions(a: string, b: string): string {
  const parse = (value: string) => value.replace(/^[\^~]/, '').split('.').map((part) => Number.parseInt(part, 10) || 0);
  const left = parse(a);
  const right = parse(b);
  for (let i = 0; i < 3; i++) {
    if ((left[i] ?? 0) !== (right[i] ?? 0)) return (left[i] ?? 0) > (right[i] ?? 0) ? a : b;
  }
  return a;
}

export function mergeDeltas(
  deltas: StepDelta[],
  baseModules: Record<string, string>,
  baseSchemaFields: Record<string, any> = {},
  baseDependencies: Record<string, string> = {},
): MergeResult {
  const conflicts: MergeConflict[] = [];
  const mergedModules = { ...baseModules };
  const mergedSchemaFields: Array<{ name: string; def: Record<string, any> }> = [];
  const mergedDependencies = { ...baseDependencies };
  const stepSummaries = deltas.map((delta) => ({ stepId: delta.stepId, summary: delta.summary }));

  for (const delta of deltas) {
    for (const [path, content] of Object.entries(delta.newFiles ?? {})) {
      if (path in mergedModules && mergedModules[path] !== content) {
        conflicts.push({
          kind: 'file_collision',
          path,
          owners: [delta.stepId, '(existing)'],
          detail: `${delta.stepId} tried to add existing file ${path} with different content.`,
          suggestedResolution: 'repair_single',
        });
        continue;
      }
      mergedModules[path] = content;
    }
  }

  const fullReplaceOwners = new Map<string, string[]>();
  for (const delta of deltas) {
    for (const edit of delta.fileEdits ?? []) {
      if (!edit.fullReplace) continue;
      const owners = fullReplaceOwners.get(edit.path) ?? [];
      owners.push(delta.stepId);
      fullReplaceOwners.set(edit.path, owners);
    }
  }

  for (const [path, owners] of fullReplaceOwners) {
    const otherEditors = deltas
      .filter((delta) => !owners.includes(delta.stepId) && (delta.fileEdits ?? []).some((edit) => edit.path === path))
      .map((delta) => delta.stepId);
    if (owners.length > 1 || otherEditors.length > 0) {
      conflicts.push({
        kind: 'file_collision',
        path,
        owners: [...owners, ...otherEditors],
        detail: `Multiple deltas edit full-owned file ${path}.`,
        suggestedResolution: 'repair_single',
      });
    }
  }

  const symbolOwners = new Map<string, string[]>();
  for (const delta of deltas) {
    for (const edit of delta.fileEdits ?? []) {
      for (const patch of edit.symbolPatches) {
        if (patch.operation !== 'replace' && patch.operation !== 'delete') continue;
        const key = `${edit.path}::${patch.symbolName}`;
        const owners = symbolOwners.get(key) ?? [];
        owners.push(delta.stepId);
        symbolOwners.set(key, owners);
      }
    }
  }

  for (const [key, owners] of symbolOwners) {
    if (owners.length <= 1) continue;
    const [path, symbolName] = key.split('::');
    conflicts.push({
      kind: 'symbol_collision',
      path,
      symbolName,
      owners,
      detail: `Symbol ${symbolName} in ${path} was edited by ${owners.join(', ')}.`,
      suggestedResolution: 'repair_single',
    });
  }

  for (const delta of deltas) {
    for (const edit of delta.fileEdits ?? []) {
      const fileHasConflict = conflicts.some((conflict) => conflict.path === edit.path);
      if (fileHasConflict) continue;

      if (edit.fullReplace) {
        const replacement = edit.symbolPatches[0]?.newContent;
        if (replacement) mergedModules[edit.path] = replacement;
        continue;
      }

      let code = mergedModules[edit.path] ?? '';
      for (const patch of edit.symbolPatches) {
        const result = applySymbolPatch(code, patch);
        if (!result.ok) {
          conflicts.push({
            kind: 'symbol_collision',
            path: edit.path,
            symbolName: patch.symbolName,
            owners: [delta.stepId],
            detail: result.error,
            suggestedResolution: 'repair_single',
          });
          continue;
        }
        code = result.code;
      }
      mergedModules[edit.path] = code;
    }
  }

  const schemaOwners = new Map<string, string>();
  for (const delta of deltas) {
    for (const field of delta.newSchemaFields ?? []) {
      const base = baseSchemaFields[field.name];
      if (base && JSON.stringify(base) !== JSON.stringify(field.def)) {
        conflicts.push({
          kind: 'schema_field_collision',
          fieldName: field.name,
          owners: [delta.stepId, '(base schema)'],
          detail: `Schema field ${field.name} already exists with a different definition.`,
          suggestedResolution: 'repair_single',
        });
        continue;
      }
      const owner = schemaOwners.get(field.name);
      if (owner) {
        conflicts.push({
          kind: 'schema_field_collision',
          fieldName: field.name,
          owners: [owner, delta.stepId],
          detail: `Schema field ${field.name} was added by multiple deltas.`,
          suggestedResolution: 'repair_single',
        });
        continue;
      }
      schemaOwners.set(field.name, delta.stepId);
      mergedSchemaFields.push(field);
    }
  }

  for (const delta of deltas) {
    for (const [pkg, version] of Object.entries(delta.newDependencies ?? {})) {
      if (pkg in mergedDependencies && mergedDependencies[pkg] !== version) {
        const picked = compareVersions(mergedDependencies[pkg], version);
        mergedDependencies[pkg] = picked;
        conflicts.push({
          kind: 'dependency_version_mismatch',
          packageName: pkg,
          owners: [delta.stepId, '(existing)'],
          detail: `Dependency ${pkg} version mismatch; picked ${picked}.`,
          suggestedResolution: 'repair_single',
        });
        continue;
      }
      mergedDependencies[pkg] = version;
    }
  }

  return {
    mergedModules,
    mergedSchemaFields,
    mergedDependencies,
    conflicts,
    stepSummaries,
    hasConflicts: conflicts.length > 0,
  };
}

export function conflictToRepairStep(conflict: MergeConflict): Record<string, any> {
  const target = conflict.path ?? conflict.symbolName ?? conflict.fieldName ?? conflict.packageName ?? conflict.kind;
  return {
    id: `repair-${conflict.kind}-${target}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80),
    category: 'glue_code',
    owner: 'remotion_coder',
    files: conflict.path ? [conflict.path] : [],
    goal: `Resolve ${conflict.kind}: ${conflict.detail}`,
    hypothesis: 'A single integration repair can reconcile the conflicting delta output without changing frozen contracts.',
    evidence: [`owners: ${conflict.owners.join(', ')}`],
    failureMode: 'If the conflict cannot be repaired locally, the orchestrator must replan file ownership.',
  };
}
