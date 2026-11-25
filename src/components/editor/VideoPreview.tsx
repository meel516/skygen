'use client';

import { useEditorStore } from '@/store/editor-store';
import { Loader2, Video, Maximize2, ChevronDown, X } from '@/components/ui/studio-icons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { DynamicVideo, getCompositionConfig } from '@/lib/video/compositions/DynamicVideo';
import { type VideoPlan, type AIDecision, COMPONENT_IDS } from '@/lib/video/schemas';
import { motion, AnimatePresence } from 'framer-motion';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useClientRender, type ClientRenderFormat } from '@/hooks/useClientRender';
import { VideoDownloadMenu } from '@/components/ui/video-download-menu';
import { EditorOverlay } from './EditorOverlay';


function generatePlanFromBlocks(videoInput: { contentBlocks: Array<{ type: string; duration?: number }> }): VideoPlan {
  const typeToComponentId: Record<string, string> = {
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
    'pricing-table': COMPONENT_IDS.PRICING_TABLE, 'logo-wall': COMPONENT_IDS.LOGO_WALL,
    'process-steps': COMPONENT_IDS.PROCESS_STEPS,
    'html': COMPONENT_IDS.HTML,
    'diagram': COMPONENT_IDS.DIAGRAM,
    'top-players': COMPONENT_IDS.TOP_PLAYERS,
    'custom-plugin': 'custom-plugin',
  };
  const decisions: AIDecision[] = videoInput.contentBlocks.map((block) => {
    const duration = block.duration || getDefaultDuration(block.type);
    return {
      componentId: typeToComponentId[block.type] || COMPONENT_IDS.TEXT,
      motionProfile: 'dynamic' as const,
      duration,
      animation: { enter: 0.4, hold: duration - 0.6, exit: 0.2 },
    };
  });
  return {
    decisions,
    totalDuration: decisions.reduce((sum, d) => sum + d.duration, 0),
    suggestedTransitions: decisions.map(() => 'fade' as const),
  };
}

function getDefaultDuration(type: string): number {
  const durations: Record<string, number> = {
    'stat': 3, 'comparison': 4, 'text': 3, 'image': 4, 'quote': 4, 'list': 5,
    'timeline': 6, 'callout': 3, 'icon-list': 5, 'line-chart': 5, 'pie-chart': 5,
    'code': 6, 'testimonial': 5, 'whatsapp-chat': 8, 'motivational-image': 6,
    'counter': 4, 'progress-bar': 3, 'qr-code': 4, 'video': 5,
    'avatar-grid': 5, 'social-stats': 4, 'cta': 3, 'gradient-text': 4,
    'animated-bg': 5, 'countdown': 4, 'weather-block': 4,
    'tower-chart-3d': 20, 'bar-race-3d': 15, 'parallax-story': 10,
    'pricing-table': 6, 'logo-wall': 5, 'process-steps': 5,
    'html': 5, 'diagram': 6, 'top-players': 15, 'custom-plugin': 4,
  };
  return durations[type] || 4;
}

const ASPECT_RATIOS = ['9:16', '16:9', '1:1', '4:5'];

function getPreviewDimensions(ratio: string) {
  switch (ratio) {
    case '9:16': return { width: 270, height: 480 };
    case '16:9': return { width: 480, height: 270 };
    case '1:1': return { width: 360, height: 360 };
    case '4:5': return { width: 360, height: 450 };
    default: return { width: 270, height: 480 };
  }
}

