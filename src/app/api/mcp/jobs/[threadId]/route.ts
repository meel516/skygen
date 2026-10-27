import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getJob } from '@/lib/mcp/wizard-jobs';

// GET /api/mcp/jobs/[threadId] — read job status instantly from DB
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const { threadId } = await params;
  const isMcpPreview = threadId.includes('mcp_preview_');
  if (!isMcpPreview) {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) return authResult.response;
  }
  const job = await getJob(threadId);

  if (!job) return NextResponse.json(null);
  return NextResponse.json(job);
}
