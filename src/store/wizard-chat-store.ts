import { create } from 'zustand';
import type { VideoInput } from '@/lib/video/schemas';

// ─── Types ─────────────────────────────────────────────────────────────────

export type GenerationStatus = 'idle' | 'running' | 'interrupted' | 'complete' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  /** Tool call progress cards rendered inline */
  toolCalls?: ToolCallStatus[];
}

export interface ToolCallStatus {
  toolName: string;
  status: 'running' | 'complete' | 'error';
  label: string;
  result?: string;
}

type ActiveRunStatus = 'running' | 'complete' | 'error' | 'cancelled';

interface ActiveRunState {
  runId: string;
  threadId: string;
  lastEventId: string;
  status: ActiveRunStatus;
  assistantMessageId?: string;
  assistantContent?: string;
  updatedAt: number;
}

interface WizardChatState {
  // Chat state
  threadId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;

  // Generation state
  generationStatus: GenerationStatus;
  videoInput: VideoInput | null;
  videoId: string | null;
  error: string | null;

  // User pre-selections (from chip rows)
  selectedTemplateId: string | null;
  selectedVoiceId: string | null;
  selectedStyleId: string | null;

  // Preview versioning — increments on each real change to force Player re-mount
  previewVersion: number;
  // Which block index is currently being generated (drives skeleton label)
  currentGeneratingBlock: number;

  // Plugin preview — set when agent returns preview_ready, cleared on build/cancel
  pendingPlugin: {
    pluginId: string;
    pluginName: string;
    sceneCode: string;
    modules?: Record<string, string>;
    schemaJson: string;
    dependencies?: Record<string, string>;
    sourceHash?: string;
    lastCompiledSourceHash?: string;
    lastCompileOk?: boolean;
    lastBundleBytes?: number;
    lastCompiledAt?: string;
    previewSourceHash?: string;
    previewBuildId?: string;
    previewSavedAt?: string;
  } | null;

  activeRuns: Record<string, ActiveRunState>;
}

interface WizardChatActions {
  sendMessage: (text: string, attachmentUrl?: string) => Promise<void>;
  stopStreaming: () => void;
  hydrateFromThread: (threadId: string) => Promise<void>;
  reset: () => void;
  setGenerationStatus: (status: GenerationStatus) => void;
  setSelectedTemplate: (id: string | null) => void;
  setSelectedVoice: (id: string | null) => void;
  setSelectedStyle: (id: string | null) => void;
  setPendingPlugin: (p: WizardChatState['pendingPlugin']) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

let msgCounter = 0;
function makeId(): string {
  return `msg-${Date.now()}-${++msgCounter}`;
}

/**
 * Maps toolCallId → toolName across the SSE stream.
 * Tool-call events carry both; tool-result events often only carry toolCallId.
 * This lets us resolve the tool name when processing tool-result chunks.
 */
const toolCallNameMap = new Map<string, string>();

// Module-scoped controller for the in-flight chat fetch. Keeps it out of
// React state so re-renders never recreate it. stopStreaming() aborts this
// controller; the next sendMessage() replaces it.
let currentAbortController: AbortController | null = null;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const ACTIVE_RUNS_STORAGE_KEY = 'skygen.wizard.activeRuns.v1';
const CURRENT_THREAD_STORAGE_KEY = 'skygen.wizard.currentThreadId.v1';

export function getStoredWizardThreadId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(CURRENT_THREAD_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredWizardThreadId(threadId: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CURRENT_THREAD_STORAGE_KEY, threadId);
  } catch {
    /* ignore storage quota/privacy errors */
  }
}

function clearCurrentThreadId(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CURRENT_THREAD_STORAGE_KEY);
  } catch {
    /* ignore storage quota/privacy errors */
  }
}

function loadActiveRuns(): Record<string, ActiveRunState> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(ACTIVE_RUNS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveActiveRuns(activeRuns: Record<string, ActiveRunState>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(ACTIVE_RUNS_STORAGE_KEY, JSON.stringify(activeRuns));
  } catch {
    /* ignore storage quota/privacy errors */
  }
}

function normalizeActiveRunStatus(status: unknown): ActiveRunStatus {
  return status === 'complete' || status === 'error' || status === 'cancelled'
    ? status
    : 'running';
}

function isTerminalRunStatus(status: unknown): boolean {
  return status === 'complete' || status === 'error' || status === 'cancelled';
}

