import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

async function ensureTable() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id           TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      TEXT NOT NULL,
      key_hash     TEXT NOT NULL UNIQUE,
      key_prefix   TEXT NOT NULL,
      label        TEXT NOT NULL DEFAULT 'Default',
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMPTZ
    )
  `);
}

// GET /api/user/api-keys — list keys (prefix + metadata only, never hash)
export async function GET() {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  await ensureTable();

  const result = await db.query(
    `SELECT id, key_prefix, label, created_at, last_used_at
     FROM user_api_keys WHERE user_id = $1 ORDER BY created_at DESC`,
    [session.user.id]
  );

  return NextResponse.json({ keys: result.rows });
}

// POST /api/user/api-keys — generate a new key, return plaintext once
export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const body = await req.json().catch(() => ({}));
  const label = (body.label as string | undefined)?.slice(0, 64) || 'Default';

  await ensureTable();

  // Limit to 5 keys per user
  const count = await db.query(
    `SELECT COUNT(*) FROM user_api_keys WHERE user_id = $1`,
    [session.user.id]
  );
  if (parseInt(count.rows[0].count, 10) >= 5) {
    return NextResponse.json({ error: 'Maximum 5 API keys allowed' }, { status: 400 });
  }

  const rawKey    = `sk-vg-${randomBytes(24).toString('hex')}`;
  const keyHash   = createHash('sha256').update(rawKey).digest('hex');
  const keyPrefix = rawKey.slice(0, 12); // "sk-vg-XXXXXX"

  await db.query(
    `INSERT INTO user_api_keys (user_id, key_hash, key_prefix, label)
     VALUES ($1, $2, $3, $4)`,
    [session.user.id, keyHash, keyPrefix, label]
  );

  // Return plaintext key ONCE — never stored
  return NextResponse.json({ key: rawKey, prefix: keyPrefix, label });
}

// DELETE /api/user/api-keys/[id] is handled by the [id] subroute
// But we support DELETE with body here too for simplicity
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const body = await req.json().catch(() => ({}));
  const { id } = body as { id?: string };
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  await ensureTable();

  const result = await db.query(
    `DELETE FROM user_api_keys WHERE id = $1 AND user_id = $2`,
    [id, session.user.id]
  );

  if (result.rowCount === 0) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
