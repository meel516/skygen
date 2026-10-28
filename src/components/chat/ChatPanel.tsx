'use client';

import { useRef, useEffect, useCallback, useState, type KeyboardEvent } from 'react';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import { ChatMessage } from './ChatMessage';
import { SelectionChips } from './SelectionChips';
import { useToast } from '@/hooks/use-toast';
import {
  PaperPlaneTilt,
  MagicWand,
  ArrowCounterClockwise,
  CircleNotch,
  Image as ImageIcon,
  X,
  Stop,
} from '@phosphor-icons/react';

export function ChatPanel() {
  const { messages, isStreaming, sendMessage, stopStreaming, reset, generationStatus, setPendingPlugin, setForkPluginId } = useWizardChatStore();
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
    setForkPluginId(forkPluginId);
    setInput(nextPrompt);

    const cleanUrl = `${window.location.pathname}${window.location.hash || ''}`;
    // Keep the remix reference until a thread exists, so refreshing before the
    // first message cannot detach the draft from its saved source.
    window.history.replaceState({}, '', forkPluginId ? `${window.location.pathname}?forkPluginId=${encodeURIComponent(forkPluginId)}${window.location.hash || ''}` : cleanUrl);

    // If we have a forkPluginId, immediately fetch its source to hydrate the preview editor
    if (forkPluginId) {
      fetch(`/api/plugins/${forkPluginId}/source`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data && data.sceneCode && useWizardChatStore.getState().forkPluginId === forkPluginId && !useWizardChatStore.getState().threadId) {
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
  }, [reset, setPendingPlugin, setForkPluginId]);

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
    <div className="flex flex-col h-full bg-background dark:bg-[var(--background)] text-foreground dark:text-[var(--foreground)]">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b shrink-0 border-border dark:border-white/[0.06]"
      >
        <div className="flex items-center gap-3">
          <div>
            <div className="text-sm font-semibold text-foreground dark:text-[var(--foreground)]">
              Video Agent
            </div>
            <div className="text-[11px]" style={{ color: isStreaming ? 'var(--primary)' : 'var(--muted-foreground)' }}>
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
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-xs bg-card hover:bg-muted border border-border text-muted-foreground hover:text-foreground dark:bg-white/[0.04] dark:hover:bg-white/[0.08] dark:border-white/[0.07] dark:text-[var(--muted-foreground)] dark:hover:text-[var(--foreground)]"
          title="New session"
        >
          <ArrowCounterClockwise weight="bold" size={14} />
          New
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-5 min-h-0" style={{ scrollbarWidth: 'thin', scrollbarColor: 'var(--border) transparent' }}>
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
                className="h-16 w-16 rounded-sm object-cover"
                style={{ border: '1px solid color-mix(in srgb, var(--primary) 40%, transparent)' }}
              />
              {isUploading && (
                <div className="absolute inset-0 rounded-sm flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
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
            className="rounded-sm overflow-hidden"
            style={{
              background: 'var(--card)',
              border: `1px solid ${attachmentUrl ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'var(--border)'}`,
            }}
          >
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-label="Video brief"
              placeholder="Describe your video, or ask for a change…"
              rows={2}
              className="w-full bg-transparent text-sm resize-none outline-none placeholder-gray-600 px-4 pt-3 pb-2"
              style={{ color: 'var(--foreground)', maxHeight: 140 }}
            />
            <div className="flex items-center justify-between px-3 pb-2.5 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming || isUploading}
                  title="Attach reference image for plugin creation"
                  className="flex items-center justify-center w-7 h-7 rounded-sm disabled:opacity-30"
                  style={{
                    background: attachmentUrl ? 'color-mix(in srgb, var(--primary) 20%, transparent)' : 'var(--border)',
                    border: `1px solid ${attachmentUrl ? 'color-mix(in srgb, var(--primary) 40%, transparent)' : 'var(--border)'}`,
                    color: attachmentUrl ? 'var(--primary)' : 'var(--muted-foreground)',
                  }}
                >
                  <ImageIcon weight="bold" size={14} />
                </button>
                <button
                  onClick={handleEnhancePrompt}
                  disabled={isStreaming || isEnhancing || !input.trim()}
                  title="Refine brief" aria-label="Refine brief"
                  className="flex items-center justify-center w-7 h-7 rounded-sm disabled:opacity-30"
                  style={{
                    background: input.trim()
                      ? 'var(--studio-accent-wash)'
                      : 'var(--card)',
                    border: input.trim()
                      ? '1px solid color-mix(in srgb, var(--primary) 35%, transparent)'
                      : '1px solid var(--border)',
                    color: input.trim() ? 'var(--primary)' : 'var(--muted-foreground)',
                    boxShadow: 'none',
                  }}
                >
                  {isEnhancing ? (
                    <CircleNotch weight="bold" size={14} className="animate-spin text-[var(--primary)]" />
                  ) : (
                    <MagicWand weight="bold" size={14} />
                  )}
                </button>
                <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>
                  Shift+Enter for new line
                </span>
              </div>
              {isStreaming ? (
                <button
                  onClick={stopStreaming}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-xs font-semibold"
                  style={{
                    background: 'var(--primary)',
                    color: 'var(--primary-foreground)',
                    boxShadow: 'none',
                  }}
                  title="Stop the agent. The video keeps whatever was already generated."
                >
                  <Stop weight="fill" size={14} />Stop
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="flex items-center gap-2 px-4 py-1.5 rounded-sm text-xs font-semibold disabled:opacity-30"
                  style={{
                    background: input.trim()
                      ? 'var(--primary)'
                      : 'var(--border)',
                    color: input.trim() ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
                    boxShadow: 'none',
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
  const starters = [
    { title: 'Introduce a product', detail: 'A clear story with features, numbers, and a call to action.', prompt: 'Create a product demo video for a SaaS analytics dashboard. Show key features with stats and charts.' },
    { title: 'Tell a short story', detail: 'A narrated reel with a strong opening and a thoughtful ending.', prompt: 'Create a short motivational video about never giving up. Choose a story arc, visual style, and voice.' },
    { title: 'Visualize an idea', detail: 'An editable motion graphic built around your subject.', prompt: 'Create an editable motion graphic that explains a complex idea with clear typography and animated data.' },
  ];
  return <div className="chat-welcome">
    <span className="studio-eyebrow">A new conversation</span>
    <h2>What's the story?</h2>
    <p>Describe the video you have in mind. Add a reference, choose a direction, and refine it as you go.</p>
    {starters.map((item, index) => <button className="chat-starter" key={item.title} onClick={() => onQuickAction(item.prompt)}><span>0{index + 1}</span><span><strong>{item.title}</strong><small>{item.detail}</small></span></button>)}
  </div>;
}
