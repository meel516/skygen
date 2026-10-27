export interface PluginTrackedTerm {
  id: string;
  aliases: string[];
  reason: string;
}

export interface PluginImportRecord {
  file: string;
  specifier: string;
  kind: 'local' | 'external';
  resolved?: string;
  packageName?: string;
}

export interface PluginImportIssue {
  file: string;
  specifier: string;
  message: string;
}

export interface PluginVisualIssue {
  file: string;
  message: string;
}

export interface PluginLedgerSnapshot {
  files: string[];
  dependencies: string[];
  imports: PluginImportRecord[];
}

export interface PluginLedgerEvent {
  type: 'init' | 'plan' | 'step' | 'edit' | 'schema-edit' | 'dependency-edit' | 'compile' | 'validation' | 'feedback';
  filePath?: string;
  summary: string;
  changedChars?: number;
  warnings?: string[];
  errors?: string[];
  at: string;
}

export type PluginWorkCategory = 'core_remotion_logic' | 'glue_code' | 'validation';
export type PluginStepStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export interface PluginStepIssue {
  type: string;
  area: PluginWorkCategory;
  detail: string;
  fixed?: boolean;
}

export interface PluginExecutionStep {
  id: string;
  title: string;
  category: PluginWorkCategory;
  owner: 'orchestrator' | 'schema_agent' | 'remotion_coder' | 'dependency_agent' | 'validator';
  goal: string;
  files: string[];
  status: PluginStepStatus;
  attempts: number;
  summary?: string;
  issues?: PluginStepIssue[];

  // ─── Reason+Act fields (added when recon→plan→act is enabled) ────────────
  // Pure ReAct only commits a one-line goal. Reason+Act requires the agent
  // to commit a hypothesis + evidence + failureMode BEFORE acting, so the
  // orchestrator can detect when reasoning was wrong and record a deviation.
  hypothesis?: string;        // "I believe editing X will fix Y because Z"
  evidence?: string[];        // source-map symbols / line ranges / ledger events that support the hypothesis
  failureMode?: string;       // "if this doesn't fix it, the real cause is probably..."
  dependsOn?: string[];       // step ids this step depends on (for future parallel execution)
}

export interface PluginFrozenContracts {
  schemaPaths: string[];
  files: string[];
  dependencies: Record<string, string>;
  generationFields: string[];
  notes?: string[];
}

export interface PluginExecutionState {
  version: 1;
  pluginId: string;
  mode: 'create' | 'modify';
  currentStepId?: string;
  frozenContracts: PluginFrozenContracts;
  steps: PluginExecutionStep[];
  createdAt: string;
  updatedAt: string;

  // ─── Reason+Act audit trail ─────────────────────────────────────────────
  deviations?: PlanDeviationRecord[];
  // ─── Recon gating ───────────────────────────────────────────────────────
  // In modify mode, recordPluginPlan rejects if lastReconAt is missing or
  // stale (> 5 min). This forces the orchestrator to call getSourceMap first.
  lastReconAt?: string | null;
  lastReconOverallHash?: string | null;
}

export interface PlanDeviationRecord {
  stepId: string;
  expected: string;
  actual: string;
  reason: string;
  resolution: 'local_repair' | 'global_replan' | 'abort' | 'continue';
  nextStepId?: string | null;
  recordedAt: string;
}

export interface PluginRunLedger {
  version: 1;
  sourcePrompt: string;
  hardRequirements: PluginTrackedTerm[];
  baseline: PluginLedgerSnapshot;
  execution?: PluginExecutionState;
  events: PluginLedgerEvent[];
  createdAt: string;
  updatedAt: string;
}

export interface PluginGuardResult {
  ok: boolean;
  hardRequirements: PluginTrackedTerm[];
  missingRequirements: string[];
  importIssues: PluginImportIssue[];
  visualIssues: PluginVisualIssue[];
  warnings: string[];
  snapshot: PluginLedgerSnapshot;
}

