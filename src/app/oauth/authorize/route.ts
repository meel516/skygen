import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { generateCode, storeCode } from '@/lib/oauth';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const clientId    = searchParams.get('client_id') ?? '';
  const redirectUri = searchParams.get('redirect_uri') ?? '';
  const state       = searchParams.get('state') ?? '';
  const responseType = searchParams.get('response_type') ?? '';
  const codeChallenge = searchParams.get('code_challenge') ?? '';
  const codeChallengeMethod = searchParams.get('code_challenge_method') ?? '';

  // --- Validate response_type ---
  if (responseType !== 'code') {
    return NextResponse.json({ error: 'unsupported_response_type' }, { status: 400 });
  }

  // --- Validate client_id and redirect_uri ---
  let isAllowed = false;

  console.log("OAUTH AUTHORIZE REQUEST:", { clientId, redirectUri, state, responseType });

  let errorMessage = '';

  if (clientId.startsWith('https://')) {
    // Dynamic Client Registration (CIMD)
    try {
      const res = await fetch(clientId, { method: 'GET', headers: { 'Accept': 'application/json' } });
      const text = await res.text();
      
      if (res.ok) {
        const metadata = JSON.parse(text);
        const allowedUris: string[] = metadata.redirect_uris || [];
        isAllowed = allowedUris.some((pattern) => {
          if (pattern.includes('*')) {
            const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
            return new RegExp(regexStr).test(redirectUri);
          }
          return pattern === redirectUri;
        });
        if (!isAllowed) errorMessage = `Redirect URI not in allowed list: ${JSON.stringify(allowedUris)}`;
      } else {
        errorMessage = `CIMD fetch failed with status ${res.status}: ${text.slice(0, 100)}`;
      }
    } catch (e: any) {
      errorMessage = `CIMD fetch threw error: ${e.message}`;
      console.error("Failed to fetch client metadata", e);
    }
  } else {
    // Pre-registered database client (e.g., 'chatgpt')
    const clientResult = await db.query(
      `SELECT id, redirect_uris FROM oauth_clients WHERE id = $1`,
      [clientId]
    );

    if (clientResult.rows.length > 0) {
      const allowedUris: string[] = clientResult.rows[0].redirect_uris;
      isAllowed = allowedUris.some((pattern) => {
        if (pattern.includes('*')) {
          const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
          return new RegExp(regexStr).test(redirectUri);
        }
        return pattern === redirectUri;
      });
      if (!isAllowed) errorMessage = `Database redirect URI mismatch for client ${clientId}`;
    } else {
      errorMessage = `Client ${clientId} not found in database`;
    }
  }

  if (!isAllowed) {
    return NextResponse.json({ 
      error: 'invalid_client_or_redirect_uri',
      details: errorMessage,
      debug: { clientId, redirectUri }
    }, { status: 400 });
  }

  // --- Check for existing NextAuth session ---
  const session = await auth();

  if (!session?.user?.id) {
    // Not logged in – redirect to OAuth login page with all params forwarded
    const loginUrl = new URL('/oauth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('client_id', clientId);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('response_type', responseType);
    if (codeChallenge) loginUrl.searchParams.set('code_challenge', codeChallenge);
    if (codeChallengeMethod) loginUrl.searchParams.set('code_challenge_method', codeChallengeMethod);
    return NextResponse.redirect(loginUrl);
  }

  // --- User is authenticated – issue an authorization code ---
  const code = generateCode();
  await storeCode(code, clientId, session.user.id, redirectUri, codeChallenge, codeChallengeMethod);

  // Redirect back to the client with code and state
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl);
}
