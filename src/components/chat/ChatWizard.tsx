'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatPanel } from './ChatPanel';
import { ConversationSidebar } from './ConversationSidebar';
import { LivePreview } from './LivePreview';
import { getStoredWizardThreadId, useWizardChatStore } from '@/store/wizard-chat-store';

export function ChatWizard() {
  const { error, threadId, hydrateFromThread } = useWizardChatStore();
  const searchParams = useSearchParams();
  const tParam = searchParams.get('t');
  const forkParam = searchParams.get('forkPluginId');
  const isEmbed = searchParams.get('embed') === '1';

  const [mobilePanel, setMobilePanel] = useState<'chat' | 'preview'>('chat');

  useEffect(() => {
    if (forkParam) return;
    // If a specific thread is requested in the URL, load it
    if (tParam && threadId !== tParam) {
      void hydrateFromThread(tParam);
      return;
    }

    if (threadId) return;
    const storedThreadId = getStoredWizardThreadId();
    if (storedThreadId) {
      void hydrateFromThread(storedThreadId);
    }
  }, [hydrateFromThread, threadId, tParam, forkParam]);

  if (isEmbed) {
    return (
      <div className="h-screen w-full flex bg-[var(--background)]">
        <LivePreview />
      </div>
    );
  }

  return (
    <div className="studio-chat" data-mobile-panel={mobilePanel}>
      <header className="studio-chat-header">
        <h1>Creation studio</h1><span>Brief. Preview. Refine.</span>
        <div className="studio-chat-switch" aria-label="Workspace panel">
          <button aria-pressed={mobilePanel === 'chat'} onClick={() => setMobilePanel('chat')}>Conversation</button>
          <button aria-pressed={mobilePanel === 'preview'} onClick={() => setMobilePanel('preview')}>Preview</button>
        </div>
      </header>
      <div className="studio-chat-panes">
        <div className="studio-conversation"><ConversationSidebar /><div className="flex-1 min-w-0 overflow-hidden"><ChatPanel /></div></div>
        <div className="studio-preview"><LivePreview /></div>
      </div>
      {error && <div role="alert" className="studio-chat-error">{error}</div>}
    </div>
  );
}
