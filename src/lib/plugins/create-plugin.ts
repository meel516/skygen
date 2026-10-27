import fs from 'fs';
import path from 'path';
import os from 'os';
import { checkPluginCompatibility } from './compatibility-checker';
import { buildPluginInSandbox, normalizePluginModules, type PluginModuleMap } from './sandbox-builder';
import { extractNormalizedFields } from './extract-normalized-fields';
import {
  formatPluginSourceIssues,
  validatePluginSchemaReservedFields,
  validatePluginSource,
} from './source-validation';
import { uploadToS3 } from '@/lib/s3';
import { db } from '@/lib/db';
import { normalizePluginId } from './utils';
import { derivePluginTags } from './tags';
import { formatDependencyPolicyChanges, normalizePluginDependencies } from './dependency-policy';

// ============================================================================
// SHARED PLUGIN CREATION HELPER
//
// Single-sourced pipeline for turning AI/user-supplied plugin source into a
// persisted, runnable plugin:
//   validate id → compatibility check → build in sandbox → upload bundle to S3
//   → insert/upsert into plugins table.
//
// Both the HTTP route (/api/plugins/create-from-source) and the mastra
// `createPlugin` agent tool call this — do NOT duplicate the steps elsewhere.
// ============================================================================

const CORE_PLUGIN_IDS = ['counter-block', 'stat-block', 'cta-block'];

export interface CreatePluginInput {
  id: string;
  name: string;
  description?: string;
  category?: string;
  sceneCode: string;
  modules?: PluginModuleMap;
  schemaJson: string | Record<string, unknown>;
  /**
   * npm dependencies the plugin source imports (package → semver). Merged
   * into the sandbox's package.json so esbuild can inline them into the
   * bundle. react / remotion / @remotion/* / framer-motion are always
   * stripped (handled by the sandbox builder).
   */
  dependencies?: Record<string, string>;
  userId?: string | null;
}

export interface CreatePluginOk {
  ok: true;
  pluginId: string;
  name: string;
  s3Key: string;
  builtInSandbox: boolean;
  warnings: string[];
}

export interface CreatePluginErr {
  ok: false;
  status: number;
  error: string;
  errors?: string[];
}

export type CreatePluginResult = CreatePluginOk | CreatePluginErr;

