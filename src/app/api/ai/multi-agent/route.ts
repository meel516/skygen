import { NextRequest, NextResponse } from 'next/server';
import { generateVideoPayload } from '@/lib/video/ai';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { canUseTemplateBlocks } from '@/lib/template-access';
import { getServerAiSettings } from '@/lib/video/ai/providers';
import { getApiKeyFromCookie } from '@/lib/api-key-cookies';

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
      scope: 'ai-multi-agent',
      limit: 8,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await req.json();
    const { userStory, templateBlocks, partialVideoMeta = {}, sourceTemplateId } = body;

    console.log('[/api/ai/multi-agent] Received request:', {
      model: body.model,
      deepseekConfigured: !!process.env.DEEPSEEK_API_KEY,
      googleConfigured: !!process.env.GOOGLE_API_KEY,
    });

    if (!userStory || !Array.isArray(templateBlocks)) {
      return NextResponse.json(
        { error: 'Missing userStory or templateBlocks' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const canUseBlocks = await canUseTemplateBlocks({
      role: session.user.role,
      blocks: templateBlocks,
      sourceTemplateId,
    });

    if (!canUseBlocks) {
      return NextResponse.json(
        { error: 'Premium required to use advanced content blocks.' },
        { status: 403, headers: rateLimitHeaders }
      );
    }

    // Check token limit before generating
    try {
      const usageResult = await db.query(
        `SELECT "aiTokensUsed", "aiTokenLimit" FROM users WHERE id = $1`,
        [session.user.id]
      );
      if (usageResult.rows.length > 0) {
        const { aiTokensUsed, aiTokenLimit } = usageResult.rows[0];
        const used = aiTokensUsed ?? 0;
        const limit = aiTokenLimit ?? 100000;
        if (used >= limit) {
          return NextResponse.json(
            {
              error: 'AI token limit reached',
              message: `You have used ${used.toLocaleString()}/${limit.toLocaleString()} AI tokens. Upgrade to generate more.`,
              used,
              limit,
            },
            { status: 403, headers: rateLimitHeaders }
          );
        }
      }
    } catch {
      // Columns may not exist yet — allow through
    }

    const { defaultModel } = getServerAiSettings();
    const model = body.model || defaultModel;
    console.log('[/api/ai/multi-agent] Using model:', model);

    // Read API key from HTTP-only cookie (never from request body).
    // DeepSeek is the current user-facing provider; xai remains fallback for older cookies.
    const apiKey =
      (await getApiKeyFromCookie('deepseek')) ||
      (await getApiKeyFromCookie('xai'));

    const result = await generateVideoPayload(
      userStory,
      templateBlocks,
      partialVideoMeta,
      apiKey,
      model
    );

    // Record actual tokens used
    if (result.tokensUsed > 0) {
      try {
        await db.query(
          `UPDATE users
           SET "aiTokensUsed" = COALESCE("aiTokensUsed", 0) + $1,
               "aiCount"      = COALESCE("aiCount", 0) + 1
           WHERE id = $2`,
          [result.tokensUsed, session.user.id]
        );
      } catch {
        // Non-fatal
      }
    }

    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (e: any) {
    console.error('[/api/ai/multi-agent]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
