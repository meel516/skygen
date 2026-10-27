/**
 * MCP-only local plugin sandbox.
 *
 * Full capability (same idea as server sandbox, without Vercel):
 * - Multi-file modules (entry Scene.tsx)
 * - dependencies map / package.json-style deps
 * - npm install any third-party packages listed (or imported + auto-declared)
 * - esbuild bundle; host packages (react/remotion/three kit) stay EXTERNAL
 *
 * Does NOT use Vercel Sandbox. Does NOT change chat/Mastra create path.
 * Capability is NOT artificially limited — if npm install + esbuild succeed, validate passes.
 * Runtime failures (WebGL in Remotion player, peer conflicts) may still surface later.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { spawnSync } from 'child_process';
//untracked
import {
  formatDependencyPolicyChanges,
  normalizePluginDependencies,
  HOST_PROVIDED_PLUGIN_DEPS,
  HOST_VERSIONED_PLUGIN_DEPS,
} from '../plugins/dependency-policy';
import { normalizePluginModules, type PluginModuleMap } from '../plugins/sandbox-builder';
import { PLUGIN_RUNTIME_IMPORTS, pluginRuntimeExternals } from '../plugins/runtime-contract';
import { findHostPackageJson } from '../plugins/host-dependencies';

/** Host packages provided at runtime — never npm-installed into the plugin bundle. */
export const MCP_BASE_BUNDLE = {
  host_provided: PLUGIN_RUNTIME_IMPORTS,
  host_versioned_3d: [
    'three',
    '@react-three/fiber',
    '@react-three/drei',
    '@react-three/postprocessing',
    'postprocessing',
  ],
  notes: [
    'Host packages (react, remotion, three kit) are EXTERNAL — supplied by Skygen at runtime.',
    'Any other package listed in dependencies (or imported) is npm-installed in the local sandbox and bundled.',
    'There is NO package allowlist/blocklist — install + build success is the gate.',
    'Multi-file: modules map with Scene.tsx as entry.',
    'After validate succeeds, create_plugin installs via the existing server API (same dependency map).',
  ],
} as const;

/** Same host externals the main sandbox-builder uses (not bundled into plugin). */
const HOST_EXTERNALS: readonly string[] = PLUGIN_RUNTIME_IMPORTS;

const NPM_INSTALL_TIMEOUT_MS = 120_000;

export interface LocalSandboxInput {
  pluginId?: string;
  sceneCode?: string;
  modules?: Record<string, string>;
  schemaJson?: string | Record<string, unknown>;
  dependencies?: Record<string, string>;
  /** Skip npm install (host-only plugins). Default false. */
  skip_npm_install?: boolean;
}

export interface LocalSandboxResult {
  success: boolean;
  sandbox: 'mcp-local-install-build';
  plugin_id: string | null;
  files: string[];
  dependencies: Record<string, string>;
  install_dependencies: Record<string, string>;
  host_dependencies: Record<string, string>;
  stripped_dependencies: string[];
  dependency_notes: string[];
  npm_installed: string[];
  warnings: string[];
  errors: string[];
  bundle_bytes?: number;
  source_hash?: string;
  base_bundle: typeof MCP_BASE_BUNDLE;
  message: string;
}

function parseSchema(schemaJson: string | Record<string, unknown> | undefined): {
  ok: boolean;
  error?: string;
} {
  if (schemaJson == null || schemaJson === '') return { ok: true };
  try {
    const schema =
      typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
    if (!schema || typeof schema !== 'object') {
      return { ok: false, error: 'schema_json must be a JSON object' };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: `schema_json is not valid JSON: ${e?.message ?? e}` };
  }
}

