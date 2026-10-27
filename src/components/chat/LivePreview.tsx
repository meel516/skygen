'use client';

import { useMemo, useCallback, useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Player } from '@remotion/player';
import { DynamicVideo, getCompositionConfig } from '@/lib/video/compositions/DynamicVideo';
import { COMPONENT_IDS } from '@/lib/video/schemas';
import { useWizardChatStore } from '@/store/wizard-chat-store';
import { PluginPreview } from './PluginPreview';
import { useEditorStore } from '@/store/editor-store';
import {
  Play,
  Monitor,
  DeviceMobile,
  Square,
  CircleNotch,
  ArrowSquareOut,
  VideoCamera,
  CheckCircle,
} from '@phosphor-icons/react';

// ─── Block type → component ID mapping ─────────────────────────────────────

const TYPE_TO_ID: Record<string, string> = {
  'stat': COMPONENT_IDS.STAT, 'comparison': COMPONENT_IDS.COMPARISON,
  'text': COMPONENT_IDS.TEXT, 'image': COMPONENT_IDS.IMAGE,
  'quote': COMPONENT_IDS.QUOTE, 'list': COMPONENT_IDS.LIST,
  'timeline': COMPONENT_IDS.TIMELINE, 'callout': COMPONENT_IDS.CALLOUT,
  'icon-list': COMPONENT_IDS.ICON_LIST, 'line-chart': COMPONENT_IDS.LINE_CHART,
  'pie-chart': COMPONENT_IDS.PIE_CHART, 'code': COMPONENT_IDS.CODE,
  'testimonial': COMPONENT_IDS.TESTIMONIAL, 'whatsapp-chat': COMPONENT_IDS.WHATSAPP_CHAT,
  'motivational-image': COMPONENT_IDS.MOTIVATIONAL_IMAGE,
  'counter': COMPONENT_IDS.COUNTER, 'progress-bar': COMPONENT_IDS.PROGRESS_BAR,
  'qr-code': COMPONENT_IDS.QR_CODE, 'video': COMPONENT_IDS.VIDEO,
  'avatar-grid': COMPONENT_IDS.AVATAR_GRID, 'social-stats': COMPONENT_IDS.SOCIAL_STATS,
  'cta': COMPONENT_IDS.CTA, 'gradient-text': COMPONENT_IDS.GRADIENT_TEXT,
  'animated-bg': COMPONENT_IDS.ANIMATED_BG, 'countdown': COMPONENT_IDS.COUNTDOWN,
  'weather-block': COMPONENT_IDS.WEATHER, 'tower-chart-3d': COMPONENT_IDS.TOWER_CHART_3D,
  'bar-race-3d': COMPONENT_IDS.BAR_RACE_3D, 'parallax-story': COMPONENT_IDS.PARALLAX_STORY,
  'top-players': COMPONENT_IDS.TOP_PLAYERS,
};

function getDefaultDuration(type: string): number {
  const d: Record<string, number> = {
    'parallax-story': 6, 'video': 5, 'timeline': 5,
    'line-chart': 5, 'pie-chart': 4, 'tower-chart-3d': 6, 'bar-race-3d': 6,
    'top-players': 15,
  };
  return d[type] || 4;
}

function buildPlan(contentBlocks: Array<{ type: string; duration?: number }>) {
  const decisions = contentBlocks.map((b) => {
    const duration = b.duration || getDefaultDuration(b.type);
    return {
      componentId: TYPE_TO_ID[b.type] || COMPONENT_IDS.TEXT,
      motionProfile: 'dynamic' as const,
      duration,
      animation: { enter: 0.4, hold: duration - 0.6, exit: 0.2 },
    };
  });
  return {
    decisions,
    totalDuration: decisions.reduce((s, d) => s + d.duration, 0),
    suggestedTransitions: decisions.map(() => 'fade' as const),
  };
}

function getPreviewDims(ratio: string) {
  switch (ratio) {
    case '9:16': return { width: 270, height: 480 };
    case '16:9': return { width: 480, height: 270 };
    case '1:1': return { width: 360, height: 360 };
    case '4:5': return { width: 360, height: 450 };
    default: return { width: 270, height: 480 };
  }
}

/** Aspect ratio string → numeric width/height ratio */
const RATIO_MAP: Record<string, number> = {
  '9:16': 9 / 16,
  '16:9': 16 / 9,
  '1:1': 1,
  '4:5': 4 / 5,
};

// ─── LivePreview Component ─────────────────────────────────────────────────

