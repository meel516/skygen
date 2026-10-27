
// ============================================================================
// MODULE BUNDLER — inlines multi-file plugin modules into a single Scene.tsx
//
// The esbuild sandbox compiles a single Scene.tsx entry point. When the
// orchestrator writes code across multiple modules (theme.ts, animations.ts,
// components.tsx, layout.tsx), this bundler inlines them into one file by
// replacing `import { X } from './module'` with the actual exports.
//
// If only Scene.tsx exists (backward compat), returns it as-is.
// ============================================================================

interface ModuleMap {
  [filePath: string]: string;
}

/**
 * Bundle multi-file modules into a single compilable Scene.tsx.
 *
 * Strategy: Scene.tsx is the entry point. We scan its imports for local
 * relative paths (`./animations`, `./theme`, etc.), resolve them against
 * the module map, and inline the exported code directly.
 *
 * - Named imports become local variable declarations
 * - Default imports become `const X = (inlined code)`
 * - The original import line is removed
 * - Inlined code is placed above the import section
 */
export function bundleModules(modules: ModuleMap): string {
  // Backward compat: single file, no inlining needed
  const modulePaths = Object.keys(modules);
  if (modulePaths.length <= 1 || !modules['Scene.tsx']) {
    return modules['Scene.tsx'] ?? modules[modulePaths[0]] ?? '';
  }

  let sceneCode = modules['Scene.tsx'];
  const inlinedBlocks: string[] = [];

  // Find all relative imports in Scene.tsx
  const importRegex = /^import\s+(.+?)\s+from\s+['"]\.\/(.+?)['"];?\s*$/gm;
  let match: RegExpExecArray | null;

  const replacements: Array<{ original: string; moduleName: string; imports: string }> = [];

  while ((match = importRegex.exec(sceneCode)) !== null) {
    const fullMatch = match[0];
    const importSpec = match[1]; // e.g. "{ useEnter, useHold }" or "Theme"
    const moduleName = match[2]; // e.g. "animations" or "theme"

    // Resolve module path — try exact, then with extensions
    const resolvedPath = resolveModulePath(moduleName, modules);
    if (!resolvedPath) continue; // Skip non-local imports (won't have a module)

    replacements.push({ original: fullMatch, moduleName: resolvedPath, imports: importSpec });
  }

  // Build inlined code blocks and remove import lines
  for (const rep of replacements) {
    const moduleCode = modules[rep.moduleName];
    if (!moduleCode) continue;

    // Strip import lines from the module (they're host-injected or irrelevant)
    const cleanedModule = moduleCode
      .split('\n')
      .filter(line => !/^import\s/.test(line.trim()) || /^import\s+.*from\s+['"](\.\.?\/|[^./])/.test(line.trim()) === false)
      .join('\n')
      .trim();

    // Remove export keyword from declarations — they become local to the bundle
    const deExported = cleanedModule
      .replace(/^export\s+(default\s+)?/gm, '');

    inlinedBlocks.push(`// ─── Inlined from ${rep.moduleName} ─────────────────\n${deExported}`);

    // Remove the import line from Scene.tsx
    sceneCode = sceneCode.replace(rep.original, '');
  }

  // Prepend inlined blocks before the remaining Scene.tsx code
  if (inlinedBlocks.length > 0) {
    const cleanedScene = sceneCode.replace(/^\s*\n/gm, '').trimStart();
    return `${inlinedBlocks.join('\n\n')}\n\n// ─── Scene.tsx ─────────────────\n${cleanedScene}`;
  }

  return sceneCode;
}

/**
 * Resolve a bare module name (e.g. "animations") to an actual file path
 * in the modules map (e.g. "animations.ts" or "components.tsx").
 */
function resolveModulePath(name: string, modules: ModuleMap): string | null {
  // Exact match
  if (modules[name]) return name;

  // Try common extensions
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  for (const ext of extensions) {
    const candidate = name + ext;
    if (modules[candidate]) return candidate;
  }

  return null;
}

/**
 * Check if modules contain multiple files (indicating multi-file mode).
 */
export function isMultiFile(modules: ModuleMap): boolean {
  return Object.keys(modules).length > 1;
}