interface PendingPluginLike {
  description?: string;
  schemaJson?: string;
  sceneCode?: string;
  modules?: Record<string, string>;
  dependencies?: Record<string, string>;
  runLedger?: PluginRunLedger;
}

const KNOWN_REQUIREMENTS: PluginTrackedTerm[] = [
  {
    id: 'maplibre',
    aliases: ['maplibre', 'maplibre-gl', 'MapLibre'],
    reason: 'The request mentioned MapLibre, so the plugin must not silently degrade to SVG-only.',
  },
  {
    id: 'generation-fields',
    aliases: ['generationfields', 'generation fields', 'removebackground', 'removeBackground', 'editor": "image', 'editor":"image'],
    reason: 'The request mentioned generated media fields, so image field metadata must stay present.',
  },
  {
    id: 'plugin-data',
    aliases: ['plugindata', 'pluginData'],
    reason: 'The request mentioned pluginData, so the plugin data contract must stay explicit.',
  },
  {
    id: 'tail-tracer',
    aliases: ['tail-light', 'taillight', 'lightning', 'strokeDasharray', 'pathLength', 'dashoffset'],
    reason: 'The request mentioned a moving tracer, so the border trace implementation must remain present.',
  },
  {
    id: 'geojson',
    aliases: ['geojson', 'GeoJSON', 'centerLngLat', 'screenPath'],
    reason: 'The request mentioned map geometry/projection, so geometry fields must stay present.',
  },
];

const HOST_EXTERNALS = new Set([
  'react',
  'react-dom',
  'remotion',
  '@remotion/player',
  '@remotion/renderer',
  '@remotion/lambda',
  '@remotion/media',
  '@remotion/webcodecs',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  '@react-three/postprocessing',
  'postprocessing',
  'shared',
]);

const FILE_EXTENSIONS = ['', '.ts', '.tsx', '.js', '.jsx'];

