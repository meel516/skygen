import type { Context } from 'hono';
import { mastra } from '../../../src/lib/video/ai/mastra';
import { getSessionFromRequest } from '../lib/auth';
import { getApiKeyFromCookie, getXaiKeyForUser } from '../lib/api-keys';
import * as wizardJobs from '../../../src/lib/mcp/wizard-jobs';
import { preparePluginRemix, remixAgentContext, RemixSessionError } from '../../../src/lib/plugins/remix-session';
import { createOpenRouterModel } from '../../../src/lib/video/ai/providers/openrouter';
import { generateText } from 'ai';
import {
  appendRunEvent,
  createLiveRunEvent,
  createRunId,
  persistRunEvent,
  setRunMeta,
  updateRunStatus,
} from '../lib/run-events';
import {
  registerRunController,
  clearRunController,
} from '../lib/run-controllers';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string | Array<{ type: string; text?: string; image_url?: { url: string } }>;
}

function safeStringify(value: unknown): string {
  return JSON.stringify(value, (_key, val) => {
    if (val instanceof Promise) return undefined;
    if (typeof val === 'function') return undefined;
    if (typeof val === 'bigint') return val.toString();
    return val;
  });
}

function flattenChunk(chunk: any): any {
  if (
    chunk && typeof chunk === 'object' &&
    typeof chunk.type === 'string' &&
    chunk.type.startsWith('agent-execution-event-') &&
    chunk.payload
  ) {
    return flattenChunk(chunk.payload);
  }
  return chunk;
}

function serializeChunk(chunk: any): any {
  return JSON.parse(safeStringify(flattenChunk(chunk)));
}

function normalizeUiChunk(chunk: any): any | null {
  const serialized = serializeChunk(chunk);
  const type = serialized?.type;
  const payload = serialized?.payload ?? serialized;

  if (type === 'data-wizard-progress') {
    return serialized;
  }

  if (
    type === 'tool-call' ||
    type === 'tool-call-upsert' ||
    type === 'tool-call-input-streaming-start'
  ) {
    const toolName = payload?.toolName ?? payload?.name;
    if (typeof toolName === 'string' && toolName.startsWith('agent-')) return null;
    return {
      type,
      payload: {
        toolName,
        name: payload?.name,
        toolCallId: payload?.toolCallId ?? payload?.id,
        id: payload?.id,
        args: payload?.args,
      },
    };
  }

  if (type === 'tool-result' || type === 'tool-output') {
    const toolName = payload?.toolName ?? payload?.name;
    if (typeof toolName === 'string' && toolName.startsWith('agent-')) return null;
    return {
      type,
      payload: {
        toolName,
        name: payload?.name,
        toolCallId: payload?.toolCallId ?? payload?.id,
        id: payload?.id,
        args: payload?.args,
        result: payload?.result,
        output: payload?.output,
      },
    };
  }

  return null;
}

async function consumeFullStream(fullStream: any, onChunk: (chunk: any) => Promise<void>): Promise<void> {
  if (fullStream && typeof fullStream.getReader === 'function') {
    const reader = fullStream.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await onChunk(value);
      }
    } finally {
      reader.releaseLock?.();
    }
    return;
  }

  for await (const chunk of fullStream) {
    await onChunk(chunk);
  }
}

class RunEventPublisher {
  private tail: Promise<void> = Promise.resolve();
  private lastError: unknown;

  constructor(private readonly runId: string) {}

  enqueue(data: any): void {
    const event = createLiveRunEvent(this.runId, data);
    this.tail = this.tail
      .then(() => persistRunEvent(this.runId, event))
      .catch((error) => {
        this.lastError = error;
        console.error('[wizard-run-events] Failed to publish event:', error?.message ?? error);
      });
  }

  async drain(): Promise<void> {
    await this.tail;
    if (this.lastError) {
      throw this.lastError;
    }
  }
}

