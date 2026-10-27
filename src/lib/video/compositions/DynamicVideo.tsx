import React, { useState, useEffect, useRef } from 'react';
import * as ReactDOM from 'react-dom';
import * as ReactDOMClient from 'react-dom/client';
import * as jsxDevRuntime from 'react/jsx-dev-runtime';
import * as jsxRuntime from 'react/jsx-runtime';
import * as ThreeLib from 'three';
import * as ReactThreeFiber from '@react-three/fiber';
import * as ReactThreeDrei from '@react-three/drei';
import * as ReactThreePostprocessing from '@react-three/postprocessing';
import * as PostprocessingLib from 'postprocessing';
import {
  AbsoluteFill,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  delayRender,
  continueRender,
} from 'remotion';
import { Audio, Video as MediaVideo } from '@remotion/media';
import * as RemotionLib from 'remotion';
import * as RemotionMotionBlur from '@remotion/motion-blur';
import * as RemotionTransitions from '@remotion/transitions';
import * as RemotionSfx from '@remotion/sfx';
import * as RemotionLottie from '@remotion/lottie';
import * as RemotionMediaUtils from '@remotion/media-utils';
import {
  Intro,
  Outro,
  StatScene,
  ComparisonScene,
  TextScene,
  QuoteScene,
} from '../components';
import { ListScene } from '../components/ListScene';
import { ElementOverrideInjector } from '../components/ElementOverrideInjector';
import { TimelineScene } from '../components/TimelineScene';
import { CalloutScene } from '../components/CalloutScene';
import { IconListScene } from '../components/IconListScene';
import { LineChartScene, PieChartScene } from '../components/ChartScene';
import { CodeScene, TestimonialScene } from '../components/CodeTestimonialScene';
import { WhatsAppChatScene } from '../components/WhatsAppChatScene';
import { MotivationalImageScene } from '../components/MotivationalImageScene';
// New block components
import { CounterScene } from '../components/CounterScene';
import { ProgressBarScene } from '../components/ProgressBarScene';
import { QRCodeScene } from '../components/QRCodeScene';
import { VideoScene } from '../components/VideoScene';
import { AvatarGridScene } from '../components/AvatarGridScene';
import { SocialStatsScene } from '../components/SocialStatsScene';
import { CTAScene } from '../components/CTAScene';
import { GradientTextScene } from '../components/GradientTextScene';
import { AnimatedBgScene } from '../components/AnimatedBgScene';
import { CountdownScene } from '../components/CountdownScene';
import { WeatherScene } from '../components/WeatherScene';
import { TowerChart3DScene } from '../components/TowerChart3DScene';
import { BarRace3DScene } from '../components/BarRace3DScene';
import { ParallaxStoryScene } from '../components/ParallaxStoryScene';
import { PricingTableScene } from '../components/PricingTableScene';
import { LogoWallScene } from '../components/LogoWallScene';
import { ProcessStepsScene } from '../components/ProcessStepsScene';
import { HtmlScene } from '../components/HtmlScene';
import { DiagramScene } from '../components/DiagramScene';
import { TopPlayersScene } from '../components/TopPlayersScene';
import { GlobalSubtitleOverlay } from '../components/GlobalSubtitleOverlay';
import { GlobalTextOverlay } from '../components/GlobalTextOverlay';
import {
  type VideoInput,
  type AIDecision,
  type VideoPlan,
  type ContentBlock,
  type StatBlock,
  type ComparisonBlock,
  type TextBlock,
  type QuoteBlock,
  type ListBlock,
  type TimelineBlock,
  type CalloutBlock,
  type IconListBlock,
  type LineChartBlock,
  type PieChartBlock,
  type CodeBlock,
  type TestimonialBlock,
  type WhatsAppChatBlock,
  type MotivationalImageBlock,
  // New block types
  type CounterBlock,
  type ProgressBarBlock,
  type QRCodeBlock,
  type VideoBlock,
  type AvatarGridBlock,
  type SocialStatsBlock,
  type CTABlock,
  type GradientTextBlock,
  type AnimatedBackgroundBlock,
  type CountdownBlock,
  type WeatherBlock,
  type TowerChart3DBlock,
  type BarRace3DBlock,
  type ParallaxStoryBlock,
  type PricingTableBlock,
  type LogoWallBlock,
  type ProcessStepsBlock,
  type HtmlBlock,
  type DiagramBlock,
  type TopPlayersBlock,
  type CustomPluginBlock,
  type ElementOverride,
  COMPONENT_IDS,
} from '../schemas';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';

