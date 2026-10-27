import { createClient, type RedisClientType } from 'redis';

const RUN_TTL_SECONDS = Number(process.env.WIZARD_RUN_TTL_SECONDS ?? 60 * 60 * 24);
const STREAM_MAXLEN = Number(process.env.WIZARD_RUN_STREAM_MAXLEN ?? 1000);

let redisPromise: Promise<RedisClientType> | null = null;

export interface RunMeta {
  runId: string;
  threadId: string;
  userId: string;
  status: 'running' | 'complete' | 'error' | 'cancelled';
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export interface RunEvent {
  id: string;
  data: any;
}

type RunEventListener = (event: RunEvent) => void;

const listeners = new Map<string, Set<RunEventListener>>();
let lastEventMs = 0;
let lastEventSeq = 0;

function streamKey(runId: string): string {
  return `wizard:run:${runId}:events`;
}

function metaKey(runId: string): string {
  return `wizard:run:${runId}:meta`;
}

export function createRunId(): string {
  return `run-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function compareRunEventIds(a: string, b: string): number {
  const [aMsRaw, aSeqRaw] = a.split('-');
  const [bMsRaw, bSeqRaw] = b.split('-');
  const aMs = Number(aMsRaw || 0);
  const bMs = Number(bMsRaw || 0);
  if (aMs !== bMs) return aMs - bMs;
  return Number(aSeqRaw || 0) - Number(bSeqRaw || 0);
}

function createEventId(): string {
  const now = Date.now();
  if (now === lastEventMs) {
    lastEventSeq += 1;
  } else {
    lastEventMs = now;
    lastEventSeq = 0;
  }
  return `${lastEventMs}-${lastEventSeq}`;
}

function emitLiveEvent(runId: string, event: RunEvent): void {
  const runListeners = listeners.get(runId);
  if (!runListeners) return;
  for (const listener of runListeners) {
    try {
      listener(event);
    } catch (error: any) {
      console.error('[wizard-run-events] Live listener failed:', error?.message ?? error);
    }
  }
}

export function subscribeRunEvents(runId: string, listener: RunEventListener): () => void {
  let runListeners = listeners.get(runId);
  if (!runListeners) {
    runListeners = new Set();
    listeners.set(runId, runListeners);
  }
  runListeners.add(listener);

  return () => {
    const current = listeners.get(runId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) {
      listeners.delete(runId);
    }
  };
}

async function getRedis(): Promise<RedisClientType> {
  if (!redisPromise) {
    const client = createClient({
      url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    });
    client.on('error', (error) => {
      console.error('[wizard-run-events] Redis error:', error);
    });
    redisPromise = client.connect().then(() => client as RedisClientType);
  }
  return redisPromise;
}

export async function setRunMeta(meta: RunMeta): Promise<void> {
  const redis = await getRedis();
  await redis.sendCommand([
    'SET',
    metaKey(meta.runId),
    JSON.stringify(meta),
    'EX',
    String(RUN_TTL_SECONDS),
  ]);
}

export async function getRunMeta(runId: string): Promise<RunMeta | null> {
  const redis = await getRedis();
  const raw = await redis.get(metaKey(runId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as RunMeta;
  } catch {
    return null;
  }
}

export async function updateRunStatus(
  runId: string,
  status: RunMeta['status'],
  error?: string,
): Promise<void> {
  const current = await getRunMeta(runId);
  if (!current) return;
  await setRunMeta({
    ...current,
    status,
    error,
    updatedAt: new Date().toISOString(),
  });
}

export function createLiveRunEvent(runId: string, data: any): RunEvent {
  const event = { id: createEventId(), data };
  emitLiveEvent(runId, event);
  return event;
}

export async function persistRunEvent(runId: string, event: RunEvent): Promise<string> {
  const redis = await getRedis();
  await redis.sendCommand([
    'XADD',
    streamKey(runId),
    'MAXLEN',
    '~',
    String(STREAM_MAXLEN),
    event.id,
    'data',
    JSON.stringify(event.data),
  ]);
  await redis.sendCommand(['EXPIRE', streamKey(runId), String(RUN_TTL_SECONDS)]);
  return event.id;
}

export async function appendRunEvent(runId: string, data: any): Promise<string> {
  const event = createLiveRunEvent(runId, data);
  return persistRunEvent(runId, event);
}

export async function readRunEvents(
  runId: string,
  afterId: string,
  blockMs = 25000,
  count = 50,
): Promise<RunEvent[]> {
  const redis = await getRedis();
  const command = [
    'XREAD',
    'COUNT',
    String(count),
    'STREAMS',
    streamKey(runId),
    afterId || '0-0',
  ];
  if (blockMs > 0) {
    command.splice(1, 0, 'BLOCK', String(blockMs));
  }
  const response = await redis.sendCommand(command);

  let entries: any;
  if (Array.isArray(response)) {
    if (response.length === 0) return [];
    const firstStream = response[0] as any[];
    entries = firstStream?.[1];
  } else if (response && typeof response === 'object') {
    entries = Object.values(response as Record<string, unknown>)[0];
  }
  if (!Array.isArray(entries)) return [];

  return entries.map((entry: any[]) => {
    const id = String(entry[0]);
    const fields = entry[1] as any[];
    let raw = '{}';
    for (let i = 0; i < fields.length; i += 2) {
      if (String(fields[i]) === 'data') {
        raw = String(fields[i + 1] ?? '{}');
        break;
      }
    }
    try {
      return { id, data: JSON.parse(raw) };
    } catch {
      return { id, data: { type: 'run-event-parse-error', raw } };
    }
  });
}
