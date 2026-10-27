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

  // --- Validate response_type ---
  if (responseType !== 'code') {
    return NextResponse.json({ error: 'unsupported_response_type' }, { status: 400 });
  }

  // --- Validate client_id exists ---
  const clientResult = await db.query(
    `SELECT id, redirect_uris FROM oauth_clients WHERE id = $1`,
    [clientId]
  );

  if (clientResult.rows.length === 0) {
    return NextResponse.json({ error: 'invalid_client' }, { status: 400 });
  }

  // --- Validate redirect_uri is in allowed list ---
  // ChatGPT uses wildcard redirect URIs like https://chatgpt.com/aip/g-*/oauth/callback
  const allowedUris: string[] = clientResult.rows[0].redirect_uris;
  const isAllowed = allowedUris.some((pattern) => {
    if (pattern.includes('*')) {
      // Convert glob pattern to regex: escape dots, replace * with .*
      const regexStr = '^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '.*') + '$';
      return new RegExp(regexStr).test(redirectUri);
    }
    return pattern === redirectUri;
  });

  if (!isAllowed) {
    return NextResponse.json({ error: 'invalid_redirect_uri' }, { status: 400 });
  }

  // --- Check for existing NextAuth session ---
  const session = await auth();

  if (!session?.user?.id) {
    // Not logged in — redirect to OAuth login page with all params forwarded
    const loginUrl = new URL('/oauth/login', request.nextUrl.origin);
    loginUrl.searchParams.set('client_id', clientId);
    loginUrl.searchParams.set('redirect_uri', redirectUri);
    loginUrl.searchParams.set('state', state);
    loginUrl.searchParams.set('response_type', responseType);
    return NextResponse.redirect(loginUrl);
  }

  // --- User is authenticated — issue an authorization code ---
  const code = generateCode();
  await storeCode(code, clientId, session.user.id, redirectUri);

  // Redirect back to the client with code and state
  const callbackUrl = new URL(redirectUri);
  callbackUrl.searchParams.set('code', code);
  if (state) callbackUrl.searchParams.set('state', state);

  return NextResponse.redirect(callbackUrl);
}
