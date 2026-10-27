// ============================================================================
// YOUR PLUGIN SCENE
// This file is the Remotion component that renders your video block.
//
// ⚠️  DO NOT change the function signature or props — the platform passes
//     these automatically. Only change the JSX/animation inside.
// ============================================================================

import React from 'react';
import { useCurrentFrame, useVideoConfig, interpolate, spring } from 'remotion';

// BaseScene handles background, alignment, padding, and enter/exit animations.
// Import it from the shared utils — it's already in the host app.
import { BaseScene, getThemeColors, extractCustomization } from '../../shared/plugin-utils';

// ──────────────────────────────────────────────────────────────────────────────
// YOUR DATA TYPE
// Match these fields to the properties you defined in schema.json
// ──────────────────────────────────────────────────────────────────────────────
interface MyPluginData {
  title?: string;
  subtitle?: string;
  color?: string;
  fontSize?: number;
  showSubtitle?: boolean;
  style?: 'minimal' | 'bold' | 'gradient';
  // BlockCustomization fields (alignment, background, etc.) are also in data
  [key: string]: unknown;
}

// ──────────────────────────────────────────────────────────────────────────────
// SCENE COMPONENT
// These props are ALWAYS provided by the platform — do not change the interface.
// ──────────────────────────────────────────────────────────────────────────────
interface SceneProps {
  data: MyPluginData;
  theme: string;            // e.g. 'dark_modern', 'light_minimal'
  animation: {
    enter: number;          // seconds
    hold: number;           // seconds
    exit: number;           // seconds
  };
  motionProfile?: 'subtle' | 'dynamic' | 'energetic';
}

export default function MyPluginScene({ data, theme, animation }: SceneProps): React.ReactElement {
  // ── Remotion hooks ────────────────────────────────────────────────────────
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // ── Theme colors ──────────────────────────────────────────────────────────
  const colors = getThemeColors(theme);

  // ── Your data fields ──────────────────────────────────────────────────────
  const {
    title = 'Hello World',
    subtitle = '',
    color = colors.accent,
    fontSize = 64,
    showSubtitle = true,
    style = 'minimal',
  } = data;

  // ThemeColors has: background, backgroundSecondary, text, textSecondary, accent, accentSecondary, border

  // ── Animations ────────────────────────────────────────────────────────────
  // Fade in during the enter phase
  const enterFrames = Math.round(animation.enter * fps);

  const opacity = interpolate(frame, [0, enterFrames], [0, 1], {
    extrapolateRight: 'clamp',
  });

  // Spring scale for a subtle pop effect
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 120, mass: 0.8 },
    from: 0.85,
    to: 1,
  });

  // Slide up
  const translateY = interpolate(frame, [0, enterFrames], [30, 0], {
    extrapolateRight: 'clamp',
  });

  // ── Gradient style (only when style === 'gradient') ───────────────────────
  const titleStyle: React.CSSProperties = {
    fontSize,
    fontWeight: 900,
    letterSpacing: -1,
    lineHeight: 1.1,
    color: style === 'gradient' ? 'transparent' : (style === 'bold' ? colors.text : color),
    ...(style === 'gradient' ? {
      background: `linear-gradient(135deg, ${color}, ${colors.accent})`,
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    } : {}),
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    // BaseScene handles: background, border, shadow, padding, alignment
    // from the BlockCustomization fields in data
    <BaseScene theme={theme} customization={extractCustomization(data)} animation={animation}>
      <div
        style={{
          opacity,
          transform: `scale(${scale}) translateY(${translateY}px)`,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 20,
          textAlign: 'center',
          padding: '0 40px',
        }}
      >
        {/* Title */}
        <h1 style={titleStyle}>{title}</h1>

        {/* Subtitle */}
        {showSubtitle && subtitle && (
          <p
            style={{
              fontSize: Math.round(fontSize * 0.35),
              color: colors.textSecondary,
              fontWeight: 400,
              maxWidth: '80%',
              lineHeight: 1.5,
            }}
          >
            {subtitle}
          </p>
        )}
      </div>
    </BaseScene>
  );
}
