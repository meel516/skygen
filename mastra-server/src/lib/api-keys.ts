import { db } from './db';

function readCookie(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return '';
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return '';
}

export function getApiKeyFromCookie(cookieHeader: string | null, provider: string): string {
  return readCookie(cookieHeader, `api_key_${provider}`);
}

export async function getXaiKeyForUser(userId: string): Promise<string> {
  try {
    const result = await db.query(`SELECT xai_api_key FROM users WHERE id = $1`, [userId]);
    return result.rows[0]?.xai_api_key ?? '';
  } catch {
    return '';
  }
}

export async function getTtsKeysForUser(
  userId: string,
  cookieHeader: string | null,
): Promise<{ deepgram: string; elevenlabs: string; cartesia: string }> {
  const [cgDg, cgEl, cgCa] = [
    getApiKeyFromCookie(cookieHeader, 'deepgram'),
    getApiKeyFromCookie(cookieHeader, 'elevenlabs'),
    getApiKeyFromCookie(cookieHeader, 'cartesia'),
  ];
  if (cgDg && cgEl && cgCa) return { deepgram: cgDg, elevenlabs: cgEl, cartesia: cgCa };

  try {
    const result = await db.query(
      `SELECT deepgram_api_key, elevenlabs_api_key, cartesia_api_key FROM users WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0] ?? {};
    return {
      deepgram: cgDg || row.deepgram_api_key || '',
      elevenlabs: cgEl || row.elevenlabs_api_key || '',
      cartesia: cgCa || row.cartesia_api_key || '',
    };
  } catch {
    return { deepgram: cgDg, elevenlabs: cgEl, cartesia: cgCa };
  }
}
