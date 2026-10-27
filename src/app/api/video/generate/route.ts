import { auth } from '@/lib/auth';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { canUseTemplateBlocks } from '@/lib/template-access';
import { getS3Object, uploadToS3 } from '@/lib/s3';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 120;

const RENDERER_URL = process.env.VIDEO_RENDERER_URL || 'http://127.0.0.1:3031';
const USE_LAMBDA = !!(process.env.LAMBDA_FUNCTION_NAME && process.env.LAMBDA_SITE_URL && process.env.LAMBDA_REGION);

// Block type → Remotion component ID mapping (mirrors VideoPreview.tsx)
const TYPE_TO_COMPONENT_ID: Record<string, string> = {
  'stat': 'stat-scene', 'comparison': 'comparison-scene', 'text': 'text-scene',
  'image': 'image-scene', 'quote': 'quote-scene', 'list': 'list-scene',
  'timeline': 'timeline-scene', 'callout': 'callout-scene', 'icon-list': 'icon-list-scene',
  'line-chart': 'line-chart-scene', 'pie-chart': 'pie-chart-scene', 'code': 'code-scene',
  'testimonial': 'testimonial-scene', 'whatsapp-chat': 'whatsapp-chat-scene',
  'motivational-image': 'motivational-image-scene', 'counter': 'counter-scene',
  'progress-bar': 'progress-bar-scene', 'qr-code': 'qr-code-scene', 'video': 'video-scene',
  'avatar-grid': 'avatar-grid-scene', 'social-stats': 'social-stats-scene', 'cta': 'cta-scene',
  'gradient-text': 'gradient-text-scene', 'animated-bg': 'animated-bg-scene',
  'countdown': 'countdown-scene', 'weather-block': 'weather-scene',
  'tower-chart-3d': 'tower-chart-3d-scene', 'bar-race-3d': 'bar-race-3d-scene',
  'parallax-story': 'parallax-story-scene',
  'pricing-table': 'pricing-table-scene',
  'logo-wall': 'logo-wall-scene',
  'process-steps': 'process-steps-scene',
  'html': 'html-scene',
  'diagram': 'diagram-scene',
  'custom-plugin': 'custom-plugin',
};

const DEFAULT_DURATIONS: Record<string, number> = {
  'stat': 3, 'comparison': 4, 'text': 3, 'image': 4, 'quote': 4, 'list': 5,
  'timeline': 6, 'callout': 3, 'icon-list': 5, 'line-chart': 5, 'pie-chart': 5,
  'code': 6, 'testimonial': 5, 'whatsapp-chat': 8, 'motivational-image': 6,
  'counter': 4, 'progress-bar': 3, 'qr-code': 4, 'video': 5, 'avatar-grid': 5,
  'social-stats': 4, 'cta': 3, 'gradient-text': 4, 'animated-bg': 5,
  'countdown': 4, 'weather-block': 4, 'tower-chart-3d': 20, 'bar-race-3d': 15, 'parallax-story': 10,
  'pricing-table': 6, 'logo-wall': 5, 'process-steps': 5,
  'html': 5, 'diagram': 6,
};

function generatePlan(contentBlocks: Array<{ type: string; duration?: number }>) {
  const decisions = contentBlocks.map((block) => {
    const duration = block.duration || DEFAULT_DURATIONS[block.type] || 4;
    return {
      componentId: TYPE_TO_COMPONENT_ID[block.type] || 'text-scene',
      motionProfile: 'dynamic',
      duration,
      animation: { enter: 0.4, hold: duration - 0.6, exit: 0.2 },
    };
  });
  return {
    decisions,
    totalDuration: decisions.reduce((sum, d) => sum + d.duration, 0),
    suggestedTransitions: decisions.map(() => 'fade'),
  };
}