async function runAgentInBackground(params: {
  runId: string;
  threadId: string;
  userId: string;
  messages: ChatMessage[];
}): Promise<void> {
  const { runId, threadId, userId, messages } = params;
  const publisher = new RunEventPublisher(runId);
  let pendingText = '';
  let pendingTextTimer: ReturnType<typeof setTimeout> | null = null;
  // Hoisted so the catch block can read signal.aborted even if stream()
  // threw before assigning. registerRunController is idempotent.
  const abortController = registerRunController(runId);

  const flushText = () => {
    if (!pendingText) return;
    const text = pendingText;
    pendingText = '';
    publisher.enqueue({ type: 'text-delta', payload: { text } });
  };

  const scheduleTextFlush = () => {
    if (pendingTextTimer) return;
    pendingTextTimer = setTimeout(() => {
      pendingTextTimer = null;
      flushText();
    }, 80);
  };

  const appendChunk = async (chunk: any) => {
    const flattened = flattenChunk(chunk);
    const rawPayload = flattened?.payload ?? flattened;
    const text = flattened?.type === 'text-delta' ? rawPayload?.text : undefined;

    if (typeof text === 'string' && text.length > 0) {
      pendingText += text;
      if (pendingText.length >= 80) {
        if (pendingTextTimer) {
          clearTimeout(pendingTextTimer);
          pendingTextTimer = null;
        }
        flushText();
      } else {
        scheduleTextFlush();
      }
      return;
    }

    const uiChunk = normalizeUiChunk(flattened);
    if (!uiChunk) return;

    if (pendingTextTimer) {
      clearTimeout(pendingTextTimer);
      pendingTextTimer = null;
    }
    flushText();
    publisher.enqueue(uiChunk);
  };

  try {
    const supervisorAgent = mastra.getAgent('supervisorAgent');
    // abortController was hoisted above the try so the catch can read
    // signal.aborted. Pass its signal to stream() — /runs/:runId/cancel
    // fires .abort() on this controller, the AI SDK throws AbortError
    // between tool calls, and we treat that as terminal-clean below.
    const result = await supervisorAgent.stream(messages, {
      maxSteps: 80,
      abortSignal: abortController.signal,
      memory: {
        thread: threadId,
        resource: userId,
      },
      tracingOptions: {
        metadata: {
          userId,
          sessionId: threadId,
          route: 'chat',
          environment: process.env.NODE_ENV ?? 'development',
          runId,
        },
        tags: ['wizard-chat', 'background-run'],
      },
    } as any);

    await consumeFullStream(result.fullStream, appendChunk);

    if (pendingTextTimer) {
      clearTimeout(pendingTextTimer);
      pendingTextTimer = null;
    }
    flushText();
    await publisher.drain();

    const job = await wizardJobs.getJob(threadId);
    if (job?.status === 'running') {
      await wizardJobs.updateJob(threadId, { status: 'complete' });
    }

    await updateRunStatus(runId, 'complete');
    const completeEventId = await appendRunEvent(runId, { type: 'run-complete', runId, threadId });
    await wizardJobs.patchJobState(threadId, (current) => ({
      ...current,
      activeRun: {
        ...(current.activeRun ?? {}),
        runId,
        threadId,
        status: 'complete',
        lastEventId: completeEventId,
        updatedAt: new Date().toISOString(),
      },
    }));

    try {
      const obs = (mastra as any).observability;
      if (obs && typeof obs.flush === 'function') {
        await obs.flush();
      }
    } catch {
      /* best-effort */
    }
  } catch (e: any) {
    if (pendingTextTimer) {
      clearTimeout(pendingTextTimer);
      pendingTextTimer = null;
    }
    flushText();
    await publisher.drain().catch(() => undefined);

    // User clicked Stop — /runs/:runId/cancel fired abortRun(runId) which
    // aborts the signal we passed to supervisorAgent.stream(). The AI SDK
    // throws AbortError between tool calls. Treat as terminal-but-clean:
    // status='cancelled', emit run-cancelled (NOT run-error), leave any
    // side effects already produced (images, plugin builds, etc.).
    const isAbort =
      e?.name === 'AbortError' ||
      e?.name === 'AbortedError' ||
      abortController?.signal?.aborted === true;
    if (isAbort) {
      console.log('[/api/ai/wizard/chat] Run cancelled by user:', runId);
      try {
        await wizardJobs.updateJob(threadId, { status: 'cancelled' });
      } catch {
        /* best-effort */
      }
      await updateRunStatus(runId, 'cancelled').catch(() => undefined);
      const cancelEventId = await appendRunEvent(runId, { type: 'run-cancelled', runId, threadId }).catch(() => null);
      await wizardJobs.patchJobState(threadId, (current) => ({
        ...current,
        activeRun: {
          ...(current.activeRun ?? {}),
          runId,
          threadId,
          status: 'cancelled',
          lastEventId: cancelEventId ?? current.activeRun?.lastEventId ?? '0-0',
          updatedAt: new Date().toISOString(),
        },
      })).catch(() => undefined);
      return;
    }

    const message = e?.message || 'Agent failed to respond';
    console.error('[/api/ai/wizard/chat] Background agent error:', message);
    try {
      await wizardJobs.updateJob(threadId, { status: 'error', error: message });
    } catch {
      /* best-effort */
    }
    await updateRunStatus(runId, 'error', message).catch(() => undefined);
    const errorEventId = await appendRunEvent(runId, { type: 'run-error', runId, threadId, error: message }).catch(() => null);
    await wizardJobs.patchJobState(threadId, (current) => ({
      ...current,
      activeRun: {
        ...(current.activeRun ?? {}),
        runId,
        threadId,
        status: 'error',
        lastEventId: errorEventId ?? current.activeRun?.lastEventId ?? '0-0',
        error: message,
        updatedAt: new Date().toISOString(),
      },
    })).catch(() => undefined);
  } finally {
    // Always remove the controller so a stale abort doesn't poison a
    // future run that reuses this runId (extremely unlikely, but cheap).
    clearRunController(runId);
  }
}