// ============================================================================
// PLUGIN SCENE - Dynamically loads and renders user-installed plugin blocks
// ============================================================================

// Server URL for serving compiled plugin bundles in Lambda/headless contexts.
// In the browser preview, we use relative URLs via fetch() instead.
const PLUGIN_SERVER_URL =
  (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_APP_URL) ||
  'http://localhost:3000';

/**
 * Routes a cross-origin media URL (image OR audio) through /api/proxy-media
 * so @remotion/web-renderer can fetch it without CORS / referer restrictions.
 * Same-origin URLs, data:, and blob: URLs pass through unchanged.
 */
function proxyMediaSrc(src: string | undefined): string | undefined {
  if (!src) return src;
  if (typeof window === 'undefined') return src; // SSR — return as-is
  if (src.startsWith('data:') || src.startsWith('blob:')) return src;
  try {
    const u = new URL(src, window.location.href);
    if (u.origin === window.location.origin) return src;
    return `/api/proxy-media?url=${encodeURIComponent(src)}`;
  } catch {
    return src;
  }
}

/**
 * Drop-in replacement for Remotion's <Img> that auto-proxies cross-origin
 * sources. Used by plugins via __pluginDeps['remotion'].Img.
 */
const ProxiedImg = React.forwardRef<HTMLImageElement, React.ImgHTMLAttributes<HTMLImageElement>>(
  function ProxiedImg(props, ref) {
    const RealImg = (RemotionLib as any).Img as React.ComponentType<any>;
    const proxied = proxyMediaSrc(props.src);
    return <RealImg ref={ref} {...props} src={proxied} crossOrigin="anonymous" />;
  },
);

/**
 * Wraps @remotion/media's <Audio> so cross-origin audio URLs auto-proxy.
 * Required because S3 presigned URLs (Remotion Lambda TTS output) lack CORS
 * headers — the web-renderer's audio fetch fails without going through proxy.
 */
function ProxiedAudio(props: any) {
  const proxied = proxyMediaSrc(props.src);
  return <Audio {...props} src={proxied} />;
}

const IMAGE_URL_RE = /^https?:\/\/[^\s]+\.(?:jpe?g|png|webp|gif|avif|svg)(?:\?[^\s]*)?$/i;
const AUDIO_URL_RE = /^https?:\/\/[^\s]+\.(?:mp3|wav|ogg|m4a|aac|flac|opus|webm)(?:\?[^\s]*)?$/i;
const MEDIA_URL_KEY_RE = /(image|img|photo|avatar|thumbnail|logo|picture|cover|background|audio|sound|music|track|narration|voice|tts|src|url)$/i;

/**
 * Walks an arbitrary plugin data object and rewrites any string that looks
 * like an image OR audio URL through /api/proxy-media. Also matches by key
 * name (e.g. `audioSrc`, `imageUrl`) since presigned S3 URLs don't have a
 * recognizable extension before the query string.
 */
function proxyMediaUrlsDeep<T>(value: T, keyHint = ''): T {
  if (value == null) return value;
  if (typeof value === 'string') {
    const isMediaByExt = IMAGE_URL_RE.test(value) || AUDIO_URL_RE.test(value);
    const isMediaByKey = keyHint && MEDIA_URL_KEY_RE.test(keyHint) && /^https?:\/\//.test(value);
    if (isMediaByExt || isMediaByKey) {
      return proxyMediaSrc(value) as unknown as T;
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => proxyMediaUrlsDeep(item, keyHint)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = proxyMediaUrlsDeep(v, k);
    }
    return out as unknown as T;
  }
  return value;
}

