import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/youtube/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

// Ensure the youtube_accounts table exists
async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS youtube_accounts (
      user_id      TEXT PRIMARY KEY,
      access_token  TEXT NOT NULL,
      refresh_token TEXT,
      expiry_date   BIGINT,
      updated_at    TIMESTAMPTZ DEFAULT now()
    )
  `);
}

// Handle OAuth callback - exchange code for tokens
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  // Always redirect back to the production app, not whatever host Google called
  const appBase = process.env.NEXTAUTH_URL || request.nextUrl.origin;

  if (error) {
    return NextResponse.redirect(`${appBase}/?youtube_error=${error}`);
  }

  if (!code) {
    return NextResponse.redirect(`${appBase}/?youtube_error=no_code`);
  }

  try {
    const tokens = await getTokensFromCode(code);
    const session = await auth();

    if (session?.user?.id) {
      await ensureTable();
      await db.query(
        `INSERT INTO youtube_accounts (user_id, access_token, refresh_token, expiry_date, updated_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (user_id) DO UPDATE
           SET access_token = $2, refresh_token = COALESCE($3, youtube_accounts.refresh_token),
               expiry_date = $4, updated_at = now()`,
        [
          session.user.id,
          tokens.access_token,
          tokens.refresh_token ?? null,
          tokens.expiry_date ?? null,
        ]
      );
      return NextResponse.redirect(`${appBase}/?youtube_connected=1`);
    }

    // Fallback: no session
    const tokensStr = Buffer.from(JSON.stringify(tokens)).toString('base64');
    return NextResponse.redirect(`${appBase}/?youtube_tokens=${tokensStr}`);
  } catch (err) {
    console.error('YouTube OAuth error:', err);
    return NextResponse.redirect(`${appBase}/?youtube_error=auth_failed`);
  }
}
