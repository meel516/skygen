import { NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

/** GET /api/music — List all music tracks for the wizard UI */
export async function GET() {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  try {
    const result = await db.query(
      `SELECT id, name, artist, mood, duration, src, tags
       FROM music_tracks ORDER BY mood, name`
    );
    return NextResponse.json({ tracks: result.rows });
  } catch {
    // Table may not exist yet — return empty
    return NextResponse.json({ tracks: [] });
  }
}
