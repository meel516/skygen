import { NextRequest, NextResponse } from 'next/server';
import { getTemplateById, VideoTemplate } from '@/lib/video/templates/template-definitions';
import { db } from '@/lib/db';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { canUseTemplateBlocks } from '@/lib/template-access';
import { generateVideoPayload } from '@/lib/video/ai';
import { getServerAiSettings } from '@/lib/video/ai/providers';

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
      scope: 'template-generate',
      limit: 8,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await request.json();
    const { templateId, userPrompt, model, preferredArc, preferredVoice, scratchBlocks } = body;

    if (!userPrompt) {
      return NextResponse.json(
        { error: 'Missing userPrompt' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    if (!scratchBlocks && !templateId) {
      return NextResponse.json(
        { error: 'Missing templateId or scratchBlocks' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    const { defaultModel } = getServerAiSettings();

    let blocks: any[];
    let videoMeta: any;

    if (scratchBlocks) {
      // Scratch mode — use the niche-based block structure provided by the client
      blocks = scratchBlocks;
      videoMeta = {
        aspectRatio: '9:16',
        theme: 'dark_modern',
        fps: 30,
        audioTracks: [],
        intro: { title: '', subtitle: '', duration: 2 },
        outro: { title: '', subtitle: '', duration: 2 },
      };
    } else {
      // Template mode — look up template by id (hardcoded first, then DB)
      let template: VideoTemplate | undefined = getTemplateById(templateId);

      if (!template) {
        const result = await db.query(`SELECT * FROM "Template" WHERE id = $1 LIMIT 1`, [templateId]);
        if (result.rows.length > 0) {
          const row = result.rows[0];
          const data = typeof row.data === 'string' ? JSON.parse(row.data) : (row.data || {});
          template = {
            id: row.id,
            name: row.name,
            description: row.description || row.name,
            category: (row.category as VideoTemplate['category']) || 'motivation',
            videoMeta: data?.videoMeta || {},
            blocks: data?.blocks || [],
            requiredVariables: data?.requiredVariables || [],
          };
        }
      }

      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404, headers: rateLimitHeaders }
        );
      }

      blocks = template.blocks;
      videoMeta = template.videoMeta;
    }

    const canUseBlocks = await canUseTemplateBlocks({
      role: session.user.role,
      blocks,
      sourceTemplateId: scratchBlocks ? null : templateId,
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

    const result = await generateVideoPayload(
      userPrompt,
      blocks,
      videoMeta,
      '',
      model || defaultModel,
      preferredArc ?? null,
      preferredVoice ?? null,
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

    return NextResponse.json(
      {
        content: {
          ...result.payload,
          ...(scratchBlocks ? {} : { sourceTemplateId: templateId }),
        },
      },
      { headers: rateLimitHeaders }
    );
  } catch (error) {
    console.error('Template generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Generation failed' },
      { status: 500 }
    );
  }
}
