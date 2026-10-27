'use client';

import { memo } from 'react';
import type { ToolCallStatus } from '@/store/wizard-chat-store';
import { CircleNotch, CheckCircle, XCircle } from '@phosphor-icons/react';

export const ToolStatusCard = memo(function ToolStatusCard({ toolCall }: { toolCall: ToolCallStatus }) {
  const isRunning = toolCall.status === 'running';
  const isComplete = toolCall.status === 'complete';
  const isError = toolCall.status === 'error';

  const accentColor = isRunning
    ? 'rgba(124,58,237,0.6)'
    : isComplete
    ? 'rgba(52,211,153,0.6)'
    : 'rgba(248,113,113,0.5)';

  return (
    <div
      className="flex items-center gap-3 pl-3 pr-4 py-2 rounded-lg"
      style={{
        background: isRunning
          ? 'rgba(124,58,237,0.06)'
          : isComplete
          ? 'rgba(52,211,153,0.04)'
          : 'rgba(248,113,113,0.04)',
        borderLeft: `2px solid ${accentColor}`,
        border: `1px solid ${isRunning ? 'rgba(124,58,237,0.15)' : isComplete ? 'rgba(52,211,153,0.12)' : 'rgba(248,113,113,0.12)'}`,
        borderLeftWidth: '2px',
        borderLeftColor: accentColor,
      }}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">
        {isRunning && <CircleNotch weight="bold" size={14} className="animate-spin" style={{ color: '#A78BFA' }} />}
        {isComplete && <CheckCircle weight="fill" size={14} style={{ color: '#34D399' }} />}
        {isError && <XCircle weight="fill" size={14} style={{ color: '#F87171' }} />}
      </div>

      {/* Label */}
      <span
        className="text-xs flex-1 leading-tight"
        style={{
          color: isRunning ? '#C4B5FD' : isComplete ? '#6EE7B7' : '#FCA5A5',
        }}
      >
        {toolCall.label}
      </span>

      {/* Status pill */}
      <span
        className="text-[10px] font-medium px-1.5 py-0.5 rounded-full flex-shrink-0"
        style={{
          background: isRunning
            ? 'rgba(124,58,237,0.15)'
            : isComplete
            ? 'rgba(52,211,153,0.1)'
            : 'rgba(248,113,113,0.1)',
          color: isRunning ? '#A78BFA' : isComplete ? '#34D399' : '#F87171',
        }}
      >
        {isRunning ? 'running' : isComplete ? 'done' : 'error'}
      </span>
    </div>
  );
});
