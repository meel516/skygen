import type { Context } from 'hono';
import { getSessionFromRequest } from '../lib/auth';
import { getRunMeta, updateRunStatus, appendRunEvent } from '../lib/run-events';
import { abortRun } from '../lib/run-controllers';

// POST /wizard/runs/:runId/cancel
// Halts an in-flight wizard run. The chat handler registered an
// AbortController for this runId when it kicked off runAgentInBackground;
// we abort it here, and the AI SDK throws AbortError between tool calls.
// The catch block in runAgentInBackground treats that as terminal-clean
// (status='cancelled', run-cancelled event). This route only fires the
// abort — the actual status/event writes happen in the chat handler's
// catch, so they always happen in the same process that owns the run.
export async function runCancelHandler(c: Context) {
  const req = c.req.raw;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const runId = c.req.param('runId');
  const meta = await getRunMeta(runId);
  if (!meta) {
    return c.json({ error: 'Run not found or expired' }, 404);
  }
  // Ownership check — same gate as the events route. Prevents a user from
  // cancelling another user's run by guessing runId.
  if (meta.userId !== session.user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Already terminal — nothing to cancel. Tell the client so it can
  // converge (the SSE stream may still be open and will deliver the
  // original terminal event).
  if (meta.status === 'complete' || meta.status === 'error' || meta.status === 'cancelled') {
    return c.json({ ok: true, runId, status: meta.status, alreadyTerminal: true });
  }

  // Fire the abort. The chat handler's catch block does the status write
  // and emits run-cancelled. Best-effort: even if no controller is
  // registered (e.g. process restarted mid-run), we mark the run
  // cancelled so the client converges instead of hanging on a stream
  // that will never produce another event.
  const aborted = abortRun(runId);
  if (!aborted) {
    // Process likely restarted — promote meta to cancelled so SSE clients
    // exit cleanly. No agent loop to actually halt.
    await updateRunStatus(runId, 'cancelled').catch(() => undefined);
    await appendRunEvent(runId, { type: 'run-cancelled', runId, threadId: meta.threadId }).catch(() => null);
    return c.json({ ok: true, runId, status: 'cancelled', orphaned: true });
  }

  return c.json({ ok: true, runId, status: 'cancelled' });
}
