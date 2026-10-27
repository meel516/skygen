import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { canUseTemplateBlocks } from '@/lib/template-access';
import { db } from '@/lib/db';
import { getS3Object, uploadToS3 } from '@/lib/s3';

/**
 * POST /api/video/render-lambda
 *
 * Triggers a Remotion Lambda render.
 *
 * Prerequisites (run once):
 *   npx remotion lambda sites create remotion-entry.tsx --site-name=skygen-renderer
 *   # Then set LAMBDA_SITE_URL to the returned serveUrl in .env
 *
 * Required env vars:
 *   LAMBDA_FUNCTION_NAME  e.g. remotion-render-4-0-431-mem3007mb-disk10240mb-900sec
 *   LAMBDA_SITE_URL       e.g. https://remotionlambda-xxx.s3.us-east-1.amazonaws.com/sites/skygen-renderer/index.html
 *   LAMBDA_REGION         e.g. us-east-1
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
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
    scope: 'video-render-lambda',
    limit: 3,
    windowMs: 10 * 60_000,
  });
  if ('response' in rateLimitResult) {
    return rateLimitResult.response;
  }

  const rateLimitHeaders = rateLimitResult.headers;

  const functionName = process.env.LAMBDA_FUNCTION_NAME;
  const serveUrl = process.env.LAMBDA_SITE_URL;
  const region = (process.env.LAMBDA_REGION || 'us-east-1') as string;

  if (!functionName || !serveUrl) {
    return NextResponse.json(
      { error: 'Lambda not configured. Set LAMBDA_FUNCTION_NAME and LAMBDA_SITE_URL.' },
      { status: 503, headers: rateLimitHeaders }
    );
  }

  try {
    const body = await request.json();
    const { videoMeta, contentBlocks, plan, input } = body;

    if ((!input?.videoMeta || !input?.contentBlocks) && (!videoMeta || !contentBlocks)) {
      return NextResponse.json(
        { error: 'Missing videoMeta or contentBlocks' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const resolvedInput = input ?? { videoMeta, contentBlocks };
    const canUseBlocks = await canUseTemplateBlocks({
      role: session.user.role,
      blocks: resolvedInput.contentBlocks,
      sourceTemplateId: resolvedInput.sourceTemplateId ?? body.sourceTemplateId,
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

    // Pre-fetch plugin bundles and upload them INTO the Remotion site directory.
    // This makes them same-origin static files — Chromium can fetch them reliably
    // without cross-origin or external network issues.
    const pluginBundleUrls: Record<string, string> = {};
    const customPluginIds = [
      ...new Set(
        resolvedInput.contentBlocks
          .filter((b: any) => b.type === 'custom-plugin' && b.pluginId)
          .map((b: any) => b.pluginId as string)
      ),
    ];

    // Derive the S3 site prefix from the serveUrl
    // e.g. "https://bucket.s3.amazonaws.com/sites/skygen-renderer/index.html"
    //    → site prefix = "sites/skygen-renderer"
    const sitePrefix = serveUrl.replace(/^https:\/\/[^/]+\/(.+)\/index\.html$/, '$1');

    if (customPluginIds.length > 0) {
      await Promise.all(
        customPluginIds.map(async (pluginId) => {
          try {
            const result = await db.query('SELECT s3_key FROM plugins WHERE id = $1', [pluginId]);
            if (result.rows[0]?.s3_key) {
              // Fetch bundle code from its S3 location
              const code = await getS3Object(result.rows[0].s3_key);
              // Upload as a static file INSIDE the Remotion site directory
              const pluginSiteKey = `${sitePrefix}/plugins/${pluginId}.js`;
              await uploadToS3(pluginSiteKey, code, 'application/javascript');
              // Construct same-origin URL that Chromium can fetch
              // Same bucket, same path prefix — guaranteed accessible
              const baseUrl = serveUrl.replace(/\/index\.html$/, '');
              pluginBundleUrls[pluginId] = `${baseUrl}/plugins/${pluginId}.js`;
              console.log(`[Lambda] Uploaded plugin "${pluginId}" to site (${code.length} chars)`);
            } else {
              console.warn(`[Lambda] Plugin "${pluginId}" found in DB but has no s3_key`);
            }
          } catch (err) {
            console.error(`[Lambda] Failed to deploy plugin "${pluginId}" to site:`, err);
          }
        })
      );
    }
    console.log(`[Lambda] pluginBundleUrls: ${JSON.stringify(pluginBundleUrls)}`);

    // Build inputProps for the DynamicVideo composition
    const baseInputProps = input ? { input, plan } : { input: resolvedInput, plan };
    const inputProps = { ...baseInputProps, pluginBundleUrls };

    // Compute actual duration from plan so Lambda renders the full video
    const resolvedPlan = plan ?? inputProps.plan;
    const fps = inputProps.input?.videoMeta?.fps ?? 30;
    const totalDuration = resolvedPlan?.totalDuration ?? 12;
    const durationInFrames = Math.ceil(totalDuration * fps);

    // Dynamic import to avoid bundling issues when Lambda is not configured
    const { renderMediaOnLambda } = await import('@remotion/lambda/client');

    // Derive the app origin so PluginScene can fetch bundle URLs inside Lambda.
    // NEXT_PUBLIC_APP_URL takes priority; fall back to the request origin.
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${request.nextUrl.protocol}//${request.nextUrl.host}`;

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
      timeoutInMilliseconds: 900000, // 15 min max
      envVariables: {
        NEXT_PUBLIC_APP_URL: appUrl,
      },
    });

    return NextResponse.json({ renderId, bucketName, region }, { headers: rateLimitHeaders });
  } catch (error: any) {
    console.error('Lambda render error:', error);
    return NextResponse.json({ error: error.message || 'Lambda render failed' }, { status: 500, headers: rateLimitHeaders });
  }
}
