// ============================================================================
// PLUGIN COMPATIBILITY CHECKER
// Validates a plugin directory before installation
// ============================================================================

import fs from 'fs';
import path from 'path';
import {
  formatPluginSourceIssues,
  validatePluginSchemaReservedFields,
  validatePluginSource,
} from './source-validation';

export interface CompatibilityResult {
  compatible: boolean;
  errors: string[];
  warnings: string[];
}

/** Patterns that are forbidden in plugin scene source code */
const FORBIDDEN_PATTERNS = [
  { pattern: /\beval\s*\(/, reason: 'eval() is not allowed in plugins' },
  { pattern: /process\.exit\s*\(/, reason: 'process.exit() is not allowed in plugins' },
  { pattern: /require\s*\(\s*['"]fs['"]/, reason: 'Direct filesystem access (fs) is not allowed' },
  { pattern: /require\s*\(\s*['"]child_process['"]/, reason: 'child_process is not allowed in plugins' },
  { pattern: /\bexecSync\b|\bspawnSync\b|(?<!\.)\bexec\b\s*\(/, reason: 'Shell execution is not allowed in plugins' },
];

export interface CompatibilityOptions {
  /** Skip the dist/index.esm.js existence check — used when building from source (MCP flow) */
  skipDistCheck?: boolean;
}

export function checkPluginCompatibility(pluginDir: string, options: CompatibilityOptions = {}): CompatibilityResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ── 1. Required files ────────────────────────────────────────────────────
  const requiredFiles = ['plugin.json', 'schema.json', 'src/Scene.tsx'];
  for (const file of requiredFiles) {
    if (!fs.existsSync(path.join(pluginDir, file))) {
      errors.push(`Missing required file: ${file}`);
    }
  }

  // Pre-built bundle is required for ZIP uploads (skipped when building from source via MCP)
  const bundlePath = path.join(pluginDir, 'dist', 'index.esm.js');
  if (!options.skipDistCheck && !fs.existsSync(bundlePath)) {
    errors.push(
      "dist/index.esm.js is missing — run 'npm run build' in your plugin folder before creating the ZIP"
    );
  } else if (!options.skipDistCheck) {
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8').trim();
    if (bundleContent.length < 50) {
      errors.push("dist/index.esm.js is empty — run 'npm run build' to generate a valid bundle");
    }
  }

  if (errors.length > 0) {
    return { compatible: false, errors, warnings };
  }

  // ── 2. Validate plugin.json ──────────────────────────────────────────────
  let manifest: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(path.join(pluginDir, 'plugin.json'), 'utf-8');
    manifest = JSON.parse(raw);
  } catch {
    errors.push('plugin.json is not valid JSON');
    return { compatible: false, errors, warnings };
  }

  const requiredManifestFields = ['id', 'name', 'version', 'category'];
  for (const field of requiredManifestFields) {
    if (!manifest[field]) {
      errors.push(`plugin.json missing required field: "${field}"`);
    }
  }

  // Validate plugin ID format
  if (manifest.id && !/^[a-z0-9-]+$/.test(String(manifest.id))) {
    errors.push('plugin.json "id" must only contain lowercase letters, numbers, and hyphens');
  }

  // Validate version format
  if (manifest.version && !/^\d+\.\d+\.\d+/.test(String(manifest.version))) {
    warnings.push('plugin.json "version" should follow semver (e.g. "1.0.0")');
  }

  // ── 3. Validate schema.json ──────────────────────────────────────────────
  let schema: Record<string, unknown>;
  try {
    const raw = fs.readFileSync(path.join(pluginDir, 'schema.json'), 'utf-8');
    schema = JSON.parse(raw);
  } catch {
    errors.push('schema.json is not valid JSON');
    return { compatible: false, errors, warnings };
  }

  if (!schema.properties || typeof schema.properties !== 'object') {
    errors.push('schema.json must have a "properties" object');
  }

  const schemaReservedCheck = validatePluginSchemaReservedFields(schema);
  if (!schemaReservedCheck.ok) {
    errors.push(...schemaReservedCheck.issues.map((issue) => issue.message));
  }

  // ── 4. Check for forbidden code patterns ─────────────────────────────────
  const sourceFiles = ['src/Scene.tsx', 'src/index.ts', 'src/Editor.tsx'];
  for (const file of sourceFiles) {
    const filePath = path.join(pluginDir, file);
    if (!fs.existsSync(filePath)) continue;

    const code = fs.readFileSync(filePath, 'utf-8');
    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        errors.push(`${file}: ${reason}`);
      }
    }

    const sourceCheck = validatePluginSource({ [file]: code });
    if (!sourceCheck.ok) {
      errors.push(...formatPluginSourceIssues(sourceCheck.issues).split('\n'));
    }
  }

  // ── 5. Check extra dependencies declared ─────────────────────────────────
  const pkgPath = path.join(pluginDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
      const conflicting = ['react', 'react-dom', 'remotion'].filter(d => deps.includes(d));
      if (conflicting.length > 0) {
        warnings.push(
          `plugin/package.json declares ${conflicting.join(', ')} as dependencies — ` +
          'these are provided by the host app and will be ignored during bundling'
        );
      }
      if (deps.length > 0) {
        warnings.push(`Plugin declares ${deps.length} extra dependency/dependencies. Make sure they are compiled into dist/index.esm.js via 'npm run build'.`);
      }
    } catch {
      warnings.push('package.json could not be parsed — extra dependencies will not be installed');
    }
  }

  return {
    compatible: errors.length === 0,
    errors,
    warnings,
  };
}
