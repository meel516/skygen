'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import {
  ChatCircleText,
  CircleNotch,
  NotePencil,
  Plus,
} from '@phosphor-icons/react';

type ConversationThread = {
  id: string;
  title: string;
  messageCount: number;
  lastMessage: string;
  updatedAt: string | null;
  jobStatus?: string | null;
  activeRun?: {
    runId?: string;
    status?: string;
  } | null;
};

function formatRelativeTime(value: string | null): string {
  if (!value) return '';
  const then = new Date(value).getTime();
  if (!Number.isFinite(then)) return '';

  const diffMs = Date.now() - then;
  const minute = 60_000;
  const hour = minute * 60;
  const day = hour * 24;

  if (diffMs < minute) return 'now';
  if (diffMs < hour) return `${Math.floor(diffMs / minute)}m`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h`;
  if (diffMs < day * 7) return `${Math.floor(diffMs / day)}d`;

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

export function ConversationSidebar() {
  const { threadId, hydrateFromThread, reset, messages } = useWizardChatStore();
  const [threads, setThreads] = useState<ConversationThread[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingThreadId, setLoadingThreadId] = useState<string | null>(null);

  const loadThreads = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/wizard/threads', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();
      setThreads(Array.isArray(data.threads) ? data.threads : []);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (!threadId) return;
    const timeout = window.setTimeout(() => {
      loadThreads();
    }, 500);
    return () => window.clearTimeout(timeout);
  }, [threadId, messages.length, loadThreads]);

  const hasThreads = threads.length > 0;
  const sortedThreads = useMemo(() => threads, [threads]);

  const handleSelectThread = useCallback(
    async (id: string) => {
      if (id === threadId) return;
      setLoadingThreadId(id);
      try {
        await hydrateFromThread(id);
      } finally {
        setLoadingThreadId(null);
      }
    },
    [hydrateFromThread, threadId],
  );

  const handleNewThread = useCallback(() => {
    reset();
  }, [reset]);

  return (
    <aside
      className="hidden xl:flex w-[236px] shrink-0 border-r flex-col min-h-0"
      style={{
        background: 'var(--background)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="h-[61px] px-3 flex items-center justify-between border-b shrink-0"
        style={{ borderColor: 'var(--border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <ChatCircleText weight="duotone" size={17} style={{ color: 'var(--primary)' }} />
          <span className="text-xs font-semibold truncate" style={{ color: 'var(--foreground)' }}>
            Conversations
          </span>
        </div>
        <button
          onClick={handleNewThread}
          className="w-8 h-8 rounded-sm flex items-center justify-center disabled:opacity-40"
          title="New conversation"
          style={{
            background: 'color-mix(in srgb, var(--primary) 16%, transparent)',
            border: '1px solid color-mix(in srgb, var(--primary) 28%, transparent)',
            color: 'var(--primary)',
          }}
        >
          <Plus weight="bold" size={15} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-2" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
        {isLoading && !hasThreads && (
          <div role="status" aria-label="Loading conversations" className="space-y-4 p-3"><div className="h-12 bg-muted" /><div className="h-12 bg-muted" /><div className="h-12 bg-muted" /></div>
        )}

        {!isLoading && !hasThreads && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <NotePencil weight="duotone" size={28} style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-xs mt-3 leading-relaxed" style={{ color: 'var(--muted-foreground)' }}>
              Your saved chats will appear here.
            </p>
          </div>
        )}

        {hasThreads && (
          <div className="flex flex-col gap-1">
            {sortedThreads.map((thread) => {
              const active = thread.id === threadId;
              const loading = loadingThreadId === thread.id;
              return (
                <button
                  key={thread.id}
                  onClick={() => handleSelectThread(thread.id)}
                  className="w-full text-left rounded-sm px-3 py-2.5 disabled:opacity-50"
                  title={thread.title}
                  style={{
                    background: active ? 'color-mix(in srgb, var(--primary) 16%, transparent)' : 'transparent',
                    border: active ? '1px solid color-mix(in srgb, var(--primary) 28%, transparent)' : '1px solid transparent',
                    color: 'var(--foreground)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-xs font-medium truncate">
                      {thread.title}
                    </span>
                    <span className="text-[10px] shrink-0" style={{ color: active ? 'var(--primary)' : 'var(--muted-foreground)' }}>
                      {loading ? '...' : formatRelativeTime(thread.updatedAt)}
                    </span>
                  </div>
                  <div className="text-[11px] leading-snug line-clamp-2" style={{ color: 'var(--muted-foreground)' }}>
                    {thread.lastMessage || `${thread.messageCount} messages`}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
