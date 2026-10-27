import React from 'react';
import { AbsoluteFill, Sequence, useVideoConfig } from 'remotion';
import {
  Intro,
  Outro,
  StatScene,
  ComparisonScene,
  TextScene,
  QuoteScene,
} from '../lib/video/components';
import { ListScene } from '../lib/video/components/ListScene';
import { TimelineScene } from '../lib/video/components/TimelineScene';
import { CalloutScene } from '../lib/video/components/CalloutScene';
import { IconListScene } from '../lib/video/components/IconListScene';
import { LineChartScene, PieChartScene } from '../lib/video/components/ChartScene';
import { CodeScene, TestimonialScene } from '../lib/video/components/CodeTestimonialScene';
import { WhatsAppChatScene } from '../lib/video/components/WhatsAppChatScene';
import { MotivationalImageScene } from '../lib/video/components/MotivationalImageScene';
import { TopPlayersScene } from '../lib/video/components/TopPlayersScene';
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
  type TopPlayersBlock,
  COMPONENT_IDS,
} from '../lib/video/schemas';
import { getTheme } from '../lib/video/utils/theme';
import type { MotionProfileType } from '../lib/video/utils/animations';

// ============================================================================
// TYPES
// ============================================================================

export interface CompositionProps {
  input: VideoInput;
  plan: VideoPlan;
  title?: string;
  subtitle?: string;
}

// ============================================================================
// DYNAMIC VIDEO COMPOSITION
// ============================================================================

export function DynamicVideo({
  input,
  plan,
  title = 'Video Report',
  subtitle = '',
}: CompositionProps): React.ReactElement {
  // Safety check for props
  if (!input || !plan) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#0a0a0f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <h1 style={{ fontSize: 48, margin: 0 }}>Loading...</h1>
          <p style={{ color: '#666' }}>Waiting for props</p>
        </div>
      </AbsoluteFill>
    );
  }
  
  const { videoMeta, contentBlocks } = input;
  const { decisions } = plan;
  const colors = getTheme(videoMeta.theme);
  const { fps } = useVideoConfig();
  
  const introDuration = 2;
  const outroDuration = 2;
  
  const timeline = buildTimeline(contentBlocks, decisions, introDuration, outroDuration, fps);
  
  return (
    <AbsoluteFill style={{ backgroundColor: colors.background }}>
      {/* Intro */}
      <Sequence from={0} durationInFrames={frames(introDuration, fps)}>
        <Intro title={title} subtitle={subtitle} theme={videoMeta.theme} />
      </Sequence>
      
      {/* Content Scenes */}
      {timeline.scenes.map((scene, index) => (
        <Sequence
          key={`scene-${index}`}
          from={scene.startFrame}
          durationInFrames={scene.durationFrames}
        >
          <SceneRenderer block={scene.block} decision={scene.decision} theme={videoMeta.theme} />
        </Sequence>
      ))}
      
      {/* Outro */}
      <Sequence from={timeline.totalFrames - frames(outroDuration, fps)} durationInFrames={frames(outroDuration, fps)}>
        <Outro theme={videoMeta.theme} />
      </Sequence>
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
}

