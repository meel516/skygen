'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChatPanel } from './ChatPanel';
import { ConversationSidebar } from './ConversationSidebar';
import { LivePreview } from './LivePreview';
import { getStoredWizardThreadId, useWizardChatStore } from '@/store/wizard-chat-store';
import { Sparkle, VideoCamera } from '@phosphor-icons/react';
import { useSiteConfig } from '@/lib/use-site-config';

export function ChatWizard() {
  const { error, threadId, hydrateFromThread } = useWizardChatStore();
  const searchParams = useSearchParams();
  const tParam = searchParams.get('t');
  
  const { config } = useSiteConfig();
  const branding = config.branding || {};
  const appName = branding.appName || 'SKYGEN';
  const logoUrl = branding.logoUrl;

  useEffect(() => {
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
  }, [hydrateFromThread, threadId, tParam]);

  return (
    <div
      className="h-screen flex flex-col"
      style={{ background: '#0A0A0F', color: '#F1F1F8' }}
    >
      {/* Top bar */}
      <nav
        className="flex items-center justify-between px-4 py-2.5 border-b flex-shrink-0"
        style={{
          background: 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="w-6 h-6 object-contain" />
          ) : (
            <div
              className="w-6 h-6 rounded-md flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}
            >
              <VideoCamera weight="fill" size={14} className="text-white" />
            </div>
          )}
          <span className="text-sm font-bold tracking-tight" style={{ color: '#F1F1F8' }}>
            {appName}
          </span>
          <span
            className="text-[10px] font-medium px-2 py-0.5 rounded-full ml-2"
            style={{
              background: 'rgba(124,58,237,0.12)',
              border: '1px solid rgba(124,58,237,0.25)',
              color: '#A78BFA',
            }}
          >
            <Sparkle weight="fill" size={10} className="inline mr-1" />
            AI Wizard
          </span>
        </div>
      </nav>

      {/* Main content: preview is the hero, chat is the steering panel.
          On narrow viewports (<900px), shrink chat aggressively so preview gets real estate. */}
      <div className="flex-1 flex min-h-0 w-full">
        {/* Chat panel (left — narrower steering panel) */}
        <div
          className="border-r flex-shrink-0 min-w-0 overflow-hidden flex"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            // Wide enough for the desktop conversation rail plus chat, while
            // still collapsing to a usable single chat panel on smaller screens.
            width: 'clamp(320px, 48%, 760px)',
          }}
        >
          <ConversationSidebar />
          <div className="flex-1 min-w-0 overflow-hidden">
            <ChatPanel />
          </div>
        </div>

        {/* Preview panel (right — primary artifact surface) */}
        <div className="flex-1 min-w-0 flex">
          <LivePreview />
        </div>
      </div>

      {/* Error toast */}
      {error && (
        <div
          className="fixed bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 rounded-lg text-sm z-50"
          style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5',
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
