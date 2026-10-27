import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/site-config
 * Public endpoint — returns all site configuration and block thumbnails.
 * Frontend uses hardcoded defaults as fallback when keys are missing.
 */
export async function GET() {
  try {
    const [configResult, thumbnailsResult] = await Promise.all([
      db.query(`SELECT key, value FROM site_config`),
      db.query(`SELECT block_type, thumbnail_url FROM block_thumbnails`),
    ]);

    const config: Record<string, unknown> = {};
    for (const row of configResult.rows) {
      config[row.key] = row.value;
    }

    const blockThumbnails: Record<string, string> = {};
    for (const row of thumbnailsResult.rows) {
      if (row.thumbnail_url) {
        blockThumbnails[row.block_type] = row.thumbnail_url;
      }
    }

    return NextResponse.json(
      { config, blockThumbnails },
      {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
        },
      }
    );
  } catch (error) {
    // Tables may not exist yet if migration hasn't run
    return NextResponse.json({ config: {}, blockThumbnails: {} });
  }
}