function SceneRenderer({ block, decision, theme }: SceneRendererProps): React.ReactElement {
  const motionProfile = decision.motionProfile as MotionProfileType;
  const animation = decision.animation ?? { enter: 0.4, hold: decision.duration - 0.6, exit: 0.2 };
  
  const props = { theme, motionProfile, animation };
  
  switch (decision.componentId) {
    case COMPONENT_IDS.STAT:
      return <StatScene data={block as StatBlock} {...props} />;
    case COMPONENT_IDS.COMPARISON:
      return <ComparisonScene data={block as ComparisonBlock} {...props} />;
    case COMPONENT_IDS.TEXT:
      return <TextScene data={block as TextBlock} {...props} />;
    case COMPONENT_IDS.QUOTE:
      return <QuoteScene data={block as QuoteBlock} {...props} />;
    case COMPONENT_IDS.LIST:
      return <ListScene data={block as ListBlock} {...props} />;
    case COMPONENT_IDS.TIMELINE:
      return <TimelineScene data={block as TimelineBlock} {...props} />;
    case COMPONENT_IDS.CALLOUT:
      return <CalloutScene data={block as CalloutBlock} {...props} />;
    case COMPONENT_IDS.ICON_LIST:
      return <IconListScene data={block as IconListBlock} {...props} />;
    case COMPONENT_IDS.LINE_CHART:
      return <LineChartScene data={block as LineChartBlock} {...props} />;
    case COMPONENT_IDS.PIE_CHART:
      return <PieChartScene data={block as PieChartBlock} {...props} />;
    case COMPONENT_IDS.CODE:
      return <CodeScene data={block as CodeBlock} {...props} />;
    case COMPONENT_IDS.TESTIMONIAL:
      return <TestimonialScene data={block as TestimonialBlock} {...props} />;
    case COMPONENT_IDS.WHATSAPP_CHAT:
      return <WhatsAppChatScene data={block as WhatsAppChatBlock} {...props} />;
    case COMPONENT_IDS.MOTIVATIONAL_IMAGE:
      return <MotivationalImageScene data={block as MotivationalImageBlock} {...props} />;
    case COMPONENT_IDS.TOP_PLAYERS:
      return <TopPlayersScene data={block as TopPlayersBlock} {...props} />;
    default:
      // Fallback: render based on block type directly
      if ((block as ContentBlock).type === 'whatsapp-chat') {
        return <WhatsAppChatScene data={block as WhatsAppChatBlock} {...props} />;
      }
      if ((block as ContentBlock).type === 'motivational-image') {
        return <MotivationalImageScene data={block as MotivationalImageBlock} {...props} />;
      }
      return <TextScene data={{ type: 'text', content: 'Unsupported block' }} {...props} />;
  }
}

// ============================================================================
// HELPERS
// ============================================================================

function buildTimeline(
  blocks: ContentBlock[],
  decisions: AIDecision[],
  introDuration: number,
  outroDuration: number,
  fps: number
): { scenes: { block: ContentBlock; decision: AIDecision; startFrame: number; durationFrames: number }[]; totalFrames: number } {
  const scenes: { block: ContentBlock; decision: AIDecision; startFrame: number; durationFrames: number }[] = [];
  let currentFrame = frames(introDuration, fps);
  
  blocks.forEach((block, index) => {
    const decision = decisions[index];
    scenes.push({
      block,
      decision,
      startFrame: currentFrame,
      durationFrames: frames(decision.duration, fps),
    });
    currentFrame += frames(decision.duration, fps);
  });
  
  return { scenes, totalFrames: currentFrame + frames(outroDuration, fps) };
}

function frames(seconds: number, fps: number): number {
  return Math.round(seconds * fps);
}

// ============================================================================
// COMPOSITION CONFIG HELPER
// ============================================================================

export function getCompositionConfigFromProps(props: CompositionProps) {
  const { input, plan } = props;
  
  const aspectRatios: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };
  
  const dimensions = aspectRatios[input.videoMeta.aspectRatio] || aspectRatios['9:16'];
  const introDuration = 2;
  const outroDuration = 2;
  const contentDuration = plan.decisions.reduce((sum, d) => sum + d.duration, 0);
  const totalDuration = introDuration + contentDuration + outroDuration;
  
  return {
    id: 'DynamicVideo',
    durationInFrames: Math.round(totalDuration * input.videoMeta.fps),
    fps: input.videoMeta.fps,
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Calculate composition config from input and plan (for API use)
 */
export function calculateCompositionConfig(input: VideoInput, plan: VideoPlan) {
  return getCompositionConfigFromProps({ input, plan });
}
