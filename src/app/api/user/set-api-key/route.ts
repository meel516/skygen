import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

const dbColumn: Record<string, string> = {
  deepseek: 'xai_api_key', xai: 'xai_api_key', deepgram: 'deepgram_api_key',
  elevenlabs: 'elevenlabs_api_key', cartesia: 'cartesia_api_key',
};

export async function GET(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  try {
    const result = await db.query(
      `SELECT xai_api_key, deepgram_api_key, elevenlabs_api_key, cartesia_api_key FROM users WHERE id = $1`,
      [authResult.session.user.id],
    );
    const row = result.rows[0] ?? {};
    const providers = Object.fromEntries(Object.entries(dbColumn).map(([provider, column]) => [provider, {
      saved: Boolean(row[column]?.trim()),
      browserOnly: !row[column]?.trim() && Boolean(req.cookies.get(`api_key_${provider}`)?.value),
    }]));
    return NextResponse.json({ providers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not check saved keys.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const { provider, apiKey } = await req.json();

  if (!Object.hasOwn(dbColumn, provider) || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'Missing provider or apiKey' }, { status: 400 });
  }

  // Confirm database persistence before reporting success or changing the cookie.
  try {
    const result = await db.query(
      `UPDATE users SET "${dbColumn[provider]}" = $1 WHERE id = $2 RETURNING id`,
      [apiKey.trim() || null, session.user.id],
    );
    if (!result.rows.length) throw new Error('Account not found');
  } catch {
    return NextResponse.json({ error: 'Could not save the key to your account. Please retry.' }, { status: 500 });
  }

  const cookieName = `api_key_${provider}`;
  const res = NextResponse.json({ ok: true });

  if (apiKey.trim() === '') {
    res.cookies.set(cookieName, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 0,
    });
  } else {
    res.cookies.set(cookieName, apiKey.trim(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return res;
}
