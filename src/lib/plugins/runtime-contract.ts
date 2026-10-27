import type { Plugin } from 'esbuild';

// Exact import specifiers supplied by BOTH the preview and video players.
// Keep subpath imports out of esbuild's prefix-based `external` option: an
// unlisted subpath (e.g. three/examples/...) must be bundled, not left dangling.
export const PLUGIN_RUNTIME_IMPORTS = [
  'react', 'react/jsx-runtime', 'react/jsx-dev-runtime',
  'react-dom', 'react-dom/client', 'remotion', 'remotion/no-react',
  '@remotion/player', '@remotion/media', '@remotion/media-utils',
  '@remotion/sfx', '@remotion/three', '@remotion/lottie',
  '@remotion/motion-blur', '@remotion/transitions', 'framer-motion',
  'three', '@react-three/fiber', '@react-three/drei',
  '@react-three/postprocessing', 'postprocessing',
] as const;

export type PluginRuntimeImport = typeof PLUGIN_RUNTIME_IMPORTS[number];

export function packageNameForImport(specifier: string): string {
  return specifier.startsWith('@')
    ? specifier.split('/').slice(0, 2).join('/')
    : specifier.split('/')[0];
}

export const PLUGIN_RUNTIME_PACKAGES = [...new Set(PLUGIN_RUNTIME_IMPORTS.map(packageNameForImport))];

/** Also serialized into the isolated sandbox build script. */
export function pluginRuntimeExternals(imports: readonly string[]): Plugin {
  const provided = new Set(imports);
  return {
    name: 'skygen-runtime',
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (provided.has(args.path)) return { path: args.path, external: true };
        if (args.path === '@remotion/renderer' || args.path.startsWith('@remotion/renderer/')) {
          return { errors: [{ text: '@remotion/renderer runs on the server and cannot be imported by a browser Scene.' }] };
        }
        return undefined;
      });
    },
  };
}

export function requirePluginDependency(deps: Record<string, unknown>, specifier: string, pluginId: string): unknown {
  if (Object.prototype.hasOwnProperty.call(deps, specifier) && deps[specifier] != null) return deps[specifier];
  throw new Error(`Plugin "${pluginId}" requires "${specifier}", but the player does not provide it. Rebuild the plugin with this dependency bundled.`);
}
