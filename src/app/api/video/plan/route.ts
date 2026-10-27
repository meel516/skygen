import { NextRequest, NextResponse } from 'next/server';
import { 
  VideoInputSchema,
  type VideoInput,
  type VideoPlan,
} from '@/lib/video/schemas';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { canUseTemplateBlocks } from '@/lib/template-access';
import { generateVideoPlan } from '@/lib/video/ai/decision-router';

// ============================================================================
// VIDEO ENGINE API
// ============================================================================

/**
 * POST /api/video/plan
 * Generate a video plan from input data using AI routing
 */
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
      scope: 'video-plan',
      limit: 12,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await request.json();
    
    // Validate input with Zod
    const validationResult = VideoInputSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed', 
          details: validationResult.error.issues 
        },
        { status: 400, headers: rateLimitHeaders }
      );
    }
    
    const input = validationResult.data;

    const canUseBlocks = await canUseTemplateBlocks({
      role: session.user.role,
      blocks: input.contentBlocks,
      sourceTemplateId: input.sourceTemplateId,
    });

    if (!canUseBlocks) {
      return NextResponse.json(
        {
          error: 'Premium required',
          message: 'Upgrade to Premium to use advanced content blocks.',
        },
        { status: 403, headers: rateLimitHeaders }
      );
    }
    
    // Generate video plan via AI
    const plan = await generateVideoPlan(input.videoMeta, input.contentBlocks);
    
    // Calculate composition config
    const compositionConfig = getCompositionConfig(input, plan);
    
    return NextResponse.json({
      success: true,
      input,
      plan,
      compositionConfig,
    }, { headers: rateLimitHeaders });
    
  } catch (error) {
    console.error('Video plan generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate video plan',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/video/plan
 * Get sample input schema for reference
 */
export async function GET() {
  return NextResponse.json({
    schema: {
      videoMeta: {
        aspectRatio: '9:16 | 16:9 | 1:1 | 4:5',
        theme: 'dark_modern | light_minimal | bold_vibrant | corporate',
        fps: '24-60 (default: 30)',
      },
      contentBlocks: [
        {
          type: 'stat',
          heading: 'string (1-100 chars)',
          value: 'string (1-50 chars)',
          subtext: 'string (optional)',
        },
        {
          type: 'comparison',
          title: 'string (optional)',
          items: [
            { label: 'string', value: 'number', color: 'string (optional)' }
          ],
        },
        {
          type: 'text',
          content: 'string (1-500 chars)',
          emphasis: 'low | medium | high (optional)',
        },
        {
          type: 'quote',
          text: 'string (1-300 chars)',
          author: 'string (optional)',
        },
      ],
    },
    example: {
      videoMeta: {
        aspectRatio: '9:16',
        theme: 'dark_modern',
        fps: 30,
      },
      contentBlocks: [
        {
          type: 'stat',
          heading: 'Revenue',
          value: '400K',
          subtext: 'Year over year growth',
        },
        {
          type: 'comparison',
          title: 'Market Share',
          items: [
            { label: 'Product A', value: 45 },
            { label: 'Product B', value: 30 },
            { label: 'Product C', value: 25 },
          ],
        },
        {
          type: 'quote',
          text: 'Innovation distinguishes between a leader and a follower.',
          author: 'Steve Jobs',
        },
      ],
    },
  });
}

/**
 * Calculate composition configuration
 */
function getCompositionConfig(
  input: VideoInput,
  plan: VideoPlan
): { width: number; height: number; fps: number; durationInFrames: number } {
  const aspectRatios: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };
  
  const dimensions = aspectRatios[input.videoMeta.aspectRatio] || aspectRatios['9:16'];
  const introDuration = 2;
  const outroDuration = 2;
  const totalDuration = introDuration + plan.totalDuration + outroDuration;
  
  return {
    width: dimensions.width,
    height: dimensions.height,
    fps: input.videoMeta.fps,
    durationInFrames: Math.round(totalDuration * input.videoMeta.fps),
  };
}
