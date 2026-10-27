/**
 * Pack a real on-disk plugin folder into the JSON shape Skygen MCP install tools expect.
 *
 * Preferred agent workflow:
 *   1. Write files under a folder (Scene.tsx, components/*, schema.json, package.json)
 *   2. pack_plugin_dir / validate_plugin_dir / create_plugin_from_dir
 *
 * Only works where the MCP process can read the filesystem (stdio mcp-server on the
 * developer machine). HTTP MCP on Vercel cannot see the client's laptop paths.
 */

import fs from 'fs';
import path from 'path';

const SOURCE_EXTS = new Set(['.tsx', '.ts', '.jsx', '.js', '.css', '.json']);
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.turbo',
  'coverage',
  '.cache',
  '__pycache__',
]);
const SKIP_FILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'tsconfig.json',
  '.gitignore',
  '.npmrc',
  'README.md',
  'readme.md',
]);
/** Not packed as modules — used as metadata instead */
const META_FILES = new Set(['package.json', 'schema.json', 'plugin.json']);

export interface PackedPluginDir {
  success: boolean;
  path: string;
  id: string;
  name: string;
  description: string;
  category: string;
  files: string[];
  modules: Record<string, string>;
  scene_code: string;
  schema_json: string;
  dependencies: Record<string, string>;
  package_json: Record<string, unknown> | null;
  warnings: string[];
  errors: string[];
  /** Ready-to-pass payload for propose_plugin_preview */
  propose_plugin_args: {
    id: string;
    name: string;
    description: string;
    category: string;
    scene_code: string;
    modules: Record<string, string>;
    schema_json: string;
    dependencies: Record<string, string>;
  } | null;
  message: string;
}

function walkFiles(dir: string, base: string, out: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e: any) {
    throw new Error(`Cannot read directory ${dir}: ${e?.message ?? e}`);
  }

  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (SKIP_DIR_NAMES.has(ent.name) || ent.name.startsWith('.')) continue;
      walkFiles(abs, base, out);
      continue;
    }
    if (!ent.isFile()) continue;
    if (SKIP_FILE_NAMES.has(ent.name)) continue;
    if (ent.name.startsWith('.')) continue;
    const ext = path.extname(ent.name).toLowerCase();
    // Always keep package.json / schema.json even if not in SOURCE_EXTS... they are .json
    if (!SOURCE_EXTS.has(ext) && !META_FILES.has(ent.name)) continue;
    out.push(abs);
  }
}

function toPosixRel(from: string, file: string): string {
  return path.relative(from, file).split(path.sep).join('/');
}

function slugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'plugin';
}

/**
 * Read a plugin project folder and produce modules + schema + dependencies JSON.
 */
