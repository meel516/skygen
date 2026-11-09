import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit } from '@/lib/api-security';
import { registerOAuthClient, type OAuthClientAuthMethod } from '@/lib/oauth/clients';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'no-store',
};

const GOOGLE_REDIRECT_HOSTS = new Set([
  'oauth-redirect.googleusercontent.com',
  'oauth-redirect-sandbox.googleusercontent.com',
  'oauth-redirect-test.googleusercontent.com',
]);

function isAllowedGoogleRedirectUri(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;

  try {
    const uri = new URL(value);
    return uri.protocol === 'https:' &&
      !uri.username &&
      !uri.password &&
      !uri.port &&
      !uri.hash &&
      GOOGLE_REDIRECT_HOSTS.has(uri.hostname) &&
      /^\/(r|a)\/[^/]+\/?$/.test(uri.pathname);
  } catch {
    return false;
  }
}

function errorResponse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: CORS_HEADERS });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: NextRequest) {
  const rateLimit = enforceRateLimit({
    request,
    scope: 'oauth-dynamic-client-registration',
    limit: 10,
    windowMs: 60 * 60 * 1000,
  });
  if ('response' in rateLimit) {
    const headers = new Headers(rateLimit.response.headers);
    for (const [name, value] of Object.entries(CORS_HEADERS)) headers.set(name, value);
    return new NextResponse(rateLimit.response.body, {
      status: rateLimit.response.status,
      headers,
    });
  }

  let metadata: Record<string, unknown>;
  try {
    const body = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return errorResponse('invalid_client_metadata', 400);
    }
    metadata = body as Record<string, unknown>;
  } catch {
    return errorResponse('invalid_client_metadata', 400);
  }

  const redirectUris = metadata.redirect_uris;
  if (
    !Array.isArray(redirectUris) ||
    redirectUris.length < 1 ||
    redirectUris.length > 10 ||
    !redirectUris.every(isAllowedGoogleRedirectUri)
  ) {
    return errorResponse('invalid_redirect_uri', 400);
  }

  const grantTypes = metadata.grant_types;
  if (grantTypes !== undefined &&
      (!Array.isArray(grantTypes) || grantTypes.some((value) => value !== 'authorization_code'))) {
    return errorResponse('unsupported_grant_type', 400);
  }

  const responseTypes = metadata.response_types;
  if (responseTypes !== undefined &&
      (!Array.isArray(responseTypes) || responseTypes.some((value) => value !== 'code'))) {
    return errorResponse('unsupported_response_type', 400);
  }

  const requestedAuthMethod = metadata.token_endpoint_auth_method ?? 'client_secret_basic';
  if (!['none', 'client_secret_basic', 'client_secret_post'].includes(String(requestedAuthMethod))) {
    return errorResponse('invalid_client_metadata', 400);
  }

  const clientName = typeof metadata.client_name === 'string'
    ? metadata.client_name.trim().slice(0, 120)
    : 'Gemini Connected App';

  try {
    const client = await registerOAuthClient({
      clientName: clientName || 'Gemini Connected App',
      redirectUris: [...new Set(redirectUris as string[])],
      tokenEndpointAuthMethod: requestedAuthMethod as OAuthClientAuthMethod,
    });

    return NextResponse.json({
      client_id: client.clientId,
      ...(client.clientSecret ? {
        client_secret: client.clientSecret,
        client_secret_expires_at: 0,
      } : {}),
      client_id_issued_at: client.clientIdIssuedAt,
      client_name: clientName || 'Gemini Connected App',
      redirect_uris: [...new Set(redirectUris as string[])],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: requestedAuthMethod,
    }, { status: 201, headers: CORS_HEADERS });
  } catch (error) {
    console.error('[oauth/register] Client registration failed:', error);
    return errorResponse('server_error', 500);
  }
}