export function LivePreview() {
  const router = useRouter();
  const { videoInput, generationStatus, videoId, previewVersion, currentGeneratingBlock, pendingPlugin } = useWizardChatStore();
  const setEditorInput = useEditorStore((s) => s.setVideoInput);

  // ── Container measurement for responsive preview ──
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Seed immediately so first render uses real dims, not fallback
    const { width, height } = el.getBoundingClientRect();
    if (width > 0 && height > 0) {
      setContainerSize({ width: Math.floor(width), height: Math.floor(height) });
    }
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerSize({ width: Math.floor(width), height: Math.floor(height) });
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Filter out skeleton blocks (planned but not yet generated) when building
  // the Remotion composition — the Player can't render placeholders.
  const filledBlocks = useMemo(
    () => (videoInput?.contentBlocks ?? []).filter((b: any) => !b?._skeleton),
    [videoInput],
  );

  const totalBlocks = videoInput?.contentBlocks?.length ?? 0;
  const filledCount = filledBlocks.length;
  const skeletonCount = totalBlocks - filledCount;

  const previewPlan = useMemo(() => {
    if (!filledBlocks.length) return null;
    return buildPlan(filledBlocks);
  }, [filledBlocks]);

  const previewConfig = useMemo(() => {
    if (!videoInput || !previewPlan) return null;
    const filteredInput = { ...videoInput, contentBlocks: filledBlocks };
    return getCompositionConfig(filteredInput as any, previewPlan);
  }, [videoInput, previewPlan, filledBlocks]);

  const aspectRatio = videoInput?.videoMeta?.aspectRatio ?? '9:16';
  const dims = useMemo(() => {
    const { width: cw, height: ch } = containerSize;
    if (cw === 0 || ch === 0) return getPreviewDims(aspectRatio);
    const ratio = RATIO_MAP[aspectRatio] ?? 9 / 16;
    // p-4 = 16px each side → 32px total per axis
    const maxW = cw - 32;
    const maxH = ch - 32;
    let width = maxW;
    let height = width / ratio;
    if (height > maxH) {
      height = maxH;
      width = height * ratio;
    }
    return { width: Math.max(Math.floor(width), 180), height: Math.max(Math.floor(height), 180) };
  }, [containerSize, aspectRatio]);

  const handleOpenInEditor = useCallback(() => {
    if (videoInput) {
      setEditorInput(videoInput);
      if (videoId) {
        router.push(`/editor?videoId=${videoId}`);
      } else {
        router.push('/editor');
      }
    }
  }, [videoInput, setEditorInput, router, videoId]);

  const isGenerating = generationStatus === 'running';
  const hasAnyBlocks = totalBlocks > 0;
  const hasFilledBlock = filledCount > 0;
  const isIdle = generationStatus === 'idle';
  const onlySkeletons = hasAnyBlocks && !hasFilledBlock;

  const isPreviewValid = previewConfig && !isNaN(previewConfig.durationInFrames) && previewConfig.durationInFrames > 0;

  return (
    <div className="relative flex flex-col h-full w-full min-w-0 bg-slate-100 dark:bg-[#0D0D14] transition-colors">
      {/* Plugin preview overlay — shown when agent has generated code pending approval */}
      {pendingPlugin && (
        <div className="absolute inset-0 z-20 flex flex-col bg-white dark:bg-[#0A0A0F] transition-colors">
          <PluginPreview />
        </div>
      )}
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 border-b shrink-0 border-slate-200 dark:border-white/[0.06] transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <VideoCamera weight="duotone" size={16} className="text-slate-400 dark:text-[#55556A]" />
          <span className="text-sm font-semibold text-slate-800 dark:text-[#C4C4D8]">
            Live Preview
          </span>
          {isGenerating && (
            <span
              className="flex items-center gap-1.5 text-xs px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)', color: '#A78BFA' }}
            >
              <CircleNotch weight="bold" size={12} className="animate-spin" />
              Generating
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {hasAnyBlocks && (
            <div className="flex gap-1">
              <RatioChip icon={<DeviceMobile weight="duotone" size={12} />} active={aspectRatio === '9:16'} label="9:16" />
              <RatioChip icon={<Monitor weight="duotone" size={12} />} active={aspectRatio === '16:9'} label="16:9" />
              <RatioChip icon={<Square weight="duotone" size={12} />} active={aspectRatio === '1:1'} label="1:1" />
            </div>
          )}
        </div>
      </div>

      {/* Main area — flex column: player fills remaining height, button pinned below */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0 relative">
        {/* Player region — containerRef measures only this, so dims fills it exactly */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-4 min-h-0 min-w-0 relative">
          {isIdle && !hasAnyBlocks && <IdlePlaceholder />}
          {isGenerating && !hasAnyBlocks && <GeneratingState />}
          {onlySkeletons && <SkeletonGrid count={totalBlocks} aspectRatio={aspectRatio} currentBlock={currentGeneratingBlock} />}
          {hasFilledBlock && isPreviewValid && previewPlan && (
            <div
              className="rounded-2xl overflow-hidden"
              style={{
                boxShadow: '0 0 60px rgba(124,58,237,0.18)',
                border: '1px solid rgba(124,58,237,0.2)',
                width: dims.width,
                height: dims.height,
              }}
            >
              <Player
                key={`${previewVersion}-${dims.width}x${dims.height}`}
                component={DynamicVideo}
                inputProps={{ input: { ...videoInput, contentBlocks: filledBlocks }, plan: previewPlan } as any}
                durationInFrames={previewConfig.durationInFrames}
                compositionWidth={previewConfig.width}
                compositionHeight={previewConfig.height}
                fps={previewConfig.fps}
                style={{ width: '100%', height: '100%' }}
                controls
                loop
              />
            </div>
          )}
        </div>

        {/* Open in Editor — pinned below player, doesn't affect dims calculation */}
        {hasFilledBlock && !isGenerating && (
          <div className="shrink-0 flex justify-center pb-5">
            <button
              onClick={handleOpenInEditor}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                boxShadow: '0 0 24px rgba(124,58,237,0.35)',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 32px rgba(124,58,237,0.5)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 24px rgba(124,58,237,0.35)'; }}
            >
              <ArrowSquareOut weight="bold" size={16} />
              Open in Editor
            </button>
          </div>
        )}

        {/* Block progress badge — floating overlay bottom-right */}
        {hasAnyBlocks && (
          <div
            className="absolute bottom-5 right-5 flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium"
            style={{
              background: 'rgba(10,10,15,0.85)',
              backdropFilter: 'blur(12px)',
              border: isGenerating ? '1px solid rgba(124,58,237,0.35)' : '1px solid rgba(255,255,255,0.08)',
              color: isGenerating ? '#A78BFA' : '#34D399',
              boxShadow: isGenerating ? '0 0 12px rgba(124,58,237,0.2)' : 'none',
            }}
          >
            {isGenerating ? (
              <CircleNotch weight="bold" size={12} className="animate-spin shrink-0" />
            ) : (
              <CheckCircle weight="fill" size={12} className="shrink-0" />
            )}
            Blocks · {filledCount}/{totalBlocks}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function IdlePlaceholder() {
  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated gradient circle */}
      <div
        className="w-32 h-32 rounded-full mb-6 flex items-center justify-center"
        style={{
          background: 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
        }}
      >
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(14,165,233,0.1))',
            border: '1px solid rgba(124,58,237,0.15)',
          }}
        >
          <Play weight="duotone" size={32} style={{ color: '#55556A' }} />
        </div>
      </div>
      <p className="text-sm text-slate-500 dark:text-[#55556A]">
        Your video preview will appear here
      </p>
      <p className="text-xs mt-1 text-slate-400 dark:text-[#3A3A50]">
        Start by describing what you want to create
      </p>
    </div>
  );
}

function GeneratingState() {
  return (
    <div className="flex flex-col items-center text-center">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
        style={{
          background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(14,165,233,0.15))',
          border: '1px solid rgba(124,58,237,0.3)',
        }}
      >
        <CircleNotch weight="bold" size={32} className="animate-spin" style={{ color: '#A78BFA' }} />
      </div>
      <p className="text-sm font-medium" style={{ color: '#A78BFA' }}>
        Generating your video...
      </p>
      <div className="mt-3 space-y-1">
        <ProgressPhase label="Planning narrative" />
        <ProgressPhase label="Generating images" />
        <ProgressPhase label="Recording audio" />
        <ProgressPhase label="Rendering preview" />
      </div>
    </div>
  );
}

function ProgressPhase({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: 'rgba(124,58,237,0.5)' }}
      />
      <span className="text-xs" style={{ color: '#55556A' }}>{label}</span>
    </div>
  );
}

