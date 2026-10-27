import 'server-only';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';

export async function getApiKeyFromCookie(provider: string): Promise<string> {
  const cookieStore = await cookies();
  return cookieStore.get(`api_key_${provider}`)?.value || '';
}

// Fallback for MCP requests (no cookies) — looks up the user's XAI key from DB
export async function getDeepSeekKeyForUser(userId: string): Promise<string> {
  try {
    const result = await db.query(`SELECT xai_api_key FROM users WHERE id = $1`, [userId]);
    return result.rows[0]?.xai_api_key ?? '';
  } catch {
    return '';
  }
}

export const getXaiKeyForUser = getDeepSeekKeyForUser;

// Look up all TTS provider keys for a user (cookie first, then DB fallback)
export async function getTtsKeysForUser(userId: string): Promise<{
  deepgram: string; elevenlabs: string; cartesia: string;
}> {
  const [cgDg, cgEl, cgCa] = await Promise.all([
    getApiKeyFromCookie('deepgram'),
    getApiKeyFromCookie('elevenlabs'),
    getApiKeyFromCookie('cartesia'),
  ]);
  if (cgDg && cgEl && cgCa) return { deepgram: cgDg, elevenlabs: cgEl, cartesia: cgCa };

  try {
    const result = await db.query(
      `SELECT deepgram_api_key, elevenlabs_api_key, cartesia_api_key FROM users WHERE id = $1`,
      [userId],
    );
    const row = result.rows[0] ?? {};
    return {
      deepgram:   cgDg   || row.deepgram_api_key   || '',
      elevenlabs: cgEl   || row.elevenlabs_api_key  || '',
      cartesia:   cgCa   || row.cartesia_api_key    || '',
    };
  } catch {
    return { deepgram: cgDg, elevenlabs: cgEl, cartesia: cgCa };
  }
}
