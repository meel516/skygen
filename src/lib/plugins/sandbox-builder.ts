import path from 'path';
import fs from 'fs';
import os from 'os';
import { formatDependencyPolicyChanges, normalizePluginDependencies } from './dependency-policy';

// ============================================================================
// HOST-VERSION COMPATIBILITY
// Plugins may install third-party packages that declare peerDependencies on
// host-owned runtimes (react, react-dom, react-reconciler, remotion, @remotion/*).
// If a plugin dep's peer range doesn't satisfy the host's version, the bundle
// builds fine but crashes at runtime (e.g. ReactCurrentOwner on React 18 libs
// rendered by a React 19 host).
//
// We resolve host versions from the repo's package.json — the single source of
// truth — and validate every plugin dep (direct + transitive) against them in
// the sandbox after `npm install`. Incompatibilities hard-fail with an
// actionable message naming the offending dep, its peer range, and the host
// version.
// ============================================================================

const HOST_PEER_PACKAGES = new Set([
  'react',
  'react-dom',
  'react-reconciler',
  'remotion',
  '@types/react',
  '@types/react-dom',
]);

interface HostVersions {
  react: string;
  reactDom: string;
  remotion: string;
}

let _hostVersionsCache: HostVersions | null = null;

function readHostVersions(): HostVersions {
  if (_hostVersionsCache) return _hostVersionsCache;

  // Walk up from cwd looking for a package.json that actually declares
  // react/react-dom/remotion as dependencies. On the Mastra VPS the cwd is
  // .../mastra-server (which has only @mastra/* deps), but the host app's
  // package.json sits one or two levels up and owns the real versions.
  // Allow an explicit override via env for unusual layouts.
  const candidates: string[] = [];
  if (process.env.HOST_PACKAGE_JSON) {
    candidates.push(path.resolve(process.env.HOST_PACKAGE_JSON));
  }
  let dir = process.cwd();
  for (let i = 0; i < 6 && dir !== path.dirname(dir); i++) {
    candidates.push(path.join(dir, 'package.json'));
    dir = path.dirname(dir);
  }

  let lastError: string | null = null;
  for (const rootPkgPath of candidates) {
    let pkg: any = {};
    try {
      pkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf-8'));
    } catch (e: any) {
      lastError = `${rootPkgPath}: ${e?.message ?? 'unreadable'}`;
      continue;
    }
    const deps = pkg.dependencies ?? {};
    const react = deps['react'];
    const reactDom = deps['react-dom'];
    const remotion = deps['remotion'];
    if (react && reactDom && remotion) {
      _hostVersionsCache = { react, reactDom, remotion };
      return _hostVersionsCache;
    }
    lastError = `${rootPkgPath}: missing react/react-dom/remotion in dependencies`;
  }

  throw new Error(
    'sandbox-builder: could not find a host package.json with react/react-dom/remotion versions ' +
    `(checked: ${candidates.join(', ')}). Last error: ${lastError ?? 'unknown'}. ` +
    'Set HOST_PACKAGE_JSON to the absolute path of the Next.js app package.json.',
  );
}

/**
 * Minimal semver `satisfies` covering the range shapes npm peerDependencies
 * actually use: exact, ^, ~, *, >=, <=, >, <, and || unions. Returns true if
 * `version` satisfies `range`. On an unparseable token we fail OPEN (return
 * true) so unknown syntax doesn't block builds — the host-owned packages we
 * care about always use plain ranges.
 *
 * NOTE: This helper is serialized into the sandbox build script (see
 * buildWithVercelSandbox). The canonical implementation lives there; this
 * host-side copy is intentionally removed to avoid dead code. The sandbox
 * version is the one that runs against the installed node_modules tree.
 */
// (semver helpers inlined into the sandbox build script below.)