export function packPluginDir(dirPath: string, opts?: {
  id?: string;
  name?: string;
  description?: string;
  category?: string;
}): PackedPluginDir {
  const warnings: string[] = [];
  const errors: string[] = [];

  const resolved = path.resolve(dirPath);
  if (!fs.existsSync(resolved)) {
    return fail(resolved, `Path does not exist: ${resolved}`);
  }
  if (!fs.statSync(resolved).isDirectory()) {
    return fail(resolved, `Path is not a directory: ${resolved}`);
  }

  const absFiles: string[] = [];
  try {
    walkFiles(resolved, resolved, absFiles);
  } catch (e: any) {
    return fail(resolved, e?.message ?? String(e));
  }

  const modules: Record<string, string> = {};
  let packageJson: Record<string, unknown> | null = null;
  let schemaRaw: string | null = null;
  let pluginMeta: Record<string, unknown> | null = null;

  for (const abs of absFiles) {
    const rel = toPosixRel(resolved, abs);
    const base = path.basename(abs);
    let content: string;
    try {
      content = fs.readFileSync(abs, 'utf-8');
    } catch (e: any) {
      errors.push(`Failed to read ${rel}: ${e?.message ?? e}`);
      continue;
    }

    if (base === 'package.json') {
      try {
        packageJson = JSON.parse(content);
      } catch (e: any) {
        errors.push(`package.json is not valid JSON: ${e?.message ?? e}`);
      }
      continue;
    }
    if (base === 'schema.json') {
      schemaRaw = content;
      continue;
    }
    if (base === 'plugin.json') {
      try {
        pluginMeta = JSON.parse(content);
      } catch (e: any) {
        warnings.push(`plugin.json ignored (invalid JSON): ${e?.message ?? e}`);
      }
      continue;
    }

    // Source modules — normalize Scene entry names
    let moduleKey = rel;
    if (rel === 'index.tsx' || rel === 'index.ts' || rel === 'index.jsx' || rel === 'index.js') {
      if (!modules['Scene.tsx']) {
        moduleKey = 'Scene.tsx';
        warnings.push(`Mapped ${rel} → Scene.tsx (entry)`);
      }
    }
    modules[moduleKey] = content;
  }

  // Entry resolution
  if (!modules['Scene.tsx']) {
    const alt = ['src/Scene.tsx', 'src/index.tsx', 'src/index.ts'].find((k) => modules[k]);
    if (alt) {
      modules['Scene.tsx'] = modules[alt];
      warnings.push(`Using ${alt} as Scene.tsx entry`);
    }
  }

  if (!modules['Scene.tsx']?.trim()) {
    errors.push(
      'Missing Scene.tsx entry. Create Scene.tsx (or index.tsx) exporting default function Scene(...).',
    );
  }

  // schema
  let schema_json = schemaRaw ?? '';
  if (!schema_json.trim()) {
    schema_json = JSON.stringify(
      { properties: {}, defaults: {} },
      null,
      2,
    );
    warnings.push('No schema.json found — used empty { properties: {}, defaults: {} }.');
  } else {
    try {
      JSON.parse(schema_json);
    } catch (e: any) {
      errors.push(`schema.json is not valid JSON: ${e?.message ?? e}`);
    }
  }

  // dependencies from package.json
  const dependencies: Record<string, string> = {};
  if (packageJson) {
    const deps = (packageJson.dependencies ?? {}) as Record<string, string>;
    const peer = (packageJson.peerDependencies ?? {}) as Record<string, string>;
    // Prefer dependencies; peerDependencies are optional hints (often react — stripped later)
    for (const [k, v] of Object.entries(deps)) {
      if (typeof v === 'string') dependencies[k] = v;
    }
    for (const [k, v] of Object.entries(peer)) {
      if (dependencies[k] == null && typeof v === 'string') {
        // Don't force peer react/remotion into install list noise — still include for completeness
        dependencies[k] = v;
      }
    }
  } else {
    warnings.push('No package.json — dependencies will be empty (or auto-detected from imports at validate).');
  }

  const folderName = path.basename(resolved);
  const id =
    opts?.id ||
    (typeof pluginMeta?.id === 'string' ? pluginMeta.id : '') ||
    (typeof packageJson?.name === 'string' ? slugFromName(String(packageJson.name).replace(/^@[^/]+\//, '')) : '') ||
    slugFromName(folderName);

  const name =
    opts?.name ||
    (typeof pluginMeta?.name === 'string' ? pluginMeta.name : '') ||
    (typeof packageJson?.description === 'string' && packageJson.name
      ? String(packageJson.name)
      : '') ||
    folderName;

  const description =
    opts?.description ||
    (typeof pluginMeta?.description === 'string' ? pluginMeta.description : '') ||
    (typeof packageJson?.description === 'string' ? packageJson.description : '') ||
    '';

  const category =
    opts?.category ||
    (typeof pluginMeta?.category === 'string' ? pluginMeta.category : '') ||
    'content';

  const fileList = Object.keys(modules).sort();
  const success = errors.length === 0;

  const propose_plugin_args = success
    ? {
        id,
        name: typeof name === 'string' ? name : folderName,
        description: typeof description === 'string' ? description : '',
        category: typeof category === 'string' ? category : 'content',
        scene_code: modules['Scene.tsx'] ?? '',
        modules,
        schema_json,
        dependencies,
      }
    : null;

  return {
    success,
    path: resolved,
    id,
    name: typeof name === 'string' ? name : folderName,
    description: typeof description === 'string' ? description : '',
    category: typeof category === 'string' ? category : 'content',
    files: fileList,
    modules,
    scene_code: modules['Scene.tsx'] ?? '',
    schema_json,
    dependencies,
    package_json: packageJson,
    warnings,
    errors,
    propose_plugin_args,
    message: success
      ? `Packed ${fileList.length} module file(s) from ${resolved}. Use propose_plugin_preview, passing the properties from propose_plugin_args.`
      : `Pack failed for ${resolved}. Fix errors and retry.`,
  };
}

function fail(pathStr: string, error: string): PackedPluginDir {
  return {
    success: false,
    path: pathStr,
    id: '',
    name: '',
    description: '',
    category: 'content',
    files: [],
    modules: {},
    scene_code: '',
    schema_json: '',
    dependencies: {},
    package_json: null,
    warnings: [],
    errors: [error],
    propose_plugin_args: null,
    message: error,
  };
}

/** Layout docs for agents */
export function getPluginDirLayoutInfo() {
  return {
    recommended_layout: {
      'Scene.tsx': 'Required entry — export default function Scene({ data, theme, animation })',
      'schema.json': 'Required — { "properties": {...}, "defaults": {...} }',
      'package.json': 'Optional — dependencies installed at local validate/create',
      'plugin.json': 'Optional — { id, name, description, category }',
      'components/*.tsx': 'Optional multi-file modules (relative imports from Scene.tsx)',
      'lib/*.ts': 'Optional helpers',
    },
    skip: ['node_modules', 'dist', 'package-lock.json', '.git'],
    workflow: [
      '1. Create folder with real files (MCP client file tools)',
      '2. pack_plugin_dir({ path }) — see packed JSON without install',
      '3. propose_plugin_preview({ ...args }) — propose it for live web preview and user approval',
    ],
    note:
      'Prefer file-based authoring. JSON modules are only for the API boundary. ' +
      'Dir tools require a filesystem-visible path (stdio MCP / local machine). HTTP MCP on Vercel cannot read your laptop disk — use stdio mcp-server or pack via CLI then propose_plugin_preview.',
  };
}
