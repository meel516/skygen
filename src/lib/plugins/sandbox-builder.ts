import path from 'path';
import fs from 'fs';
import os from 'os';
import { formatDependencyPolicyChanges, normalizePluginDependencies, getPluginBuildDependencies } from './dependency-policy';
import { findHostPackageJson, readHostDependencyVersions } from './host-dependencies';
import { PLUGIN_RUNTIME_IMPORTS, PLUGIN_RUNTIME_PACKAGES, pluginRuntimeExternals } from './runtime-contract';
import { PluginBuildError, pluginBuildFailure, runPluginBuildCommand } from './build-errors';

// ============================================================================
// HOST-VERSION COMPATIBILITY
// Plugins may install third-party packages that declare peerDependencies on
// host-owned runtimes (react, react-dom, react-reconciler, remotion, @remotion/*).
// If a plugin dep's peer range doesn't satisfy the host's version, the bundle
// builds fine but crashes at runtime (e.g. ReactCurrentOwner on React 18 libs
// rendered by a React 19 host).
//
// We resolve exact host versions from the installed app or its lockfile,
// and validate bundled plugin deps (direct + transitive) against them in
// the sandbox after `npm install`. Incompatibilities hard-fail with an
// actionable message naming the offending dep, its peer range, and the host
// version.
// ============================================================================

type HostVersions = Record<string, string>;

function readHostVersions(): HostVersions {
  const installed = readHostDependencyVersions();
  return Object.fromEntries(
    [...PLUGIN_RUNTIME_PACKAGES, 'react-reconciler']
      .filter(name => installed[name])
      .map(name => [name, installed[name]]),
  );
}

// ============================================================================
// SANDBOX BUILDER — Compiles AI-generated plugin code in E2B Sandbox
//
// Security: AI-generated plugin code is UNTRUSTED. It must NOT run on the
// host server. E2B Sandbox provides isolated microVMs where esbuild
// can safely compile arbitrary code without risk to the host.
//
// Local fallback requires ALLOW_LOCAL_PLUGIN_BUILD=true, or explicitly
// disabling the sandbox for development with USE_SANDBOX_BUILDER=false.
//
// ─── Env var ────────────────────────────────────────────────────────────────
//   USE_SANDBOX_BUILDER (default: "true")
//     "true"  → build in E2B Sandbox; local fallback requires explicit opt-in.
//     "false" → skip the sandbox entirely and always build locally.
//               DEV ONLY — AI-generated code is untrusted. Never disable in
//               production or on any machine that processes real user prompts.
// ============================================================================

const EXTERNALS = PLUGIN_RUNTIME_IMPORTS;
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

/** Whether the isolated E2B build service is configured. */
function hasSandboxCredentials(): boolean {
  return Boolean(process.env.E2B_API_KEY);
}

/**
 * Build a plugin from source code inside an E2B Sandbox microVM.
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
  const depPolicy = normalizePluginDependencies(params.dependencies, modules);
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

  // Cloud builds require configured credentials; local builds must be opted into.
  const sandboxAvailable = useSandbox && hasSandboxCredentials();

  if (sandboxAvailable) {
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
    } catch (error) {
      const failure = new PluginBuildError(pluginBuildFailure(error, 'setup'));
      // Build/install errors must reach the preview, even when local fallback
      // is enabled. A second build could hide the dependency failure.
      if (error instanceof PluginBuildError || !shouldAllowLocalBuild()) throw failure;
      console.warn(`[sandbox-builder] ${failure.message}`);
    }
  } else if (useSandbox && !shouldAllowLocalBuild()) {
    throw new Error('Set E2B_API_KEY to build plugins in the sandbox. For local development, explicitly set USE_SANDBOX_BUILDER=false.');
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

  const ROOT = path.dirname(findHostPackageJson());
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
    dependencies: getPluginBuildDependencies(params.dependencies),
  }, null, 2);

  const hostVersionsJson = JSON.stringify(params.hostVersions ?? readHostVersions());
  const hostPeerPackagesJson = JSON.stringify(Object.keys(params.hostVersions ?? readHostVersions()));

  const buildScript = `
import esbuild from 'esbuild';
import semver from 'semver';
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
  // Validate bundled libraries against the deployed runtime, not the app against itself.
  if (HOST_VERSIONS[pkg.name] === pkg.version) return;
  const peers = pkg.peerDependencies ?? {};
  const pkgId = (pkg.name ?? '?') + '@' + (pkg.version ?? '?');
  for (const [peerName, peerRange] of Object.entries(peers)) {
    if (!HOST_PEER_PACKAGES.has(peerName)) continue;
    const hostVersion = HOST_VERSIONS[peerName];
    if (!hostVersion) continue;
    if (!semver.satisfies(hostVersion, peerRange)) {
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
  // Exact runtime imports are external; unlisted subpaths get bundled.
  target: ['chrome90'],
  platform: 'browser',
  // Polyfill Buffer for dependencies that reference it (e.g. three, uuid)
  inject: [path.join(srcDir, 'buffer-shim.js')],
  define: { global: 'globalThis' },
  plugins: [aliasPlugin, (${pluginRuntimeExternals.toString()})(${JSON.stringify(EXTERNALS)})],
  sourcemap: false,
  minify: false,
});

const bundleContent = fs.readFileSync(outfile, 'utf-8');
process.stdout.write(JSON.stringify({ success: true, bundleContent }));
`;

  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
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

    const run = (command: string) => sandbox.commands.run(command, { cwd: CWD });
    await runPluginBuildCommand(run, 'npm install --legacy-peer-deps --no-audit --no-fund --loglevel=error', 'install');
    const build = await runPluginBuildCommand(run, 'node build.mjs', 'build');
    const stdout = build.stdout;
    const stderr = build.stderr;

    let output;
    try { output = JSON.parse(stdout); } catch {
      throw new PluginBuildError({ stage: 'build', message: 'Sandbox returned invalid build output.', command: 'node build.mjs', stdout, stderr });
    }
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
      throw new PluginBuildError({ stage: output.peerDepErrors?.length ? 'compatibility' : 'build', message: errMsg, command: 'node build.mjs', stderr });
    }

    return output.bundleContent;
  } finally {
    // Cleanup must never replace an install/compiler failure and its logs.
    try { await sandbox.kill(); } catch { console.warn('[sandbox-builder] Sandbox cleanup failed.'); }
  }
}

/**
 * Fallback: Build locally with esbuild.
 * Only used when E2B Sandbox is unavailable (local dev).
 */
export async function buildWithLocalEsbuild(
  pluginId: string,
  sceneCode: string,
  params: { sharedUtilsPath?: string; sharedTypesPath?: string; modules?: PluginModuleMap },
): Promise<string> {
  const ROOT = path.dirname(findHostPackageJson());
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
      nodePaths: [path.join(ROOT, 'node_modules')],
      absWorkingDir: ROOT,
      target: ['chrome90'],
      platform: 'browser',
      // Polyfill Buffer for dependencies that reference it (e.g. three, uuid)
      inject: [path.join(srcDir, 'buffer-shim.js')],
      define: { global: 'globalThis' },
      plugins: [aliasPlugin, pluginRuntimeExternals(EXTERNALS)],
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