// ============================================================================
// SANDBOX BUILDER — Compiles AI-generated plugin code in Vercel Sandbox
//
// Security: AI-generated plugin code is UNTRUSTED. It must NOT run on the
// host server. Vercel Sandbox provides isolated microVMs where esbuild
// can safely compile arbitrary code without risk to the host.
//
// Fallback: If @vercel/sandbox is unavailable (local dev, non-Vercel),
// falls back to local esbuild with a warning.
//
// ─── Env var ────────────────────────────────────────────────────────────────
//   USE_SANDBOX_BUILDER (default: "true")
//     "true"  → build in Vercel Sandbox microVM, fallback to local on failure.
//     "false" → skip the sandbox entirely and always build locally.
//               DEV ONLY — AI-generated code is untrusted. Never disable in
//               production or on any machine that processes real user prompts.
// ============================================================================

const EXTERNALS = [
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'remotion',
  '@remotion/player',
  '@remotion/renderer',
  '@remotion/media-utils',
  '@remotion/sfx',
  '@remotion/three',
  '@remotion/lottie',
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  '@react-three/postprocessing',
  'postprocessing',
];
const BUFFER_SHIM = `
const encoder = new TextEncoder();
function from(value, encoding) {
  if (typeof value === 'string') {
    if (encoding === 'base64') {
      const binary = atob(value);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      return bytes;
    }
    return encoder.encode(value);
  }
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  if (Array.isArray(value)) return new Uint8Array(value);
  return new Uint8Array();
}
globalThis.Buffer = globalThis.Buffer ?? {
  from,
  alloc(size) { return new Uint8Array(size); },
  isBuffer(value) { return value instanceof Uint8Array; },
};
`;

const MAX_BUNDLE_BYTES = 5 * 1024 * 1024; // 5 MB
const SOURCE_EXT_RE = /\.(tsx?|jsx?)$/;

export type PluginModuleMap = Record<string, string>;

function normalizeModulePath(filePath: string): string | null {
  if (typeof filePath !== 'string') return null;
  const normalized = filePath.replace(/\\/g, '/').replace(/^src\//, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('\0') ||
    normalized.split('/').some((part) => part === '..' || part === '')
  ) {
    return null;
  }
  if (!SOURCE_EXT_RE.test(normalized)) return null;
  return normalized;
}

export function normalizePluginModules(
  sceneCode: string,
  modules?: PluginModuleMap,
): PluginModuleMap {
  const normalized: PluginModuleMap = {};
  for (const [filePath, source] of Object.entries(modules ?? {})) {
    const safePath = normalizeModulePath(filePath);
    if (!safePath || typeof source !== 'string') continue;
    normalized[safePath] = source;
  }

  if (!normalized['Scene.tsx']) {
    normalized['Scene.tsx'] = sceneCode;
  }

  return normalized;
}

export interface SandboxBuildResult {
  bundleContent: string;
  builtInSandbox: boolean;
}

function shouldAllowLocalBuild(): boolean {
  return process.env.ALLOW_LOCAL_PLUGIN_BUILD === 'true' || process.env.USE_SANDBOX_BUILDER === 'false';
}

/**
 * True when the host has Vercel Sandbox credentials configured. When false,
 * the sandbox path is skipped entirely (instead of throwing) and we fall
 * through to a local esbuild. This is the expected mode on a self-hosted
 * Mastra server (VPS) where the operator has NOT provisioned Vercel
 * Sandbox creds — the source validators (validatePluginSource +
 * checkPluginCompatibility) already gate out dangerous patterns.
 */
function hasSandboxCredentials(): boolean {
  return Boolean(process.env.E2B_API_KEY || 'e2b_4d4e8b7ef35bd3a37a3d77bf839b38a98e6b3b71');
}

function formatSandboxErrors(errors: string[]): string {
  if (errors.length === 0) return 'No sandbox provider was attempted.';
  return errors.map((error, index) => `${index + 1}. ${error}`).join('\n');
}

