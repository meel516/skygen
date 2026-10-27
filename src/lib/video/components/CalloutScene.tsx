import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import {
  useFadeIn,
  useScaleIn,
  useSlideIn,
  type MotionProfileType,
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { CalloutBlock, AnimationPhase } from '../schemas';

export interface CalloutSceneProps {
  data: CalloutBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function CalloutScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: CalloutSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const customization = extractCustomization(data);

  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration  = animation?.hold  ?? 2.5;

  const cardScale   = useScaleIn(0.5, 0, motionProfile);
  const cardOpacity = useFadeIn(0.4, 0, motionProfile);

  const titleSlide   = useSlideIn('up', 30, 0.4, 0.15, motionProfile);
  const titleOpacity = useFadeIn(0.3, 0.15, motionProfile);

  const contentSlide   = useSlideIn('up', 20, 0.4, 0.28, motionProfile);
  const contentOpacity = useFadeIn(0.3, 0.28, motionProfile);

  // Icon ring animation
  const iconRingProgress = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });

  // Exit
  const exitStart    = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity  = 1 - exitProgress;

  const variantColors: Record<string, { bg: string; border: string; icon: string; glow: string }> = {
    success: { bg: '#10b98112', border: '#10b981', icon: '#10b981', glow: '#10b98130' },
    warning: { bg: '#f59e0b12', border: '#f59e0b', icon: '#f59e0b', glow: '#f59e0b30' },
    info:    { bg: '#3b82f612', border: '#3b82f6', icon: '#3b82f6', glow: '#3b82f630' },
    error:   { bg: '#ef444412', border: '#ef4444', icon: '#ef4444', glow: '#ef444430' },
    default: { bg: `${colors.primary}12`, border: colors.primary, icon: colors.primary, glow: `${colors.primary}30` },
  };

  const variant = variantColors[data.variant ?? 'default'] ?? variantColors.default;

  const iconPath: Record<string, React.ReactElement> = {
    success: (
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={variant.icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
      </svg>
    ),
    warning: (
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={variant.icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
    info: (
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={variant.icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    ),
    error: (
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={variant.icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
      </svg>
    ),
    default: (
      <svg width={40} height={40} viewBox="0 0 24 24" fill="none" stroke={variant.icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  };

  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 60,
        }}
      >
        {/* Glass card */}
        <div
          style={{
            background: variant.bg,
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: `2px solid ${variant.border}40`,
            borderRadius: 28,
            padding: '52px 64px',
            maxWidth: 820,
            width: '100%',
            transform: `scale(${cardScale})`,
            opacity: cardOpacity,
            boxShadow: `0 24px 80px ${variant.glow}, 0 0 0 1px ${variant.border}20 inset`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Gradient accent line at top */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 3,
              background: `linear-gradient(90deg, transparent, ${variant.border}, ${variant.border}aa, transparent)`,
              opacity: titleOpacity,
            }}
          />

          {/* Subtle corner glow */}
          <div
            style={{
              position: 'absolute',
              top: -60, right: -60,
              width: 200,
              height: 200,
              borderRadius: '50%',
              background: `radial-gradient(circle, ${variant.glow} 0%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          {/* Icon with animated ring */}
          <div
            style={{
              marginBottom: 28,
              opacity: titleOpacity,
              transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div style={{ position: 'relative', width: 72, height: 72 }}>
              {/* Ring */}
              <svg
                width={72}
                height={72}
                viewBox="0 0 72 72"
                style={{ position: 'absolute', top: 0, left: 0 }}
              >
                <circle cx={36} cy={36} r={30} fill={`${variant.border}15`} />
                <circle
                  cx={36} cy={36} r={30}
                  fill="none"
                  stroke={variant.border}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeDasharray={`${188 * iconRingProgress} 188`}
                  strokeDashoffset={47}
                  style={{
                    filter: `drop-shadow(0 0 6px ${variant.border}88)`,
                  }}
                />
              </svg>
              {/* Icon centered */}
              <div
                style={{
                  position: 'absolute',
                  top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {iconPath[data.variant ?? 'default'] ?? iconPath.default}
              </div>
            </div>
          </div>

          {/* Title */}
          <h2
            style={{
              fontSize: 44,
              fontWeight: 700,
              fontFamily: '"Inter", system-ui, sans-serif',
              color: colors.foreground,
              margin: '0 0 18px 0',
              lineHeight: 1.2,
              opacity: titleOpacity,
              transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
            }}
          >
            {data.title}
          </h2>

          {/* Content */}
          <p
            style={{
              fontSize: 27,
              fontFamily: '"Inter", system-ui, sans-serif',
              color: colors.muted,
              margin: 0,
              lineHeight: 1.6,
              opacity: contentOpacity,
              transform: `translate(${contentSlide.x}px, ${contentSlide.y}px)`,
            }}
          >
            {data.content}
          </p>
        </div>
      </div>
    </BaseScene>
  );
}
