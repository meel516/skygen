import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { canUseTemplateBlocks } from '@/lib/template-access';

// ============================================================================
// VIDEO RENDER API - Simple public folder approach
// ============================================================================

const VIDEOS_DIR = path.join(process.cwd(), 'public', 'videos');
const LATEST_VIDEO = path.join(VIDEOS_DIR, 'latest.mp4');

// Video renderer service URL (works locally)
const RENDERER_URL = process.env.VIDEO_RENDERER_URL || 'http://127.0.0.1:3031';

/**
 * POST /api/video/render
 * 
 * Renders video and saves to public/videos/latest.mp4
 * Returns the URL to fetch the video
 * 
 * NOTE: Video rendering requires the video-renderer service running on port 3031
 * This works locally but may not be available in all published environments
 */
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
      scope: 'video-render',
      limit: 3,
      windowMs: 10 * 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await request.json();
    
    // Validate
    if (!body.videoMeta || !body.contentBlocks) {
      return NextResponse.json({ error: 'Missing videoMeta or contentBlocks' }, { status: 400, headers: rateLimitHeaders });
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
    
    // Check if video renderer service is available
    try {
      const healthCheck = await fetch(`${RENDERER_URL}/health`, { 
        signal: AbortSignal.timeout(3000) 
      });
      
      if (!healthCheck.ok) {
        throw new Error('Service not healthy');
      }
      
      const health = await healthCheck.json();
      
      if (!health.bundleExists) {
        return NextResponse.json({
          error: 'Video renderer bundle not found',
          hint: 'Run locally: bun run video:bundle',
        }, { status: 503, headers: rateLimitHeaders });
      }
    } catch {
      return NextResponse.json({
        error: 'Video renderer service not available',
        hint: 'This API works locally when video-renderer service is running',
        localCommand: 'cd mini-services/video-renderer && bun run index.ts',
      }, { status: 503, headers: rateLimitHeaders });
    }
    
    // Ensure videos directory exists
    if (!fs.existsSync(VIDEOS_DIR)) {
      fs.mkdirSync(VIDEOS_DIR, { recursive: true });
    }
    
    // Clear old videos
    const files = fs.readdirSync(VIDEOS_DIR);
    files.forEach(f => {
      try { fs.unlinkSync(path.join(VIDEOS_DIR, f)); } catch {}
    });
    
    console.log('🎬 Rendering video...');
    
    // Call video renderer
    const renderResponse = await fetch(`${RENDERER_URL}/render-full`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    if (!renderResponse.ok) {
      const error = await renderResponse.json().catch(() => ({ error: 'Render failed' }));
      return NextResponse.json({ error: 'Render failed', details: error }, { status: 500, headers: rateLimitHeaders });
    }
    
    // Get the video buffer
    const videoBuffer = await renderResponse.arrayBuffer();
    
    // Save to public folder
    fs.writeFileSync(LATEST_VIDEO, Buffer.from(videoBuffer));
    
    const processingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    const stats = fs.statSync(LATEST_VIDEO);
    
    console.log(`✅ Video saved to ${LATEST_VIDEO} (${stats.size} bytes)`);
    
    return NextResponse.json({
      success: true,
      url: '/videos/latest.mp4',
      size: stats.size,
      processingTime: `${processingTime}s`,
      duration: renderResponse.headers.get('X-Video-Duration') || '',
      resolution: renderResponse.headers.get('X-Video-Resolution') || '',
    }, { headers: rateLimitHeaders });
    
  } catch (error) {
    console.error('Render error:', error);
    return NextResponse.json({
      error: 'Failed to render video',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

/**
 * GET /api/video/render
 * 
 * Returns info about the latest video
 */
export async function GET() {
  const exists = fs.existsSync(LATEST_VIDEO);
  
  if (!exists) {
    return NextResponse.json({
      message: 'No video rendered yet',
      hint: 'POST to /api/video/render with videoMeta and contentBlocks',
      example: {
        videoMeta: { aspectRatio: '9:16', theme: 'dark_modern', fps: 30 },
        contentBlocks: [{ type: 'stat', heading: 'Revenue', value: '$1M' }],
        quality: 'high',
      },
      endpoints: {
        render: 'POST /api/video/render - Authenticated render and save',
        latest: 'GET /videos/latest.mp4 - Get the latest video',
      },
    });
  }
  
  const stats = fs.statSync(LATEST_VIDEO);
  
  return NextResponse.json({
    url: '/videos/latest.mp4',
    size: stats.size,
    createdAt: stats.birthtime,
  });
}