function buildVideoMeta(raw: any, blockCount: number): VideoInput['videoMeta'] {
  const meta = raw ?? {};
  return {
    fps: meta.fps || 30,
    aspectRatio: meta.aspectRatio ?? '9:16',
    duration: Math.max(1, meta.duration ?? blockCount * 5),
    theme: meta.theme ?? 'dark_modern',
    audioTracks: meta.audioTracks ?? [],
    selectedArc: meta.selectedArc ?? '',
    ...meta,
  };
}

// ─── Store ─────────────────────────────────────────────────────────────────

export const useWizardChatStore = create<WizardChatState & WizardChatActions>((set, get) => {
  // Apply a tool-result from the SSE stream directly to the preview state.
  // This replaces the old poll-the-DB flow: plan-video seeds skeleton blocks,
  // generate-block fills one slot at a time, assemble-video snaps the final state.
  const applyToolResult = (toolName: string | undefined, result: any, args?: any) => {
    console.log(`[wizard-chat-store] applyToolResult(${toolName})`, { result, args });
    if (!result || typeof result !== 'object') return;

    // Mastra reports the tool name from the agentTools object key (camelCase),
    // not the tool's internal `id` (kebab-case). Normalize to kebab-case so
    // downstream logic matches either form.
    const normalized = (toolName ?? '').replace(/([A-Z])/g, '-$1').toLowerCase();

    if (normalized === 'plan-video' && Array.isArray(result.templateBlocks)) {
      const blocks = result.templateBlocks;
      const next: VideoInput = {
        videoMeta: buildVideoMeta(result.videoMeta, blocks.length),
        contentBlocks: blocks,
      };
      console.log(`[wizard-chat-store] Seeding skeleton preview with ${blocks.length} blocks`);
      set({
        videoInput: next,
        generationStatus: 'running',
        previewVersion: get().previewVersion + 1,
      });
      return;
    }

    if (normalized === 'generate-block' && result.block && typeof result.blockIndex === 'number') {
      const current = get().videoInput;
      if (!current) {
        // plan-video didn't run (or we missed it) — seed a minimal preview
        // from this single block so something shows up immediately.
        const blocks: any[] = [];
        blocks[result.blockIndex] = result.block;
        set({
          videoInput: {
            videoMeta: buildVideoMeta(null, result.blockIndex + 1),
            contentBlocks: blocks,
          },
          generationStatus: 'running',
          previewVersion: get().previewVersion + 1,
        });
        console.log(`[wizard-chat-store] Seeded preview from first generate-block (index ${result.blockIndex})`);
        return;
      }
      const nextBlocks = current.contentBlocks.slice();
      nextBlocks[result.blockIndex] = result.block;
      console.log(`[wizard-chat-store] Filled block ${result.blockIndex}`);
      set({
        videoInput: { ...current, contentBlocks: nextBlocks },
        previewVersion: get().previewVersion + 1,
      });
      return;
    }

    if (normalized === 'update-block-image' && typeof result.blockIndex === 'number' && result.newImageUrl) {
      const current = get().videoInput;
      if (!current) return;
      const nextBlocks = current.contentBlocks.slice();
      const block = { ...(nextBlocks[result.blockIndex] ?? {}) };
      const fp = result.fieldPath ?? 'imageUrl';
      // Apply patch to nested path, same convention as the backend tool uses.
      const parts = fp.replace(/\[(\d+)\]/g, '.$1').split('.');
      let target: any = block;
      for (let i = 0; i < parts.length - 1; i++) {
        if (target[parts[i]] === undefined) target[parts[i]] = {};
        target[parts[i]] = { ...target[parts[i]] };
        target = target[parts[i]];
      }
      target[parts[parts.length - 1]] = result.newImageUrl;
      nextBlocks[result.blockIndex] = block;
      console.log(`[wizard-chat-store] Patched image on block ${result.blockIndex} (${fp})`);
      set({
        videoInput: { ...current, contentBlocks: nextBlocks },
        previewVersion: get().previewVersion + 1,
      });
      return;
    }

    if (normalized === 'update-block-audio' && typeof result.blockIndex === 'number' && result.newAudioUrl) {
      const current = get().videoInput;
      if (!current) return;
      const nextBlocks = current.contentBlocks.slice();
      nextBlocks[result.blockIndex] = {
        ...(nextBlocks[result.blockIndex] ?? {}),
        audioSrc: result.newAudioUrl,
      };
      console.log(`[wizard-chat-store] Patched audio on block ${result.blockIndex}`);
      set({
        videoInput: { ...current, contentBlocks: nextBlocks },
        previewVersion: get().previewVersion + 1,
      });
      return;
    }

    if (normalized === 'patch-state' && result.ok && typeof result.patched === 'string') {
      // patchState returns only { ok, patched } — the new value lives in args.
      // If we have it, mirror the patch locally so the preview updates
      // instantly. Otherwise, assembleVideo (called next by the agent) refreshes.
      const path: string = args?.path ?? result.patched;
      const value = args?.value;
      if (value === undefined) {
        console.log(`[wizard-chat-store] patchState on "${path}" — no args in chunk, waiting for assembleVideo`);
        return;
      }
      // Only apply patches that target the current videoInput shape:
      // filledBlocks[i].xxx → contentBlocks[i].xxx, videoMeta.xxx → videoMeta.xxx.
      // Other paths (visualStyleGuide, storyBible, etc.) aren't in videoInput,
      // so they simply flow through the next assembleVideo.
      const current = get().videoInput;
      if (!current) return;
      const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
      if (parts.length < 2) return;
      const root = parts[0];
      if (root === 'filledBlocks') {
        const idx = Number(parts[1]);
        if (!Number.isFinite(idx)) return;
        const nextBlocks = current.contentBlocks.slice();
        const block = { ...(nextBlocks[idx] ?? {}) };
        let target: any = block;
        for (let i = 2; i < parts.length - 1; i++) {
          if (target[parts[i]] === undefined) target[parts[i]] = {};
          target[parts[i]] = { ...target[parts[i]] };
          target = target[parts[i]];
        }
        if (parts.length === 2) {
          nextBlocks[idx] = value;
        } else {
          target[parts[parts.length - 1]] = value;
          nextBlocks[idx] = block;
        }
        console.log(`[wizard-chat-store] patchState applied locally: ${path}`);
        set({
          videoInput: { ...current, contentBlocks: nextBlocks },
          previewVersion: get().previewVersion + 1,
        });
        return;
      }
      if (root === 'videoMeta') {
        const meta: any = { ...(current.videoMeta ?? {}) };
        let target: any = meta;
        for (let i = 1; i < parts.length - 1; i++) {
          if (target[parts[i]] === undefined) target[parts[i]] = {};
          target[parts[i]] = { ...target[parts[i]] };
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
        console.log(`[wizard-chat-store] patchState applied locally: ${path}`);
        set({
          videoInput: { ...current, videoMeta: meta },
          previewVersion: get().previewVersion + 1,
        });
        return;
      }
      console.log(`[wizard-chat-store] patchState on "${path}" — not in videoInput shape, waiting for assembleVideo`);
      return;
    }

    if (normalized === 'create-plugin') {
      if (result.status === 'preview_ready' && result.pendingPlugin) {
        console.log(`[wizard-chat-store] Plugin preview ready: ${result.pendingPlugin.pluginId}`);
        set({ pendingPlugin: result.pendingPlugin });
      } else if (result.pluginId) {
        console.log(`[wizard-chat-store] Plugin created: ${result.pluginId}`);
      }
      return;
    }

    if (normalized === 'build-and-save-plugin') {
      console.log(`[wizard-chat-store] Plugin built${result.pluginId ? `: ${result.pluginId}` : ''}`);
      set({ pendingPlugin: null });
      return;
    }

    if (normalized === 'assemble-video' && result.videoInput) {
      const vi = result.videoInput;
      const next: VideoInput = {
        videoMeta: buildVideoMeta(vi.videoMeta, vi.contentBlocks?.length ?? 0),
        contentBlocks: vi.contentBlocks ?? [],
      };
      console.log(`[wizard-chat-store] Finalized preview with ${next.contentBlocks.length} blocks`);
      set({
        videoInput: next,
        videoId: result.videoId ?? get().videoId,
        generationStatus: 'complete',
        previewVersion: get().previewVersion + 1,
      });
      return;
    }
  };

  const setActiveRun = (threadId: string, update: Partial<ActiveRunState> & Pick<ActiveRunState, 'runId'>) => {
    const activeRuns = {
      ...get().activeRuns,
      [threadId]: {
        ...(get().activeRuns[threadId] ?? {
          threadId,
          lastEventId: '0-0',
          status: 'running' as const,
          updatedAt: Date.now(),
        }),
        ...update,
        threadId,
        updatedAt: Date.now(),
      },
    };
    set({ activeRuns });
    saveActiveRuns(activeRuns);
  };

  const consumeRunEvents = async (params: {
    runId: string;
    threadId: string;
    assistantMessageId: string;
    initialContent?: string;
    after?: string;
  }) => {
    const { runId, threadId, assistantMessageId } = params;
    const decoder = new TextDecoder();
    let accumulated = params.initialContent ?? '';
    let lineBuffer = '';
    let lastEventId = params.after ?? '0-0';
    let terminalRunEvent = false;

    while (!terminalRunEvent) {
      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
      try {
        const eventResponse = await fetch(
          `/api/ai/wizard/runs/${encodeURIComponent(runId)}/events?after=${encodeURIComponent(lastEventId)}`,
          {
            headers: { Accept: 'text/event-stream' },
            signal: currentAbortController?.signal,
          },
        );

        if (!eventResponse.ok) {
          // 404 = run meta expired (24h TTL) — terminal, don't loop forever.
          if (eventResponse.status === 404) {
            console.warn('[wizard-chat-store] Run meta expired (404) — stopping reconnect loop');
            return;
          }
          throw new Error(`Event stream HTTP ${eventResponse.status}`);
        }

        reader = eventResponse.body?.getReader() ?? null;
        if (!reader) throw new Error('No response body');

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        lineBuffer += chunk;

        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('id: ')) {
            lastEventId = trimmed.slice(4).trim();
            setActiveRun(threadId, {
              runId,
              lastEventId,
              status: 'running',
              assistantMessageId,
              assistantContent: accumulated,
            });
            continue;
          }
          if (!trimmed.startsWith('data: ')) continue;

          const rawData = trimmed.slice(6);
          if (!rawData || rawData === '[DONE]') continue;

          try {
            const parsed = JSON.parse(rawData);
            const chunkType = parsed.type;
            const payload = parsed.payload ?? parsed;

            if (chunkType !== 'text-delta') {
              console.log(`[wizard-chat-store] chunk: ${chunkType}`, payload);
            }

            if (chunkType === 'run-meta') {
              const status = normalizeActiveRunStatus(payload.status);
              if (isTerminalRunStatus(status)) {
                terminalRunEvent = true;
                if (status === 'error') {
                  set({ generationStatus: 'error', error: payload.error ?? 'Agent run failed' });
                } else if (status === 'cancelled') {
                  set({ generationStatus: 'interrupted' });
                }
                setActiveRun(threadId, {
                  runId,
                  lastEventId,
                  status,
                  assistantMessageId,
                  assistantContent: accumulated,
                });
              }
            }
            else if (chunkType === 'text-delta' && payload.text) {
              accumulated += payload.text;
              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId ? { ...m, content: accumulated } : m,
                ),
              }));
              setActiveRun(threadId, {
                runId,
                lastEventId,
                status: 'running',
                assistantMessageId,
                assistantContent: accumulated,
              });
            }
            else if (chunkType === 'run-complete') {
              terminalRunEvent = true;
              setActiveRun(threadId, {
                runId,
                lastEventId,
                status: 'complete',
                assistantMessageId,
                assistantContent: accumulated,
              });
            }
            else if (chunkType === 'run-error') {
              terminalRunEvent = true;
              set({ generationStatus: 'error', error: payload.error ?? 'Agent run failed' });
              setActiveRun(threadId, {
                runId,
                lastEventId,
                status: 'error',
                assistantMessageId,
                assistantContent: accumulated,
              });
            }
            else if (chunkType === 'run-cancelled') {
              terminalRunEvent = true;
              set({ generationStatus: 'interrupted' });
              setActiveRun(threadId, {
                runId,
                lastEventId,
                status: 'cancelled',
                assistantMessageId,
                assistantContent: accumulated,
              });
            }
            else if (chunkType === 'data-wizard-progress') {
              const data = parsed.data ?? payload.data ?? payload;
              const { phase, status, toolCallId, errorMessage } = data ?? {};
              if (!phase || !status) continue;

              if (status === 'start') {
                if (toolCallId) toolCallNameMap.set(toolCallId, phase);

                const toolCall: ToolCallStatus = {
                  toolName: phase,
                  status: 'running',
                  label: getToolLabel(phase),
                };
                set((s) => ({
                  messages: s.messages.map((m) =>
                    m.id === assistantMessageId
                      ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                      : m,
                  ),
                }));

                if (phase === 'plan-video' || phase === 'generate-block' || phase === 'assemble-video') {
                  if (get().generationStatus !== 'running' && get().generationStatus !== 'complete') {
                    set({ generationStatus: 'running' });
                  }
                }
                if (phase === 'generate-block' && typeof data.blockIndex === 'number') {
                  set({ currentGeneratingBlock: data.blockIndex });
                }
                if (phase === 'build-and-save-plugin') {
                  set({ pendingPlugin: null });
                }
              } else if (status === 'complete') {
                set((s) => ({
                  messages: s.messages.map((m) => {
                    if (m.id !== assistantMessageId) return m;
                    const calls = [...(m.toolCalls ?? [])];
                    const idx = calls.findLastIndex(
                      (c) => c.toolName === phase && c.status === 'running',
                    );
                    if (idx >= 0) calls[idx] = { ...calls[idx], status: 'complete' };
                    return { ...m, toolCalls: calls };
                  }),
                }));

                applyToolResult(phase, data, data);

                if (toolCallId) toolCallNameMap.delete(toolCallId);
              } else if (status === 'preview-ready') {
                if (data.pendingPlugin) {
                  set({ pendingPlugin: data.pendingPlugin });
                  console.log(`[wizard-chat-store] Plugin preview ready: ${data.pendingPlugin.pluginId}`);
                }
                if (toolCallId) toolCallNameMap.delete(toolCallId);
              } else if (status === 'error') {
                set((s) => ({
                  messages: s.messages.map((m) => {
                    if (m.id !== assistantMessageId) return m;
                    const calls = [...(m.toolCalls ?? [])];
                    const idx = calls.findLastIndex(
                      (c) => c.toolName === phase && c.status === 'running',
                    );
                    if (idx >= 0) {
                      calls[idx] = {
                        ...calls[idx],
                        status: 'error',
                        result: errorMessage ?? 'Failed',
                      };
                    }
                    return { ...m, toolCalls: calls };
                  }),
                }));

                if (phase === 'plan-video' || phase === 'assemble-video') {
                  set({ generationStatus: 'error', error: errorMessage ?? 'Failed' });
                }

                if (toolCallId) toolCallNameMap.delete(toolCallId);
              }
              continue;
            }
            else if (
              chunkType === 'tool-call'
              || chunkType === 'tool-call-upsert'
              || chunkType === 'tool-call-input-streaming-start'
            ) {
              const toolName = payload.toolName ?? payload.name;
              const toolCallId = payload.toolCallId ?? payload.id;

              if (toolName && toolName.startsWith('agent-')) continue;

              if (toolCallId && toolName) {
                toolCallNameMap.set(toolCallId, toolName);
              }

              const toolCall: ToolCallStatus = {
                toolName: toolName || 'unknown',
                status: 'running',
                label: getToolLabel(toolName || 'unknown'),
              };

              set((s) => ({
                messages: s.messages.map((m) =>
                  m.id === assistantMessageId
                    ? { ...m, toolCalls: [...(m.toolCalls ?? []), toolCall] }
                    : m,
                ),
              }));

              const kebab = (toolName ?? '').replace(/([A-Z])/g, '-$1').toLowerCase();
              if (kebab === 'plan-video' || kebab === 'generate-block' || kebab === 'assemble-video') {
                if (get().generationStatus !== 'running' && get().generationStatus !== 'complete') {
                  set({ generationStatus: 'running' });
                }
              }
              if (kebab === 'generate-block') {
                const args = payload.args ?? {};
                const idx = typeof args.blockIndex === 'number' ? args.blockIndex : null;
                if (idx !== null) set({ currentGeneratingBlock: idx });
              }
            }
            else if (chunkType === 'tool-result' || chunkType === 'tool-output') {
              let toolName = payload.toolName ?? payload.name;
              const toolCallId = payload.toolCallId ?? payload.id;
              if (!toolName && toolCallId) {
                toolName = toolCallNameMap.get(toolCallId);
              }

              if (toolName && toolName.startsWith('agent-')) continue;
              const toolResult = payload.result ?? payload.output ?? payload;

              set((s) => ({
                messages: s.messages.map((m) => {
                  if (m.id !== assistantMessageId) return m;
                  const calls = [...(m.toolCalls ?? [])];
                  const idx = toolName
                    ? calls.findLastIndex((c) => (c.toolName === toolName || c.toolName === 'unknown') && c.status === 'running')
                    : calls.findLastIndex((c) => c.status === 'running');
                  if (idx >= 0) calls[idx] = { ...calls[idx], status: 'complete' };
                  return { ...m, toolCalls: calls };
                }),
              }));

              if (toolResult?.threadId && !get().threadId) {
                set({ threadId: toolResult.threadId });
                saveCurrentThreadId(toolResult.threadId);
              }

              applyToolResult(toolName, toolResult, payload.args);

              if (toolCallId) {
                toolCallNameMap.delete(toolCallId);
              }
            }
          } catch (err) {
            console.warn('[wizard-chat-store] Parse error (partial chunk?):', err);
          }
        }
      }
      } catch (e: any) {
        // Network blip, proxy reset, aborted fetch — reconnect from lastEventId
        // and pick up the Redis backlog. AbortError is user-initiated (Stop);
        // we let it kill the loop.
        if (e?.name === 'AbortError') throw e;
        console.warn('[wizard-chat-store] Event stream error; reconnecting:', e?.message ?? e);
      } finally {
        try { reader?.releaseLock?.(); } catch { /* already released */ }
      }

      if (!terminalRunEvent) {
        console.warn('[wizard-chat-store] Event stream closed before terminal event; reconnecting');
        await delay(1000);
      }
    }
  };

  return {
    // Initial state
    threadId: null,
    messages: [],
    isStreaming: false,
    generationStatus: 'idle',
    videoInput: null,
    videoId: null,
    error: null,
    selectedTemplateId: null,
    selectedVoiceId: null,
    selectedStyleId: null,
    previewVersion: 0,
    currentGeneratingBlock: 0,
    pendingPlugin: null,
    activeRuns: loadActiveRuns(),

    // ── Send message ────────────────────────────────────────────────────────
    sendMessage: async (text: string, attachmentUrl?: string) => {
      const state = get();
      if (state.isStreaming) return;

      const userMsg: ChatMessage = {
        id: makeId(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
      };

      const assistantMsg: ChatMessage = {
        id: makeId(),
        role: 'assistant',
        content: '',
        timestamp: Date.now(),
      };

      set({
        messages: [...state.messages, userMsg, assistantMsg],
        isStreaming: true,
        error: null,
      });

      let controller: AbortController | null = null;

      try {
        // Filter out empty assistant messages (from tool-calling turns) —
        // the AI SDK chokes on assistant messages with empty content and
        // no corresponding tool-result messages, which prevents tool calls
        // on subsequent turns.
        const chatMessages = [...state.messages, userMsg]
          .filter((m) => m.role !== 'assistant' || m.content.trim() !== '')
          .map((m) => ({
            role: m.role as 'user' | 'assistant',
            content: m.content,
          }));

        // Fresh AbortController for this request — stopStreaming() aborts it.
        controller = new AbortController();
        currentAbortController = controller;

        const startResponse = await fetch('/api/ai/wizard/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: chatMessages,
            threadId: state.threadId,
            templateId: state.selectedTemplateId,
            voiceId: state.selectedVoiceId,
            styleId: state.selectedStyleId,
            attachmentUrl: attachmentUrl ?? null,
          }),
          signal: controller.signal,
        });

        if (!startResponse.ok) {
          throw new Error(`HTTP ${startResponse.status}`);
        }

        const startPayload = await startResponse.json();
        const runId = startPayload?.runId;
        const resolvedThreadId =
          startPayload?.threadId ||
          startResponse.headers.get('X-Thread-Id');

        if (!runId) {
          throw new Error('Chat run did not return a runId');
        }

        // Capture threadId so follow-up turns stay on the same thread.
        if (resolvedThreadId && !get().threadId) {
          set({ threadId: resolvedThreadId });
          setStoredWizardThreadId(resolvedThreadId);
        }

        const activeThreadId = resolvedThreadId ?? state.threadId ?? '';
        setActiveRun(activeThreadId, {
          runId,
          lastEventId: '0-0',
          status: 'running',
          assistantMessageId: assistantMsg.id,
          assistantContent: '',
        });
        await consumeRunEvents({
          runId,
          threadId: activeThreadId,
          assistantMessageId: assistantMsg.id,
          initialContent: '',
          after: '0-0',
        });

        set({ isStreaming: false });

        if (!get().videoInput && get().generationStatus === 'running') {
          set({ generationStatus: 'idle' });
        }

        const activeCurrentThreadId = get().threadId;
        const activeStillHasSkeletons = (get().videoInput?.contentBlocks ?? []).some((b: any) => b?._skeleton);
        if (activeStillHasSkeletons && activeCurrentThreadId) {
          console.warn('[wizard-chat-store] Blocks still skeleton after stream - re-hydrating from DB');
          get().hydrateFromThread(activeCurrentThreadId);
        }
        return;
      } catch (e: any) {
        // User-initiated abort — drop quietly, leave existing state intact.
        // Whatever the last completed tool persisted to the DB stands as truth.
        if (e?.name === 'AbortError') {
          console.log('[wizard-chat-store] Stream aborted by user');
          set({ isStreaming: false });
        } else {
          console.error('[wizard-chat-store] Stream failed:', e);
          set({ isStreaming: false, error: e.message, generationStatus: 'error' });
        }
      } finally {
        if (currentAbortController === controller) {
          currentAbortController = null;
        }
      }
    },

    // ── Stop the in-flight stream ──────────────────────────────────────────
    // Aborts the fetch on the client; Next.js fires req.signal on the server,
    // which Mastra honors as agent.stream({ abortSignal }). The agent loop
    // halts after its current tool call; whatever was already persisted stays.
    stopStreaming: () => {
      const state = get();
      const threadId = state.threadId;
      const activeRun = threadId ? state.activeRuns[threadId] : null;

      if (threadId && activeRun?.runId && activeRun.status === 'running') {
        const currentAssistantContent =
          state.messages.find((m) => m.id === activeRun.assistantMessageId)?.content ??
          activeRun.assistantContent ??
          '';

        setActiveRun(threadId, {
          runId: activeRun.runId,
          lastEventId: activeRun.lastEventId ?? '0-0',
          status: 'cancelled',
          assistantMessageId: activeRun.assistantMessageId,
          assistantContent: currentAssistantContent,
        });
        set({ isStreaming: false, generationStatus: 'interrupted' });

        void fetch(`/api/ai/wizard/runs/${encodeURIComponent(activeRun.runId)}/cancel`, {
          method: 'POST',
        }).catch((error) => {
          console.warn('[wizard-chat-store] Failed to cancel background run:', error?.message ?? error);
        });
      }
      if (currentAbortController) {
        console.log('[wizard-chat-store] stopStreaming → abort()');
        currentAbortController.abort();
        currentAbortController = null;
      }
    },

    // ── Resume on mount ─────────────────────────────────────────────────────
    // One-shot DB fetch when a thread is re-opened. Rebuilds videoInput from
    // whatever the last generation left behind. No polling — the SSE stream
    // takes over once the user sends another message.
    hydrateFromThread: async (threadId: string) => {
      try {
        if (currentAbortController) {
          currentAbortController.abort();
          currentAbortController = null;
        }
        setStoredWizardThreadId(threadId);

        const threadRes = await fetch(`/api/ai/wizard/threads/${encodeURIComponent(threadId)}`);
        if (threadRes.ok) {
          const threadData = await threadRes.json();
          const restoredMessages = Array.isArray(threadData.messages)
            ? threadData.messages.map((message: any) => ({
                id: String(message.id ?? makeId()),
                role: message.role === 'assistant' ? 'assistant' : 'user',
                content: String(message.content ?? ''),
                timestamp: Number(message.timestamp ?? Date.now()),
              }))
            : [];

          set({
            threadId,
            messages: restoredMessages,
            isStreaming: false,
            error: null,
            pendingPlugin: null,
          });
        }

        const res = await fetch(`/api/mcp/jobs/${encodeURIComponent(threadId)}`);
        if (!res.ok) {
          set({ threadId });
          return;
        }
        const job = await res.json();
        if (!job) {
          set({
            threadId,
            videoInput: null,
            videoId: null,
            generationStatus: 'idle',
            previewVersion: get().previewVersion + 1,
          });
          return;
        }

        const persistedRun = job.state?.activeRun;
        const localRun = get().activeRuns[threadId];
        const activeRun: ActiveRunState | null =
          persistedRun?.runId &&
          normalizeActiveRunStatus(persistedRun.status) === 'running' &&
          localRun?.status !== 'cancelled'
            ? {
                runId: persistedRun.runId,
                threadId,
                lastEventId: localRun?.lastEventId ?? '0-0',
                status: 'running',
                assistantMessageId: localRun?.assistantMessageId,
                assistantContent: localRun?.assistantContent,
                updatedAt: Date.now(),
              }
            : localRun?.status === 'running'
              ? localRun
              : null;

        if (activeRun?.runId) {
          const existingAssistant =
            get().messages.find((m) => m.id === activeRun.assistantMessageId) ??
            get().messages.findLast((m) => m.role === 'assistant' && m.content.trim().length === 0);
          const assistantMessage: ChatMessage = existingAssistant ?? {
            id: makeId(),
            role: 'assistant',
            content: activeRun.assistantContent ?? '',
            timestamp: Date.now(),
          };

          if (!existingAssistant) {
            set((s) => ({ messages: [...s.messages, assistantMessage] }));
          }

          currentAbortController = new AbortController();
          set({
            isStreaming: true,
            generationStatus: activeRun.status === 'error' ? 'error' : 'running',
            error: null,
          });
          setActiveRun(threadId, {
            runId: activeRun.runId,
            lastEventId: activeRun.lastEventId ?? '0-0',
            status: activeRun.status,
            assistantMessageId: assistantMessage.id,
            assistantContent: assistantMessage.content,
          });

          void consumeRunEvents({
            runId: activeRun.runId,
            threadId,
            assistantMessageId: assistantMessage.id,
            initialContent: assistantMessage.content,
            after: activeRun.lastEventId ?? '0-0',
          }).then(() => {
            set({ isStreaming: false });
            if (!get().videoInput && get().generationStatus === 'running') {
              set({ generationStatus: 'idle' });
            }
          }).catch((err: any) => {
            if (err?.name === 'AbortError') return;
            console.error('[wizard-chat-store] Resume stream failed:', err);
            set({ isStreaming: false, error: err.message, generationStatus: 'error' });
          }).finally(() => {
            currentAbortController = null;
          });
        }

        const payloadBlocks = job.payload?.contentBlocks ?? [];
        const stateBlocks = job.state?.filledBlocks ?? [];
        const contentBlocks = payloadBlocks.length > 0 ? payloadBlocks : stateBlocks;
        if (contentBlocks.length === 0) {
          set({
            threadId,
            videoInput: null,
            videoId: null,
            generationStatus: job.status === 'running' ? 'running' : 'idle',
            previewVersion: get().previewVersion + 1,
            pendingPlugin: job.state?.pendingPlugin ?? null,
          });
          return;
        }

        const videoMeta = job.payload?.videoMeta ?? job.state?.videoMeta ?? {};
        const next: VideoInput = {
          videoMeta: buildVideoMeta(videoMeta, contentBlocks.length),
          contentBlocks,
        };

        set({
          threadId,
          videoInput: next,
          videoId: job.payload?.videoId ?? null,
          generationStatus: job.status === 'complete' ? 'complete' : job.status === 'running' ? 'running' : 'idle',
          previewVersion: get().previewVersion + 1,
          pendingPlugin: job.state?.pendingPlugin ?? null,
        });
      } catch (err) {
        console.warn('[wizard-chat-store] hydrateFromThread failed:', err);
      }
    },

    reset: () => {
      if (currentAbortController) {
        currentAbortController.abort();
        currentAbortController = null;
      }
      toolCallNameMap.clear();
      clearCurrentThreadId();
      set({
        threadId: null,
        messages: [],
        isStreaming: false,
        generationStatus: 'idle',
        videoInput: null,
        videoId: null,
        error: null,
        selectedTemplateId: null,
        selectedVoiceId: null,
        selectedStyleId: null,
        previewVersion: 0,
        currentGeneratingBlock: 0,
        pendingPlugin: null,
      });
    },

    setGenerationStatus: (status: GenerationStatus) => set({ generationStatus: status }),
    setSelectedTemplate: (id: string | null) => set({ selectedTemplateId: id }),
    setSelectedVoice: (id: string | null) => set({ selectedVoiceId: id }),
    setSelectedStyle: (id: string | null) => set({ selectedStyleId: id }),
    setPendingPlugin: (p) => set({ pendingPlugin: p }),
  };
});

function getToolLabel(toolName: string): string {
  const labels: Record<string, string> = {
    'select-template': 'Selecting template structure...',
    'select-arc': 'Choosing narrative arc...',
    'plan-narrative': 'Planning narrative...',
    'evaluate-engagement': 'Evaluating engagement...',
    'generate-content': 'Generating content...',
    'create-plugin': 'Creating custom plugin...',
    'build-and-save-plugin': 'Building plugin bundle...',
    'plan-video': 'Planning your video...',
    'generate-block': 'Generating block...',
    'get-video-state': 'Loading video state...',
    'list-block-media-fields': 'Inspecting block fields...',
    'patch-state': 'Applying changes...',
    'update-block-image': 'Updating image...',
    'update-block-audio': 'Updating audio...',
    'assemble-video': 'Rebuilding preview...',
    'list-voices': 'Loading voices...',
    'list-visual-styles': 'Loading styles...',
    'list-templates': 'Loading templates...',
  };
  // Mastra reports camelCase tool names (object keys); our labels are keyed
  // by kebab-case tool ids. Normalize before lookup.
  const kebab = toolName.replace(/([A-Z])/g, '-$1').toLowerCase();
  return labels[kebab] ?? labels[toolName] ?? `Running ${toolName}...`;
}