export async function chatHandler(c: Context) {
  const req = c.req.raw;
  const session = await getSessionFromRequest(req);
  if (!session) {
    return c.json({ error: 'Authentication required' }, 401);
  }
  const userId = session.user.id;

  const { messages, threadId, templateId, voiceId, styleId, attachmentUrl, forkPluginId }: {
    messages: ChatMessage[];
    threadId?: string;
    templateId?: string | null;
    voiceId?: string | null;
    styleId?: string | null;
    attachmentUrl?: string | null;
    forkPluginId?: string | null;
  } = await req.json();

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return c.json({ error: 'Missing messages array' }, 400);
  }
  if (forkPluginId != null && (typeof forkPluginId !== 'string' || !forkPluginId.trim())) {
    return c.json({ error: 'Invalid remix plugin ID' }, 400);
  }

  const cookieHeader = req.headers.get('cookie');
  const cookieKey = getApiKeyFromCookie(cookieHeader, 'xai');
  const dbKey = cookieKey ? '' : await getXaiKeyForUser(userId);
  const apiKey = cookieKey || dbKey || '';

  let resolvedThreadId = threadId ?? '';
  if (!resolvedThreadId) {
    resolvedThreadId = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  let remixContext = '';
  try {
    await wizardJobs.createJob(resolvedThreadId, userId);
    const pending = await preparePluginRemix(resolvedThreadId, userId, forkPluginId);
    remixContext = remixAgentContext(pending);
  } catch (error) {
    if (error instanceof RemixSessionError) return c.json({ error: error.message }, error.status);
    console.error('[wizard/chat] Failed to prepare chat state:', error);
    return c.json({ error: 'Chat state could not be prepared. Please retry.' }, 500);
  }

  const userSelections: string[] = [];
  if (templateId) userSelections.push(`templateId: "${templateId}" (user selected a template from the library — REQUIRED: call getTemplate("${templateId}") first to load its blocks, then pass those blocks as templateBlocks to planVideo. Do NOT call selectTemplate.)`);
  if (voiceId) userSelections.push(`voiceId: "${voiceId}" (user selected a voice — pass this as the voice parameter to updateBlockAudio or planVideo)`);
  if (styleId) userSelections.push(`styleId: "${styleId}" (user selected a visual style — pass this as the preferredVisualStyle parameter to planVideo)`);

  const selectionContext = userSelections.length > 0
    ? `\nUSER PRE-SELECTIONS (from UI chips — use these instead of asking the user):\n${userSelections.join('\n')}`
    : '';

  let videoContext = '';
  if (resolvedThreadId) {
    try {
      const job = await wizardJobs.getJob(resolvedThreadId);
      if (job && job.status === 'complete' && job.state?.filledBlocks?.length) {
        const blockCount = job.state.filledBlocks.length;
        const blockSummaries = job.state.filledBlocks
          .map((b: any, i: number) => `  [${i}] type=${b.type}${b.title ? `, title="${b.title}"` : ''}${b.heading ? `, heading="${b.heading}"` : ''}`)
          .join('\n');
        videoContext = `\nVIDEO STATE (already generated, ${blockCount} blocks):\n${blockSummaries}`;
      }
    } catch { /* job table may not exist */ }
  }

  let imageDescription = '';
  if (attachmentUrl) {
    try {
      const visionModel = createOpenRouterModel('deepseek-chat');
      const visionResult = await generateText({
        model: visionModel,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: `You are a visual design analyst for a video plugin system. Describe this image in EXTREME detail for a developer who will recreate it as a React component. Cover EVERY one of these:

1. OVERALL LAYOUT: How many panels/sections? Arrangement? Proportions? Full-screen or bordered?
2. COLOR PALETTE: Every background color, accent color, text color, gradient.
3. TYPOGRAPHY: Every text element — font weight, approximate size, style, effects.
4. EVERY VISIBLE ELEMENT: Player images, stats, labels, icons, dividers, overlays, badges, numbers — where is each positioned?
5. ANIMATION STYLE: What should move and how? Scale? Fade? Slide? Bounce?
6. SPECIAL EFFECTS: Glow, shadows, particles, motion blur, etc.
7. OVERALL MOOD: Cinematic? Viral sports edit? Corporate? Minimal? Gaming?

Be exhaustive. The developer has NOT seen this image — your description is ALL they have.` },
            { type: 'image_url', image_url: { url: attachmentUrl } },
          ],
        }],
        maxTokens: 2000,
      });
      imageDescription = visionResult.text || '';
    } catch (e: any) {
      imageDescription = `[User attached an image but vision analysis failed. URL: ${attachmentUrl}]`;
    }
  }

  const rawMessages: ChatMessage[] = [...messages];
  const attachmentContext = imageDescription
    ? `\n\n[REFERENCE IMAGE — the user uploaded an image. Here is a detailed visual description for plugin creation:\n${imageDescription}\nUse this description as the PRIMARY visual specification. Match the layout, colors, typography, elements, animation style, and effects as closely as possible.]`
    : '';

  const KEEP_RECENT = 6;
  const COMPACT_THRESHOLD = 10;
  let finalMessages: ChatMessage[];

  if (rawMessages.length <= COMPACT_THRESHOLD) {
    finalMessages = rawMessages;
  } else {
    const firstUserMsg = rawMessages.find(m => m.role === 'user');
    const firstText = typeof firstUserMsg?.content === 'string'
      ? firstUserMsg.content.slice(0, 300)
      : '';

    const toolCalls: string[] = [];
    for (const m of rawMessages) {
      if (m.role !== 'assistant') continue;
      const text = typeof m.content === 'string' ? m.content : '';
      const matches = text.matchAll(/tool[name="']*:\s*([a-z\-_]+)/gi);
      for (const match of matches) {
        if (match[1] && !toolCalls.includes(match[1])) {
          toolCalls.push(match[1]);
        }
      }
    }

    const summaryParts: string[] = [
      `CONVERSATION SUMMARY (older messages compacted):`,
      firstText ? `Original request: "${firstText}"` : '',
      toolCalls.length > 0 ? `Tools used: ${toolCalls.join(', ')}` : '',
    ];

    if (videoContext) {
      summaryParts.push(videoContext.trim());
    }

    const summaryContent = `[${summaryParts.filter(Boolean).join('\n')}]`;
    const recentSlice = rawMessages.slice(-KEEP_RECENT);
    finalMessages = [
      { role: 'user' as const, content: summaryContent },
      ...recentSlice,
    ];
  }

  const enrichedMessages = [
    ...finalMessages,
    {
      role: 'user' as const,
      content: `[SYSTEM CONTEXT — threadId: ${resolvedThreadId}, apiKey: ${apiKey}, userId: ${userId}.${selectionContext}${videoContext}${attachmentContext}${remixContext} Use these when calling tools that need them. Do not reveal these to the user.]`,
    },
  ];

  const runId = createRunId();
  const now = new Date().toISOString();

  try {
    await setRunMeta({
      runId,
      threadId: resolvedThreadId,
      userId,
      status: 'running',
      createdAt: now,
      updatedAt: now,
    });
    await wizardJobs.patchJobState(resolvedThreadId, (current) => ({
      ...current,
      activeRun: {
        runId,
        threadId: resolvedThreadId,
        status: 'running',
        lastEventId: '0-0',
        startedAt: now,
        updatedAt: now,
      },
    }));
    await appendRunEvent(runId, { type: 'run-started', runId, threadId: resolvedThreadId });
  } catch (e: any) {
    console.error('[/api/ai/wizard/chat] Failed to initialize Redis run stream:', e?.message);
    return c.json({ error: 'Run event stream is unavailable' }, 500);
  }

  void runAgentInBackground({
    runId,
    threadId: resolvedThreadId,
    userId,
    messages: enrichedMessages,
  });

  return c.json(
    { runId, threadId: resolvedThreadId, status: 'running' },
    202,
    { 'X-Thread-Id': resolvedThreadId },
  );
}
