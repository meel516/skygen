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

    // Decide fallback shape from the original URL's likely media type.
    // We can't trust the failed upstream's Content-Type, so guess from path.
    const path = parsed.pathname.toLowerCase();
    const isAudio = /\.(mp3|wav|ogg|m4a|aac|flac|opus)(?:$|\?)/.test(path) ||
                    (request.headers.get('accept') ?? '').includes('audio/');

    if (isAudio) {
      // Tiny silent MP3 (~0.05s) so audio fetches don't abort the render.
      // Generated via: ffmpeg -f lavfi -i anullsrc=r=44100:cl=mono -t 0.05 silent.mp3
      const SILENT_MP3 = Uint8Array.from([
        0xff, 0xfb, 0x90, 0x44, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x49, 0x6e, 0x66, 0x6f,
        0x00, 0x00, 0x00, 0x0f, 0x00, 0x00, 0x00, 0x02, 0x00, 0x00, 0x01, 0x9c,
        0x00, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
        0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80, 0x80,
      ]);
      return new NextResponse(SILENT_MP3, {
        status: 200,
        headers: {
          'Content-Type': 'audio/mpeg',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store',
          'X-Proxy-Fallback': `upstream-${upstream.status}`,
        },
      });
    }

    // Default: 1×1 transparent PNG for image requests.
    const TRANSPARENT_PNG = Uint8Array.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ]);
    return new NextResponse(TRANSPARENT_PNG, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store',
        'X-Proxy-Fallback': `upstream-${upstream.status}`,
      },
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
