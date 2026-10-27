import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

export async function GET() {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  const result = await db.query(
    `SELECT block_type, thumbnail_url, updated_at FROM block_thumbnails ORDER BY block_type`
  );
  return NextResponse.json({ thumbnails: result.rows });
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const { blockType, thumbnailUrl } = await request.json();

  if (!blockType) {
    return NextResponse.json({ error: 'blockType is required' }, { status: 400 });
  }

  if (thumbnailUrl) {
    await db.query(
      `INSERT INTO block_thumbnails (block_type, thumbnail_url, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (block_type) DO UPDATE SET thumbnail_url = $2, updated_by = $3, updated_at = now()`,
      [blockType, thumbnailUrl, session.user.id]
    );
  } else {
    // Remove thumbnail (revert to default icon)
    await db.query(`DELETE FROM block_thumbnails WHERE block_type = $1`, [blockType]);
  }

  return NextResponse.json({ success: true });
}
