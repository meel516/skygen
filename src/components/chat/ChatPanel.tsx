'use client';

import { useRef, useEffect, useCallback, useState, type KeyboardEvent } from 'react';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import { ChatMessage } from './ChatMessage';
import { SelectionChips } from './SelectionChips';
import { useToast } from '@/hooks/use-toast';
import {
  PaperPlaneTilt,
  Sparkle,
  MagicWand,
  ArrowCounterClockwise,
  CircleNotch,
  FilmSlate,
  ChartBar,
  CubeFocus,
  Image as ImageIcon,
  X,
  Stop,
} from '@phosphor-icons/react';

export function ChatPanel() {
  const { messages, isStreaming, sendMessage, stopStreaming, reset, generationStatus, setPendingPlugin } = useWizardChatStore();
  const [input, setInput] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState<string | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefilledPromptRef = useRef<string | null>(null);
  const { toast } = useToast();
  const [isEnhancing, setIsEnhancing] = useState(false);

  const handleEnhancePrompt = useCallback(async () => {
    const text = input.trim();
    if (!text || isEnhancing) return;
    setIsEnhancing(true);
    try {
      const res = await fetch('/api/ai/enhance-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text }),
      });
      const data = await res.json();
      if (res.ok && data.enhancedPrompt) {
        setInput(data.enhancedPrompt);
      } else {
        toast({
          title: 'Enhancement failed',
          description: data.error || 'Failed to enhance prompt.',
          variant: 'destructive',
        });
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsEnhancing(false);
    }
  }, [input, isEnhancing, toast]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 140) + 'px';
    }
  }, [input]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const rawPrompt = params.get('prompt');
    const pluginId = params.get('pluginId');
    const forkPluginId = params.get('forkPluginId');
    const blockType = params.get('blockType');
    const templateId = params.get('templateId');
    const pluginName = params.get('pluginName');
    const blockName = params.get('blockName');
    const templateName = params.get('templateName');

    const nextPrompt =
      rawPrompt ||
      (forkPluginId
        ? `I want to modify the source code of this plugin (forkPluginId: ${forkPluginId}). Please make changes to it.`
        : pluginId
          ? `Create a video using the custom plugin "${pluginName || pluginId}" (pluginId: ${pluginId}). Make it polished and adapt the content to my topic.`
          : blockType
            ? `Create a video using the "${blockName || blockType}" block (blockType: ${blockType}). Use it as an important scene in the video.`
            : templateId
              ? `Create a video from the template "${templateName || templateId}" (templateId: ${templateId}).`
              : '');

    if (!nextPrompt || prefilledPromptRef.current === nextPrompt) return;
    prefilledPromptRef.current = nextPrompt;
    reset();
    setInput(nextPrompt);

    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    window.history.replaceState({}, '', cleanUrl);

    // If we have a forkPluginId, immediately fetch its source to hydrate the preview editor
    if (forkPluginId) {
      fetch(`/api/plugins/${forkPluginId}/source`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.sceneCode) {
            setPendingPlugin({
              pluginId: data.pluginId,
              pluginName: data.pluginName,
              sceneCode: data.sceneCode,
              modules: data.modules,
              schemaJson: data.schemaJson,
              dependencies: data.dependencies,
            });
          }
        })
        .catch((err) => console.error('Failed to load fork source:', err));
    }
  }, [reset, setPendingPlugin]);

  const handleImagePick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachmentPreview(URL.createObjectURL(file));
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/image/upload-s3', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setAttachmentUrl(data.url);
    } catch {
      setAttachmentPreview(null);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveAttachment = useCallback(() => {
    setAttachmentUrl(null);
    setAttachmentPreview(null);
  }, []);

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput('');
    const url = attachmentUrl ?? undefined;
    setAttachmentUrl(null);
    setAttachmentPreview(null);
    sendMessage(text, url);
  }, [input, isStreaming, sendMessage, attachmentUrl]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  const handleQuickAction = useCallback(
    (action: string) => { sendMessage(action); },
    [sendMessage],
  );

  const hasMessages = messages.length > 0;
  const isGenerating = generationStatus === 'running';

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0A0A0F] text-slate-900 dark:text-[#F1F1F8] transition-colors">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b shrink-0 border-slate-200 dark:border-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}
          >
            <Sparkle weight="fill" size={16} className="text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-slate-900 dark:text-[#F1F1F8]">
              Video Agent
            </div>
            <div className="text-[11px]" style={{ color: isStreaming ? '#A78BFA' : '#55556A' }}>
              {isGenerating
                ? 'Generating your video…'
                : isStreaming
                ? 'Thinking…'
                : 'Ready'}
            </div>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-900 dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.07] dark:text-[#55556A] dark:hover:text-[#F1F1F8]"
          title="New session"
        >
          <ArrowCounterClockwise weight="bold" size={14} />
          New
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.07) transparent' }}>
        {!hasMessages && <WelcomeScreen onQuickAction={handleQuickAction} />}
        {hasMessages && (
          <>
            {messages.map(msg => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Bottom: config + composer */}
      <div className="shrink-0">
        {/* Collapsible config panel (template / voice / style) */}
        <SelectionChips />

        {/* Composer */}
        <div className="px-4 py-3">
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />

          {/* Attachment thumbnail */}
          {attachmentPreview && (
            <div className="mb-2 relative inline-flex">
              <img
                src={attachmentPreview}
                alt="attachment"
                className="h-16 w-16 rounded-lg object-cover"
                style={{ border: '1px solid rgba(124,58,237,0.4)' }}
              />
              {isUploading && (
                <div className="absolute inset-0 rounded-lg flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                  <CircleNotch weight="bold" size={16} className="animate-spin text-white" />
                </div>
              )}
              {!isUploading && (
                <button
                  onClick={handleRemoveAttachment}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: '#EF4444' }}
                >
                  <X weight="bold" size={9} className="text-white" />
                </button>
              )}
            </div>
          )}

          <div
            className="rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${attachmentUrl ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.09)'}`,
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describe your video, or ask the agent to change anything…"
              rows={2}
              className="w-full bg-transparent text-sm resize-none outline-none placeholder-gray-600 px-4 pt-3 pb-2"
              style={{ color: '#F1F1F8', maxHeight: 140 }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || isUploading}
                  title="Attach reference image for plugin creation"
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-colors disabled:opacity-30"
                  style={{
                    background: attachmentUrl ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${attachmentUrl ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.08)'}`,
                    color: attachmentUrl ? '#A78BFA' : '#55556A',
                  }}
                >
                  <ImageIcon weight="bold" size={14} />
                </button>
                <button
                  onClick={handleEnhancePrompt}
                  disabled={isStreaming || isEnhancing || !input.trim()}
                  title="Magic Enhance Prompt"
                  className="flex items-center justify-center w-7 h-7 rounded-lg transition-all disabled:opacity-30"
                  style={{
                    background: input.trim()
                      ? 'linear-gradient(135deg, rgba(14,165,233,0.15), rgba(124,58,237,0.15))'
                      : 'rgba(255,255,255,0.05)',
                    border: input.trim()
                      ? '1px solid rgba(124,58,237,0.35)'
                      : '1px solid rgba(255,255,255,0.08)',
                    color: input.trim() ? '#A78BFA' : '#55556A',
                    boxShadow: input.trim()
                      ? '0 0 8px rgba(124,58,237,0.15)'
                      : 'none',
                  }}
                >
                  {isEnhancing ? (
                    <CircleNotch weight="bold" size={14} className="animate-spin text-[#A78BFA]" />
                  ) : (
                    <MagicWand weight="bold" size={14} />
                  )}
                </button>
                <span className="text-[11px]" style={{ color: '#3A3A50' }}>
                  Shift+Enter for new line
                </span>
              </div>
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: 'linear-gradient(135deg, #DC2626, #B91C1C)',
                    color: '#fff',
                    boxShadow: '0 0 16px rgba(220,38,38,0.35)',
                  }}
                  title="Stop the agent. The video keeps whatever was already generated."
                >
                  <Stop weight="fill" size={14} />Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all disabled:opacity-30"
                  style={{
                    background: input.trim()
                      ? 'linear-gradient(135deg, #7C3AED, #6D28D9)'
                      : 'rgba(255,255,255,0.06)',
                    color: input.trim() ? '#fff' : '#55556A',
                    boxShadow: input.trim() ? '0 0 16px rgba(124,58,237,0.35)' : 'none',
                  }}
                >
                  <PaperPlaneTilt weight="fill" size={14} />Generate
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Welcome screen ────────────────────────────────────────────────────────