/**
 * Replaces raw <video> elements inside plugins with a canvas-based proxy.
 * renderMediaOnWeb's software DOM-to-canvas renderer cannot paint native <video>
 * elements (GPU-composited outside the DOM layer). This component loads the video
 * off-screen, seeks it to the current Remotion frame, then draws to a <canvas>
 * which the renderer CAN capture. Falls back gracefully if video fails to load.
 */
function VideoCanvasProxy({ src, style, ...rest }: React.VideoHTMLAttributes<HTMLVideoElement> & { src?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Resolve src — route cross-origin URLs through our proxy so the canvas isn't tainted.
  // Same-origin URLs (including S3 with CORS configured) load directly.
  const resolvedSrc = (() => {
    if (!src) return undefined;
    if (typeof window === 'undefined') return src;
    try {
      const u = new URL(src, window.location.href);
      if (u.origin === window.location.origin) return src;
      return `/api/proxy-media?url=${encodeURIComponent(src)}`;
    } catch {
      return src;
    }
  })();

  // Create the off-screen video element once per src.
  // Mount it in the DOM (hidden) so the browser actually decodes frames — detached
  // video elements often stall at readyState=1 in headless render contexts.
  useEffect(() => {
    if (!resolvedSrc) return;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.style.position = 'fixed';
    video.style.left = '-99999px';
    video.style.top = '-99999px';
    video.style.width = '1px';
    video.style.height = '1px';
    video.style.opacity = '0';
    video.style.pointerEvents = 'none';
    video.src = resolvedSrc;
    document.body.appendChild(video);
    videoRef.current = video;
    video.load();
    // Pause so we control currentTime; play+pause forces the browser to decode.
    video.play().then(() => video.pause()).catch(() => { /* ignore — seek will still work */ });
    return () => {
      video.pause();
      video.src = '';
      video.removeAttribute('src');
      try { document.body.removeChild(video); } catch { /* already removed */ }
      videoRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSrc]);

  // On every frame: seek the video to currentTime and draw to canvas.
  // delayRender blocks the screenshot until the seek + draw completes.
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!resolvedSrc || !canvas || !video) return;

    const targetTime = frame / fps;
    const handle = delayRender(`VideoCanvasProxy frame ${frame}`, { timeoutInMilliseconds: 30000 });
    let done = false;
    const cleanups: (() => void)[] = [];

    const draw = () => {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx && video.readyState >= 2 && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        }
      } catch {
        // Canvas tainted by CORS — leave blank rather than crash
      }
    };

    const finish = () => {
      if (done) return;
      done = true;
      cleanups.forEach((fn) => fn());
      draw();
      continueRender(handle);
    };

    const addListener = (event: string, fn: () => void) => {
      video.addEventListener(event, fn);
      cleanups.push(() => video.removeEventListener(event, fn));
    };

    // Need readyState >= 2 (HAVE_CURRENT_DATA) AND duration known before we can seek.
    // 'canplay' (rs=3) is the most reliable signal that we can seek + drawImage.
    const tryStart = () => {
      if (done) return;
      if (video.readyState < 3 || !isFinite(video.duration) || video.duration <= 0) {
        // Wait — listeners below will retry
        return;
      }

      const seekTo = targetTime % video.duration;
      if (Math.abs(video.currentTime - seekTo) < 0.04) {
        finish();
        return;
      }

      addListener('seeked', finish);
      video.currentTime = seekTo;
    };

    addListener('canplay', tryStart);
    addListener('loadeddata', tryStart);
    addListener('loadedmetadata', tryStart);
    addListener('error', finish);

    tryStart();

    return () => {
      if (!done) {
        done = true;
        cleanups.forEach((fn) => fn());
        continueRender(handle);
      }
    };
  });

  const { objectFit, ...restStyle } = (style ?? {}) as React.CSSProperties;

  return (
    <canvas
      ref={canvasRef}
      width={1920}
      height={1080}
      data-original-tag="VIDEO"
      data-video-src={src ?? ''}
      style={{ position: 'absolute', width: '100%', height: '100%', objectFit: objectFit ?? 'cover', ...restStyle }}
      {...(rest as React.CanvasHTMLAttributes<HTMLCanvasElement>)}
    />
  );
}