function SkeletonGrid({ count, aspectRatio, currentBlock }: { count: number; aspectRatio: string; currentBlock: number }) {
  const dims = getPreviewDims(aspectRatio);
  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="rounded-2xl p-4"
        style={{
          border: '1px solid rgba(124,58,237,0.2)',
          boxShadow: '0 0 40px rgba(124,58,237,0.15)',
          background: 'rgba(20,20,30,0.4)',
          width: dims.width,
          height: dims.height,
        }}
      >
        <div className="flex flex-col gap-2 h-full">
          {Array.from({ length: Math.min(count, 6) }).map((_, i) => (
            <div
              key={i}
              className="flex-1 rounded-lg animate-pulse"
              style={{
                background: 'linear-gradient(90deg, rgba(124,58,237,0.08), rgba(14,165,233,0.12), rgba(124,58,237,0.08))',
                backgroundSize: '200% 100%',
                animationDelay: `${i * 120}ms`,
              }}
            />
          ))}
        </div>
      </div>
      <div
        className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs"
        style={{
          background: 'rgba(124,58,237,0.15)',
          border: '1px solid rgba(124,58,237,0.25)',
          color: '#A78BFA',
        }}
      >
        <CircleNotch weight="bold" size={12} className="animate-spin" />
        Generating block {currentBlock + 1} of {count}
      </div>
    </div>
  );
}

function RatioChip({ icon, active, label }: { icon: React.ReactNode; active: boolean; label: string }) {
  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
      style={{
        color: active ? '#C4B5FD' : '#3A3A50',
        background: active ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
        border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.05)',
      }}
    >
      {icon}
      <span className="text-[10px] font-medium">{label}</span>
    </div>
  );
}
