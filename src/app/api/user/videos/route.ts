import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  try {
    const result = await db.query(
      `SELECT id, name, url, duration, "createdAt" FROM "Video"
       WHERE "userId" = $1 ORDER BY "createdAt" DESC`,
      [session.user.id]
    );
    return NextResponse.json({ videos: result.rows });
  } catch (err) {
    console.error('Videos fetch error:', err);
    return NextResponse.json({ error: 'Failed to fetch videos' }, { status: 500 });
  }
}