// Register globally so the bundle transform can reference it
if (typeof globalThis !== 'undefined') {
  (globalThis as Record<string, unknown>).__VideoCanvasProxy = VideoCanvasProxy;
}


interface PluginSceneProps {
  block: CustomPluginBlock;
  theme: string;
  animation: { enter: number; hold: number; exit: number };
  motionProfile: MotionProfileType;
  /** URL for this plugin's bundle. Same-origin for Lambda, Vercel API for preview. */
  bundleUrl?: string;
}

function PluginScene({ block, theme, animation, motionProfile, bundleUrl }: PluginSceneProps): React.ReactElement {
  const [PluginComponent, setPluginComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Use useState initializer (runs once) to avoid leaking extra delayRender handles on re-renders.
  const [initialHandle] = useState<number>(() => delayRender(`Loading plugin: ${block.pluginId}`));
  const renderHandleRef = useRef<number | null>(initialHandle);

  // Phase 1: Fetch and evaluate the plugin bundle.
  useEffect(() => {
    if (typeof globalThis !== 'undefined') {
      const g = globalThis as Record<string, unknown>;
      const deps = (g.__pluginDeps ?? {}) as Record<string, unknown>;
      deps['react'] = React;
      deps['react/jsx-dev-runtime'] = jsxDevRuntime;
      deps['react/jsx-runtime'] = jsxRuntime;
      deps['react-dom'] = ReactDOM;
      deps['react-dom/client'] = ReactDOMClient;
      // Override the legacy `Audio` (Html5Audio) from remotion with the
      // WebCodecs-compatible one from @remotion/media — required for client
      // (browser) renders. Plugins using `Audio` from 'remotion' will now
      // transparently get the new component.
      // Also wrap `Img` so cross-origin URLs auto-route through our CORS
      // proxy — required because @remotion/web-renderer aborts the whole
      // render if a single image fetch fails (CORS / 403 / etc).
      deps['remotion'] = {
        ...RemotionLib,
        Audio: ProxiedAudio,
        Img: ProxiedImg,
        Video: MediaVideo,
      };
      deps['three'] = ThreeLib;
      deps['@react-three/fiber'] = ReactThreeFiber;
      deps['@react-three/drei'] = ReactThreeDrei;
      deps['@react-three/postprocessing'] = ReactThreePostprocessing;
      deps['postprocessing'] = PostprocessingLib;
      deps['@remotion/motion-blur'] = RemotionMotionBlur;
      deps['@remotion/transitions'] = RemotionTransitions;
      deps['@remotion/sfx'] = RemotionSfx;
      deps['@remotion/lottie'] = RemotionLottie;
      deps['@remotion/media-utils'] = RemotionMediaUtils;
      g.__pluginDeps = deps;
    }

    const fetchUrl = bundleUrl ?? `${PLUGIN_SERVER_URL}/api/plugins/${block.pluginId}/bundle`;

    fetch(fetchUrl)
      .then(r => {
        if (!r.ok) throw new Error(`Bundle not found (status ${r.status})`);
        return r.text();
      })
      .then(raw => {
        const code = raw.replace(
          /React\.createElement\(\s*["']video["']\s*,/g,
          'React.createElement(globalThis.__VideoCanvasProxy,'
        );
        const exportsObj: Record<string, unknown> = {};
        const moduleObj = { exports: exportsObj };
        const customRequire = (pkg: string) => {
          const g = globalThis as Record<string, unknown>;
          const deps = (g.__pluginDeps ?? {}) as Record<string, unknown>;
          if (deps[pkg]) {
            return deps[pkg];
          }
          console.warn(`Plugin "${block.pluginId}" requested unknown module: ${pkg}`);
          return {};
        };
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const factory = new Function('exports', 'require', 'module', code);
        factory(exportsObj, customRequire, moduleObj);
        return moduleObj.exports as Record<string, unknown>;
      })
      .then((mod) => {
        const Component =
          mod?.default?.scene ??
          mod?.default ??
          mod?.Scene ??
          mod?.scene ??
          Object.values(mod ?? {}).find((value) => typeof value === 'function');
        if (!Component) {
          setError(`Plugin "${block.pluginId}" has no default or Scene export`);
          if (renderHandleRef.current !== null) {
            continueRender(renderHandleRef.current);
            renderHandleRef.current = null;
          }
        } else {
          // setPluginComponent triggers a re-render; continueRender fires in Phase 2
          // useEffect below, AFTER React has painted the component.
          setPluginComponent(() => Component);
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`Failed to load plugin "${block.pluginId}":`, msg);
        setError(msg);
        if (renderHandleRef.current !== null) {
          continueRender(renderHandleRef.current);
          renderHandleRef.current = null;
        }
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.pluginId]);

  // Phase 2: Release the render hold only AFTER React has committed the PluginComponent to the DOM.
  useEffect(() => {
    if (PluginComponent !== null && renderHandleRef.current !== null) {
      continueRender(renderHandleRef.current);
      renderHandleRef.current = null;
    }
  }, [PluginComponent]);

  if (!PluginComponent) {
    if (error) {
      return (
        <AbsoluteFill style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1a1a2e' }}>
          <div style={{ color: '#ef4444', fontSize: 24, textAlign: 'center', padding: 40 }}>
            {`Plugin error: ${error}`}
          </div>
        </AbsoluteFill>
      );
    }
    // delayRender is still active — renderer will not capture this blank frame
    return <AbsoluteFill />;
  }

  const rawPluginData = { audioSrc: block.audioSrc, ...(block.pluginData ?? {}) };
  const pluginData = proxyMediaUrlsDeep(rawPluginData);

  return (
    <AbsoluteFill>
      {block.audioSrc && <Audio src={proxyMediaSrc(block.audioSrc)} volume={0.8} />}
      <PluginComponent
        {...pluginData}
        data={pluginData}
        pluginData={pluginData}
        theme={theme}
        animation={animation}
        motionProfile={motionProfile}
      />
    </AbsoluteFill>
  );
}

// ============================================================================
// DYNAMIC VIDEO COMPOSITION
// ============================================================================

export interface DynamicVideoProps {
  input: VideoInput;
  plan: VideoPlan;
  /** URLs for plugin bundles keyed by pluginId.
   *  When rendering via Lambda, these are same-origin URLs (files uploaded to the Remotion site directory).
   *  For browser preview, this is empty — PluginScene falls back to the Vercel API. */
  pluginBundleUrls?: Record<string, string>;
}

/**
 * Main video composition that dynamically renders based on AI decisions
 */
export function DynamicVideo({
  input,
  plan,
  pluginBundleUrls = {},
}: DynamicVideoProps): React.ReactElement {
  const { videoMeta, contentBlocks } = input;
  const { decisions, suggestedTransitions } = plan;
  const colors = getTheme(videoMeta.theme);

  // Get audio tracks
  const audioTracks = videoMeta.audioTracks || [];

  // Get intro/outro config with defaults
  const introConfig = videoMeta.intro || {};
  const outroConfig = videoMeta.outro || {};

  const introTitle = introConfig.title || 'SKYGEN';
  const introSubtitle = introConfig.subtitle || '';
  const introDuration = introConfig.duration || 2;

  const outroMessage = outroConfig.title || 'Thank You';
  const outroCta = outroConfig.subtitle || '';
  const outroDuration = outroConfig.duration || 2;

  // Build timeline
  const timeline = buildTimeline(
    contentBlocks,
    decisions,
    introDuration,
    outroDuration,
    videoMeta.fps
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.background,
      }}
    >
      {/* Audio Tracks - render all non-muted tracks */}
      {audioTracks.map((track, index) => !track.muted && (
        <Sequence
          key={track.id || `audio-${index}`}
          from={Math.round(track.startTime * videoMeta.fps)}
        >
          <Audio
            src={proxyMediaSrc(track.src)}
            volume={track.volume}
            loop={track.loop}
          />
        </Sequence>
      ))}

      {/* Intro */}
      <Sequence from={0} durationInFrames={frames(introDuration, videoMeta.fps)}>
        <Intro
          title={introTitle}
          subtitle={introSubtitle}
          theme={videoMeta.theme}
          logoUrl={introConfig.logoUrl}
        />
      </Sequence>

      {/* Dynamic Content Scenes */}
      {timeline.scenes.map((scene, index) => {
        const overrides = (scene.block as { elementOverrides?: Record<string, ElementOverride> }).elementOverrides;
        return (
          <Sequence
            key={`scene-${index}`}
            from={scene.startFrame}
            durationInFrames={scene.durationFrames}
          >
            <ElementOverrideInjector blockIndex={index} overrides={overrides}>
              <SceneRenderer
                block={scene.block}
                decision={scene.decision}
                theme={videoMeta.theme}
                transition={suggestedTransitions?.[index]}
                pluginBundleUrls={pluginBundleUrls}
              />
            </ElementOverrideInjector>
          </Sequence>
        );
      })}

      {/* Outro */}
      <Sequence
        from={timeline.totalFrames - frames(outroDuration, videoMeta.fps)}
        durationInFrames={frames(outroDuration, videoMeta.fps)}
      >
        <Outro
          message={outroMessage}
          cta={outroCta}
          theme={videoMeta.theme}
          logoUrl={outroConfig.logoUrl}
        />
      </Sequence>

      {/* Global Text Overlay Tracks — persistent text layers (watermarks, lower thirds, etc.) */}
      {videoMeta.textOverlayTracks && videoMeta.textOverlayTracks.length > 0 && (
        <GlobalTextOverlay tracks={videoMeta.textOverlayTracks} />
      )}

      {/* Global Subtitle Track — rendered on top of all scenes */}
      {videoMeta.subtitleTrack && (
        <GlobalSubtitleOverlay subtitleTrack={videoMeta.subtitleTrack} />
      )}
    </AbsoluteFill>
  );
}

// ============================================================================
// SCENE RENDERER
// ============================================================================

interface SceneRendererProps {
  block: ContentBlock;
  decision: AIDecision;
  theme: string;
  transition?: 'fade' | 'slide' | 'zoom' | 'wipe';
  pluginBundleUrls?: Record<string, string>;
}

function SceneRenderer({
  block,
  decision,
  theme,
  pluginBundleUrls = {},
}: SceneRendererProps): React.ReactElement {
  const motionProfile = decision.motionProfile as MotionProfileType;
  const animation = decision.animation ?? {
    enter: 0.4,
    hold: decision.duration - 0.6,
    exit: 0.2,
  };

  // Custom plugin blocks must be detected by block type, not by decision.componentId.
  // Upstream plan generators (video-renderer, generate route, decision-router) default
  // unknown block types to 'text-scene', which would otherwise make the switch below
  // render a TextScene for custom plugins — visuals would be lost and only the merged
  // audioSrc would play. Handling this here keeps PluginScene resilient to any caller.
  if (block.type === 'custom-plugin') {
    return (
      <PluginScene
        block={block as CustomPluginBlock}
        theme={theme}
        animation={animation}
        motionProfile={motionProfile}
        bundleUrl={pluginBundleUrls?.[(block as CustomPluginBlock).pluginId]}
      />
    );
  }

  // Render based on component ID
  switch (decision.componentId) {
    case COMPONENT_IDS.STAT:
      return (
        <StatScene
          data={block as StatBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.COMPARISON:
      return (
        <ComparisonScene
          data={block as ComparisonBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.TEXT:
      return (
        <TextScene
          data={block as TextBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.QUOTE:
      return (
        <QuoteScene
          data={block as QuoteBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.LIST:
      return (
        <ListScene
          data={block as ListBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.TIMELINE:
      return (
        <TimelineScene
          data={block as TimelineBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.CALLOUT:
      return (
        <CalloutScene
          data={block as CalloutBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.ICON_LIST:
      return (
        <IconListScene
          data={block as IconListBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.LINE_CHART:
      return (
        <LineChartScene
          data={block as LineChartBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.PIE_CHART:
      return (
        <PieChartScene
          data={block as PieChartBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.CODE:
      return (
        <CodeScene
          data={block as CodeBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.TESTIMONIAL:
      return (
        <TestimonialScene
          data={block as TestimonialBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.WHATSAPP_CHAT:
      return (
        <WhatsAppChatScene
          data={block as WhatsAppChatBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.MOTIVATIONAL_IMAGE:
      return (
        <MotivationalImageScene
          data={block as MotivationalImageBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    // New blocks
    case COMPONENT_IDS.COUNTER:
      return (
        <CounterScene
          data={block as CounterBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.PROGRESS_BAR:
      return (
        <ProgressBarScene
          data={block as ProgressBarBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.QR_CODE:
      return (
        <QRCodeScene
          data={block as QRCodeBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.VIDEO:
      return (
        <VideoScene
          data={block as VideoBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.AVATAR_GRID:
      return (
        <AvatarGridScene
          data={block as AvatarGridBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.SOCIAL_STATS:
      return (
        <SocialStatsScene
          data={block as SocialStatsBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.CTA:
      return (
        <CTAScene
          data={block as CTABlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.GRADIENT_TEXT:
      return (
        <GradientTextScene
          data={block as GradientTextBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.ANIMATED_BG:
      return (
        <AnimatedBgScene
          data={block as AnimatedBackgroundBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.COUNTDOWN:
      return (
        <CountdownScene
          data={block as CountdownBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.WEATHER:
      return (
        <WeatherScene
          data={block as WeatherBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.TOWER_CHART_3D:
      return (
        <TowerChart3DScene
          data={block as TowerChart3DBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.BAR_RACE_3D:
      return (
        <BarRace3DScene
          data={block as BarRace3DBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
      
    case COMPONENT_IDS.PARALLAX_STORY:
      return (
        <ParallaxStoryScene
          data={block as ParallaxStoryBlock}
          theme={theme}
          motionProfile={motionProfile}
        />
      );

    case COMPONENT_IDS.PRICING_TABLE:
      return (
        <PricingTableScene
          data={block as PricingTableBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );

    case COMPONENT_IDS.LOGO_WALL:
      return (
        <LogoWallScene
          data={block as LogoWallBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );

    case COMPONENT_IDS.PROCESS_STEPS:
      return (
        <ProcessStepsScene
          data={block as ProcessStepsBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );

    case COMPONENT_IDS.HTML:
      return (
        <HtmlScene
          data={block as HtmlBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );

    case COMPONENT_IDS.TOP_PLAYERS:
      return (
        <TopPlayersScene
          data={block as TopPlayersBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );

    case COMPONENT_IDS.DIAGRAM:
      return (
        <DiagramScene
          data={block as DiagramBlock}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );

    default:
      // Custom plugin block — dynamically loaded
      if (block.type === 'custom-plugin') {
        return (
          <PluginScene
            block={block as CustomPluginBlock}
            theme={theme}
            animation={animation}
            motionProfile={motionProfile}
            bundleUrl={pluginBundleUrls?.[(block as CustomPluginBlock).pluginId]}
          />
        );
      }
      // Fallback: render based on block type directly
      return renderByBlockType(block, theme, motionProfile, animation);
  }
}

/**
 * Fallback renderer that uses block type directly
 */
function renderByBlockType(
  blockRaw: ContentBlock,
  theme: string,
  motionProfile: MotionProfileType,
  animation: { enter: number; hold: number; exit: number }
): React.ReactElement {
  // Proxy any cross-origin media URLs in the block before passing to scenes
  // so renderMediaOnWeb can fetch them without CORS errors. Cheap walk; no-op
  // for already-proxied or same-origin URLs.
  const block = proxyMediaUrlsDeep(blockRaw);
  switch (block.type) {
    case 'stat':
      return <StatScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'comparison':
      return <ComparisonScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'text':
      return <TextScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'quote':
      return <QuoteScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'list':
      return <ListScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'timeline':
      return <TimelineScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'callout':
      return <CalloutScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'icon-list':
      return <IconListScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'line-chart':
      return <LineChartScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'pie-chart':
      return <PieChartScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'code':
      return <CodeScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'testimonial':
      return <TestimonialScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'whatsapp-chat':
      return <WhatsAppChatScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'motivational-image':
      return <MotivationalImageScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    // New blocks
    case 'counter':
      return <CounterScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'progress-bar':
      return <ProgressBarScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'qr-code':
      return <QRCodeScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'video':
      return <VideoScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'avatar-grid':
      return <AvatarGridScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'social-stats':
      return <SocialStatsScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'cta':
      return <CTAScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'gradient-text':
      return <GradientTextScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'animated-bg':
      return <AnimatedBgScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'countdown':
      return <CountdownScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'weather-block':
      return <WeatherScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'tower-chart-3d':
      return <TowerChart3DScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'bar-race-3d':
      return <BarRace3DScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'parallax-story':
      return <ParallaxStoryScene data={block} theme={theme} motionProfile={motionProfile} />;
    case 'pricing-table':
      return <PricingTableScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'logo-wall':
      return <LogoWallScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'process-steps':
      return <ProcessStepsScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'html':
      return <HtmlScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'diagram':
      return <DiagramScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'top-players':
      return <TopPlayersScene data={block as TopPlayersBlock} theme={theme} motionProfile={motionProfile} animation={animation} />;
    case 'custom-plugin':
      return (
        <PluginScene
          block={block as CustomPluginBlock}
          theme={theme}
          animation={animation}
          motionProfile={motionProfile}
        />
      );
    default:
      return (
        <TextScene
          data={{ type: 'text', content: 'Unsupported content type' }}
          theme={theme}
          motionProfile={motionProfile}
          animation={animation}
        />
      );
  }
}

// ============================================================================
// TIMELINE BUILDER
// ============================================================================

interface TimelineScene {
  block: ContentBlock;
  decision: AIDecision;
  startFrame: number;
  durationFrames: number;
}

interface Timeline {
  scenes: TimelineScene[];
  totalFrames: number;
}

function buildTimeline(
  blocks: ContentBlock[],
  decisions: AIDecision[],
  introDuration: number,
  outroDuration: number,
  fps: number
): Timeline {
  const scenes: TimelineScene[] = [];
  let currentFrame = frames(introDuration, fps);
  
  blocks.forEach((block, index) => {
    const decision = decisions[index];
    const durationFrames = frames(decision.duration, fps);
    
    scenes.push({
      block,
      decision,
      startFrame: currentFrame,
      durationFrames,
    });
    
    currentFrame += durationFrames;
  });
  
  const totalFrames = currentFrame + frames(outroDuration, fps);
  
  return { scenes, totalFrames };
}

/**
 * Convert seconds to frames
 */
function frames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

// ============================================================================
// COMPOSITION CONFIG HELPER
// ============================================================================

/**
 * Generate Remotion composition configuration from video input and plan
 */
export function getCompositionConfig(
  input: VideoInput,
  plan: VideoPlan
): {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
} {
  const dimensions = getAspectRatioDimensions(input.videoMeta.aspectRatio);
  const introDuration = input.videoMeta.intro?.duration || 2;
  const outroDuration = input.videoMeta.outro?.duration || 2;
  const contentDuration = plan.decisions.reduce((sum, d) => sum + d.duration, 0);
  const totalDuration = introDuration + contentDuration + outroDuration;
  
  return {
    width: dimensions.width,
    height: dimensions.height,
    fps: input.videoMeta.fps,
    durationInFrames: Math.round(totalDuration * input.videoMeta.fps),
  };
}

function getAspectRatioDimensions(ratio: string): { width: number; height: number } {
  const ratios: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };
  
  return ratios[ratio] ?? ratios['9:16'];
}
