// ============================================================================
// PLUGIN SCHEMA API - Returns schema for a specific plugin
// Checks filesystem (core) then database (custom) then S3
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { db } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // 1) Try filesystem (core plugins)
    const pluginsDir = path.join(process.cwd(), 'plugins');
    const coreDir = path.join(pluginsDir, 'core', id);
    const customDir = path.join(pluginsDir, 'custom', id);

    let pluginDir: string | null = null;
    if (fs.existsSync(coreDir)) pluginDir = coreDir;
    else if (fs.existsSync(customDir)) pluginDir = customDir;

    if (pluginDir) {
      const schemaPath = path.join(pluginDir, 'schema.json');
      if (fs.existsSync(schemaPath)) {
        const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
        return NextResponse.json(schema);
      }
    }

    // 2) Try database (custom plugins installed at runtime)
    try {
      const result = await db.query('SELECT schema_json FROM plugins WHERE id = $1', [id]);
      if (result.rows.length > 0) {
        const schema = JSON.parse(result.rows[0].schema_json);
        return NextResponse.json(schema);
      }
    } catch { /* DB not available */ }

    return NextResponse.json({ error: 'Schema not found' }, { status: 404 });
  } catch (error) {
    console.error('Failed to load schema:', error);
    return NextResponse.json({ error: 'Failed to load schema' }, { status: 500 });
  }
}