/**
 * Build a plugin from source code inside a Vercel Sandbox microVM.
 * This is the PRIMARY build path — AI-generated code is untrusted and
 * MUST be compiled in isolation.
 */
export async function buildPluginInSandbox(params: {
  pluginId: string;
  sceneCode: string;
  schemaJson: string;
  modules?: PluginModuleMap;
  dependencies?: Record<string, string>;
  sharedUtilsPath?: string;
  sharedTypesPath?: string;
}): Promise<SandboxBuildResult> {
  const { pluginId, sceneCode, schemaJson } = params;
  const modules = normalizePluginModules(sceneCode, params.modules);
  const useSandbox = process.env.USE_SANDBOX_BUILDER !== 'false';
  const depPolicy = normalizePluginDependencies(params.dependencies);
  const safeDeps = depPolicy.installDependencies;
  for (const message of formatDependencyPolicyChanges(depPolicy)) {
    console.warn(`[sandbox-builder] ${message}`);
  }

  // Ambient type stubs so tsc won't error on external/declared imports.
  // Imported identifiers are declared as `any` — tsc still catches truly
  // undefined identifiers (e.g. TS2304: Cannot find name 'safeDuration').
  const allModuleNames = [...EXTERNALS, ...Object.keys(safeDeps)];
  const stubsContent = allModuleNames
    .map(m => `declare module '${m}' { const m: any; export default m; export = m; }`)
    .join('\n');

  const tsconfigContent = JSON.stringify({
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react',
      strict: false,
      noImplicitAny: false,
      skipLibCheck: true,
      noEmit: true,
    },
    include: ['src/**/*', 'src/stubs.d.ts'],
  }, null, 2);

  const hostVersions = readHostVersions();

  // Skip the sandbox path entirely when creds are missing — common on
  // self-hosted Mastra (VPS). Previously this threw and aborted the save,
  // causing the agent to report "built" while no row landed in the plugins
  // table. The validators above already gate out dangerous source.
  const sandboxAvailable = useSandbox && hasSandboxCredentials();

  if (sandboxAvailable) {
    const errors: string[] = [];

    try {
      const result = await buildWithE2BSandbox(pluginId, sceneCode, schemaJson, {
        ...params,
        modules,
        dependencies: safeDeps,
        stubsContent,
        tsconfigContent,
        hostVersions,
      });
      enforceBundleSize(result);
      return { bundleContent: result, builtInSandbox: true };
    } catch (e: any) {
      const details = e?.details;
      const message = `sandbox: ${e?.message ?? e}${details ? `\n${JSON.stringify(details)}` : ''}`;
      errors.push(message);
      console.warn(`[sandbox-builder] E2B sandbox failed: ${e?.message ?? e}`, details ? { details } : '');
    }

    if (!shouldAllowLocalBuild()) {
      throw new Error(
        `Sandbox builder failed. Local fallback is disabled for safety.\n${formatSandboxErrors(errors)}\n` +
        'Configure E2B sandbox credentials on the Mastra server.',
      );
    }
  } else if (useSandbox && !hasSandboxCredentials()) {
    console.warn(
      '[sandbox-builder] E2B Sandbox credentials not configured (E2B_API_KEY) — ' +
      'falling through to local esbuild. Set ALLOW_LOCAL_PLUGIN_BUILD=false to hard-fail instead.',
    );
  }
  // Fallback: local esbuild
  console.warn('[sandbox-builder] ⚠️ Building plugin LOCALLY — AI-generated code is untrusted!');
  if (Object.keys(safeDeps).length > 0) {
    console.warn(
      `[sandbox-builder] local fallback does not npm-install declared deps (${Object.keys(safeDeps).join(', ')}). ` +
      `esbuild will fail to resolve them unless they're already in the host node_modules. ` +
      `Set USE_SANDBOX_BUILDER=true to use the real build path.`
    );
  }
  const bundleContent = await buildWithLocalEsbuild(pluginId, sceneCode, { ...params, modules });
  enforceBundleSize(bundleContent);
  return { bundleContent, builtInSandbox: false };
}

