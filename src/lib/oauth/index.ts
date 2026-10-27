import 'server-only';

import { randomBytes } from 'node:crypto';
import { db } from '@/lib/db';
import { auth } from '@/lib/auth';

type Session = NonNullable<Awaited<ReturnType<typeof auth>>>;

/** Returns a 64-character hex string (32 bytes of randomness). */
export function generateCode(): string {
  return randomBytes(32).toString('hex');
}

/** Returns a token in the format `sk-vg-oauth-<64hex>`. */
export function generateToken(): string {
  return `sk-vg-oauth-${randomBytes(32).toString('hex')}`;
}

/**
 * Inserts a new authorization code into the DB with a 10-minute expiry.
 */
export async function storeCode(
  code: string,
  clientId: string,
  userId: string,
  redirectUri: string,
  codeChallenge?: string,
  codeChallengeMethod?: string
): Promise<void> {
  await db.query(
    `INSERT INTO oauth_authorization_codes (code, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '10 minutes')`,
    [code, clientId, userId, redirectUri, codeChallenge || null, codeChallengeMethod || null]
  );
}

/**
 * Atomically exchanges a valid (non-expired) authorization code for an access token.
 * Deletes the code, creates an access token with 90-day expiry.
 * Returns the new token string, or null if the code is invalid/expired.
 */
export async function exchangeCode(code: string, codeVerifier?: string): Promise<string | null> {
  // Look up the code – must exist and not be expired
  const codeResult = await db.query(
    `SELECT client_id, user_id, redirect_uri, scope, code_challenge, code_challenge_method
     FROM oauth_authorization_codes
     WHERE code = $1 AND expires_at > NOW()`,
    [code]
  );

  if (codeResult.rows.length === 0) return null;

  const row = codeResult.rows[0];

  // Validate PKCE if it was provided during authorization
  if (row.code_challenge && row.code_challenge_method === 'S256') {
    if (!codeVerifier) return null;
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    if (hash !== row.code_challenge) return null;
  } else if (row.code_challenge && row.code_challenge_method === 'plain') {
    if (codeVerifier !== row.code_challenge) return null;
  }

  const { client_id, user_id, scope } = row;

  // Delete the used code (single-use)
  await db.query(
    `DELETE FROM oauth_authorization_codes WHERE code = $1`,
    [code]
  );

  // Create the access token
  const token = generateToken();
  await db.query(
    `INSERT INTO oauth_access_tokens (token, client_id, user_id, scope, expires_at)
     VALUES ($1, $2, $3, $4, NOW() + INTERVAL '90 days')`,
    [token, client_id, user_id, scope]
  );

  return token;
}

/**
 * Revokes (deletes) an access token. Safe to call even if the token doesn't exist.
 */
export async function revokeToken(token: string): Promise<void> {
  await db.query(
    `DELETE FROM oauth_access_tokens WHERE token = $1`,
    [token]
  );
}

/**
 * Resolves an OAuth access token to a session-shaped object (same shape as
 * resolveApiKey in api-security.ts). Returns null if token is invalid or expired.
 */
export async function resolveOAuthToken(rawToken: string): Promise<Session | null> {
  try {
    const result = await db.query(
      `SELECT t.user_id, t.scope, u.email, u.name, u.role, u."videoCount", u."videoLimit"
       FROM oauth_access_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token = $1 AND t.expires_at > NOW()`,
      [rawToken]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];

    return {
      user: {
        id:         row.user_id,
        email:      row.email,
        name:       row.name,
        role:       row.role,
        videoCount: row.videoCount ?? 0,
        videoLimit: row.videoLimit ?? 10,
      },
      expires: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
    } as unknown as Session;
  } catch {
    return null;
  }
}
