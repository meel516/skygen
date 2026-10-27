import { NextRequest, NextResponse } from 'next/server';
// Template-gallery generation intentionally uses the legacy LangGraph wizard.
// Chat generation is routed elsewhere through the Mastra server/proxy flow.
import { startWizard, resumeWizard } from '@/lib/video/ai/graph';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { canUseTemplateBlocks } from '@/lib/template-access';
import { getServerAiSettings } from '@/lib/video/ai/providers';
import { getApiKeyFromCookie, getDeepSeekKeyForUser, getTtsKeysForUser } from '@/lib/api-key-cookies';
import { setTtsApiKeys } from '@/lib/video/ai/deepgram-tts';

// Allow up to 5 minutes for wizard runs (video generation can be slow)
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
      scope: 'ai-wizard-run',
      limit: 10,
      windowMs: 10 * 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body    = await req.json();
    const { action, threadId, templateId } = body;

    if (!threadId) {
      return NextResponse.json({ error: 'Missing threadId' }, { status: 400, headers: rateLimitHeaders });
    }

    // Token limit check
    try {
      const usage = await db.query(
        `SELECT "aiTokensUsed", "aiTokenLimit" FROM users WHERE id = $1`,
        [session.user.id]
      );
      if (usage.rows.length > 0) {
        const { aiTokensUsed, aiTokenLimit } = usage.rows[0];
        const used  = aiTokensUsed  ?? 0;
        const limit = aiTokenLimit  ?? 100000;
        if (used >= limit) {
          return NextResponse.json(
            { error: 'AI token limit reached', used, limit },
            { status: 403, headers: rateLimitHeaders }
          );
        }
      }
    } catch { /* columns may not exist yet */ }

    let result: Awaited<ReturnType<typeof startWizard>>;

    if (action === 'start') {
      const {
        userStory, templateBlocks,
        partialVideoMeta = {}, preferredArc = null, preferredVoice = null,
        preferredVisualStyle = null, customVisualPrompt = null,
        customArc = null,
        deepseekApiKey = null,
        xaiApiKey = null,
        language = 'en',
        model: bodyModel,
      } = body;

      if (!userStory || !Array.isArray(templateBlocks)) {
        return NextResponse.json(
          { error: 'Missing userStory or templateBlocks' },
          { status: 400, headers: rateLimitHeaders }
        );
      }

      const canUseBlocks = await canUseTemplateBlocks({
        role: session.user.role,
        blocks: templateBlocks,
        sourceTemplateId: templateId,
      });

      if (!canUseBlocks) {
        return NextResponse.json(
          { error: 'Premium required to use advanced content blocks.' },
          { status: 403, headers: rateLimitHeaders }
        );
      }

      const { defaultModel } = getServerAiSettings();
      const model  = bodyModel ?? defaultModel;

      console.log('[wizard/run start] model:', model, 'template:', templateId ?? 'scratch');

      // Cookie (web UI) → DB (MCP — no cookies) → body xaiApiKey → empty
      const cookieKey =
        (await getApiKeyFromCookie('deepseek')) ||
        (await getApiKeyFromCookie('xai'));
      const dbKey = cookieKey ? '' : await getDeepSeekKeyForUser(session.user.id);
      const ttsKeys = await getTtsKeysForUser(session.user.id);
      setTtsApiKeys(ttsKeys);

      result = await startWizard(threadId, {
        userStory, templateBlocks, partialVideoMeta,
        preferredArc, preferredVoice, preferredVisualStyle, customVisualPrompt,
        customArc, language, apiKey: cookieKey || dbKey || deepseekApiKey || xaiApiKey || '', model,
      });

    } else if (action === 'resume') {
      const { value } = body;
      console.log('[wizard/run resume] threadId:', threadId);
      const ttsKeys = await getTtsKeysForUser(session.user.id);
      setTtsApiKeys(ttsKeys);
      result = await resumeWizard(threadId, value);

    } else {
      return NextResponse.json(
        { error: 'Invalid action. Use "start" or "resume".' },
        { status: 400, headers: rateLimitHeaders }
      );
    }

    // Track tokens used in this invocation
    if (result.tokensUsed > 0) {
      try {
        await db.query(
          `UPDATE users SET "aiTokensUsed" = COALESCE("aiTokensUsed", 0) + $1 WHERE id = $2`,
          [result.tokensUsed, session.user.id]
        );
      } catch { /* non-fatal */ }
    }

    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (e: any) {
    console.error('[/api/ai/wizard/run]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
