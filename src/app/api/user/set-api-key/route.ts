import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const { provider, apiKey } = await req.json();

  if (!provider || typeof apiKey !== 'string') {
    return NextResponse.json({ error: 'Missing provider or apiKey' }, { status: 400 });
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

  // Persist provider keys to DB so MCP requests (no cookies) can look them up
  const dbColumn: Record<string, string> = {
    deepseek:   'xai_api_key',
    xai:        'xai_api_key',
    deepgram:   'deepgram_api_key',
    elevenlabs: 'elevenlabs_api_key',
    cartesia:   'cartesia_api_key',
  };
  if (dbColumn[provider]) {
    try {
      await db.query(
        `UPDATE users SET "${dbColumn[provider]}" = $1 WHERE id = $2`,
        [apiKey.trim() || null, session.user.id],
      );
    } catch { /* non-fatal — cookie is the primary storage */ }
  }

  return res;
}
