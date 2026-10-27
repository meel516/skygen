// ============================================================================
// PLUGIN INSTALL API
// POST /api/plugins/install  — accepts multipart/form-data with a 'plugin' ZIP file
//
// Plugins must be pre-built (dist/index.esm.js included in ZIP).
// The server does NOT compile — it validates, extracts the ready bundle,
// uploads to S3, and saves metadata to DB. Works on Vercel free plan (<2s).
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import AdmZip from 'adm-zip';
import { checkPluginCompatibility } from '@/lib/plugins/compatibility-checker';
import { uploadToS3 } from '@/lib/s3';
import { db } from '@/lib/db';
import { extractNormalizedFields } from '@/lib/plugins/extract-normalized-fields';
import { derivePluginTags } from '@/lib/plugins/tags';

function extractZip(zipBuffer: Buffer, destDir: string): void {
  fs.mkdirSync(destDir, { recursive: true });
  const zip = new AdmZip(zipBuffer);
  zip.extractAllTo(destDir, true);
}

function updateLocalRegistry(pluginId: string, manifest: Record<string, unknown>): void {
  const registryPath = path.join(process.cwd(), 'plugins', '_registry.json');
  if (!fs.existsSync(registryPath)) return;

  let registry: {
    version: string;
    generatedAt: string;
    plugins: Record<string, unknown>[];
    categories: Record<string, string[]>;
  };

  try {
    registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch {
    return;
  }

  registry.plugins = registry.plugins.filter((p) => p.id !== pluginId);
  registry.plugins.push({
    id: manifest.id,
    name: manifest.name,
    path: `./plugins/custom/${pluginId}`,
    category: manifest.category ?? 'other',
    icon: manifest.icon ?? 'puzzle',
    color: manifest.color ?? '#7C3AED',
    description: manifest.description ?? '',
    version: manifest.version,
    status: 'stable',
  });

  const category = String(manifest.category ?? 'other');
  if (!registry.categories[category]) registry.categories[category] = [];
  if (!registry.categories[category].includes(pluginId)) {
    registry.categories[category].push(pluginId);
  }

  registry.generatedAt = new Date().toISOString();
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

export async function POST(request: NextRequest) {
  let tmpDir: string | undefined;
  try {
    const formData = await request.formData();
    const file = formData.get('plugin') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No plugin file provided. Send a ZIP as "plugin" field.' },
        { status: 400 }
      );
    }

    if (!file.name.endsWith('.zip')) {
      return NextResponse.json({ error: 'Plugin must be a .zip file' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Extract to temp dir (works on Vercel /tmp and local)
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'plugin-install-'));
    extractZip(buffer, tmpDir);

    // Validate structure, manifest, schema, and that dist/index.esm.js exists
    const check = checkPluginCompatibility(tmpDir);
    if (!check.compatible) {
      return NextResponse.json(
        {
          error: 'Plugin failed compatibility check',
          errors: check.errors,
          warnings: check.warnings,
        },
        { status: 422 }
      );
    }

    // Read manifest
    const manifest = JSON.parse(fs.readFileSync(path.join(tmpDir, 'plugin.json'), 'utf-8'));
    const pluginId = String(manifest.id);

    // Read schema
    const schemaPath = path.join(tmpDir, 'schema.json');
    const schemaJson = fs.existsSync(schemaPath)
      ? fs.readFileSync(schemaPath, 'utf-8')
      : '{}';

    // Extract generation_fields from schema editor fields + Scene.tsx data-ai-type annotations
    let schemaObj: Record<string, any> = {};
    try { schemaObj = JSON.parse(schemaJson); } catch { /* ignore */ }
    const sceneCode = fs.existsSync(path.join(tmpDir, 'src', 'Scene.tsx'))
      ? fs.readFileSync(path.join(tmpDir, 'src', 'Scene.tsx'), 'utf-8')
      : '';
    const generationFields = extractNormalizedFields(schemaObj, sceneCode);
    const tags = derivePluginTags({
      id: pluginId,
      name: manifest.name ?? pluginId,
      description: manifest.description ?? '',
      category: manifest.category ?? 'custom',
      schemaJson: schemaObj,
    });

    // Read the pre-built ESM bundle (already validated to exist by compatibility checker)
    const bundleContent = fs.readFileSync(
      path.join(tmpDir, 'dist', 'index.esm.js'),
      'utf-8'
    );

    // Upload bundle to S3
    const s3Key = `plugins/${pluginId}/bundle.esm.js`;
    await uploadToS3(s3Key, bundleContent, 'application/javascript');

    // Save metadata to DB (works on both Vercel + local)
    await db.query(
      `INSERT INTO plugins (id, name, description, version, category, icon, color, status, s3_key, schema_json, generation_fields, tags, likes_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 0)
       ON CONFLICT (id) DO UPDATE SET
         name = $2, description = $3, version = $4, category = $5,
         icon = $6, color = $7, status = $8, s3_key = $9, schema_json = $10,
         generation_fields = $11, tags = $12, updated_at = NOW()`,
      [
        pluginId,
        manifest.name ?? pluginId,
        manifest.description ?? '',
        manifest.version ?? '1.0.0',
        manifest.category ?? 'custom',
        manifest.icon ?? 'puzzle',
        manifest.color ?? '#7C3AED',
        'stable',
        s3Key,
        schemaJson,
        JSON.stringify(generationFields),
        tags,
      ]
    );

    // Copy to local plugins/custom/ for local dev filesystem serving (non-critical on Vercel)
    try {
      const customDir = path.join(process.cwd(), 'plugins', 'custom', pluginId);
      if (fs.existsSync(customDir)) fs.rmSync(customDir, { recursive: true });
      fs.cpSync(tmpDir, customDir, { recursive: true });
      updateLocalRegistry(pluginId, manifest);
    } catch {
      // Vercel has read-only FS — this is fine, S3+DB takes over
    }

    // Clean up temp dir
    try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }

    return NextResponse.json({
      success: true,
      pluginId,
      name: manifest.name,
      warnings: check.warnings,
    });
  } catch (error) {
    console.error('Plugin install failed:', error);
    if (tmpDir) {
      try { fs.rmSync(tmpDir, { recursive: true }); } catch { /* ignore */ }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Plugin installation failed' },
      { status: 500 }
    );
  }
}
