import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult as { session: { user: { id: string } } };
  const { id } = await params;

  const result = await db.query(
    `SELECT id, name, data, url, duration, "createdAt" FROM "Video" WHERE id = $1 AND "userId" = $2`,
    [id, session.user.id]
  );
  if (!result.rows[0]) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(result.rows[0]);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;
  const { id } = await params;

  const { url } = await req.json();

  const result = await db.query(`SELECT "userId" FROM "Video" WHERE id = $1`, [id]);
  if (result.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (result.rows[0].userId !== session.user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  await db.query(`UPDATE "Video" SET url = $1 WHERE id = $2`, [url, id]);
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;
  const { id } = await params;

  try {
    const result = await db.query(
      `SELECT "userId" FROM "Video" WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    if (result.rows[0].userId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await db.query(`DELETE FROM "Video" WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Video delete error:', err);
    return NextResponse.json({ error: 'Failed to delete video' }, { status: 500 });
  }
}