/**
 * POST /api/video/generate
 * Renders video with usage limit checking.
 * Uses Remotion Lambda if configured, otherwise falls back to local renderer.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) {
    return authResult.response;
  }

  const { session } = authResult;
  const rateLimitResult = enforceRateLimit({
    request,
    userId: session.user.id,
    scope: 'video-generate',
    limit: 4,
    windowMs: 10 * 60_000,
  });
  if ('response' in rateLimitResult) {
    return rateLimitResult.response;
  }

  const rateLimitHeaders = rateLimitResult.headers;

  try {
    // Check usage limit
    const userResult = await db.query(
      `SELECT "videoCount", "videoLimit" FROM users WHERE id = $1`,
      [session.user.id]
    );

    if (userResult.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404, headers: rateLimitHeaders });
    }

    const { videoCount, videoLimit } = userResult.rows[0];

    if ((videoCount ?? 0) >= (videoLimit ?? 10)) {
      return NextResponse.json(
        {
          error: 'Video limit reached',
          message: `You have used ${videoCount}/${videoLimit} videos. Upgrade to create more.`,
          limit: videoLimit,
          used: videoCount,
        },
        { status: 403, headers: rateLimitHeaders }
      );
    }

    let body = await request.json();

    // Support staged payloads — client sends { payloadId } instead of the full payload
    // to avoid Vercel's 4.5MB request body limit
    if (body.payloadId && !body.contentBlocks) {
      const staged = await db.query(
        `DELETE FROM staged_payloads WHERE id = $1 AND user_id = $2 RETURNING payload`,
        [body.payloadId, session.user.id]
      );
      if (!staged.rows[0]) {
        return NextResponse.json({ error: 'Staged payload not found or expired' }, { status: 404, headers: rateLimitHeaders });
      }
      body = JSON.parse(staged.rows[0].payload);
    }

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

    let videoUrl: string;
    let duration: number | null = null;

    if (USE_LAMBDA) {
      // ── Lambda path: call renderMediaOnLambda directly (no internal HTTP proxy) ──
      const functionName = process.env.LAMBDA_FUNCTION_NAME!;
      const serveUrl = process.env.LAMBDA_SITE_URL!;
      const region = (process.env.LAMBDA_REGION || 'us-east-1') as string;

      const { renderMediaOnLambda } = await import('@remotion/lambda/client');
      const { videoMeta, contentBlocks, plan, input } = body;
      const resolvedInput = input ?? { videoMeta, contentBlocks };
      const resolvedPlan = plan ?? generatePlan(resolvedInput.contentBlocks ?? []);

      // Resolve relative /api/music/ paths to absolute S3 URLs for Lambda rendering
      if (resolvedInput.videoMeta?.audioTracks?.length) {
        const bucketHost = process.env.LAMBDA_SITE_URL
          ? new URL(process.env.LAMBDA_SITE_URL).origin
          : `https://remotionlambda-useast1-l722vmwfn0.s3.us-east-1.amazonaws.com`;
        // Extract bucket base: https://BUCKET.s3.REGION.amazonaws.com
        const siteUrl = process.env.LAMBDA_SITE_URL || '';
        const bucketMatch = siteUrl.match(/^(https:\/\/[^/]+)/);
        const s3Base = bucketMatch ? bucketMatch[1] : bucketHost;

        resolvedInput.videoMeta.audioTracks = resolvedInput.videoMeta.audioTracks.map(
          (track: { src: string;[key: string]: unknown }) => {
            if (track.src?.startsWith('/api/music/')) {
              const filename = track.src.replace('/api/music/', '');
              return { ...track, src: `${s3Base}/music/${filename}` };
            }
            return track;
          }
        );
      }

      // Deploy custom plugin bundles as static files INSIDE the Remotion site directory.
      // Same-origin fetch — guaranteed accessible from headless Chromium in Lambda.
      const pluginBundleUrls: Record<string, string> = {};
      const customPluginIds = [
        ...new Set(
          (resolvedInput.contentBlocks ?? [])
            .filter((b: any) => b.type === 'custom-plugin' && b.pluginId)
            .map((b: any) => b.pluginId as string)
        ),
      ];
      if (customPluginIds.length > 0) {
        const sitePrefix = serveUrl.replace(/^https:\/\/[^/]+\/(.+)\/index\.html$/, '$1');
        await Promise.all(
          customPluginIds.map(async (pluginId) => {
            try {
              const result = await db.query('SELECT s3_key FROM plugins WHERE id = $1', [pluginId]);
              if (result.rows[0]?.s3_key) {
                const code = await getS3Object(result.rows[0].s3_key);
                const pluginSiteKey = `${sitePrefix}/plugins/${pluginId}.js`;
                await uploadToS3(pluginSiteKey, code, 'application/javascript');
                const baseUrl = serveUrl.replace(/\/index\.html$/, '');
                pluginBundleUrls[pluginId] = `${baseUrl}/plugins/${pluginId}.js`;
                console.log(`[generate] Deployed plugin "${pluginId}" to site (${code.length} chars)`);
              }
            } catch (err) {
              console.error(`[generate] Failed to deploy plugin "${pluginId}":`, err);
            }
          })
        );
      }

      const inputProps = {
        input: resolvedInput,
        plan: resolvedPlan,
        ...(Object.keys(pluginBundleUrls).length > 0 ? { pluginBundleUrls } : {}),
      };

      const fps = resolvedInput.videoMeta?.fps ?? 30;
      const totalDuration = resolvedPlan.totalDuration ?? 30;
      const durationInFrames = Math.ceil(totalDuration * fps);

      console.log('[generate] body.plan?.totalDuration:', body.plan?.totalDuration);
      console.log('[generate] resolvedPlan.totalDuration:', resolvedPlan.totalDuration);
      console.log('[generate] contentBlocks count:', resolvedInput.contentBlocks?.length);
      console.log('[generate] fps:', fps, 'totalDuration:', totalDuration, 'durationInFrames:', durationInFrames);

      const { renderId, bucketName } = await renderMediaOnLambda({
        region,
        functionName,
        serveUrl,
        composition: 'DynamicVideo',
        inputProps,
        durationInFrames,
        fps,
        codec: 'h264',
        downloadBehavior: { type: 'download', fileName: 'video.mp4' },
        timeoutInMilliseconds: 900000,
        concurrencyPerLambda: 2,
        framesPerLambda: 200,
        maxRetries: 3,
      });

      // Increment counter immediately
      await db.query(
        `UPDATE users SET "videoCount" = COALESCE("videoCount", 0) + 1 WHERE id = $1`,
        [session.user.id]
      );

      // Save pending video record (url=null, will be updated by client after polling)
      const videoName = `Video ${(videoCount ?? 0) + 1}`;
      let videoId: string | null = null;
      try {
        const videoIdResult = await db.query(
          `INSERT INTO "Video" (id, name, data, "userId", url, duration, "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, NULL, NULL, NOW())
           RETURNING id`,
          [videoName, JSON.stringify(body), session.user.id]
        );
        videoId = videoIdResult.rows[0]?.id ?? null;
      } catch (dbErr) {
        console.error('Video record save failed (non-fatal):', dbErr);
      }

      return NextResponse.json(
        {
          usedLambda: true,
          renderId,
          bucketName,
          region,
          videoId,
          debug: { totalDuration, durationInFrames, fps, blockCount: resolvedInput.contentBlocks?.length ?? 0 },
          usage: {
            used: (videoCount ?? 0) + 1,
            limit: videoLimit ?? 10,
            remaining: (videoLimit ?? 10) - (videoCount ?? 0) - 1,
          },
        },
        { headers: rateLimitHeaders }
      );
    } else {
      // ── Local renderer path ──────────────────────────────────────
      try {
        const healthCheck = await fetch(`${RENDERER_URL}/health`, { signal: AbortSignal.timeout(3000) });
        if (!healthCheck.ok) throw new Error('Service not healthy');
        const health = await healthCheck.json();
        if (!health.bundleExists) {
          return NextResponse.json(
            { error: 'Video renderer bundle not found', hint: 'Run: bun run video:bundle' },
            { status: 503, headers: rateLimitHeaders }
          );
        }
      } catch {
        return NextResponse.json(
          { error: 'Video renderer service not available', hint: 'Start the renderer or configure Lambda env vars' },
          { status: 503, headers: rateLimitHeaders }
        );
      }

      const localPlan = body.plan ?? generatePlan(body.contentBlocks ?? []);
      const renderResponse = await fetch(`${RENDERER_URL}/render-full`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, plan: localPlan }),
      });

      if (!renderResponse.ok) {
        const error = await renderResponse.json().catch(() => ({ error: 'Render failed' }));
        return NextResponse.json(
          { error: error.error || 'Failed to render video' },
          { status: 500, headers: rateLimitHeaders }
        );
      }

      // Stream back — client downloads directly from VideoPreview's exportVideo()
      // For generate route, just indicate success with a local video path
      videoUrl = `/videos/latest.mp4?t=${Date.now()}`;
      const durationHeader = renderResponse.headers.get('X-Video-Duration');
      duration = durationHeader ? parseInt(durationHeader) : null;

      // Save the buffer to disk for the local path
      const { default: fs } = await import('fs');
      const { default: path } = await import('path');
      const VIDEOS_DIR = path.join(process.cwd(), 'public', 'videos');
      if (!fs.existsSync(VIDEOS_DIR)) fs.mkdirSync(VIDEOS_DIR, { recursive: true });
      const videoBuffer = await renderResponse.arrayBuffer();
      fs.writeFileSync(path.join(VIDEOS_DIR, 'latest.mp4'), Buffer.from(videoBuffer));
    }

    // Increment video count
    await db.query(
      `UPDATE users SET "videoCount" = COALESCE("videoCount", 0) + 1 WHERE id = $1`,
      [session.user.id]
    );

    // Save video record
    const videoName = `Video ${(videoCount ?? 0) + 1}`;
    await db.query(
      `INSERT INTO "Video" (id, name, data, "userId", url, duration, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, NOW())`,
      [videoName, JSON.stringify(body), session.user.id, videoUrl, duration]
    );

    return NextResponse.json(
      {
        success: true,
        videoUrl,
        usedLambda: USE_LAMBDA,
        usage: {
          used: (videoCount ?? 0) + 1,
          limit: videoLimit ?? 10,
          remaining: (videoLimit ?? 10) - (videoCount ?? 0) - 1,
        },
      },
      { headers: rateLimitHeaders }
    );
  } catch (error: any) {
    console.error('Video generate error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to render video' },
      { status: 500, headers: rateLimitHeaders }
    );
  }
}

/**
 * GET /api/video/generate — usage statistics
 */
export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await db.query(
      `SELECT "videoCount", "videoLimit" FROM users WHERE id = $1`,
      [session.user.id]
    );

    const row = result.rows[0] ?? {};
    return NextResponse.json({
      used: row.videoCount ?? 0,
      limit: row.videoLimit ?? 10,
      remaining: (row.videoLimit ?? 10) - (row.videoCount ?? 0),
    });
  } catch (error) {
    console.error('Error fetching usage:', error);
    return NextResponse.json({ error: 'Failed to fetch usage' }, { status: 500 });
  }
}
