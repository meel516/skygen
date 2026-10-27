import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill } from 'remotion';
import { BaseScene } from './BaseScene';
import { 
  useFadeIn, 
  useScaleIn, 
  useSlideIn, 
  useStaggeredEntry,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { IconListBlock, AnimationPhase } from '../schemas';

// ============================================================================
// ICON LIST SCENE COMPONENT
// ============================================================================

export interface IconListSceneProps {
  data: IconListBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

// Icon SVG paths (wrapped in React Fragments for multiple elements)
const ICON_PATHS: Record<string, React.ReactNode> = {
  rocket: <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0 M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  star: <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />,
  heart: <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />,
  check: <polyline points="20 6 9 17 4 12" />,
  globe: <><circle cx="12" cy="12" r="10" /><line x1="2" y1="12" x2="22" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>,
  users: <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  award: <><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  dollar: <><line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" /></>,
};

export function IconListScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: IconListSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  if (!data?.items) {
    return <AbsoluteFill style={{ background: colors.background }} />;
  }

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
  
  return (
    <BaseScene theme={theme} opacity={exitOpacity} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '50px 60px',
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
        
        {/* Items Grid */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: data.items.length > 3 ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)',
            gap: 30,
            alignItems: 'center',
          }}
        >
          {data.items.map((item, index) => (
            <IconListItem
              key={index}
              item={item}
              index={index}
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
// ICON LIST ITEM COMPONENT
// ============================================================================

interface IconListItemProps {
  item: {
    icon: string;
    title: string;
    description?: string;
  };
  index: number;
  colors: ReturnType<typeof getTheme>;
  motionProfile: MotionProfileType;
}

function IconListItem({
  item,
  index,
  colors,
  motionProfile,
}: IconListItemProps): React.ReactElement {
  const stagger = useStaggeredEntry(index, 0.12, motionProfile);
  
  const iconPath = ICON_PATHS[item.icon.toLowerCase()] || ICON_PATHS.star;
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 20,
        padding: 24,
        background: `${colors.primary}10`,
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        opacity: stagger.opacity,
        transform: `translateY(${stagger.translateY}px) scale(${stagger.scale})`,
      }}
    >
      {/* Icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <svg
          width={24}
          height={24}
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ffffff"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {iconPath}
        </svg>
      </div>
      
      {/* Content */}
      <div>
        <h3
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.foreground,
            margin: '0 0 6px 0',
          }}
        >
          {item.title}
        </h3>
        {item.description && (
          <p
            style={{
              fontSize: 16,
              color: colors.muted,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            {item.description}
          </p>
        )}
      </div>
    </div>
  );
}
