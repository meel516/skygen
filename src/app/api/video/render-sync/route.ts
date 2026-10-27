import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { canUseTemplateBlocks } from '@/lib/template-access';

// ============================================================================
// VIDEO RENDER SYNC API - Proxies to Video Renderer Service
// ============================================================================

/**
 * POST /api/video/render-sync
 * 
 * This endpoint proxies to the Video Renderer Service (port 3031).
 * 
 * This route is intended for authenticated in-app usage.
 */

// Video Renderer Service URL
const RENDERER_SERVICE_URL = process.env.VIDEO_RENDERER_URL || 'http://127.0.0.1:3031';

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request,
      userId: session.user.id,
      scope: 'video-render-sync',
      limit: 2,
      windowMs: 10 * 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await request.json();
    
    // Validate basic structure
    if (!body.videoMeta || !body.contentBlocks) {
      return NextResponse.json(
        { error: 'Missing videoMeta or contentBlocks' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const canUseBlocks = await canUseTemplateBlocks({
      role: session.user.role,
      blocks: body.contentBlocks,
      sourceTemplateId: body.sourceTemplateId,
    });

    if (!canUseBlocks) {
      return NextResponse.json(
        {
          error: 'Premium required',
          message: 'Upgrade to Premium to render videos that use advanced content blocks.',
        },
        { status: 403, headers: rateLimitHeaders }
      );
    }
    
    console.log('🎬 Forwarding to Video Renderer Service...');
    
    // Forward request to the Video Renderer Service
    const renderResponse = await fetch(`${RENDERER_SERVICE_URL}/render-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!renderResponse.ok) {
      const errorData = await renderResponse.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Renderer service error:', errorData);
      
      return NextResponse.json({
        success: false,
        error: 'Video rendering failed',
        details: errorData,
        hint: 'Check that the internal video renderer service is healthy and reachable.',
      }, { status: 500, headers: rateLimitHeaders });
    }
    
    // Get the MP4 buffer
    const videoBuffer = await renderResponse.arrayBuffer();
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const title = body.title || 'video';
    
    console.log(`✅ Video rendered in ${processingTime}s`);
    
    // Return MP4 as binary
    return new NextResponse(videoBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'video/mp4',
        'Content-Disposition': `attachment; filename="${title.replace(/\s+/g, '-').toLowerCase()}.mp4"`,
        'Content-Length': String(videoBuffer.byteLength),
        'X-Processing-Time': `${processingTime}s`,
        'X-Video-Duration': renderResponse.headers.get('X-Video-Duration') || '',
        'X-Video-Resolution': renderResponse.headers.get('X-Video-Resolution') || '',
        ...rateLimitHeaders,
      },
    });
    
  } catch (error) {
    console.error('Video render sync error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to render video',
        message: error instanceof Error ? error.message : 'Unknown error',
        hint: 'The internal video renderer service may not be running.',
      },
      { status: 500 }
    );
  }
}

/**
 * GET - API Documentation
 */
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/video/render-sync',
    method: 'POST',
    description: 'Authenticated route that renders video and returns MP4 directly',
    
    requestFormat: {
      videoMeta: { 
        aspectRatio: '16:9 | 9:16 | 1:1 | 4:5',
        theme: 'dark_modern | light_clean | gradient_vibrant | minimal_bw',
        fps: 'number (default: 30)'
      },
      contentBlocks: 'Array of content blocks',
      title: 'string (optional)',
      quality: 'low | medium | high',
    },
    
    response: {
      success: { status: 200, contentType: 'video/mp4' },
      error: { status: 400 | 500, contentType: 'application/json' },
    },
    
    contentBlocks: {
      stat: { type: 'stat', heading: 'string', value: 'string', trend: 'up|down|neutral' },
      text: { type: 'text', content: 'string' },
      comparison: { type: 'comparison', items: [{ label: 'string', value: 'number' }] },
      quote: { type: 'quote', text: 'string', author: 'string' },
      list: { type: 'list', items: ['string'] },
      timeline: { type: 'timeline', events: [{ year: 'string', title: 'string' }] },
      lineChart: { type: 'line-chart', data: [1, 2, 3], title: 'string' },
      pieChart: { type: 'pie-chart', segments: [{ label: 'string', value: 1 }] },
    },
  });
}
