import { NextRequest, NextResponse } from 'next/server';
import { revokeToken } from '@/lib/oauth';

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
    // Per RFC 7009, return 200 regardless
    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  }

  const token = body.get('token') ?? '';

  if (token) {
    // Best-effort revocation — swallow errors per RFC 7009 §2.2
    await revokeToken(token).catch(() => {});
  }

  // RFC 7009 §2.2: always return 200 OK
  return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
}