function scanImports(source: string): string[] {
  const found = new Set<string>();
  const re =
    /(?:import|export)\s+(?:type\s+)?(?:[^'"\n]+from\s+)?['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) {
    const spec = m[1] || m[2];
    if (!spec || spec.startsWith('.') || spec.startsWith('/') || spec.startsWith('shared/')) continue;
    const pkg = spec.startsWith('@')
      ? spec.split('/').slice(0, 2).join('/')
      : spec.split('/')[0];
    found.add(pkg);
  }
  return [...found];
}

function isHostPackage(pkg: string): boolean {
  if (HOST_PROVIDED_PLUGIN_DEPS.has(pkg)) return true;
  if (HOST_VERSIONED_PLUGIN_DEPS.has(pkg)) return true;
  if (HOST_EXTERNALS.includes(pkg)) return true;
  return false;
}

function runNpmInstall(cwd: string): { ok: boolean; log: string } {
  const result = spawnSync(
    'npm',
    ['install', '--legacy-peer-deps', '--no-audit', '--no-fund', '--loglevel=error'],
    {
      cwd,
      encoding: 'utf-8',
      timeout: NPM_INSTALL_TIMEOUT_MS,
      shell: true,
      env: { ...process.env, npm_config_progress: 'false' },
    },
  );

  const log = [result.stdout, result.stderr].filter(Boolean).join('\n').trim();
  if (result.error) {
    return { ok: false, log: `${result.error.message}\n${log}` };
  }
  if (result.status !== 0) {
    return { ok: false, log: log || `npm install exited ${result.status}` };
  }
  return { ok: true, log };
}

/**
 * Local multi-file compile:
 * 1) normalize deps
 * 2) npm install third-party deps from dependencies map
 * 3) esbuild bundle (host packages external; third-party inlined)
 */
export async function validatePluginLocal(input: LocalSandboxInput): Promise<LocalSandboxResult> {
  const warnings: string[] = [];
  const errors: string[] = [];
  const npmInstalled: string[] = [];

  const modules = normalizePluginModules(
    input.sceneCode ?? '',
    input.modules as PluginModuleMap | undefined,
  );
  const files = Object.keys(modules);

  if (!modules['Scene.tsx']?.trim()) {
    return {
      success: false,
      sandbox: 'mcp-local-install-build',
      plugin_id: input.pluginId ?? null,
      files,
      dependencies: {},
      install_dependencies: {},
      host_dependencies: {},
      stripped_dependencies: [],
      dependency_notes: [],
      npm_installed: [],
      warnings,
      errors: ['Missing Scene.tsx — provide scene_code or modules["Scene.tsx"]'],
      base_bundle: MCP_BASE_BUNDLE,
      message: 'Local sandbox failed: no entry Scene.tsx',
    };
  }

  const schemaParse = parseSchema(input.schemaJson);
  if (!schemaParse.ok) errors.push(schemaParse.error!);

  // Collect imports → auto-declare missing third-party packages so agents don't forget dependencies.json
  const allImports = new Set<string>();
  for (const src of Object.values(modules)) {
    for (const pkg of scanImports(src)) allImports.add(pkg);
  }

  const mergedDeps: Record<string, string> = { ...(input.dependencies ?? {}) };
  for (const pkg of allImports) {
    if (isHostPackage(pkg)) continue;
    if (mergedDeps[pkg] == null) {
      mergedDeps[pkg] = '*';
      warnings.push(
        `Import "${pkg}" was not in dependencies — auto-added as "${pkg}": "*" for local npm install. Pin a version for production installs.`,
      );
    }
  }

  // Host-versioned 3d: declare for policy, but they stay external (not npm-installed as plugin deps)
  for (const pkg of allImports) {
    if (HOST_VERSIONED_PLUGIN_DEPS.has(pkg) && (input.dependencies ?? {})[pkg] == null) {
      if (mergedDeps[pkg] == null) mergedDeps[pkg] = '*';
    }
  }

  const finalPolicy = normalizePluginDependencies(mergedDeps);
  const dependencyNotes = formatDependencyPolicyChanges(finalPolicy);

  for (const pkg of allImports) {
    if (isHostPackage(pkg)) continue;
    if (!finalPolicy.installDependencies[pkg] && !finalPolicy.dependencies[pkg]) {
      warnings.push(`Import "${pkg}" could not be resolved into installDependencies — check package name.`);
    }
  }

  const sourceHash = createHash('sha256')
    .update(JSON.stringify({ modules, deps: finalPolicy.dependencies }))
    .digest('hex')
    .slice(0, 16);

  let bundleBytes = 0;

  if (errors.length === 0) {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'skygen-mcp-plugin-'));
    try {
      const srcDir = path.join(tmpRoot, 'src');
      fs.mkdirSync(srcDir, { recursive: true });

      for (const [filePath, content] of Object.entries(modules)) {
        const target = path.join(srcDir, filePath);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, content, 'utf-8');
      }

      const installDeps = finalPolicy.installDependencies;
      const hasInstallDeps = Object.keys(installDeps).length > 0;

      if (hasInstallDeps && !input.skip_npm_install) {
        // Minimal package.json so npm can install third-party libs into this sandbox
        const packageJson = {
          name: `skygen-mcp-${(input.pluginId || 'plugin').replace(/[^a-z0-9-]/gi, '-').slice(0, 40)}`,
          version: '0.0.0',
          private: true,
          // Host peers optional so npm doesn't fail when react isn't local
          dependencies: installDeps,
        };
        fs.writeFileSync(
          path.join(tmpRoot, 'package.json'),
          JSON.stringify(packageJson, null, 2),
          'utf-8',
        );

        warnings.push(
          `npm install: ${Object.keys(installDeps).map((k) => `${k}@${installDeps[k]}`).join(', ')}`,
        );

        const install = runNpmInstall(tmpRoot);
        if (!install.ok) {
          errors.push(
            `npm install failed for dependencies (fix these in dependencies map and retry):\n${install.log.slice(0, 4000)}`,
          );
        } else {
          npmInstalled.push(...Object.keys(installDeps));
        }
      }

      if (errors.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const esbuild = require('esbuild') as typeof import('esbuild');

        const outfile = path.join(tmpRoot, 'dist', 'index.esm.js');
        fs.mkdirSync(path.dirname(outfile), { recursive: true });

        try {
          // Third-party packages are BUNDLED from node_modules after npm install.
          // Host packages stay EXTERNAL (provided by Skygen player at runtime).
          await esbuild.build({
            entryPoints: [path.join(srcDir, 'Scene.tsx')],
            outfile,
            format: 'cjs',
            bundle: true,
            plugins: [pluginRuntimeExternals(HOST_EXTERNALS)],
            target: ['chrome90'],
            platform: 'browser',
            jsx: 'automatic',
            jsxImportSource: 'react',
            define: { global: 'globalThis' },
            sourcemap: false,
            minify: false,
            logLevel: 'silent',
            absWorkingDir: tmpRoot,
            nodePaths: [path.join(tmpRoot, 'node_modules'), path.join(path.dirname(findHostPackageJson()), 'node_modules')],
          });

          if (fs.existsSync(outfile)) {
            bundleBytes = fs.statSync(outfile).size;
            if (bundleBytes < 16) {
              warnings.push('Bundle is unusually small — check that Scene default export is present.');
            }
          } else {
            errors.push('esbuild finished but no bundle file was written');
          }
        } catch (e: any) {
          const msg = e?.errors
            ? e.errors.map((x: any) => x.text || x.detail || JSON.stringify(x)).join('\n')
            : e?.message ?? String(e);
          errors.push(
            `Local esbuild failed (after npm install). Fix imports or dependency versions:\n${msg}`,
          );
        }
      }
    } finally {
      try {
        fs.rmSync(tmpRoot, { recursive: true, force: true });
      } catch {
        /* ignore */
      }
    }
  }

  const success = errors.length === 0;

  return {
    success,
    sandbox: 'mcp-local-install-build',
    plugin_id: input.pluginId ?? null,
    files,
    dependencies: finalPolicy.dependencies,
    install_dependencies: finalPolicy.installDependencies,
    host_dependencies: finalPolicy.hostDependencies,
    stripped_dependencies: finalPolicy.stripped,
    dependency_notes: dependencyNotes,
    npm_installed: npmInstalled,
    warnings,
    errors,
    bundle_bytes: success ? bundleBytes : undefined,
    source_hash: sourceHash,
    base_bundle: MCP_BASE_BUNDLE,
    message: success
      ? `Local sandbox OK (npm install + esbuild). Installed: [${npmInstalled.join(', ') || 'none (host-only)'}]. Pass same modules + dependencies to create_plugin.`
      : 'Local sandbox failed at npm install or esbuild. Fix dependencies/source — no artificial package blocklist.',
  };
}

export function getBaseBundleInfo() {
  return {
    sandbox: 'mcp-local-install-build',
    ...MCP_BASE_BUNDLE,
    third_party:
      'Any package in dependencies (or imported) is npm-installed in the local sandbox and bundled. No allowlist/blocklist.',
    workflow: [
      '1. Multi-file modules + dependencies map (package.json style)',
      '2. validate_plugin / compile_plugin_preview → local npm install + esbuild',
      '3. create_plugin with same modules + dependencies (server install)',
      '4. create_template / start_video_generation',
    ],
  };
}