export function VideoPreview() {
  const { videoInput, updateVideoMeta } = useEditorStore();
  const playerRef = useRef<PlayerRef>(null);
  const playerWrapRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(document.fullscreenElement === playerWrapRef.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);
  const { status: clientRenderStatus, progress: clientProgress, error: clientError, startRender, cancel: cancelRender, reset: resetClientRender } = useClientRender();
  const isClientRendering = clientRenderStatus === 'rendering';

  const plan = useMemo(() => generatePlanFromBlocks(videoInput), [videoInput]);
  const config = useMemo(() => {
    if (videoInput.contentBlocks.length === 0) return null;
    return getCompositionConfig(videoInput, plan);
  }, [videoInput, plan]);

  const previewDims = getPreviewDimensions(videoInput.videoMeta.aspectRatio);

  const handleClientRender = (format: ClientRenderFormat) => {
    if (!config || videoInput.contentBlocks.length === 0) return;
    startRender({
      component: DynamicVideo,
      inputProps: { input: videoInput, plan } as Record<string, unknown>,
      durationInFrames: config.durationInFrames,
      fps: config.fps,
      width: config.width,
      height: config.height,
      format,
    });
  };

  const handleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
      return;
    }
    // Use the wrap div (not the Player) so the EditorOverlay stays on top
    // when entering fullscreen. The Player fills the wrap, and the overlay
    // is its sibling — both go fullscreen together.
    playerWrapRef.current?.requestFullscreen?.();
  };

  return (
    <div
      className="h-full w-full flex items-center justify-center relative overflow-hidden min-h-0 group"
      style={{
        background: undefined,
        backgroundImage: 'none',
        backgroundSize: '20px 20px',
      }}
    >
      <AnimatePresence mode="wait">
        {videoInput.contentBlocks.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            className="text-center relative z-10 flex flex-col items-center"
          >
            <div
              className="w-20 h-20 rounded-sm flex items-center justify-center mx-auto mb-5 shadow-none bg-muted dark:bg-[var(--muted)] border border-border dark:border-white/[0.07]"

            >
              <Video className="w-9 h-9 text-muted-foreground dark:text-[var(--muted-foreground)]"  />
            </div>
            <h3 className="text-[15px] font-semibold mb-1.5 text-foreground dark:text-[var(--foreground)]">Canvas is empty</h3>
            <p className="text-[12px] max-w-[200px] leading-relaxed text-muted-foreground dark:text-[var(--muted-foreground)]" >
              Add blocks from the library panel to begin
            </p>
          </motion.div>
        ) : config ? (
          <motion.div
            key="player"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative z-10"
          >
            {/* Clean canvas */}
            <div className="relative rounded-sm overflow-hidden shadow-none">
              <div
                ref={playerWrapRef}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 0,
                  overflow: 'hidden',
                  position: 'relative',
                  width: isFullscreen ? '100vw' : previewDims.width,
                  height: isFullscreen ? '100vh' : previewDims.height,
                  background: '#000',
                  display: isFullscreen ? 'flex' : 'block',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Player
                  ref={playerRef}
                  component={DynamicVideo}
                  inputProps={{ input: videoInput, plan }}
                  durationInFrames={config.durationInFrames}
                  compositionWidth={config.width}
                  compositionHeight={config.height}
                  fps={config.fps}
                  style={
                    isFullscreen
                      ? {
                          // Letterboxed fit so the composition stays at its aspect ratio
                          aspectRatio: `${config.width} / ${config.height}`,
                          maxWidth: '100vw',
                          maxHeight: '100vh',
                          height: '100vh',
                        }
                      : { width: previewDims.width, height: previewDims.height }
                  }
                  controls
                  loop
                  autoPlay
                />
                <EditorOverlay
                  playerWrapRef={playerWrapRef}
                  compositionWidth={config.width}
                  compositionHeight={config.height}
                />
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Floating overlay — bottom-left: aspect ratio */}
      <div className="absolute bottom-4 left-4 z-20">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px]"
              style={{
                background: 'var(--popover)',
                backdropFilter: 'none',
                border: '1px solid var(--border)',
                color: 'var(--muted-foreground)',
              }}


            >
              {videoInput.videoMeta.aspectRatio}
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            style={{ background: 'var(--muted)', borderColor: 'var(--border)', color: 'var(--foreground)' }}
          >
            {ASPECT_RATIOS.map((ratio) => (
              <DropdownMenuItem
                key={ratio}
                className="text-xs cursor-pointer"
                style={{ color: videoInput.videoMeta.aspectRatio === ratio ? 'var(--primary)' : 'var(--foreground)' }}
                onClick={() => updateVideoMeta({ aspectRatio: ratio as '9:16' | '16:9' | '1:1' | '4:5' })}
              >
                {ratio}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Floating overlay — bottom-right: FPS (left) */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        <span
          className="px-2 py-1 rounded-sm text-[10px] font-mono"
          style={{
            background: 'var(--popover)',
            backdropFilter: 'none',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
          }}
        >
          {videoInput.videoMeta.fps}fps
        </span>
      </div>

      {/* Client render progress bar */}
      {isClientRendering && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/40 z-30">
          <div
            className="h-full bg-muted duration-200"
            style={{ width: `${Math.round(clientProgress * 100)}%` }}
          />
        </div>
      )}

      {/* Floating overlay — top-right: export + fullscreen */}
      <div className="absolute top-3 right-3 z-20 flex items-center gap-2">
        {/* Client render status/cancel */}
        {isClientRendering && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px]"
            style={{ background: 'var(--popover)', backdropFilter: 'none', border: '1px solid var(--border)', color: 'var(--primary)' }}
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            <span>{Math.round(clientProgress * 100)}%</span>
            <button onClick={cancelRender} className="ml-1 hover:text-foreground dark:text-white" title="Cancel">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {clientRenderStatus === 'error' && (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px]"
            style={{ background: 'var(--popover)', backdropFilter: 'none', border: '1px solid rgba(239,68,68,0.4)', color: '#F87171' }}
          >
            <span role="alert" title={clientError ?? undefined}>Render failed</span>
            <button onClick={resetClientRender} className="ml-1 hover:text-foreground dark:text-white" title="Dismiss">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {config && (
          <VideoDownloadMenu width={config.width} height={config.height}
            disabled={isClientRendering} onDownload={handleClientRender} />
        )}
        <button
          onClick={handleFullscreen}
          className="w-7 h-7 rounded-sm flex items-center justify-center opacity-100 group-hover:opacity-100"
          style={{
            background: 'var(--popover)',
            backdropFilter: 'none',
            border: '1px solid var(--border)',
            color: 'var(--muted-foreground)',
          }}


          title="Fullscreen"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
