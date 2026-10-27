import 'server-only';
import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getJob, updateJob } from '@/lib/mcp/wizard-jobs';
import { applyBlockPostProcessors } from '@/lib/video/ai';
import { db } from '@/lib/db';

export const maxDuration = 60;

// POST /api/ai/wizard/assemble
// Rebuilds the final video payload from the current wizard_jobs.state,
// creates or updates the Video record, and marks the job complete.
// Can be called multiple times — re-assembles with latest block edits.
export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult as { session: { user: { id: string } } };

  const origin = new URL(req.url).origin;
  const { threadId } = await req.json();

  if (!threadId) {
    return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });
  }

  const job = await getJob(threadId);
  if (!job) {
    return NextResponse.json({ error: 'Job not found' }, { status: 404 });
  }

  const state = job.state;
  if (!state || !state.filledBlocks?.length) {
    return NextResponse.json({ error: 'No state available — generation may not be complete yet' }, { status: 422 });
  }

  try {
    // Run post-processors (parallax layer merge, audio duration calculation)
    const contentBlocks = await applyBlockPostProcessors(
      state.filledBlocks,
      state.templateBlocks ?? [],
      state.videoMeta ?? {},
    );

    const payload = {
      videoMeta:     state.videoMeta ?? {},
      contentBlocks,
    };

    // Create or update the Video record
    const existingVideoId = job.payload?.videoId ?? null;
    let videoId: string;

    if (existingVideoId) {
      await db.query(
        `UPDATE "Video" SET data = $1 WHERE id = $2`,
        [JSON.stringify(payload), existingVideoId],
      );
      videoId = existingVideoId;
    } else {
      const insertResult = await db.query(
        `INSERT INTO "Video" (id, name, data, "userId", "createdAt")
         VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id`,
        ['Wizard Video', JSON.stringify(payload), session.user.id],
      );
      videoId = insertResult.rows[0]?.id ?? '';
    }

    const previewUrl = `${origin}/editor?videoId=${videoId}`;

    await updateJob(threadId, {
      status:  'complete',
      payload: { ...payload, videoId, previewUrl },
      state,
    });

    return NextResponse.json({ videoId, previewUrl });

  } catch (e: any) {
    console.error('[/api/ai/wizard/assemble]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