function WelcomeScreen({ onQuickAction }: { onQuickAction: (s: string) => void }) {
  return (
    <div className="flex flex-col h-full justify-center py-6 px-2">
      {/* Hero */}
      <div className="text-center mb-8">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.25), rgba(14,165,233,0.18))',
            border: '1px solid rgba(124,58,237,0.25)',
          }}
        >
          <Sparkle weight="duotone" size={28} style={{ color: '#A78BFA' }} />
        </div>
        <h2 className="text-lg font-bold mb-1.5" style={{ color: '#F1F1F8' }}>
          What should we create?
        </h2>
        <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: '#6B6B8A' }}>
          Describe your idea. The agent picks the story arc, visual style, narration, and images automatically.
        </p>
      </div>

      {/* Quick-start cards */}
      <div className="flex flex-col gap-2.5">
        <QuickCard
          icon={<FilmSlate weight="duotone" size={16} />}
          title="Motivational reel"
          description="Never give up — cinematic style, dramatic arc"
          color="violet"
          onClick={() => onQuickAction(
            'Create a short motivational video about never giving up. Choose everything for me — arc, style, voice. Just make it awesome!'
          )}
        />
        <QuickCard
          icon={<ChartBar weight="duotone" size={16} />}
          title="Product demo"
          description="SaaS dashboard with stats, charts & CTA"
          color="cyan"
          onClick={() => onQuickAction(
            'Create a product demo video for a SaaS analytics dashboard. Show key features with stats and charts.'
          )}
        />
        <QuickCard
          icon={<CubeFocus weight="duotone" size={16} />}
          title="Custom 3D block"
          description="Globe visualization plugin with live data"
          color="orange"
          onClick={() => onQuickAction(
            'I need a custom 3D globe visualization block showing global revenue data points. Can you create that as a plugin and include it in a business video?'
          )}
        />
      </div>

      <p className="text-center text-[11px] mt-6" style={{ color: '#3A3A50' }}>
        Or just type anything — the agent will figure it out
      </p>
    </div>
  );
}

