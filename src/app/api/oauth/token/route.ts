import { NextRequest, NextResponse } from 'next/server';
import { exchangeCode } from '@/lib/oauth';

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
  const clientId   = body.get('client_id') ?? '';

  if (grantType !== 'authorization_code') {
    return NextResponse.json(
      { error: 'unsupported_grant_type' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  if (!code || !clientId) {
    return NextResponse.json(
      { error: 'invalid_request', error_description: 'Missing code or client_id' },
      { status: 400, headers: CORS_HEADERS }
    );
  }

  const accessToken = await exchangeCode(code);

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
