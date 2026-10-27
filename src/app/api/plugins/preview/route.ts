// ============================================================================
// PLUGIN PREVIEW API
// POST /api/plugins/preview
//
// Compiles scene code with esbuild and installs as a temporary plugin
// (status = 'preview') so the user can preview it in the web UI.
// The AI calls delete_plugin(previewId) to clean up if the user rejects the preview.
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { uploadToS3 } from '@/lib/s3';
import { db } from '@/lib/db';
import { extractNormalizedFields } from '@/lib/plugins/extract-normalized-fields';
import { derivePluginTags } from '@/lib/plugins/tags';
import {
  formatPluginSourceIssues,
  validatePluginSchemaReservedFields,
  validatePluginSource,
} from '@/lib/plugins/source-validation';

const EXTERNALS = ['react', 'react-dom', 'remotion', '@remotion/player', '@remotion/renderer'];

function nanoid6(): string {
  return Math.random().toString(36).slice(2, 8);
}

async function buildFromSource(sceneCode: string, pluginId: string, tmpDir: string): Promise<string> {
  const ROOT = process.cwd();
  const srcDir = path.join(tmpDir, 'src');
  const distDir = path.join(tmpDir, 'dist');
  fs.mkdirSync(srcDir, { recursive: true });
  fs.mkdirSync(distDir, { recursive: true });

  const sceneFile = path.join(srcDir, 'Scene.tsx');
  fs.writeFileSync(sceneFile, sceneCode, 'utf-8');

  const sharedUtils = path.join(ROOT, 'shared', 'plugin-utils', 'index.ts');
  const sharedTypes = path.join(ROOT, 'shared', 'plugin-types', 'index.ts');

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
    entryPoints: [sceneFile],
    outfile,
    format:   'cjs',
    bundle:   true,
    external: EXTERNALS,
    target:   ['chrome90'],
    platform: 'browser',
    plugins:  [aliasPlugin],
    sourcemap: false,
    minify:    false,
  });

  if (!fs.existsSync(outfile)) {
    throw new Error('Build succeeded but dist/index.esm.js not found');
  }
  return outfile;
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult as { session: { user: { id: string } } };

  const origin = new URL(request.url).origin;
  let tmpDir: string | undefined;

  try {
    const body = await request.json();
    const {
      scene_code:  sceneCode,
      schema_json: schemaJson,
    } = body as { scene_code: string; schema_json: string };

    if (!sceneCode || !schemaJson) {
      return NextResponse.json({ error: 'Missing scene_code or schema_json' }, { status: 400 });
    }

    // Parse schema
    let schemaObj: Record<string, any> = {};
    try {
      schemaObj = typeof schemaJson === 'string' ? JSON.parse(schemaJson) : schemaJson;
    } catch {
      return NextResponse.json({ success: false, errors: ['schema_json is not valid JSON'] });
    }

    if (!schemaObj.properties || typeof schemaObj.properties !== 'object') {
      return NextResponse.json({ success: false, errors: ['schema_json must have a "properties" object'] });
    }

    const schemaReservedCheck = validatePluginSchemaReservedFields(schemaObj);
    if (!schemaReservedCheck.ok) {
      return NextResponse.json({
        success: false,
        errors: schemaReservedCheck.issues.map((issue) => issue.message),
      });
    }

    const sourceCheck = validatePluginSource({ 'Scene.tsx': sceneCode });
    if (!sourceCheck.ok) {
      return NextResponse.json({
        success: false,
        errors: formatPluginSourceIssues(sourceCheck.issues).split('\n'),
      });
    }

    const previewId = `preview-${nanoid6()}`;
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `plugin-preview-${previewId}-`));

    // Compile — esbuild errors are caught and returned to AI immediately
    let bundlePath: string;
    try {
      bundlePath = await buildFromSource(sceneCode, previewId, tmpDir);
    } catch (e: any) {
      // Extract clean error messages from esbuild output
      const errors: string[] = (e?.errors ?? []).map((err: any) =>
        `${err.text}${err.location ? ` (line ${err.location.line})` : ''}`
      );
      if (errors.length === 0) errors.push(e.message ?? 'Compile failed');
      return NextResponse.json({ success: false, errors });
    }

    // Upload to S3 under preview/ prefix
    const bundleContent = fs.readFileSync(bundlePath, 'utf-8');
    const s3Key = `plugins/preview/${previewId}/bundle.esm.js`;
    await uploadToS3(s3Key, bundleContent, 'application/javascript');

    // Store generation_fields
    const generationFields = extractNormalizedFields(schemaObj, sceneCode);
    const schemaString = typeof schemaJson === 'string' ? schemaJson : JSON.stringify(schemaJson);
    const tags = derivePluginTags({
      id: previewId,
      name: `Preview: ${previewId}`,
      description: 'Temporary preview plugin',
      category: 'content',
      schemaJson: schemaObj,
    });

    await db.query(
      `INSERT INTO plugins (id, name, description, version, category, icon, color, status, s3_key, schema_json, generation_fields, user_id, tags, likes_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, 0)
       ON CONFLICT (id) DO UPDATE SET
         s3_key = $9, schema_json = $10, generation_fields = $11, status = $8, tags = $13, updated_at = NOW()`,
      [
        previewId,
        `Preview: ${previewId}`,
        'Temporary preview plugin — delete after use',
        '0.0.0',
        'content',
        'puzzle',
        '#7C3AED',
        'preview',
        s3Key,
        schemaString,
        JSON.stringify(generationFields),
        session.user.id,
        tags,
      ],
    );

    // Clean up temp dir
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

    return NextResponse.json({
      success:    true,
      previewId,
      previewUrl: `${origin}/preview/plugin/${previewId}`,
    });

  } catch (error) {
    if (tmpDir) try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    console.error('[/api/plugins/preview]', error);
    return NextResponse.json(
      { success: false, errors: [error instanceof Error ? error.message : 'Preview failed'] },
      { status: 500 },
    );
  }
}
