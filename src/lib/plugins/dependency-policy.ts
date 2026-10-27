import { readHostDependencyVersions } from './host-dependencies';
import { PLUGIN_RUNTIME_PACKAGES, packageNameForImport } from './runtime-contract';
import ts from 'typescript';

const PACKAGE_NAME_RE = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;
export const HOST_PROVIDED_PLUGIN_DEPS = new Set<string>(PLUGIN_RUNTIME_PACKAGES);
export const HOST_VERSIONED_PLUGIN_DEPS = new Set(['three', '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing', 'postprocessing']);

export interface NormalizedPluginDependencies {
  dependencies: Record<string, string>;
  /** Packages bundled into the plugin, rather than supplied by the player. */
  installDependencies: Record<string, string>;
  hostDependencies: Record<string, string>;
  stripped: string[];
  normalized: Array<{ name: string; from?: string; to: string }>;
}

export function normalizePluginDependencies(deps: Record<string, string> | string | undefined, modules?: Record<string, string>): NormalizedPluginDependencies {
  const result: NormalizedPluginDependencies = { dependencies: {}, installDependencies: {}, hostDependencies: {}, stripped: [], normalized: [] };
  let parsed: unknown = deps ?? {};
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { throw new Error('Plugin dependencies must be a JSON object.'); }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Plugin dependencies must be a JSON object.');
  const declared = { ...parsed } as Record<string, unknown>;
  for (const source of Object.values(modules ?? {})) {
    // Parse imports without running user code or matching import-like comments.
    for (const { fileName } of ts.preProcessFile(source, true, true).importedFiles) {
      if (fileName.startsWith('.') || fileName.startsWith('/') || fileName.startsWith('shared/')) continue;
      const name = packageNameForImport(fileName);
      if (PACKAGE_NAME_RE.test(name) && declared[name] == null) declared[name] = '*';
    }
  }
  const host = readHostDependencyVersions();
  for (let [name, range] of Object.entries(declared)) {
    name = name.replace(/^["']|["']$/g, '');
    if (typeof range === 'string') range = range.replace(/^["']|["']$/g, '').trim();
    if (!PACKAGE_NAME_RE.test(name) || typeof range !== 'string' || !range) {
      result.stripped.push(name);
      continue;
    }
    // App-owned packages use its resolved version; new plugin-only packages
    // retain their requested npm range and are bundled in isolation.
    const version = host[name] ?? range;
    if (HOST_PROVIDED_PLUGIN_DEPS.has(name) && !host[name]) {
      throw new Error(`Cannot determine the deployed version of ${name}. Include its installed package or package-lock.json with the host app.`);
    }
    result.dependencies[name] = version;
    if (version !== range) result.normalized.push({ name, from: range, to: version });
    if (HOST_PROVIDED_PLUGIN_DEPS.has(name)) result.hostDependencies[name] = version;
    else result.installDependencies[name] = version;
  }
  return result;
}

/** Install host roots too: unlisted subpaths resolve from the same version. */
export function getPluginBuildDependencies(deps?: Record<string, string>): Record<string, string> {
  const host = readHostDependencyVersions();
  const dependencies = { ...normalizePluginDependencies(deps).installDependencies };
  for (const name of PLUGIN_RUNTIME_PACKAGES) {
    if (!host[name]) throw new Error(`Missing exact host version for ${name}. Check the deployed package.json and installation.`);
    dependencies[name] = host[name];
  }
  // Build tools cannot be overridden by a plugin dependency declaration.
  for (const name of ['esbuild', 'typescript', 'buffer', 'semver']) {
    if (!host[name]) throw new Error(`Missing locked or installed build tool: ${name}`);
    dependencies[name] = host[name];
  }
  return dependencies;
}

export function formatDependencyPolicyChanges(result: NormalizedPluginDependencies): string[] {
  const messages = result.normalized.map(({ name, from, to }) => `${name}: using app version ${to} (requested ${from})`);
  if (result.stripped.length) messages.push(`Invalid dependency declarations ignored: ${result.stripped.join(', ')}`);
  return messages;
}
