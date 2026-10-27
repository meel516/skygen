import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { 
  useFadeIn, 
  useScaleIn, 
  useSlideIn, 
  useStaggeredEntry,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { ListBlock, AnimationPhase } from '../schemas';

// ============================================================================
// LIST SCENE COMPONENT
// ============================================================================

export interface ListSceneProps {
  data: ListBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function ListScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: ListSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 3;
  
  // Title animations
  const titleSlide = useSlideIn('up', 40, 0.5, 0, motionProfile);
  const titleOpacity = useFadeIn(0.4, 0, motionProfile);
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  // Render icon based on style
  const renderIcon = (index: number, style: string) => {
    switch (style) {
      case 'numbered':
        return (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: colors.foreground,
            }}
          >
            {index + 1}
          </div>
        );
      case 'checkmarks':
        return (
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: `${colors.accent}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.accent}
              strokeWidth={3}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        );
      default: // bullet
        return (
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            }}
          />
        );
    }
  };
  
  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '60px 80px',
          gap: 40,
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
                fontSize: 48,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
          </div>
        )}
        
        {/* List items */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 24,
          }}
        >
          {data.items.map((item, index) => (
            <ListItem
              key={index}
              item={item}
              index={index}
              style={data.style ?? 'bullet'}
              colors={colors}
              motionProfile={motionProfile}
            />
          ))}
        </div>
      </div>
    </BaseScene>
  );
}

// ============================================================================
// LIST ITEM COMPONENT
// ============================================================================

interface ListItemProps {
  item: string;
  index: number;
  style: 'bullet' | 'numbered' | 'checkmarks';
  colors: ReturnType<typeof getTheme>;
  motionProfile: MotionProfileType;
}

function ListItem({
  item,
  index,
  style,
  colors,
  motionProfile,
}: ListItemProps): React.ReactElement {
  const stagger = useStaggeredEntry(index, 0.12, motionProfile);
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        opacity: stagger.opacity,
        transform: `translateY(${stagger.translateY}px) scale(${stagger.scale})`,
      }}
    >
      {/* Icon */}
      <div style={{ flexShrink: 0 }}>
        {style === 'numbered' && (
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 700,
              color: '#ffffff',
              boxShadow: `0 4px 15px ${colors.primary}40`,
            }}
          >
            {index + 1}
          </div>
        )}
        {style === 'checkmarks' && (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              background: `${colors.accent}20`,
              border: `2px solid ${colors.accent}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width={20}
              height={20}
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.accent}
              strokeWidth={3}
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        )}
        {style === 'bullet' && (
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              boxShadow: `0 2px 10px ${colors.primary}40`,
            }}
          />
        )}
      </div>
      
      {/* Text */}
      <span
        style={{
          fontSize: 32,
          fontWeight: 500,
          color: colors.foreground,
          lineHeight: 1.4,
        }}
      >
        {item}
      </span>
    </div>
  );
}
