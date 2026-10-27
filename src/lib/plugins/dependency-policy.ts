import fs from 'fs';
import path from 'path';

const PACKAGE_NAME_RE = /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i;

export const HOST_PROVIDED_PLUGIN_DEPS = new Set([
  'react',
  'react-dom',
  'remotion',
  '@remotion/player',
  '@remotion/renderer',
  'framer-motion',
]);

export const HOST_VERSIONED_PLUGIN_DEPS = new Set([
  'three',
  '@react-three/fiber',
  '@react-three/drei',
  '@react-three/postprocessing',
  'postprocessing',
]);

export interface NormalizedPluginDependencies {
  /**
   * Dependencies kept on the pending plugin/source hash. Includes host-versioned
   * packages so preview can use the declared import intent and normalize hashes.
   */
  dependencies: Record<string, string>;
  /**
   * Dependencies that should actually be installed in a build sandbox. Host
   * singleton packages are intentionally excluded from this map.
   */
  installDependencies: Record<string, string>;
  /**
   * Packages supplied by the Skygen host runtime rather than npm-installed into
   * an individual plugin build.
   */
  hostDependencies: Record<string, string>;
  stripped: string[];
  normalized: Array<{ name: string; from?: string; to: string }>;
}

export function normalizePluginDependencies(
  deps: Record<string, string> | string | undefined,
): NormalizedPluginDependencies {
  const dependencies: Record<string, string> = {};
  const installDependencies: Record<string, string> = {};
  const hostDependencies: Record<string, string> = {};
  const stripped: string[] = [];
  const normalized: Array<{ name: string; from?: string; to: string }> = [];

  let parsedDeps: Record<string, string> = {};
  if (typeof deps === 'string') {
    try {
      parsedDeps = JSON.parse(deps);
    } catch {
      // Ignore parse errors, will just be empty
    }
  } else if (deps && typeof deps === 'object') {
    parsedDeps = deps;
  }

  for (let [name, range] of Object.entries(parsedDeps)) {
    // Strip accidental stringified quotes from LLM payloads (e.g. `"\"@turf/turf\""`)
    if (typeof name === 'string') name = name.replace(/^"|"$/g, '').replace(/^'|'$/g, '');
    if (typeof range === 'string') range = range.replace(/^"|"$/g, '').replace(/^'|'$/g, '');

    if (typeof name !== 'string' || typeof range !== 'string' || !PACKAGE_NAME_RE.test(name)) {
      stripped.push(name);
      continue;
    }

    if (HOST_PROVIDED_PLUGIN_DEPS.has(name) || name.startsWith('@remotion/')) {
      stripped.push(name);
      continue;
    }

    if (HOST_VERSIONED_PLUGIN_DEPS.has(name)) {
      const hostVersion = readHostDependencyVersion(name);
      dependencies[name] = hostVersion;
      hostDependencies[name] = hostVersion;
      if (range !== hostVersion) {
        normalized.push({ name, from: range, to: hostVersion });
      }
      continue;
    }

    dependencies[name] = range;
    installDependencies[name] = range;
  }

  return { dependencies, installDependencies, hostDependencies, stripped, normalized };
}

function readHostDependencyVersion(name: string): string {
  const candidates: string[] = [];
  if (process.env.HOST_PACKAGE_JSON) {
    candidates.push(path.resolve(process.env.HOST_PACKAGE_JSON));
  }

  let dir = process.cwd();
  for (let i = 0; i < 8 && dir !== path.dirname(dir); i++) {
    candidates.push(path.join(dir, 'package.json'));
    dir = path.dirname(dir);
  }

  for (const pkgPath of candidates) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const version = pkg.dependencies?.[name] ?? pkg.devDependencies?.[name];
      if (typeof version === 'string' && version.trim()) {
        return version;
      }
    } catch {
      // Try the next parent package.json.
    }
  }

  return '*';
}

export function formatDependencyPolicyChanges(result: NormalizedPluginDependencies): string[] {
  const messages: string[] = [];
  if (result.stripped.length > 0) {
    messages.push(`app-provided/invalid deps kept out of plugin manifest: ${result.stripped.join(', ')}`);
  }
  return messages;
}