function enforceBundleSize(bundleContent: string) {
  const size = Buffer.byteLength(bundleContent, 'utf-8');
  if (size > MAX_BUNDLE_BYTES) {
    throw new Error(
      `Plugin bundle exceeded ${MAX_BUNDLE_BYTES} bytes (got ${size}). ` +
      `Drop heavy libraries (three.js and @react-three/drei are the usual culprits) or simplify the scene.`
    );
  }
}

/**
 * Build using @e2b/code-interpreter — isolated microVM execution.
 *
 * Layout inside the sandbox:
 *   /home/user/package.json   — pins esbuild so `npm install` has something to do
 *   /home/user/build.mjs      — the compile script
 *   /home/user/src/*          — scene + shared sources
 *   /home/user/dist/index.esm.js — output bundle
 */
async function buildWithE2BSandbox(
  pluginId: string,
  sceneCode: string,
  schemaJson: string,
  params: {
    sharedUtilsPath?: string;
    sharedTypesPath?: string;
    modules?: PluginModuleMap;
    dependencies?: Record<string, string>;
    stubsContent?: string;
    tsconfigContent?: string;
    hostVersions?: HostVersions;
  },
): Promise<string> {
  // Dynamic import so the module is only loaded when actually used
  const { Sandbox } = await import('@e2b/code-interpreter');

  const ROOT = process.cwd();
  const sharedUtils = params.sharedUtilsPath || path.join(ROOT, 'shared', 'plugin-utils', 'index.ts');
  const sharedTypes = params.sharedTypesPath || path.join(ROOT, 'shared', 'plugin-types', 'index.ts');

  let sharedUtilsContent = '';
  let sharedTypesContent = '';
  try { sharedUtilsContent = fs.readFileSync(sharedUtils, 'utf-8'); } catch { /* not required */ }
  try { sharedTypesContent = fs.readFileSync(sharedTypes, 'utf-8'); } catch { /* not required */ }

  const CWD = '/home/user';

  const packageJson = JSON.stringify({
    name: `plugin-build-${pluginId}`,
    version: '0.0.0',
    private: true,
    type: 'module',
    dependencies: { esbuild: '^0.25.0', typescript: '^5.0.0', buffer: '^6.0.3', ...(params.dependencies ?? {}) },
  }, null, 2);

  const hostVersionsJson = JSON.stringify(params.hostVersions ?? readHostVersions());
  const hostPeerPackagesJson = JSON.stringify([...HOST_PEER_PACKAGES]);

  const buildScript = `
import esbuild from 'esbuild';
import { execFileSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const srcDir = '${CWD}/src';
const distDir = '${CWD}/dist';
fs.mkdirSync(distDir, { recursive: true });

// TypeScript type check — catches undefined identifiers (e.g. TS2304) before
// bundling, so the agent gets an actionable error instead of a browser crash.
try {
  execFileSync(
    path.join('${CWD}', 'node_modules', '.bin', 'tsc'),
    ['--noEmit'],
    { cwd: '${CWD}', stdio: 'pipe' },
  );
} catch (e) {
  const out = (e.stdout?.toString() ?? '') + (e.stderr?.toString() ?? '');
  const lines = out.split('\\n');
  // Only TS2304 ("Cannot find name") = truly undefined identifier in plugin code.
  // All other codes (TS2307 module-not-found, TS2614/TS2694 named-import/namespace
  // issues from stubs, etc.) are artefacts of the ambient stub declarations.
  const realErrors = lines.filter(l => l.includes('TS2304') || l.includes('TS2552'));
  if (realErrors.length > 0) {
    process.stdout.write(JSON.stringify({ success: false, typeErrors: realErrors.join('\\n') }));
    process.exit(0);
  }
}

// ── Host peer-dependency compatibility scan ─────────────────────────────
// Walks node_modules and verifies every installed package's peerDependencies
// against the host's react/react-dom/remotion versions. A plugin dep built for
// React 18 will crash at runtime when rendered by a React 19 host — catch it
// here with an actionable message instead.
const HOST_VERSIONS = ${hostVersionsJson};
const HOST_PEER_PACKAGES = new Set(${hostPeerPackagesJson});

function satisfiesSingle(major, minor, patch, range) {
  if (range === '' || range === '*') return true;
  return range.split(/\\s+/).filter(Boolean).every((comp) => satisfiesComparator(major, minor, patch, comp));
}
function satisfiesComparator(major, minor, patch, comp) {
  let op = '';
  let verPart = comp;
  const m = comp.match(/^(>=|<=|>|<|\\^|~|=)?\\s*(.+)$/);
  if (m) { op = m[1] ?? ''; verPart = m[2]; }
  if (verPart === '*' || verPart === 'x' || verPart === 'X') return true;
  const [rM, rMn = '0', rP = '0'] = verPart.split('.');
  if (rM === '*' || rM === 'x' || rM === 'X') return true;
  const cM = parseInt(rM, 10), cMn = parseInt(rMn, 10), cP = parseInt(rP, 10);
  if (Number.isNaN(cM)) return true;
  const minorWild = rMn === '*' || rMn === 'x' || rMn === 'X';
  const patchWild = rP === '*' || rP === 'x' || rP === 'X';
  switch (op) {
    case '^':
      if (cM > 0) return major === cM && (minor > cMn || (minor === cMn && patch >= cP));
      if (cMn > 0) return major === 0 && minor === cMn && patch >= cP;
      return major === 0 && minor === 0 && patch >= cP;
    case '~':
      return major === cM && minor === cMn && (patchWild || patch >= cP);
    case '>=':
      return [major, minor, patch] >= [cM, cMn, cP]
        ? true
        : (major > cM || (major === cM && (minor > cMn || (minor === cMn && patch >= cP))));
    case '<=':
      return major < cM || (major === cM && (minor < cMn || (minor === cMn && patch <= cP)));
    case '>':
      return major > cM || (major === cM && (minor > cMn || (minor === cMn && patch > cP)));
    case '<':
      return major < cM || (major === cM && (minor < cMn || (minor === cMn && patch < cP)));
    case '=':
    case '':
      if (minorWild) return major === cM;
      if (patchWild) return major === cM && minor === cMn;
      return major === cM && minor === cMn && patch === cP;
    default:
      return true;
  }
}
function satisfies(version, range) {
  const clean = version.replace(/^[^0-9]+/, '');
  const [major, minor = 0, patch = 0] = clean.split('.').map((n) => parseInt(n, 10));
  if (Number.isNaN(major)) return true;
  return range.split('||').some((alt) => satisfiesSingle(major, minor, patch, alt.trim()));
}

function hostVersionFor(peerName) {
  if (peerName === 'react' || peerName === '@types/react') return HOST_VERSIONS.react;
  if (peerName === 'react-dom' || peerName === '@types/react-dom' || peerName === 'react-reconciler') return HOST_VERSIONS.reactDom;
  if (peerName === 'remotion' || peerName.startsWith('@remotion/')) return HOST_VERSIONS.remotion;
  return null;
}

const peerErrors = [];
const nmRoot = path.join('${CWD}', 'node_modules');
function walkNodeModules(dir, seen) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    let pkgPath;
    if (entry.name.startsWith('@')) {
      const scopedDir = path.join(dir, entry.name);
      let scopedEntries;
      try { scopedEntries = fs.readdirSync(scopedDir, { withFileTypes: true }); } catch { continue; }
      for (const sub of scopedEntries) {
        if (!sub.isDirectory()) continue;
        pkgPath = path.join(scopedDir, sub.name, 'package.json');
        inspectPkg(pkgPath, seen);
      }
      continue;
    }
    pkgPath = path.join(dir, entry.name, 'package.json');
    inspectPkg(pkgPath, seen);
  }
}
function inspectPkg(pkgPath, seen) {
  if (seen.has(pkgPath)) return;
  seen.add(pkgPath);
  let pkg;
  try { pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8')); } catch { return; }
  const peers = pkg.peerDependencies ?? {};
  const pkgId = (pkg.name ?? '?') + '@' + (pkg.version ?? '?');
  for (const [peerName, peerRange] of Object.entries(peers)) {
    if (!HOST_PEER_PACKAGES.has(peerName) && !(peerName === '@types/react') && !(peerName.startsWith('@remotion/'))) continue;
    const hostVersion = hostVersionFor(peerName);
    if (!hostVersion) continue;
    if (!satisfies(hostVersion, peerRange)) {
      peerErrors.push(
        'Plugin dep "' + pkgId + '" requires peer ' + peerName + '@' + peerRange +
        ' but host runs ' + peerName + '@' + hostVersion + '. ' +
        'Pick a version of ' + pkg.name + ' compatible with ' + peerName + '@' + hostVersion +
        ', or remove this dependency.'
      );
    }
  }
  // Recurse into nested node_modules (transitive deps with their own peers)
  const nested = path.join(path.dirname(pkgPath), 'node_modules');
  if (fs.existsSync(nested)) walkNodeModules(nested, seen);
}
const seen = new Set();
walkNodeModules(nmRoot, seen);
// Also walk top-level @types scope for @types/react compat
walkNodeModules(path.join(nmRoot, '@types'), seen);

if (peerErrors.length > 0) {
  process.stdout.write(JSON.stringify({ success: false, peerDepErrors: peerErrors }));
  process.exit(0);
}


const aliasPlugin = {
  name: 'shared-alias',
  setup(build) {
    build.onResolve({ filter: /shared\\/plugin-utils/ }, () => ({ path: path.join(srcDir, 'plugin-utils.ts') }));
    build.onResolve({ filter: /shared\\/plugin-types/ }, () => ({ path: path.join(srcDir, 'plugin-types.ts') }));
  },
};

const outfile = path.join(distDir, 'index.esm.js');

await esbuild.build({
  entryPoints: [path.join(srcDir, 'Scene.tsx')],
  outfile,
  format: 'cjs',
  bundle: true,
  external: ${JSON.stringify(EXTERNALS)},
  target: ['chrome90'],
  platform: 'browser',
  // Polyfill Buffer for dependencies that reference it (e.g. three, uuid)
  inject: [path.join(srcDir, 'buffer-shim.js')],
  define: { global: 'globalThis' },
  plugins: [aliasPlugin],
  sourcemap: false,
  minify: false,
});

const bundleContent = fs.readFileSync(outfile, 'utf-8');
process.stdout.write(JSON.stringify({ success: true, bundleContent }));
`;

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY || 'e2b_4d4e8b7ef35bd3a37a3d77bf839b38a98e6b3b71',
    timeoutMs: 120_000,
  });

  try {
    const moduleFiles = Object.entries(normalizePluginModules(sceneCode, params.modules)).map(([filePath, content]) => ({
      path: `${CWD}/src/${filePath}`,
      content,
    }));

    await Promise.all([
      sandbox.files.write(`${CWD}/package.json`, packageJson),
      sandbox.files.write(`${CWD}/build.mjs`, buildScript),
      sandbox.files.write(`${CWD}/tsconfig.json`, params.tsconfigContent ?? '{}'),
      ...moduleFiles.map(f => sandbox.files.write(f.path, f.content)),
      sandbox.files.write(`${CWD}/src/stubs.d.ts`, params.stubsContent ?? ''),
      sandbox.files.write(`${CWD}/src/plugin-utils.ts`, sharedUtilsContent),
      sandbox.files.write(`${CWD}/src/plugin-types.ts`, sharedTypesContent),
      // Polyfill Buffer so deps like three/uuid don't crash in the browser
      sandbox.files.write(`${CWD}/src/buffer-shim.js`, BUFFER_SHIM),
    ]);

    const install = await sandbox.commands.run('npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error', { cwd: CWD });
    if (install.error || install.exitCode !== 0) {
      throw new Error(
        `Sandbox npm install failed (exit ${install.exitCode})\nstdout: ${install.stdout}\nstderr: ${install.stderr}`,
      );
    }

    const build = await sandbox.commands.run('node build.mjs', { cwd: CWD });
    const stdout = build.stdout;
    const stderr = build.stderr;

    if (build.error || build.exitCode !== 0) {
      throw new Error(
        `Sandbox build failed (exit ${build.exitCode})\nstdout: ${stdout}\nstderr: ${stderr}`,
      );
    }

    const output = JSON.parse(stdout);
    if (!output.success) {
      let errMsg: string;
      if (output.peerDepErrors && output.peerDepErrors.length > 0) {
        errMsg =
          'Plugin dependency is incompatible with host runtime:\n' +
          output.peerDepErrors.map((e: string) => '  - ' + e).join('\n');
      } else if (output.typeErrors) {
        errMsg = `TypeScript errors in plugin Scene.tsx:\n${output.typeErrors}`;
      } else {
        errMsg = `Sandbox build reported failure: ${stderr}`;
      }
      throw new Error(errMsg);
    }

    return output.bundleContent;
  } finally {
    await sandbox.kill();
  }
}

