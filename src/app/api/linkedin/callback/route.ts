import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/linkedin/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS linkedin_accounts (
      user_id       TEXT PRIMARY KEY,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expiry_date   BIGINT,
      updated_at    TIMESTAMPTZ DEFAULT now()
    )
  `);
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const appBase = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${appBase}/?linkedin_error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appBase}/?linkedin_error=no_code`);
  }

  try {
    const tokens = await getTokensFromCode(code);
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.redirect(`${appBase}/?linkedin_error=not_authenticated`);
    }

    const expiryDate = tokens.expires_in
      ? Date.now() + tokens.expires_in * 1000
      : null;

    await ensureTable();
    await db.query(
      `INSERT INTO linkedin_accounts (user_id, access_token, refresh_token, expiry_date, updated_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (user_id) DO UPDATE
         SET access_token = $2,
             refresh_token = COALESCE($3, linkedin_accounts.refresh_token),
             expiry_date = $4,
             updated_at = now()`,
      [session.user.id, tokens.access_token, tokens.refresh_token ?? null, expiryDate]
    );

    return NextResponse.redirect(`${appBase}/?linkedin_connected=1`);
  } catch (err) {
    console.error('LinkedIn OAuth error:', err);
    return NextResponse.redirect(`${appBase}/?linkedin_error=auth_failed`);
  }
}
