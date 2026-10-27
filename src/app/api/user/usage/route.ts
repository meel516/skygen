import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  try {
    const result = await db.query(
      `SELECT "videoCount", "videoLimit", "aiCount", "aiLimit", "aiTokensUsed", "aiTokenLimit", role FROM users WHERE id = $1`,
      [session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ videoCount: 0, videoLimit: 10, aiCount: 0, aiLimit: 20, aiTokensUsed: 0, aiTokenLimit: 100000, role: 'USER' });
    }

    const row = result.rows[0];
    return NextResponse.json({
      videoCount:    row.videoCount    ?? 0,
      videoLimit:    row.videoLimit    ?? 10,
      aiCount:       row.aiCount       ?? 0,
      aiLimit:       row.aiLimit       ?? 20,
      aiTokensUsed:  row.aiTokensUsed  ?? 0,
      aiTokenLimit:  row.aiTokenLimit  ?? 100000,
      role:          row.role          ?? 'USER',
    });
  } catch (err) {
    console.error('Usage fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
