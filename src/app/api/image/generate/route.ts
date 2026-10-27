import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';

const IMAGE_API_URL = 'https://salru.duckdns.org/webhook/642852fe-c9f8-4555-a751-205c14a2623c';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request,
      userId: session.user.id,
      scope: 'image-generate',
      limit: 10,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400, headers: rateLimitHeaders });
    }

    const response = await fetch(IMAGE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });

    const data = await response.json();
    console.log('Image API response:', JSON.stringify(data));

    if (Array.isArray(data) && data.length > 0 && data[0].signedUrl) {
      return NextResponse.json({ signedUrl: data[0].signedUrl }, { headers: rateLimitHeaders });
    }

    if (data.signedUrl) {
      return NextResponse.json({ signedUrl: data.signedUrl }, { headers: rateLimitHeaders });
    }

    return NextResponse.json({ error: 'Invalid API response', details: data }, { status: 500, headers: rateLimitHeaders });
  } catch (error) {
    console.error('Image generation error:', error);
    return NextResponse.json({ error: 'Failed to generate image' }, { status: 500 });
  }
}
