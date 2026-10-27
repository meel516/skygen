import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring, Easing, AbsoluteFill } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { CounterBlock, AnimationPhase } from '../schemas';

interface CounterSceneProps {
  data: CounterBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function CounterScene({ data, theme, motionProfile, animation }: CounterSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const {
    label,
    from = 0,
    to = 100,
    duration = 3,
    prefix = '',
    suffix = '',
    decimals = 0,
    color,
    animationStyle = 'easeOut',
  } = data;

  const customization = extractCustomization(data);

  const progress = Math.min(frame / (duration * fps), 1);

  let easedProgress: number;
  switch (animationStyle) {
    case 'linear':
      easedProgress = progress;
      break;
    case 'bounce':
      easedProgress = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });
      break;
    case 'easeInOut':
      easedProgress = interpolate(progress, [0, 1], [0, 1], { easing: Easing.inOut(Easing.ease) });
      break;
    default:
      easedProgress = interpolate(progress, [0, 1], [0, 1], { easing: Easing.out(Easing.ease) });
  }

  const currentValue = from + (to - from) * easedProgress;
  const isComplete = easedProgress >= 0.99;

  const opacity = interpolate(frame, [0, animation.enter * fps], [0, 1], { extrapolateRight: 'clamp' });
  const scale   = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
  const y       = interpolate(frame, [0, animation.enter * fps], [50, 0], { extrapolateRight: 'clamp' });

  const formattedValue = decimals > 0
    ? currentValue.toFixed(decimals)
    : Math.round(currentValue).toLocaleString();

  const accentColor = color || colors.primary;

  // Ring fill: SVG circle that draws as progress increases
  const ringRadius     = 200;
  const ringCircumf    = 2 * Math.PI * ringRadius;
  const ringDash       = ringCircumf * easedProgress;
  const ringGap        = ringCircumf - ringDash;

  // Pulse glow when complete
  const completePulse = isComplete
    ? 1 + 0.06 * Math.sin((frame / fps) * Math.PI * 3)
    : 1;

  // Particle burst on completion
  const particles = isComplete
    ? Array.from({ length: 8 }).map((_, i) => {
        const angle   = (i / 8) * Math.PI * 2;
        const burstFr = frame - duration * fps;
        const dist    = Math.min(160, burstFr * 12);
        const pOpacity = interpolate(burstFr, [0, 20, 40], [1, 0.6, 0], { extrapolateRight: 'clamp' });
        return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist, opacity: pOpacity };
      })
    : [];

  return (
    <BaseScene theme={theme} customization={customization} animation={animation} opacity={opacity} audioSrc={data.audioSrc}>
      <div
        style={{
          transform: `translateY(${y}px) scale(${scale * completePulse})`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          position: 'relative',
        }}
      >
        {/* Glowing ring */}
        <div style={{ position: 'relative', width: 440, height: 440 }}>
          <svg
            width={440}
            height={440}
            viewBox="0 0 440 440"
            style={{ position: 'absolute', top: 0, left: 0 }}
          >
            {/* Background ring */}
            <circle
              cx={220} cy={220} r={ringRadius}
              fill="none"
              stroke={`${accentColor}18`}
              strokeWidth={14}
            />
            {/* Animated fill ring */}
            <circle
              cx={220} cy={220} r={ringRadius}
              fill="none"
              stroke={accentColor}
              strokeWidth={14}
              strokeLinecap="round"
              strokeDasharray={`${ringDash} ${ringGap}`}
              strokeDashoffset={ringCircumf * 0.25}
              style={{
                filter: `drop-shadow(0 0 12px ${accentColor}88)`,
                transform: 'rotate(-90deg)',
                transformOrigin: '220px 220px',
              }}
            />
            {/* Glow dots at tip */}
            {easedProgress > 0.02 && (
              <circle
                cx={220 + ringRadius * Math.cos((easedProgress * 2 * Math.PI) - Math.PI / 2)}
                cy={220 + ringRadius * Math.sin((easedProgress * 2 * Math.PI) - Math.PI / 2)}
                r={10}
                fill={accentColor}
                style={{ filter: `drop-shadow(0 0 8px ${accentColor})` }}
              />
            )}
          </svg>

          {/* Center content */}
          <div
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {/* Value */}
            <div
              style={{
                fontSize: 110,
                fontWeight: 800,
                fontFamily: '"Inter", system-ui, sans-serif',
                lineHeight: 1,
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: 'none',
                filter: isComplete ? `drop-shadow(0 0 20px ${accentColor}88)` : 'none',
              }}
            >
              {prefix}{formattedValue}{suffix}
            </div>

            {/* Label */}
            <div
              style={{
                fontSize: 28,
                fontFamily: '"Inter", system-ui, sans-serif',
                color: colors.muted,
                letterSpacing: '3px',
                textTransform: 'uppercase',
                fontWeight: 500,
              }}
            >
              {label}
            </div>
          </div>
        </div>

        {/* Particle burst */}
        {particles.map((p, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: accentColor,
              transform: `translate(calc(-50% + ${p.x}px), calc(-50% + ${p.y}px))`,
              opacity: p.opacity,
              boxShadow: `0 0 8px ${accentColor}`,
            }}
          />
        ))}
      </div>
    </BaseScene>
  );
}