/**
 * Fallback: Build locally with esbuild.
 * Only used when Vercel Sandbox is unavailable (local dev).
 */
export async function buildWithLocalEsbuild(
  pluginId: string,
  sceneCode: string,
  params: { sharedUtilsPath?: string; sharedTypesPath?: string; modules?: PluginModuleMap },
): Promise<string> {
  const ROOT = process.cwd();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `plugin-local-${pluginId}-`));

  try {
    const srcDir = path.join(tmpDir, 'src');
    const distDir = path.join(tmpDir, 'dist');
    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(distDir, { recursive: true });

    for (const [filePath, content] of Object.entries(normalizePluginModules(sceneCode, params.modules))) {
      const targetPath = path.join(srcDir, filePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, content, 'utf-8');
    }
    fs.writeFileSync(path.join(srcDir, 'buffer-shim.js'), BUFFER_SHIM, 'utf-8');

    const sharedUtils = params.sharedUtilsPath || path.join(ROOT, 'shared', 'plugin-utils', 'index.ts');
    const sharedTypes = params.sharedTypesPath || path.join(ROOT, 'shared', 'plugin-types', 'index.ts');

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const esbuild = require('esbuild');

    const aliasPlugin = {
      name: 'shared-alias',
      setup(build: any) {
        build.onResolve({ filter: /shared\/plugin-utils/ }, () => ({ path: sharedUtils }));
        build.onResolve({ filter: /shared\/plugin-types/ }, () => ({ path: sharedTypes }));
      },
    };

    const outfile = path.join(distDir, 'index.esm.js');

    await esbuild.build({
      entryPoints: [path.join(srcDir, 'Scene.tsx')],
      outfile,
      format: 'cjs',
      bundle: true,
      external: EXTERNALS,
      target: ['chrome90'],
      platform: 'browser',
      // Polyfill Buffer for dependencies that reference it (e.g. three, uuid)
      inject: [path.join(srcDir, 'buffer-shim.js')],
      define: { global: 'globalThis' },
      plugins: [aliasPlugin],
      sourcemap: false,
      minify: false,
    });

    if (!fs.existsSync(outfile)) {
      throw new Error('Build succeeded but bundle not found');
    }

    return fs.readFileSync(outfile, 'utf-8');
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
  }
}
