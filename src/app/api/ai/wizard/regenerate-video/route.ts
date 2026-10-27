import { NextRequest, NextResponse } from 'next/server';

import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { regenerateSingleVideo } from '@/lib/video/ai/media-service';

// Allow up to 5 minutes — Veo generation + S3 upload
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request: req,
      userId: session.user.id,
      scope: 'wizard-regenerate-video',
      limit: 4,
      windowMs: 10 * 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const { prompt, aspectRatio = '16:9', visualStyleGuide = '' } = await req.json();

    if (!prompt?.trim()) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400, headers: rateLimitHeaders });
    }

    const styledPrompt = visualStyleGuide
      ? `${visualStyleGuide}. ${prompt}`
      : prompt;

    if (!process.env.GOOGLE_API_KEY && !process.env.GOOGLE_PROJECT_ID) {
      return NextResponse.json(
        { error: 'GOOGLE_API_KEY or GOOGLE_PROJECT_ID not configured on server' },
        { status: 500, headers: rateLimitHeaders }
      );
    }

    console.log(`[regenerate-video] prompt="${styledPrompt.slice(0, 120)}" aspect=${aspectRatio}`);
    console.log(`[regenerate-video] GOOGLE_API_KEY set: ${!!process.env.GOOGLE_API_KEY}, GOOGLE_PROJECT_ID set: ${!!process.env.GOOGLE_PROJECT_ID}`);

    const result = await regenerateSingleVideo(styledPrompt, aspectRatio);

    if (!result.url) {
      return NextResponse.json(
        { error: 'Video generation returned empty URL', url: '' },
        { status: 500, headers: rateLimitHeaders }
      );
    }

    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (error: any) {
    console.error('[/api/ai/wizard/regenerate-video]', error.message, error.stack);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
