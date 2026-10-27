import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';

// GET /api/mcp/jobs/[threadId]/state — return the full editable state snapshot
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

  if (!job) return NextResponse.json(null, { status: 404 });
  return NextResponse.json(job.state ?? {});
}

// Resolve and set a dot/bracket-notation path on a state object (mutates in place)
function setPath(obj: Record<string, any>, rawPath: string, value: unknown): void {
  const parts = rawPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let target: any = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    if (target[key] === undefined || target[key] === null) {
      target[key] = /^\d+$/.test(parts[i + 1]) ? [] : {};
    }
    target = target[key];
  }
  target[parts[parts.length - 1]] = value;
}

// PATCH /api/mcp/jobs/[threadId]/state — set any field in the state snapshot
//
// Preferred body: { path: string, value: any }
//   path is a dot/bracket-notation path relative to the state root, e.g.:
//     "videoMeta.audioTracks"          → state.videoMeta.audioTracks
//     "filledBlocks[2].audioSrc"       → state.filledBlocks[2].audioSrc
//     "narrativePlan[0].spokenScript"  → state.narrativePlan[0].spokenScript
//     "videoMeta.theme"                → state.videoMeta.theme
//
// Legacy body (backward compat): { blockIndex: number, field: string, value: any }
//   Automatically translated to path = "filledBlocks[{blockIndex}].{field}"
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> },
) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  const { threadId } = await params;
  // eslint-disable-next-line prefer-const
  let { path, value, blockIndex, field } = await req.json();

  // Backward compat: translate old { blockIndex, field } form to a root path
  if (path === undefined && blockIndex !== undefined && field) {
    path = `filledBlocks[${blockIndex}].${field}`;
  }

  if (!path) {
    return NextResponse.json({ error: 'Missing path (or legacy blockIndex + field)' }, { status: 400 });
  }

  await patchJobState(threadId, (current) => {
    const next = { ...current };
    setPath(next, path as string, value);
    return next;
  });

  return NextResponse.json({ ok: true, patched: path });
}
