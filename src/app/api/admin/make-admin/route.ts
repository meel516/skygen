import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (process.env.ENABLE_ADMIN_BOOTSTRAP !== 'true') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const secret = request.headers.get('x-admin-bootstrap-secret') || request.nextUrl.searchParams.get('secret');
  const expectedSecret = process.env.ADMIN_BOOTSTRAP_SECRET;

  if (!expectedSecret || secret !== expectedSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const email = request.nextUrl.searchParams.get('email') || process.env.ADMIN_BOOTSTRAP_EMAIL;

  if (!email) {
    return NextResponse.json({ error: 'Bootstrap email not configured' }, { status: 400 });
  }

  try {
    const userResult = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found. Make sure the user has logged in first.' }, { status: 404 });
    }

    const userId = userResult.rows[0].id;

    await db.query(
      'UPDATE users SET role = $1, "updatedAt" = NOW() WHERE id = $2',
      ['ADMIN', userId]
    );

    return NextResponse.json({ success: true, userId, email });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
