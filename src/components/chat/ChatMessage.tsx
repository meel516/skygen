'use client';

import { memo, useMemo } from 'react';
import type { ChatMessage as ChatMessageType } from '@/store/wizard-chat-store';
import { ToolStatusCard } from './ToolStatusCard';
import { User as UserIcon, PencilSimpleLine as Sparkle } from '@phosphor-icons/react';

export const ChatMessage = memo(function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';
  const isSystem = message.role === 'system';
  const isEmpty = !message.content && !message.toolCalls?.length;
  const hasOnlyTools = !message.content && !!message.toolCalls?.length;

  if (isSystem) {
    return (
      <div className="flex justify-center my-3">
        <span
          className="text-xs px-3 py-1 rounded-full"
          style={{ background: 'var(--border)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
        >
          {message.content}
        </span>
      </div>
    );
  }

  // Agent thinking — show pulsing dots
  if (isEmpty && !isUser) {
    return (
      <div className="flex gap-3 mb-4">
        <AgentAvatar />
        <div
          className="flex items-center gap-1.5 px-4 py-3 rounded-sm rounded-tl-sm"
          style={{
            background: 'var(--border)',
            border: '1px solid var(--border)',
          }}
        >
          {[0, 1, 2].map(i => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{
                background: 'var(--primary)',
                animationDelay: `${i * 200}ms`,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // Agent message with only tool calls (no text yet)
  if (hasOnlyTools && !isUser) {
    return (
      <div className="flex gap-3 mb-4">
        <AgentAvatar />
        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
          {message.toolCalls!.map((tc, i) => (
            <ToolStatusCard key={`${tc.toolName}-${i}`} toolCall={tc} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'} mb-4`}>
      {/* Avatar */}
      {isUser ? <UserAvatar /> : <AgentAvatar />}

      {/* Content */}
      <div className={`flex flex-col gap-1.5 max-w-[82%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Text bubble */}
        {message.content && (
          <div
            className={`px-4 py-3 text-sm leading-relaxed break-words ${isUser ? 'rounded-sm rounded-tr-sm' : 'rounded-sm rounded-tl-sm'}`}
            style={{
              background: isUser ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--border)',
              border: isUser ? '1px solid color-mix(in srgb, var(--primary) 28%, transparent)' : '1px solid var(--border)',
              color: 'var(--foreground)',
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
          >
            <MarkdownText text={message.content} />
          </div>
        )}

        {/* Tool call cards */}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <div className="flex flex-col gap-1.5 w-full">
            {message.toolCalls.map((tc, i) => (
              <ToolStatusCard key={`${tc.toolName}-${i}`} toolCall={tc} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

function AgentAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: 'var(--primary)' }}
    >
      <Sparkle weight="fill" size={14} className="text-white" />
    </div>
  );
}

function UserAvatar() {
  return (
    <div
      className="w-7 h-7 rounded-sm flex items-center justify-center shrink-0 mt-0.5"
      style={{ background: 'var(--border)', border: '1px solid var(--border)' }}
    >
      <UserIcon weight="fill" size={14} style={{ color: '#9B9BBB' }} />
    </div>
  );
}

function MarkdownText({ text }: { text: string }) {
  const html = useMemo(() => {
    let out = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
    out = out.replace(/`([^`]+)`/g, '<code style="background:rgba(124,58,237,0.2);padding:1px 6px;border-radius:4px;font-size:11px;font-family:monospace;word-break:break-all;overflow-wrap:anywhere">$1</code>');
    out = out.replace(/\n/g, '<br/>');
    return out;
  }, [text]);

  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
