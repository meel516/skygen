import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { createJob, updateJob } from '@/lib/mcp/wizard-jobs';

// POST /api/mcp/jobs — create or reset a job record
export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const { threadId, status } = await req.json();
  if (!threadId) return NextResponse.json({ error: 'Missing threadId' }, { status: 400 });

  if (status === 'running') {
    // Reset existing job to running (approve_story / approve_images)
    await updateJob(threadId, { status: 'running' });
  } else {
    // Create new job
    await createJob(threadId, session.user.id);
  }

  return NextResponse.json({ ok: true });
}