export async function createPluginFromSource(input: CreatePluginInput): Promise<CreatePluginResult> {
  const {
    id,
    name,
    description = '',
    category = 'content',
    sceneCode,
    modules,
    schemaJson,
    dependencies,
    userId,
  } = input;

  const normalizedId = normalizePluginId(id);

  const sourceModules = normalizePluginModules(sceneCode, modules);
  const effectiveSceneCode = sourceModules['Scene.tsx'] ?? sceneCode;

  if (!normalizedId || !name || !effectiveSceneCode || !schemaJson) {
    return { ok: false, status: 400, error: 'Missing required fields: id, name, sceneCode, schemaJson' };
  }
  if (normalizedId.length < 3) {
    return { ok: false, status: 400, error: 'Plugin id (normalized) must be at least 3 characters' };
  }
  if (CORE_PLUGIN_IDS.includes(normalizedId)) {
    return { ok: false, status: 409, error: `Plugin id "${normalizedId}" conflicts with a core plugin` };
  }

  let schemaObj: Record<string, unknown>;
  try {
    schemaObj = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
  } catch {
    return { ok: false, status: 400, error: 'schemaJson is not valid JSON' };
  }
  if (!schemaObj.properties || typeof schemaObj.properties !== 'object') {
    return { ok: false, status: 400, error: 'schemaJson must have a "properties" object' };
  }

  const schemaReservedCheck = validatePluginSchemaReservedFields(schemaObj);
  if (!schemaReservedCheck.ok) {
    return {
      ok: false,
      status: 422,
      error: 'Plugin schema failed validation',
      errors: schemaReservedCheck.issues.map((issue) => issue.message),
    };
  }

  const sourceCheck = validatePluginSource(
    Object.fromEntries(Object.entries(sourceModules).map(([filePath, source]) => [`src/${filePath}`, source])),
  );
  if (!sourceCheck.ok) {
    return {
      ok: false,
      status: 422,
      error: 'Plugin source failed validation',
      errors: formatPluginSourceIssues(sourceCheck.issues).split('\n'),
    };
  }

  const schemaString = typeof schemaJson === 'string' ? schemaJson : JSON.stringify(schemaJson);
  const depPolicy = normalizePluginDependencies(dependencies);
  const depPolicyWarnings = formatDependencyPolicyChanges(depPolicy);
  for (const message of depPolicyWarnings) {
    console.warn(`[create-plugin] ${message}`);
  }

  let tmpDir: string | undefined;
  try {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `plugin-create-${normalizedId}-`));

    fs.writeFileSync(path.join(tmpDir, 'plugin.json'), JSON.stringify({
      id: normalizedId, name, description, version: '1.0.0', category,
    }), 'utf-8');
    fs.writeFileSync(path.join(tmpDir, 'schema.json'), schemaString, 'utf-8');
    const srcDir = path.join(tmpDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });
    for (const [filePath, source] of Object.entries(sourceModules)) {
      const targetPath = path.join(srcDir, filePath);
      fs.mkdirSync(path.dirname(targetPath), { recursive: true });
      fs.writeFileSync(targetPath, source, 'utf-8');
    }

    const check = checkPluginCompatibility(tmpDir, { skipDistCheck: true });
    if (!check.compatible) {
      return { ok: false, status: 422, error: 'Plugin source failed validation', errors: check.errors };
    }

    const { bundleContent, builtInSandbox } = await buildPluginInSandbox({
      pluginId: normalizedId,
      sceneCode: effectiveSceneCode,
      modules: sourceModules,
      schemaJson: schemaString,
      dependencies: depPolicy.installDependencies,
    });

    const s3Key = `plugins/${normalizedId}/bundle.cjs.js`;
    await uploadToS3(s3Key, bundleContent, 'application/javascript');

    const sourceJson = JSON.stringify({
      sceneCode: effectiveSceneCode,
      modules: sourceModules,
      dependencies,
    });
    const sourceS3Key = `plugins/${normalizedId}/source.json`;
    await uploadToS3(sourceS3Key, sourceJson, 'application/json');

    const generationFields = extractNormalizedFields(schemaObj, effectiveSceneCode);
    const tags = derivePluginTags({
      id: normalizedId,
      name,
      description,
      category,
      schemaJson: schemaObj,
    });

    await db.query(
      `INSERT INTO plugins (id, name, description, version, category, icon, color, status, s3_key, schema_json, generation_fields, user_id, tags, likes_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, description = $3, version = $4, category = $5,
         icon = $6, color = $7, status = $8, s3_key = $9, schema_json = $10,
         generation_fields = $11, tags = $13, updated_at = NOW()`,
      [
        normalizedId, name, description, '1.0.0', category,
        'puzzle', '#7C3AED', 'stable',
        s3Key, schemaString,
        JSON.stringify(generationFields),
        userId ?? null,
        tags,
      ],
    );

    console.log(`[create-plugin] Successfully saved plugin "${normalizedId}" to database. S3 Key: ${s3Key}`);

    return { ok: true, pluginId: normalizedId, name, s3Key, builtInSandbox, warnings: [...depPolicyWarnings, ...check.warnings] };
  } catch (e: any) {
    // Surface structured esbuild diagnostics (file:line:col + source line) so
    // the wizard can attempt a surgical editSceneCode fix instead of reporting
    // a generic "build failed" and silently dropping the plugin.
    const diagnostics = Array.isArray(e?.errors)
      ? e.errors.map((err: any) => ({
          text: err?.text ?? 'Unknown error',
          file: err?.location?.file ?? 'Scene.tsx',
          line: err?.location?.line ?? 0,
          column: err?.location?.column ?? 0,
          lineText: err?.location?.lineText,
        }))
      : undefined;
    const error = e?.message ?? 'Plugin creation failed';
    return {
      ok: false,
      status: 500,
      error,
      errors: diagnostics
        ? diagnostics.map((d) =>
            `${d.text} at ${d.file}:${d.line}:${d.column}${d.lineText ? `\n  > ${d.lineText}` : ''}`,
          )
        : undefined,
    };
  } finally {
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    }
  }
}
