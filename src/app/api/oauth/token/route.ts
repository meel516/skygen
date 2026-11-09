import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/oauth';
import { authenticateOAuthTokenClient, type OAuthClientAuthMethod } from '@/lib/oauth/clients';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': 'https://chatgpt.com',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: URLSearchParams;
  try {
    const text = await request.text();
    body = new URLSearchParams(text);
  } catch {
    return NextResponse.json(
      { error: 'invalid_request' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const grantType  = body.get('grant_type') ?? '';
  const code       = body.get('code') ?? '';
  const codeVerifier = body.get('code_verifier') ?? '';

  if (grantType !== 'authorization_code') {
    return NextResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!code) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing code' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  let clientId = body.get('client_id') ?? '';
  let clientSecret = body.has('client_secret') ? body.get('client_secret') : null;
  let authMethod: OAuthClientAuthMethod = clientSecret === null ? 'none' : 'client_secret_post';
  const authorization = request.headers.get('authorization');

  if (authorization) {
    const basicMatch = authorization.match(/^Basic\s+([A-Za-z0-9+/]+={0,2})$/i);
    if (!basicMatch || body.has('client_id') || body.has('client_secret')) {
      return NextResponse.json(
        { error: 'invalid_client' },
        { status: 401, headers: { ...CORS_HEADERS, 'WWW-Authenticate': 'Basic realm="oauth-token"' } }
      );
    }

    try {
      const decoded = Buffer.from(basicMatch[1], 'base64').toString('utf8');
      const separator = decoded.indexOf(':');
      if (separator <= 0) throw new Error('Malformed Basic credentials');
      const decodeFormValue = (value: string) => decodeURIComponent(value.replace(/\+/g, ' '));
      clientId = decodeFormValue(decoded.slice(0, separator));
      clientSecret = decodeFormValue(decoded.slice(separator + 1));
      authMethod = 'client_secret_basic';
    } catch {
      return NextResponse.json(
        { error: 'invalid_client' },
        { status: 401, headers: { ...CORS_HEADERS, 'WWW-Authenticate': 'Basic realm="oauth-token"' } }
      );
    }
  }

  if (!clientId) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing client_id' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const clientIsValid = await authenticateOAuthTokenClient({ clientId, clientSecret, authMethod });
  if (!clientIsValid) {
    return NextResponse.json(
      { error: 'invalid_client' },
      { status: 401, headers: { ...CORS_HEADERS, 'WWW-Authenticate': 'Basic realm="oauth-token"' } }
    );
  }

  const accessToken = await exchangeCode(code, codeVerifier, clientId);

  if (!accessToken) {
    return NextResponse.json(
      { error: 'invalid_grant' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  return NextResponse.json(
    {
      access_token: accessToken,
      token_type:   'Bearer',
      expires_in:   7776000, // 90 days in seconds
      scope:        'generate',
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
