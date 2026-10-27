import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

export async function GET() {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  try {
    const result = await db.query(`SELECT key, value, updated_at FROM site_config ORDER BY key`);
    return NextResponse.json({ configs: result.rows });
  } catch (err: any) {
    console.error('site_config GET error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const { key, value } = await request.json();

  if (!key || value === undefined) {
    return NextResponse.json({ error: 'key and value are required' }, { status: 400 });
  }

  try {
    await db.query(
      `INSERT INTO site_config (key, value, updated_by, updated_at)
       VALUES ($1, $2::jsonb, $3, now())
       ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_by = $3, updated_at = now()`,
      [key, JSON.stringify(value), session.user.id]
    );
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('site_config PUT error:', err);
    return NextResponse.json({ error: err.message || 'Internal error' }, { status: 500 });
  }
}
