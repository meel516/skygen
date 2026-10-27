import type { Context } from 'hono';
import { getSessionFromRequest } from '../lib/auth';
import {
  compareRunEventIds,
  getRunMeta,
  readRunEvents,
  subscribeRunEvents,
  type RunEvent,
} from '../lib/run-events';

function sseEncode(event: { id?: string; data?: any; comment?: string }): string {
  if (event.comment) return `: ${event.comment}\n\n`;
  const lines = [];
  if (event.id) lines.push(`id: ${event.id}`);
  lines.push(`data: ${JSON.stringify(event.data ?? {})}`);
  return `${lines.join('\n')}\n\n`;
}

export async function runEventsHandler(c: Context) {
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
  if (meta.userId !== session.user.id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const url = new URL(req.url);
  let lastId =
    req.headers.get('last-event-id') ||
    url.searchParams.get('after') ||
    '0-0';

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const liveQueue: RunEvent[] = [];
      let wake: (() => void) | null = null;
      let terminal = false;

      const unsubscribe = subscribeRunEvents(runId, (event) => {
        liveQueue.push(event);
        wake?.();
        wake = null;
      });

      const send = (event: { id?: string; data?: any; comment?: string }) => {
        controller.enqueue(encoder.encode(sseEncode(event)));
      };

      const waitForLiveEvent = (ms: number): Promise<'event' | 'timeout'> => {
        if (liveQueue.length > 0) return Promise.resolve('event');
        return new Promise((resolve) => {
          const timer = setTimeout(() => {
            if (wake === notify) wake = null;
            resolve('timeout');
          }, ms);
          const notify = () => {
            clearTimeout(timer);
            resolve('event');
          };
          wake = notify;
        });
      };

      const sendRunEvent = (event: RunEvent) => {
        if (compareRunEventIds(event.id, lastId) <= 0) return;
        lastId = event.id;
        send(event);
        const type = event.data?.type;
        if (type === 'run-complete' || type === 'run-error' || type === 'run-cancelled') {
          terminal = true;
        }
      };

      const replayRedisBacklog = async () => {
        while (!req.signal.aborted && !terminal) {
          const events = await readRunEvents(runId, lastId, 0, 100);
          if (events.length === 0) return;
          for (const event of events) {
            sendRunEvent(event);
            if (terminal) return;
          }
        }
      };

      try {
        send({
          data: {
            type: 'run-meta',
            runId: meta.runId,
            threadId: meta.threadId,
            status: meta.status,
          },
        });

        await replayRedisBacklog();

        while (!req.signal.aborted && !terminal) {
          while (liveQueue.length > 0 && !terminal) {
            const event = liveQueue.shift();
            if (event) sendRunEvent(event);
          }
          if (terminal) break;

          // 15s cadence — well under Cloudflare's 100s idle cut and any
          // reasonable proxy's read timeout. Use a `data:` event (not a
          // comment) because some proxies (notably Cloudflare free tier)
          // only reset their idle timer on data frames, not SSE comments.
          const result = await waitForLiveEvent(15000);
          if (result === 'timeout') {
            await replayRedisBacklog();
            if (!terminal && liveQueue.length === 0) {
              send({ data: { type: 'keepalive', ts: Date.now() } });
            }
          }
        }
      } catch (error: any) {
        send({
          data: {
            type: 'run-error',
            runId,
            threadId: meta.threadId,
            error: error?.message || 'Run event stream failed',
          },
        });
      } finally {
        unsubscribe();

        if (wake) {
          wake();
          wake = null;
        }

        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Thread-Id': meta.threadId,
      'X-Run-Id': runId,
    },
  });
}