function normalizeSlash(value: string): string {
  return value.replace(/\\/g, '/').replace(/^.\//, '');
}

function dirname(filePath: string): string {
  const normalized = normalizeSlash(filePath);
  const index = normalized.lastIndexOf('/');
  return index === -1 ? '' : normalized.slice(0, index);
}

function joinLocal(baseDir: string, specifier: string): string {
  const raw = `${baseDir ? `${baseDir}/` : ''}${specifier}`;
  const parts: string[] = [];
  for (const part of normalizeSlash(raw).split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') {
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

function getModules(pending: PendingPluginLike): Record<string, string> {
  if (pending.modules && Object.keys(pending.modules).length > 0) {
    return pending.modules;
  }
  return { 'Scene.tsx': pending.sceneCode ?? '' };
}

function getPackageName(specifier: string): string {
  if (specifier.startsWith('@')) {
    const [scope, name] = specifier.split('/');
    return name ? `${scope}/${name}` : specifier;
  }
  return specifier.split('/')[0] ?? specifier;
}

function resolveLocalImport(filePath: string, specifier: string, modules: Record<string, string>): string | undefined {
  const base = joinLocal(dirname(filePath), specifier);
  for (const ext of FILE_EXTENSIONS) {
    const candidate = `${base}${ext}`;
    if (modules[candidate] !== undefined) return candidate;
  }
  for (const ext of FILE_EXTENSIONS.filter(Boolean)) {
    const candidate = `${base}/index${ext}`;
    if (modules[candidate] !== undefined) return candidate;
  }
  return undefined;
}

function collectImportSpecifiers(code: string): string[] {
  const specs = new Set<string>();
  const patterns = [
    /\bimport\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
    /\bexport\s+(?:type\s+)?[\s\S]*?\s+from\s+['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
    /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      if (match[1]) specs.add(match[1]);
    }
  }

  return [...specs];
}

export function analyzePluginImports(
  modules: Record<string, string>,
  dependencies: Record<string, string> = {},
): { imports: PluginImportRecord[]; issues: PluginImportIssue[]; warnings: string[] } {
  const imports: PluginImportRecord[] = [];
  const issues: PluginImportIssue[] = [];
  const warnings: string[] = [];

  for (const [file, code] of Object.entries(modules)) {
    for (const specifier of collectImportSpecifiers(code)) {
      if (specifier.startsWith('.') || specifier.startsWith('/')) {
        const resolved = resolveLocalImport(file, specifier, modules);
        imports.push({ file, specifier, kind: 'local', resolved });
        if (!resolved) {
          issues.push({
            file,
            specifier,
            message: `Local import "${specifier}" does not resolve from ${file}. Create the file or fix the import.`,
          });
        }
        continue;
      }

      const packageName = getPackageName(specifier);
      imports.push({ file, specifier, kind: 'external', packageName });
      if (HOST_EXTERNALS.has(packageName) || packageName.startsWith('@remotion/')) continue;
      if (dependencies[packageName] === undefined) {
        issues.push({
          file,
          specifier,
          message:
            `External package "${packageName}" is imported by ${file} but not declared in dependencies. ` +
            `Add dependencies: { "${packageName}": "<semver>" } with updateDependencies or setInitialScene before compiling. ` +
            'Do not switch to CDN/dynamic script loading unless sandbox package install is truly impossible.',
        });
      }
    }
  }

  return { imports, issues, warnings };
}

function promptMentions(prompt: string, term: PluginTrackedTerm): boolean {
  const compact = prompt.toLowerCase().replace(/[\s_-]+/g, '');
  const normal = prompt.toLowerCase();
  return term.aliases.some((alias) => {
    const lower = alias.toLowerCase();
    return normal.includes(lower) || compact.includes(lower.replace(/[\s_-]+/g, ''));
  });
}

function buildSearchText(pending: PendingPluginLike): string {
  const modules = getModules(pending);
  return [
    pending.description ?? '',
    pending.schemaJson ?? '',
    Object.keys(pending.dependencies ?? {}).join(' '),
    Object.values(modules).join('\n'),
  ].join('\n');
}

function parseSchema(schemaJson?: string): Record<string, any> | null {
  if (!schemaJson) return null;
  try {
    const parsed = JSON.parse(schemaJson);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function schemaHasPreviewValue(schema: Record<string, any> | null, field: string): boolean {
  if (!schema) return false;
  const rootDefaults = schema.defaults && typeof schema.defaults === 'object' ? schema.defaults : {};
  const property = schema.properties?.[field];
  const value = rootDefaults[field] ?? property?.default;
  return value !== undefined && value !== null && String(value).trim() !== '';
}

function codeHasFallbackForDataField(source: string, field: string): boolean {
  const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`data\\.${escaped}[^\\n;,)\\]}]*(?:\\?\\?|\\|\\|)\\s*['"\`]`, 'm').test(source);
}

function detectVisualIssues(pending: PendingPluginLike): PluginVisualIssue[] {
  const modules = getModules(pending);
  const schema = parseSchema(pending.schemaJson);
  const issues: PluginVisualIssue[] = [];

  for (const [file, source] of Object.entries(modules)) {
    if (/\breturn\s+null\b/.test(source)) {
      issues.push({ file, message: 'Scene/component returns null, so preview can be blank.' });
    }
    if (/<AbsoluteFill\s*\/>/.test(source)) {
      issues.push({ file, message: 'Scene renders an empty <AbsoluteFill /> with no visible children.' });
    }
  }

  const combined = Object.entries(modules)
    .map(([file, source]) => `/* ${file} */\n${source}`)
    .join('\n');

  const hasVisiblePrimitive = /<(?:AbsoluteFill|div|section|main|svg|canvas|Img|img|video|span|p|h1|h2|h3|[A-Z][A-Za-z0-9_]*)\b/.test(combined);
  const hasPaintSignal = /(?:background|color|fill|stroke|boxShadow|textShadow|gradient|linearGradient|radialGradient|fontSize|border|opacity|transform)/.test(combined);
  if (!hasVisiblePrimitive || !hasPaintSignal) {
    issues.push({
      file: 'Scene.tsx',
      message: 'No clear visible painted element was detected. Add a full-frame background and at least one visible text/shape/image layer.',
    });
  }

  const dataFields = new Set<string>();
  for (const match of combined.matchAll(/\bdata\.(\w+)/g)) {
    dataFields.add(match[1]);
  }

  for (const field of dataFields) {
    if (schemaHasPreviewValue(schema, field) || codeHasFallbackForDataField(combined, field)) continue;
    issues.push({
      file: 'schema.json',
      message: `data.${field} is used by the scene but has no non-empty schema default and no inline fallback. Preview may render empty.`,
    });
  }

  return issues;
}

function containsRequirement(searchText: string, term: PluginTrackedTerm): boolean {
  const compact = searchText.toLowerCase().replace(/[\s_-]+/g, '');
  const normal = searchText.toLowerCase();

  if (term.id === 'generation-fields') {
    return (
      normal.includes('generationfields') ||
      normal.includes('generation fields') ||
      normal.includes('removebackground') ||
      normal.includes('removebackground') ||
      normal.includes('"editor": "image"') ||
      normal.includes('"editor":"image"') ||
      normal.includes("'editor': 'image'")
    );
  }

  return term.aliases.some((alias) => {
    const lower = alias.toLowerCase();
    return normal.includes(lower) || compact.includes(lower.replace(/[\s_-]+/g, ''));
  });
}

function deriveHardRequirements(sourcePrompt: string): PluginTrackedTerm[] {
  return KNOWN_REQUIREMENTS.filter((term) => promptMentions(sourcePrompt, term));
}

function createSnapshot(pending: PendingPluginLike): PluginLedgerSnapshot {
  const modules = getModules(pending);
  const dependencies = pending.dependencies ?? {};
  const { imports } = analyzePluginImports(modules, dependencies);
  return {
    files: Object.keys(modules).sort(),
    dependencies: Object.keys(dependencies).sort(),
    imports,
  };
}

export function createPluginRunLedger(pending: PendingPluginLike, sourcePrompt: string): PluginRunLedger {
  const now = new Date().toISOString();
  const ledger: PluginRunLedger = {
    version: 1,
    sourcePrompt,
    hardRequirements: deriveHardRequirements(sourcePrompt),
    baseline: createSnapshot(pending),
    events: [],
    createdAt: now,
    updatedAt: now,
  };

  ledger.events.push({
    type: 'init',
    summary: `Initialized plugin run ledger with ${ledger.hardRequirements.length} hard requirement(s).`,
    at: now,
  });

  return ledger;
}

export function createPluginExecutionState(params: {
  pluginId: string;
  mode?: 'create' | 'modify';
  frozenContracts?: Partial<PluginFrozenContracts>;
  steps: Array<{
    id: string;
    title: string;
    category: PluginWorkCategory;
    owner: PluginExecutionStep['owner'];
    goal: string;
    files?: string[];
    hypothesis?: string;
    evidence?: string[];
    failureMode?: string;
    dependsOn?: string[];
  }>;
  lastReconAt?: string | null;
  lastReconOverallHash?: string | null;
}): PluginExecutionState {
  const now = new Date().toISOString();
  return {
    version: 1,
    pluginId: params.pluginId,
    mode: params.mode ?? 'create',
    frozenContracts: {
      schemaPaths: params.frozenContracts?.schemaPaths ?? [],
      files: params.frozenContracts?.files ?? [],
      dependencies: params.frozenContracts?.dependencies ?? {},
      generationFields: params.frozenContracts?.generationFields ?? [],
      notes: params.frozenContracts?.notes ?? [],
    },
    steps: params.steps.map((step) => ({
      id: step.id,
      title: step.title,
      category: step.category,
      owner: step.owner,
      goal: step.goal,
      files: step.files ?? [],
      status: 'pending',
      attempts: 0,
      issues: [],
      hypothesis: step.hypothesis,
      evidence: step.evidence,
      failureMode: step.failureMode,
      dependsOn: step.dependsOn,
    })),
    deviations: [],
    lastReconAt: params.lastReconAt ?? null,
    lastReconOverallHash: params.lastReconOverallHash ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export function attachPluginExecutionState(
  pending: PendingPluginLike,
  execution: PluginExecutionState | null | undefined,
): PendingPluginLike {
  if (!execution || !pending.runLedger) return pending;
  const now = new Date().toISOString();
  return {
    ...pending,
    runLedger: {
      ...pending.runLedger,
      execution,
      events: [
        ...pending.runLedger.events.slice(-24),
        {
          type: 'plan',
          summary: `Registered ${execution.steps.length} execution step(s). Core logic: ${execution.steps.filter((s) => s.category === 'core_remotion_logic').length}; glue: ${execution.steps.filter((s) => s.category === 'glue_code').length}.`,
          at: now,
        },
      ],
      updatedAt: now,
    },
  };
}

export function updatePluginExecutionStep(
  execution: PluginExecutionState,
  params: {
    stepId: string;
    status?: PluginStepStatus;
    summary?: string;
    issues?: PluginStepIssue[];
  },
): PluginExecutionState {
  const now = new Date().toISOString();
  return {
    ...execution,
    currentStepId: params.status === 'in_progress' ? params.stepId : execution.currentStepId,
    steps: execution.steps.map((step) => {
      if (step.id !== params.stepId) return step;
      return {
        ...step,
        status: params.status ?? step.status,
        attempts: params.status === 'in_progress' ? step.attempts + 1 : step.attempts,
        summary: params.summary ?? step.summary,
        issues: params.issues ?? step.issues,
      };
    }),
    updatedAt: now,
  };
}

export function summarizePluginExecution(execution: PluginExecutionState | null | undefined): string {
  if (!execution) return 'No execution plan registered yet.';
  const lines = execution.steps.map((step) => {
    const issueSummary = step.issues?.length
      ? ` Issues: ${step.issues.map((issue) => `${issue.type}${issue.fixed ? ' fixed' : ''}`).join(', ')}.`
      : '';
    const hypothesisTag = step.hypothesis ? ` [hypothesis: ${step.hypothesis.slice(0, 80)}${step.hypothesis.length > 80 ? '…' : ''}]` : '';
    return `- ${step.id} [${step.status}, ${step.category}, ${step.owner}]${hypothesisTag}: ${step.summary ?? step.goal}.${issueSummary}`;
  });
  const deviations = execution.deviations ?? [];
  if (deviations.length > 0) {
    lines.push(`Deviations (${deviations.length}):`);
    for (const d of deviations.slice(-5)) {
      lines.push(`  • ${d.stepId} → ${d.resolution}: ${d.reason}`);
    }
  }
  return lines.join('\n');
}

export function validatePluginRunState(pending: PendingPluginLike): PluginGuardResult {
  const modules = getModules(pending);
  const dependencies = pending.dependencies ?? {};
  const ledger = pending.runLedger;
  const hardRequirements = ledger?.hardRequirements ?? [];
  const searchText = buildSearchText(pending);
  const { imports, issues, warnings } = analyzePluginImports(modules, dependencies);
  const visualIssues = detectVisualIssues(pending);

  const missingRequirements = hardRequirements
    .filter((term) => !containsRequirement(searchText, term))
    .map((term) => `${term.id}: ${term.reason}`);

  return {
    ok: missingRequirements.length === 0 && issues.length === 0 && visualIssues.length === 0,
    hardRequirements,
    missingRequirements,
    importIssues: issues,
    visualIssues,
    warnings,
    snapshot: {
      files: Object.keys(modules).sort(),
      dependencies: Object.keys(dependencies).sort(),
      imports,
    },
  };
}

export function appendPluginLedgerEvent(
  pending: PendingPluginLike,
  event: Omit<PluginLedgerEvent, 'at'>,
): PendingPluginLike {
  const ledger = pending.runLedger;
  if (!ledger) return pending;

  const now = new Date().toISOString();
  return {
    ...pending,
    runLedger: {
      ...ledger,
      events: [...ledger.events.slice(-24), { ...event, at: now }],
      updatedAt: now,
    },
  };
}
