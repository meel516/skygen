// ============================================================================
// PLUGIN BUNDLE API
// Serves compiled ESM bundle for a plugin.
// Core plugins → local filesystem (built at deploy time)
// Custom plugins → S3 (uploaded during install)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getS3Object } from '@/lib/s3';
import { db } from '@/lib/db';
import { normalizePluginId } from '@/lib/plugins/utils';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const normalizedId = normalizePluginId(id);

    if (!normalizedId) {
      return new NextResponse('Invalid plugin id', { status: 400 });
    }

    // 1) Try local filesystem (core plugins built at deploy time)
    const pluginsDir = path.join(process.cwd(), 'plugins');
    const localPath = [
      path.join(pluginsDir, 'core', id, 'dist', 'index.js'),
      path.join(pluginsDir, 'custom', id, 'dist', 'index.js'),
    ].find(p => fs.existsSync(p));

    if (localPath) {
      const code = fs.readFileSync(localPath, 'utf-8');
      return new NextResponse(code, {
        status: 200,
        headers: {
          'Content-Type': 'application/javascript; charset=utf-8',
          'Cache-Control': 'no-cache',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // 2) Try S3 via database lookup (custom plugins installed at runtime)
    console.log(`[plugins-bundle] Requesting bundle for ID: ${normalizedId} (original: ${id})`);
    const result = await db.query('SELECT s3_key FROM plugins WHERE id = $1', [normalizedId]);
    
    if (result.rows.length === 0) {
      console.warn(`[plugins-bundle] 404: Plugin "${normalizedId}" not found in database.`);
      return new NextResponse(
        `Plugin "${normalizedId}" not found`,
        { status: 404 }
      );
    }

    const { s3_key: s3Key } = result.rows[0];
    console.log(`[plugins-bundle] Found record for "${normalizedId}". S3 Key: ${s3Key}`);
    const code = await getS3Object(s3Key);

    return new NextResponse(code, {
      status: 200,
      headers: {
        'Content-Type': 'application/javascript; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Failed to serve plugin bundle:', error);
    return new NextResponse('Failed to serve plugin bundle', { status: 500 });
  }
}
