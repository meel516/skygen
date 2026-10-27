import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { 
  useFadeIn, 
  useSlideIn, 
  useStaggeredEntry,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { TimelineBlock, AnimationPhase } from '../schemas';

// ============================================================================
// TIMELINE SCENE COMPONENT
// ============================================================================

export interface TimelineSceneProps {
  data: TimelineBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function TimelineScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: TimelineSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 4;
  
  // Title animations
  const titleSlide = useSlideIn('up', 40, 0.5, 0, motionProfile);
  const titleOpacity = useFadeIn(0.4, 0, motionProfile);
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  // Line growth animation
  const lineProgress = useFadeIn(0.8, 0.2, motionProfile);
  
  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '50px 80px',
          gap: 30,
        }}
      >
        {/* Title */}
        {data.title && (
          <div
            style={{
              transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
              opacity: titleOpacity,
            }}
          >
            <h2
              style={{
                fontSize: 44,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
          </div>
        )}
        
        {/* Timeline */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            paddingLeft: 60,
          }}
        >
          {/* Vertical line */}
          <div
            style={{
              position: 'absolute',
              left: 20,
              top: 0,
              bottom: 0,
              width: 3,
              background: `linear-gradient(180deg, ${colors.primary}, ${colors.secondary})`,
              borderRadius: 2,
              opacity: lineProgress,
            }}
          />
          
          {/* Events */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 35,
            }}
          >
            {data.events.map((event, index) => (
              <TimelineEvent
                key={index}
                event={event}
                index={index}
                colors={colors}
                motionProfile={motionProfile}
              />
            ))}
          </div>
        </div>
      </div>
    </BaseScene>
  );
}

// ============================================================================
// TIMELINE EVENT COMPONENT
// ============================================================================

interface TimelineEventProps {
  event: {
    year: string;
    title: string;
    description?: string;
  };
  index: number;
  colors: ReturnType<typeof getTheme>;
  motionProfile: MotionProfileType;
}

function TimelineEvent({
  event,
  index,
  colors,
  motionProfile,
}: TimelineEventProps): React.ReactElement {
  const stagger = useStaggeredEntry(index, 0.15, motionProfile);
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 20,
        opacity: stagger.opacity,
        transform: `translateX(${stagger.translateY}px)`,
      }}
    >
      {/* Dot */}
      <div
        style={{
          position: 'absolute',
          left: 12,
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: colors.foreground,
          border: `4px solid ${colors.primary}`,
          boxShadow: `0 0 20px ${colors.primary}50`,
        }}
      />
      
      {/* Content */}
      <div
        style={{
          marginLeft: 30,
        }}
      >
        {/* Year badge */}
        <div
          style={{
            display: 'inline-block',
            padding: '4px 16px',
            background: `${colors.primary}20`,
            borderRadius: 20,
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 18,
              fontWeight: 600,
              color: colors.primary,
            }}
          >
            {event.year}
          </span>
        </div>
        
        {/* Title */}
        <h3
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: colors.foreground,
            margin: '0 0 6px 0',
          }}
        >
          {event.title}
        </h3>
        
        {/* Description */}
        {event.description && (
          <p
            style={{
              fontSize: 20,
              color: colors.muted,
              margin: 0,
            }}
          >
            {event.description}
          </p>
        )}
      </div>
    </div>
  );
}
