import 'server-only';

import { createHash } from 'crypto';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { resolveOAuthToken } from '@/lib/oauth';
import { isAdmin, isContentManager } from '@/lib/roles';
import { consumeRateLimit, getRateLimitHeaders, getRateLimitKey } from '@/lib/rate-limit';

type Session = NonNullable<Awaited<ReturnType<typeof auth>>>;

// Validate a Bearer API key (sk-vg-...) against the user_api_keys table.
// Returns a minimal session-shaped object on success, null on failure.
async function resolveApiKey(rawKey: string): Promise<Session | null> {
  try {
    const keyHash = createHash('sha256').update(rawKey).digest('hex');
    const result = await db.query(
      `SELECT k.user_id, u.email, u.name, u.role, u."videoCount", u."videoLimit"
       FROM user_api_keys k
       JOIN users u ON u.id = k.user_id
       WHERE k.key_hash = $1`,
      [keyHash]
    );
    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    // Update last_used_at async — don't block the request
    db.query(
      `UPDATE user_api_keys SET last_used_at = NOW() WHERE key_hash = $1`,
      [keyHash]
    ).catch(() => {});

    // Shape matches what NextAuth session.user looks like
    return {
      user: {
        id:         row.user_id,
        email:      row.email,
        name:       row.name,
        role:       row.role,
        videoCount: row.videoCount ?? 0,
        videoLimit: row.videoLimit ?? 10,
      },
      expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    } as unknown as Session;
  } catch {
    return null;
  }
}

export async function requireAuthenticatedSession(
  options?: { admin?: boolean; contentManager?: boolean }
): Promise<{ session: Session } | { response: NextResponse }> {
  // Check for Bearer API key first (used by MCP server)
  // Uses next/headers so no route changes needed
  const headersList = await headers();
  const authHeader = headersList.get('authorization') ?? '';
  
  // 1. Check for OAuth access token (sk-vg-oauth-...) — must come BEFORE the generic sk-vg- check
  if (authHeader.startsWith('Bearer sk-vg-oauth-')) {
    const rawToken = authHeader.slice('Bearer '.length);
    const oauthSession = await resolveOAuthToken(rawToken);
    if (!oauthSession) {
      return { response: NextResponse.json({ error: 'Invalid or expired OAuth token' }, { status: 401 }) };
    }
    if (options?.admin && !isAdmin(oauthSession.user.role)) {
      return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
    }
    return { session: oauthSession };
  }

  // 3. Check for real Bearer API key (sk-vg-...)
  if (authHeader.startsWith('Bearer sk-vg-')) {
    const rawKey = authHeader.slice('Bearer '.length);
    const apiKeySession = await resolveApiKey(rawKey);
    if (!apiKeySession) {
      return {
        response: NextResponse.json({ error: 'Invalid API key' }, { status: 401 }),
      };
    }
    if (options?.admin && !isAdmin(apiKeySession.user.role)) {
      return { response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }) };
    }
    return { session: apiKeySession };
  }

  // Fall back to NextAuth session (web UI)
  const session = await auth();

  if (!session?.user?.id) {
    return {
      response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }),
    };
  }

  if (options?.admin && !isAdmin(session.user.role)) {
    return {
      response: NextResponse.json({ error: 'Admin access required' }, { status: 403 }),
    };
  }

  if (options?.contentManager && !isContentManager(session.user.role)) {
    return {
      response: NextResponse.json({ error: 'Content manager access required' }, { status: 403 }),
    };
  }

  return { session: session as Session };
}

export function enforceRateLimit(options: {
  request: Request;
  userId?: string | null;
  scope: string;
  limit: number;
  windowMs: number;
}): { headers: HeadersInit } | { response: NextResponse } {
  const result = consumeRateLimit({
    key: getRateLimitKey({
      request: options.request,
      userId: options.userId,
      scope: options.scope,
    }),
    limit: options.limit,
    windowMs: options.windowMs,
  });

  if (!result.allowed) {
    return {
      response: NextResponse.json(
        { error: 'Rate limit exceeded' },
        { status: 429, headers: getRateLimitHeaders(result) }
      ),
    };
  }

  return { headers: getRateLimitHeaders(result) };
}