function QuickCard({
  icon, title, description, color, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  color: 'violet' | 'cyan' | 'orange';
  onClick: () => void;
}) {
  const palette = {
    violet: { bg: 'rgba(124,58,237,0.08)', border: 'rgba(124,58,237,0.18)', hoverBorder: 'rgba(124,58,237,0.4)', icon: '#A78BFA' },
    cyan:   { bg: 'rgba(6,182,212,0.07)',  border: 'rgba(6,182,212,0.18)',  hoverBorder: 'rgba(6,182,212,0.4)',  icon: '#67E8F9' },
    orange: { bg: 'rgba(251,146,60,0.07)', border: 'rgba(251,146,60,0.18)', hoverBorder: 'rgba(251,146,60,0.4)', icon: '#FDB97D' },
  }[color];

  return (
    <button
      onClick={onClick}
      className="flex items-start gap-3 px-4 py-3 rounded-xl text-left transition-all group w-full"
      style={{ background: palette.bg, border: `1px solid ${palette.border}` }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = palette.hoverBorder; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = palette.border; }}
    >
      <div className="mt-0.5 shrink-0" style={{ color: palette.icon }}>{icon}</div>
      <div>
        <div className="text-sm font-medium mb-0.5" style={{ color: '#E2E2F0' }}>{title}</div>
        <div className="text-xs" style={{ color: '#6B6B8A' }}>{description}</div>
      </div>
    </button>
  );
}
