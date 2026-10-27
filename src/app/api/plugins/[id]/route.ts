// ============================================================================
// PLUGINS API - Individual plugin endpoints
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';
import { s3, getBucketName } from '@/lib/s3';
import { DeleteObjectCommand } from '@aws-sdk/client-s3';

// DELETE /api/plugins/[id] - Uninstall a custom plugin (core plugins cannot be deleted)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
      return NextResponse.json({ error: 'Invalid plugin id' }, { status: 400 });
    }

    const customDir = path.join(process.cwd(), 'plugins', 'custom', id);
    const coreDir = path.join(process.cwd(), 'plugins', 'core', id);

    if (fs.existsSync(coreDir)) {
      return NextResponse.json(
        { error: 'Core plugins cannot be uninstalled' },
        { status: 403 }
      );
    }

    // Check DB first (covers plugins installed at runtime on Vercel)
    let dbRow: { s3_key: string } | null = null;
    try {
      const result = await db.query('SELECT s3_key FROM plugins WHERE id = $1', [id]);
      dbRow = result.rows[0] ?? null;
    } catch { /* DB not available locally */ }

    const existsLocally = fs.existsSync(customDir);
    if (!dbRow && !existsLocally) {
      return NextResponse.json({ error: 'Plugin not found' }, { status: 404 });
    }

    // Remove from DB
    try {
      await db.query('DELETE FROM plugins WHERE id = $1', [id]);
    } catch { /* non-critical */ }

    // Remove from S3
    try {
      const s3Key = dbRow?.s3_key ?? `plugins/${id}/bundle.esm.js`;
      await s3.send(new DeleteObjectCommand({ Bucket: getBucketName(), Key: s3Key }));
    } catch { /* non-critical — object may not exist */ }

    // Remove local filesystem copy (local dev)
    if (existsLocally) {
      try { fs.rmSync(customDir, { recursive: true }); } catch { /* ignore */ }
    }

    // Remove from local registry
    try {
      const registryPath = path.join(process.cwd(), 'plugins', '_registry.json');
      if (fs.existsSync(registryPath)) {
        const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
        registry.plugins = registry.plugins.filter((p: { id: string }) => p.id !== id);
        for (const cat of Object.keys(registry.categories ?? {})) {
          registry.categories[cat] = (registry.categories[cat] as string[]).filter((pid: string) => pid !== id);
        }
        registry.generatedAt = new Date().toISOString();
        fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
      }
    } catch { /* non-critical */ }

    return NextResponse.json({ success: true, pluginId: id });
  } catch (error) {
    console.error('Plugin uninstall failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Uninstall failed' },
      { status: 500 }
    );
  }
}

// GET /api/plugins/[id] - Get plugin by ID
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Find plugin directory
    const pluginsDir = path.join(process.cwd(), 'plugins');
    const coreDir = path.join(pluginsDir, 'core', id);
    const customDir = path.join(pluginsDir, 'custom', id);
    
    let pluginDir: string | null = null;
    
    if (fs.existsSync(coreDir)) {
      pluginDir = coreDir;
    } else if (fs.existsSync(customDir)) {
      pluginDir = customDir;
    }
    
    if (!pluginDir) {
      return NextResponse.json(
        { error: 'Plugin not found' },
        { status: 404 }
      );
    }
    
    // Read plugin manifest
    const manifestPath = path.join(pluginDir, 'plugin.json');
    if (!fs.existsSync(manifestPath)) {
      return NextResponse.json(
        { error: 'Plugin manifest not found' },
        { status: 404 }
      );
    }
    
    const manifestContent = fs.readFileSync(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);
    
    // Read schema
    const schemaPath = path.join(pluginDir, 'schema.json');
    let schema = {};
    if (fs.existsSync(schemaPath)) {
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      schema = JSON.parse(schemaContent);
    }
    
    // Return plugin definition
    return NextResponse.json({
      id: manifest.id,
      name: manifest.name,
      version: manifest.version,
      category: manifest.category,
      icon: manifest.icon,
      color: manifest.color,
      description: manifest.description,
      schema,
      defaults: (schema as Record<string, unknown>).defaults || {},
      remotion: manifest.remotion,
      features: manifest.features,
    });
  } catch (error) {
    console.error('Failed to load plugin:', error);
    return NextResponse.json(
      { error: 'Failed to load plugin' },
      { status: 500 }
    );
  }
}
