import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { 
  useFadeIn, 
  useScaleIn, 
  useSlideIn, 
  useCountUp,
  usePulse,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { StatBlock, AnimationPhase } from '../schemas';

// ============================================================================
// STAT SCENE COMPONENT
// ============================================================================

export interface StatSceneProps {
  data: StatBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function StatScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: StatSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 2;
  
  // Physics-based animations
  const valueScale = useScaleIn(0.6, 0, motionProfile);
  const valueOpacity = useFadeIn(0.4, 0, motionProfile);
  
  const headingSlide = useSlideIn('up', 40, 0.5, 0.15, motionProfile);
  const headingOpacity = useFadeIn(0.4, 0.15, motionProfile);
  
  const subtextSlide = useSlideIn('up', 20, 0.4, 0.3, motionProfile);
  const subtextOpacity = useFadeIn(0.4, 0.3, motionProfile);
  
  // Pulse for emphasis
  const pulse = usePulse(2, 1.02);
  
  // Extract numeric value for count-up
  const numericValue = parseFloat(data.value.replace(/[^0-9.]/g, ''));
  const suffix = data.value.replace(/[0-9.,]/g, '');
  
  // Animated count
  const animatedValue = useCountUp(
    isNaN(numericValue) ? 0 : numericValue,
    0.8,
    0.1,
    motionProfile
  );
  
  // Display value
  const displayValue = isNaN(numericValue) 
    ? data.value 
    : `${animatedValue.toLocaleString()}${suffix}`;
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  const exitScale = interpolate(exitProgress, [0, 1], [1, 0.95]);
  
  // SVG ring animation (draws in as value counts up)
  const ringProgress = Math.min(1, frame / (fps * 1.5));
  const ringRadius   = 260;
  const ringCircumf  = 2 * Math.PI * ringRadius;
  const ringDash     = ringCircumf * ringProgress;

  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      {/* Spotlight glow blob */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 700,
            borderRadius: '50%',
            background: `radial-gradient(circle, ${colors.primary}18 0%, transparent 65%)`,
            filter: 'blur(80px)',
          }}
        />
      </AbsoluteFill>

      {/* Decorative ring behind value */}
      <AbsoluteFill style={{ pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width={560} height={560} viewBox="0 0 560 560" style={{ opacity: 0.25 }}>
          <circle cx={280} cy={280} r={ringRadius} fill="none" stroke={`${colors.primary}30`} strokeWidth={2} />
          <circle
            cx={280} cy={280} r={ringRadius}
            fill="none"
            stroke={colors.primary}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeDasharray={`${ringDash} ${ringCircumf - ringDash}`}
            strokeDashoffset={ringCircumf * 0.25}
            style={{ transform: 'rotate(-90deg)', transformOrigin: '280px 280px' }}
          />
        </svg>
      </AbsoluteFill>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 30,
          transform: `scale(${exitScale})`,
        }}
      >
        {/* Heading */}
        <div
          style={{
            transform: `translate(${headingSlide.x}px, ${headingSlide.y}px)`,
            opacity: headingOpacity,
          }}
        >
          <h2
            style={{
              fontSize: 36,
              fontWeight: 500,
              color: colors.muted,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '4px',
            }}
          >
            {data.heading}
          </h2>
        </div>
        
        {/* Value */}
        <div
          style={{
            transform: `scale(${valueScale * pulse})`,
            opacity: valueOpacity,
          }}
        >
          <div
            style={{
              fontSize: 140,
              fontWeight: 800,
              background: `linear-gradient(135deg, ${colors.foreground}, ${colors.primary})`,
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              margin: 0,
              lineHeight: 1,
            }}
          >
            {displayValue}
          </div>
        </div>
        
        {/* Subtext */}
        {data.subtext && (
          <div
            style={{
              transform: `translate(${subtextSlide.x}px, ${subtextSlide.y}px)`,
              opacity: subtextOpacity,
            }}
          >
            <p
              style={{
                fontSize: 24,
                color: colors.muted,
                margin: 0,
                textAlign: 'center',
                maxWidth: 600,
              }}
            >
              {data.subtext}
            </p>
          </div>
        )}
        
        {/* Decorative line */}
        <div
          style={{
            width: 100,
            height: 3,
            background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
            marginTop: 20,
            opacity: headingOpacity,
          }}
        />
      </div>
    </BaseScene>
  );
}

// ============================================================================
// MULTI-STAT SCENE (for multiple stats)
// ============================================================================

export interface MultiStatSceneProps {
  stats: Array<{
    heading: string;
    value: string;
    subtext?: string;
  }>;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function MultiStatScene({
  stats,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
}: MultiStatSceneProps): React.ReactElement {
  const colors = getTheme(theme);
  
  return (
    <BaseScene theme={theme}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: stats.length > 2 ? 'repeat(2, 1fr)' : 'repeat(1, 1fr)',
          gap: 60,
          width: '100%',
          padding: 40,
        }}
      >
        {stats.map((stat, index) => (
          <StatCard 
            key={index} 
            stat={stat} 
            index={index} 
            theme={theme}
            motionProfile={motionProfile}
            colors={colors}
          />
        ))}
      </div>
    </BaseScene>
  );
}

interface StatCardProps {
  stat: {
    heading: string;
    value: string;
    subtext?: string;
  };
  index: number;
  theme: string;
  motionProfile: MotionProfileType;
  colors: ReturnType<typeof getTheme>;
}

function StatCard({ stat, index, theme, motionProfile, colors }: StatCardProps): React.ReactElement {
  const scale = useScaleIn(0.5, index * 0.15, motionProfile);
  const opacity = useFadeIn(0.4, index * 0.15, motionProfile);
  
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: 40,
        background: `${colors.primary}10`,
        borderRadius: 24,
        border: `1px solid ${colors.border}`,
        transform: `scale(${scale})`,
        opacity,
      }}
    >
      <span
        style={{
          fontSize: 24,
          fontWeight: 500,
          color: colors.muted,
          textTransform: 'uppercase',
          letterSpacing: '2px',
        }}
      >
        {stat.heading}
      </span>
      <span
        style={{
          fontSize: 64,
          fontWeight: 800,
          color: colors.foreground,
        }}
      >
        {stat.value}
      </span>
      {stat.subtext && (
        <span
          style={{
            fontSize: 18,
            color: colors.muted,
          }}
        >
          {stat.subtext}
        </span>
      )}
    </div>
  );
}
