import { decode } from '@auth/core/jwt';

export interface ServerSession {
  user: { id: string };
}

function readCookie(cookieHeader: string | null, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function getSessionFromRequest(req: Request): Promise<ServerSession | null> {
  const cookieHeader = req.headers.get('cookie');
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;

  // Try both insecure (localhost) and secure (https) cookie names. The salt
  // passed to decode() MUST match the cookie name Auth.js used to issue it.
  const candidates = [
    'authjs.session-token',
    '__Secure-authjs.session-token',
    'next-auth.session-token',
    '__Secure-next-auth.session-token',
  ];

  for (const name of candidates) {
    const token = readCookie(cookieHeader, name);
    if (!token) continue;
    try {
      const payload = await decode({ salt: name, secret, token });
      const userId = (payload as any)?.sub ?? (payload as any)?.userId;
      if (userId) return { user: { id: String(userId) } };
    } catch {
      // try next candidate
    }
  }
  return null;
}
