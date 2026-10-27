import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';
import { BaseScene, getThemeColors, extractCustomization } from '../../shared/plugin-utils';

interface AnnouncementData {
  emoji?: string;
  headline?: string;
  subtext?: string;
  accentColor?: string;
  showSubtext?: boolean;
  textSize?: number;
  [key: string]: unknown;
}

interface SceneProps {
  data: AnnouncementData;
  theme: string;
  animation: { enter: number; hold: number; exit: number };
  motionProfile?: 'subtle' | 'dynamic' | 'energetic';
}

export default function AnnouncementScene({ data, theme, animation }: SceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getThemeColors(theme);

  const {
    emoji = '🚀',
    headline = 'Big Announcement!',
    subtext = 'Something exciting is coming',
    accentColor = '#F59E0B',
    showSubtext = true,
    textSize = 72,
  } = data;

  const enterFrames = Math.round(animation.enter * fps);

  // Fade + slide up for the whole card
  const opacity = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: 'clamp' });
  const translateY = interpolate(frame, [0, enterFrames], [40, 0], { extrapolateRight: 'clamp' });

  // Emoji bounce
  const emojiScale = spring({
    frame: Math.max(0, frame - Math.round(enterFrames * 0.3)),
    fps,
    config: { damping: 10, stiffness: 180, mass: 0.6 },
    from: 0,
    to: 1,
  });

  // Headline word-by-word stagger (simplified: slide from left)
  const headlineX = interpolate(frame, [0, enterFrames], [-60, 0], { extrapolateRight: 'clamp' });

  // Subtext fade in slightly after headline
  const subtextDelay = Math.round(enterFrames * 0.5);
  const subtextOpacity = interpolate(
    frame,
    [subtextDelay, subtextDelay + Math.round(fps * 0.4)],
    [0, 1],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  // Pulsing accent line
  const lineWidth = interpolate(
    frame,
    [enterFrames, enterFrames + fps],
    [0, 80],
    { extrapolateRight: 'clamp', extrapolateLeft: 'clamp' }
  );

  return (
    <BaseScene theme={theme} customization={extractCustomization(data)} animation={animation}>
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
          textAlign: 'center',
          padding: '0 60px',
          maxWidth: 900,
        }}
      >
        {/* Emoji */}
        <div
          style={{
            fontSize: 96,
            transform: `scale(${emojiScale})`,
            lineHeight: 1,
            filter: `drop-shadow(0 0 20px ${accentColor}88)`,
          }}
        >
          {emoji}
        </div>

        {/* Accent line */}
        <div
          style={{
            width: `${lineWidth}px`,
            height: 4,
            borderRadius: 2,
            background: `linear-gradient(90deg, ${accentColor}, ${accentColor}44)`,
            transition: 'none',
          }}
        />

        {/* Headline */}
        <h1
          style={{
            fontSize: textSize,
            fontWeight: 900,
            letterSpacing: -2,
            lineHeight: 1.05,
            color: colors.text,
            transform: `translateX(${headlineX}px)`,
            margin: 0,
            textShadow: `0 0 40px ${accentColor}44`,
          }}
        >
          {headline}
        </h1>

        {/* Subtext */}
        {showSubtext && subtext && (
          <p
            style={{
              fontSize: Math.round(textSize * 0.32),
              color: colors.textSecondary,
              fontWeight: 400,
              lineHeight: 1.5,
              maxWidth: '75%',
              opacity: subtextOpacity,
              margin: 0,
            }}
          >
            {subtext}
          </p>
        )}
      </div>
    </BaseScene>
  );
}
