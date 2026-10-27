import { NextRequest, NextResponse } from 'next/server';
import { startWizard, resumeWizard } from '@/lib/video/ai';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getApiKeyFromCookie, getDeepSeekKeyForUser, getTtsKeysForUser } from '@/lib/api-key-cookies';
import { setTtsApiKeys } from '@/lib/video/ai/deepgram-tts';
import { updateJob } from '@/lib/mcp/wizard-jobs';
import { db } from '@/lib/db';

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult as { session: { user: { id: string; role?: string } } };

  // Capture auth header so we can forward it to internal render calls
  const origin = new URL(req.url).origin;

  const body = await req.json();
  const { action, threadId } = body;

  if (!threadId) {
    return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });
  }

  try {
    let result: Awaited<ReturnType<typeof startWizard>>;

    if (action === 'start') {
      const {
        userStory, templateBlocks,
        partialVideoMeta = {}, preferredArc = null, preferredVoice = null,
        preferredVisualStyle = null, customVisualPrompt = null,
        customArc = null, deepseekApiKey = null, xaiApiKey = null,
        language = 'en', model = 'deepseek-chat',
      } = body;

      const cookieKey =
        (await getApiKeyFromCookie('deepseek')) ||
        (await getApiKeyFromCookie('xai'));
      const dbKey     = cookieKey ? '' : await getDeepSeekKeyForUser(session.user.id);
      const apiKey    = cookieKey || dbKey || deepseekApiKey || xaiApiKey || '';

      // Inject per-user TTS keys before audio generation runs
      const ttsKeys = await getTtsKeysForUser(session.user.id);
      setTtsApiKeys(ttsKeys);

      result = await startWizard(threadId, {
        userStory, templateBlocks, partialVideoMeta,
        preferredArc, preferredVoice, preferredVisualStyle,
        customVisualPrompt, customArc, language, apiKey, model,
      });

    } else if (action === 'resume') {
      const { value } = body;
      const ttsKeys = await getTtsKeysForUser(session.user.id);
      setTtsApiKeys(ttsKeys);
      result = await resumeWizard(threadId, value);

    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Track token usage
    if (result.tokensUsed > 0) {
      db.query(
        `UPDATE users SET "aiTokensUsed" = COALESCE("aiTokensUsed", 0) + $1 WHERE id = $2`,
        [result.tokensUsed, session.user.id],
      ).catch(() => {});
    }

    const editableState = result.stateSnapshot ? {
      narrativePlan:    (result.stateSnapshot as any).narrativePlan    ?? [],
      blocksWithImages: (result.stateSnapshot as any).blocksWithImages ?? [],
      imageItems:       (result.stateSnapshot as any).imageItems       ?? [],
      filledBlocks:     (result.stateSnapshot as any).filledBlocks     ?? [],
      templateBlocks:   (result.stateSnapshot as any).templateBlocks   ?? [],
      videoMeta:        (result.stateSnapshot as any).videoMeta        ?? {},
      visualStyleGuide: (result.stateSnapshot as any).visualStyleGuide ?? '',
    } : null;

    if (result.status === 'interrupted') {
      await updateJob(threadId, { status: 'interrupted', interrupt: result.interrupt, state: editableState });
    } else {
      // Wizard complete — create a Video record for instant editor preview (no MP4 render)
      const payload = result.payload ?? {};
      try {
        const insertResult = await db.query(
          `INSERT INTO "Video" (id, name, data, "userId", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id`,
          ['Wizard Video', JSON.stringify(payload), session.user.id],
        );
        const videoId = insertResult.rows[0]?.id ?? '';
        await updateJob(threadId, {
          status:  'complete',
          payload: { ...payload, videoId, previewUrl: `${origin}/editor?videoId=${videoId}` },
          state:   editableState,
        });
      } catch (e: any) {
        console.error('[execute] video insert failed:', e.message);
        await updateJob(threadId, { status: 'complete', payload, state: editableState });
      }
    }

    return NextResponse.json({ ok: true });

  } catch (e: any) {
    console.error('[/api/ai/wizard/execute]', e.message);
    await updateJob(threadId, { status: 'error', error: e.message }).catch(() => {});
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
