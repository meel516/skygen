import type { SourceMap } from './source-map';

export interface PluginArchitectureComponent {
  name: string;
  file: string;
  role: string;
  owns: string[];
  symbols: string[];
  reads: string[];
  dependsOn: string[];
  doNotEditFor: string[];
  notes?: string;
  source: 'comment' | 'agent' | 'inferred';
  lines?: [number, number];
  fileHash?: string;
}

export interface PluginArchitectureNotes {
  version: 1;
  pluginId: string;
  generatedAt: string;
  sourceMapOverallHash: string;
  components: PluginArchitectureComponent[];
  rules: string[];
  decisions: string[];
}

type AnnotationMap = Record<string, string[]>;

const LIST_SPLIT = /\s*(?:,|;|\|)\s*/;

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function basename(path: string): string {
  const file = path.split('/').pop() ?? path;
  return file.replace(/\.(tsx?|jsx?)$/i, '');
}

function extractArchitectureAnnotations(code: string): AnnotationMap {
  const annotations: AnnotationMap = {};
  const pattern = /^\s*(?:\/{2,}|\*)?\s*@([A-Za-z][A-Za-z0-9_-]*)\s*:?\s*(.+?)\s*$/gm;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(code)) !== null) {
    const key = match[1].toLowerCase();
    annotations[key] = [...(annotations[key] ?? []), match[2].trim()];
  }
  return annotations;
}

function readList(annotations: AnnotationMap, key: string): string[] {
  return unique((annotations[key] ?? []).flatMap((value) => value.split(LIST_SPLIT)));
}

function readText(annotations: AnnotationMap, key: string): string | undefined {
  return annotations[key]?.[0]?.trim() || undefined;
}

function primarySymbol(sourceMap: SourceMap, file: string): { name: string; lines?: [number, number] } | null {
  const symbols = sourceMap.symbols.filter((symbol) => symbol.file === file);
  const preferred = symbols.find((symbol) => symbol.kind === 'default')
    ?? symbols.find((symbol) => symbol.kind === 'function' || symbol.kind === 'const')
    ?? symbols[0];
  return preferred ? { name: preferred.name, lines: preferred.lines } : null;
}

function mergeComponent(
  inferred: PluginArchitectureComponent,
  existing?: PluginArchitectureComponent,
): PluginArchitectureComponent {
  if (!existing) return inferred;
  return {
    ...inferred,
    name: existing.name || inferred.name,
    role: existing.role || inferred.role,
    owns: unique([...inferred.owns, ...(existing.owns ?? [])]),
    symbols: unique([...inferred.symbols, ...(existing.symbols ?? [])]),
    reads: unique([...inferred.reads, ...(existing.reads ?? [])]),
    dependsOn: unique([...inferred.dependsOn, ...(existing.dependsOn ?? [])]),
    doNotEditFor: unique([...inferred.doNotEditFor, ...(existing.doNotEditFor ?? [])]),
    notes: existing.notes ?? inferred.notes,
    source: existing.source === 'agent' ? 'agent' : inferred.source,
  };
}

export function derivePluginArchitectureNotes(
  modules: Record<string, string>,
  sourceMap: SourceMap,
  existing?: PluginArchitectureNotes | null,
): PluginArchitectureNotes {
  const existingByFile = new Map((existing?.components ?? []).map((component) => [component.file, component]));
  const components: PluginArchitectureComponent[] = [];

  for (const fileSummary of sourceMap.files) {
    const code = modules[fileSummary.path] ?? '';
    const annotations = extractArchitectureAnnotations(code);
    const symbols = sourceMap.symbols
      .filter((symbol) => symbol.file === fileSummary.path)
      .map((symbol) => symbol.name);
    const dataReads = sourceMap.dataFieldUsages
      .filter((usage) => usage.file === fileSummary.path)
      .map((usage) => `data.${usage.field}`);
    const localDeps = fileSummary.imports
      .filter((item) => item.kind === 'local')
      .map((item) => item.resolved ?? item.specifier);
    const primary = primarySymbol(sourceMap, fileSummary.path);

    const inferred: PluginArchitectureComponent = {
      name: readText(annotations, 'component') ?? readText(annotations, 'name') ?? primary?.name ?? basename(fileSummary.path),
      file: fileSummary.path,
      role: readText(annotations, 'role') ?? fileSummary.role,
      owns: readList(annotations, 'owns'),
      symbols: unique([...readList(annotations, 'symbols'), ...symbols]),
      reads: unique([...readList(annotations, 'reads'), ...dataReads]),
      dependsOn: unique([...readList(annotations, 'depends'), ...readList(annotations, 'dependson'), ...localDeps]),
      doNotEditFor: readList(annotations, 'donoteditfor'),
      notes: readText(annotations, 'notes'),
      source: Object.keys(annotations).some((key) => ['role', 'owns', 'reads', 'depends', 'dependson'].includes(key))
        ? 'comment'
        : 'inferred',
      lines: primary?.lines,
      fileHash: fileSummary.hash,
    };

    components.push(mergeComponent(inferred, existingByFile.get(fileSummary.path)));
  }

  return {
    version: 1,
    pluginId: sourceMap.pluginId,
    generatedAt: new Date().toISOString(),
    sourceMapOverallHash: sourceMap.overallHash,
    components,
    rules: unique(existing?.rules ?? []),
    decisions: unique(existing?.decisions ?? []),
  };
}

export function summarizePluginArchitecture(notes: PluginArchitectureNotes): string {
  const lines: string[] = [];
  lines.push(`PLUGIN ARCHITECTURE (${notes.components.length} component(s), source map ${notes.sourceMapOverallHash})`);
  for (const component of notes.components) {
    const owns = component.owns.length > 0 ? component.owns.join(', ') : 'not recorded';
    const reads = component.reads.length > 0 ? ` reads: ${component.reads.join(', ')}` : '';
    lines.push(`  - ${component.name} -> ${component.file} [${component.fileHash ?? 'no-hash'}]: ${component.role}; owns: ${owns}${reads}`);
  }
  if (notes.rules.length > 0) {
    lines.push(`  rules: ${notes.rules.join(' | ')}`);
  }
  return lines.join('\n');
}

export function searchPluginArchitecture(notes: PluginArchitectureNotes, query: string): PluginArchitectureComponent[] {
  const terms = query.toLowerCase().split(/\s+/).filter((term) => term.length > 1);
  if (terms.length === 0) return notes.components;
  return notes.components
    .map((component) => {
      const haystack = [
        component.name,
        component.file,
        component.role,
        component.notes ?? '',
        ...component.owns,
        ...component.symbols,
        ...component.reads,
        ...component.dependsOn,
        ...component.doNotEditFor,
      ].join(' ').toLowerCase();
      const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
      return { component, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((item) => item.component);
}

