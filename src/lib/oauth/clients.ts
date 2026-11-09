import 'server-only';

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { db } from '@/lib/db';

export type OAuthClientAuthMethod = 'none' | 'client_secret_basic' | 'client_secret_post';

let schemaReady: Promise<void> | undefined;

/** Lazily upgrades older deployments before DCR or client-auth checks use the new columns. */
export async function ensureOAuthClientSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await db.query(`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          redirect_uris TEXT[] NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await db.query('ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS client_secret_hash TEXT');
      await db.query(`ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none'`);
      await db.query(`ALTER TABLE oauth_clients ADD COLUMN IF NOT EXISTS dynamic_registration BOOLEAN NOT NULL DEFAULT false`);
    })().catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }

  const ready = schemaReady;
  if (!ready) throw new Error('OAuth client schema initialization did not start');
  await ready;
}

export function hashClientSecret(secret: string): string {
  return createHash('sha256').update(secret).digest('hex');
}

export function verifyClientSecret(secret: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashClientSecret(secret), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function authenticateOAuthTokenClient(input: {
  clientId: string;
  clientSecret: string | null;
  authMethod: OAuthClientAuthMethod;
}): Promise<boolean> {
  await ensureOAuthClientSchema();

  // CIMD clients identify themselves by their HTTPS metadata URL and use PKCE.
  if (input.clientId.startsWith('https://')) {
    return input.authMethod === 'none' && input.clientSecret === null;
  }

  const result = await db.query(
    `SELECT token_endpoint_auth_method, client_secret_hash FROM oauth_clients WHERE id = $1`,
    [input.clientId]
  );
  if (result.rows.length === 0) return false;

  const client = result.rows[0];
  const registeredMethod = (client.token_endpoint_auth_method || 'none') as OAuthClientAuthMethod;
  if (registeredMethod !== input.authMethod) return false;

  if (registeredMethod === 'none') return input.clientSecret === null;
  if (!input.clientSecret || !client.client_secret_hash) return false;

  return verifyClientSecret(input.clientSecret, client.client_secret_hash);
}

export async function registerOAuthClient(input: {
  clientName: string;
  redirectUris: string[];
  tokenEndpointAuthMethod: OAuthClientAuthMethod;
}): Promise<{
  clientId: string;
  clientSecret: string | null;
  clientIdIssuedAt: number;
}> {
  await ensureOAuthClientSchema();

  const clientId = `skygen_${randomBytes(24).toString('base64url')}`;
  const clientSecret = input.tokenEndpointAuthMethod === 'none'
    ? null
    : randomBytes(32).toString('base64url');

  await db.query(
    `INSERT INTO oauth_clients (id, name, redirect_uris, client_secret_hash, token_endpoint_auth_method, dynamic_registration)
     VALUES ($1, $2, $3, $4, $5, true)`,
    [
      clientId,
      input.clientName,
      input.redirectUris,
      clientSecret ? hashClientSecret(clientSecret) : null,
      input.tokenEndpointAuthMethod,
    ]
  );

  return {
    clientId,
    clientSecret,
    clientIdIssuedAt: Math.floor(Date.now() / 1000),
  };
}
