import { NextRequest, NextResponse } from 'next/server';

/**
 * Media proxy that adds CORS headers so client-side renderers (renderMediaOnWeb)
 * can draw cross-origin video/image data to a <canvas> without tainting it.
 * Only used by VideoCanvasProxy when the source URL is cross-origin and not CORS-friendly.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');
  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new NextResponse('Invalid url', { status: 400 });
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return new NextResponse('Only http/https URLs allowed', { status: 400 });
  }

  const range = request.headers.get('range') ?? undefined;

  const upstream = await fetch(url, {
    headers: range ? { range } : {},
  });

  if (!upstream.ok) {
    console.warn('[proxy-media] upstream returned non-OK status', {
      status: upstream.status,
      statusText: upstream.statusText,
      url: url.slice(0, 200),
    });

    // Never report failed media as a successful silent/transparent replacement.
    return NextResponse.json({
      error: 'Could not load media from the source host.',
      upstreamStatus: upstream.status,
    }, {
      status: upstream.status,
      headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' },
    });
  }

  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Range, Content-Type');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');

  const passthrough = ['content-type', 'content-length', 'content-range', 'accept-ranges', 'cache-control'];
  for (const h of passthrough) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers,
  });
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
    },
  });
}
