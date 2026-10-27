import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { CTABlock, AnimationPhase } from '../schemas';

interface CTASceneProps {
  data: CTABlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function CTAScene({ data, theme, motionProfile, animation }: CTASceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const {
    text,
    description,
    buttonStyle = 'primary',
    color,
    size = 'large',
    icon,
    pulse = true,
  } = data;

  const customization = extractCustomization(data);

  // Entrance
  const opacity = interpolate(frame, [0, animation.enter * fps], [0, 1], { extrapolateRight: 'clamp' });
  const enterSpring = spring({ frame, fps, config: { damping: 12, stiffness: 80 } });
  const translateY = interpolate(enterSpring, [0, 1], [60, 0]);

  // Description stagger
  const descOpacity = interpolate(frame, [animation.enter * fps * 0.3, animation.enter * fps * 0.9], [0, 1], { extrapolateRight: 'clamp' });
  const descY = interpolate(frame, [animation.enter * fps * 0.3, animation.enter * fps * 0.9], [30, 0], { extrapolateRight: 'clamp' });

  // Pulse animation on button
  const pulseScale = pulse
    ? 1 + Math.sin(frame * 0.12) * 0.035
    : 1;

  // Shimmer position (sweeps across button every 2 seconds)
  const shimmerCycle = ((frame / fps) % 2) / 2;
  const shimmerX     = interpolate(shimmerCycle, [0, 1], [-100, 200]);

  // Arrow bounce
  const arrowBounce = Math.sin(frame * 0.18) * 8;

  // Glow pulse
  const glowIntensity = 0.35 + Math.sin(frame * 0.1) * 0.15;

  const accentColor = color || colors.primary;

  const sizes = {
    small:  { padding: '14px 36px', fontSize: 22, borderRadius: 12 },
    medium: { padding: '18px 52px', fontSize: 28, borderRadius: 16 },
    large:  { padding: '22px 72px', fontSize: 34, borderRadius: 20 },
  };
  const sizeConfig = sizes[size] || sizes.large;

  const buttonStyles: Record<string, React.CSSProperties> = {
    primary: {
      background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
      color: '#FFFFFF',
      border: 'none',
    },
    secondary: {
      background: colors.surface,
      color: colors.foreground,
      border: `2px solid ${colors.border}`,
    },
    outline: {
      background: 'transparent',
      color: accentColor,
      border: `3px solid ${accentColor}`,
    },
    ghost: {
      background: 'transparent',
      color: colors.foreground,
      border: 'none',
    },
  };
  const styleConfig = buttonStyles[buttonStyle] || buttonStyles.primary;

  return (
    <BaseScene theme={theme} customization={customization} animation={animation} opacity={opacity} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 36,
          transform: `translateY(${translateY}px)`,
        }}
      >
        {/* Description */}
        {description && (
          <p
            style={{
              fontSize: 30,
              fontFamily: '"Inter", system-ui, sans-serif',
              color: colors.muted,
              textAlign: 'center',
              maxWidth: 560,
              lineHeight: 1.6,
              margin: 0,
              opacity: descOpacity,
              transform: `translateY(${descY}px)`,
              fontWeight: 400,
            }}
          >
            {description}
          </p>
        )}

        {/* CTA Button with shimmer */}
        <div style={{ position: 'relative', overflow: 'hidden', borderRadius: sizeConfig.borderRadius }}>
          {/* Shimmer overlay */}
          {buttonStyle === 'primary' && (
            <div
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: `linear-gradient(105deg, transparent ${shimmerX - 30}%, rgba(255,255,255,0.25) ${shimmerX}%, rgba(255,255,255,0.4) ${shimmerX + 15}%, rgba(255,255,255,0.25) ${shimmerX + 30}%, transparent ${shimmerX + 60}%)`,
                zIndex: 2,
                borderRadius: sizeConfig.borderRadius,
                pointerEvents: 'none',
              }}
            />
          )}

          <button
            style={{
              position: 'relative',
              padding: sizeConfig.padding,
              fontSize: sizeConfig.fontSize,
              fontFamily: '"Inter", system-ui, sans-serif',
              fontWeight: 800,
              letterSpacing: '-0.01em',
              color: styleConfig.color,
              background: styleConfig.background,
              border: styleConfig.border,
              borderRadius: sizeConfig.borderRadius,
              cursor: 'pointer',
              transform: `scale(${pulseScale * enterSpring})`,
              boxShadow: buttonStyle === 'primary'
                ? `0 8px 40px ${accentColor}${Math.round(glowIntensity * 255).toString(16).padStart(2, '0')}, 0 0 80px ${accentColor}20`
                : '0 10px 30px rgba(0,0,0,0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              zIndex: 1,
            }}
          >
            {icon && <span style={{ fontSize: sizeConfig.fontSize * 1.2 }}>{icon}</span>}
            {text}
            {/* Animated arrow */}
            <span
              style={{
                display: 'inline-block',
                transform: `translateX(${arrowBounce}px)`,
                fontSize: sizeConfig.fontSize * 0.9,
              }}
            >
              →
            </span>
          </button>
        </div>

        {/* Subtle tagline accent line */}
        <div
          style={{
            width: interpolate(enterSpring, [0, 1], [0, 120]),
            height: 2,
            background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`,
            opacity: 0.6,
          }}
        />
      </div>
    </BaseScene>
  );
}
