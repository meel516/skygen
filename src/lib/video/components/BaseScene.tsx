import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import { Audio } from '@remotion/media';
import { getTheme, type ThemeColors } from '../utils/theme';
import type { BlockCustomization } from '../schemas';

// ============================================================================
// BASE SCENE WRAPPER
// ============================================================================

export interface BaseSceneProps {
  theme?: string;
  children: React.ReactNode;
  opacity?: number;
  style?: React.CSSProperties;
  customization?: Partial<BlockCustomization>;
  animation?: { enter: number; hold: number; exit: number };
  audioSrc?: string;
  audioVolume?: number;
}

/**
 * Get animation transforms based on animation type and progress
 */
function getAnimationTransform(
  animationType: string,
  progress: number,
  frame: number,
  fps: number
): { transform: string; opacity: number } {
  const clampedProgress = Math.max(0, Math.min(1, progress));
  
  switch (animationType) {
    case 'slide-up':
      return {
        transform: `translateY(${interpolate(clampedProgress, [0, 1], [50, 0])}px)`,
        opacity: clampedProgress,
      };
    case 'slide-down':
      return {
        transform: `translateY(${interpolate(clampedProgress, [0, 1], [-50, 0])}px)`,
        opacity: clampedProgress,
      };
    case 'slide-left':
      return {
        transform: `translateX(${interpolate(clampedProgress, [0, 1], [50, 0])}px)`,
        opacity: clampedProgress,
      };
    case 'slide-right':
      return {
        transform: `translateX(${interpolate(clampedProgress, [0, 1], [-50, 0])}px)`,
        opacity: clampedProgress,
      };
    case 'zoom':
      return {
        transform: `scale(${interpolate(clampedProgress, [0, 1], [0.8, 1])})`,
        opacity: clampedProgress,
      };
    case 'bounce':
      const bounceProgress = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });
      return {
        transform: `scale(${bounceProgress})`,
        opacity: bounceProgress,
      };
    case 'rotate':
      return {
        transform: `rotate(${interpolate(clampedProgress, [0, 1], [-180, 0])}deg) scale(${clampedProgress})`,
        opacity: clampedProgress,
      };
    case 'flip':
      return {
        transform: `perspective(400px) rotateY(${interpolate(clampedProgress, [0, 1], [90, 0])}deg)`,
        opacity: clampedProgress,
      };
    case 'none':
      return {
        transform: 'none',
        opacity: 1,
      };
    case 'fade':
    default:
      return {
        transform: 'none',
        opacity: clampedProgress,
      };
  }
}

/**
 * Base scene wrapper with theme support and block customizations
 */
export function BaseScene({
  theme = 'dark_modern',
  children,
  opacity = 1,
  style,
  customization,
  animation,
  audioSrc,
  audioVolume = 0.8,
}: BaseSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const fps = 30;
  const colors = getTheme(theme);
  
  // Default customizations
  const cust = customization || {};
  const enterAnim = cust.enterAnimation || 'fade';
  const animDuration = (cust.animationDuration || 0.5) * fps;
  
  // Map alignment to CSS values
  const justifyContentMap: Record<string, string> = {
    'top': 'flex-start',
    'center': 'center',
    'bottom': 'flex-end',
  };
  
  const alignItemsMap: Record<string, string> = {
    'left': 'flex-start',
    'center': 'center',
    'right': 'flex-end',
  };
  
  const verticalAlign = cust.verticalAlign || 'center';
  const horizontalAlign = cust.horizontalAlign || 'center';
  
  // Calculate animation progress
  const animProgress = animation 
    ? Math.min(frame / animDuration, 1)
    : 1;
  
  // Get animation transforms
  const animStyle = getAnimationTransform(enterAnim, animProgress, frame, fps);
  
  // Build container styles - use padding from customization or default 60
  const containerStyle: React.CSSProperties = {
    backgroundColor: cust.backgroundColor || colors.background,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: justifyContentMap[verticalAlign],
    alignItems: alignItemsMap[horizontalAlign],
    padding: cust.padding !== undefined ? cust.padding : 60,
    margin: cust.margin || 0,
    opacity: opacity * animStyle.opacity,
    transform: animStyle.transform,
    ...style,
  };
  
  // Add background image if provided
  if (cust.backgroundImage) {
    containerStyle.backgroundImage = `url(${cust.backgroundImage})`;
    containerStyle.backgroundSize = 'cover';
    containerStyle.backgroundPosition = 'center';
  }
  
  // Add border styles - content wrapper should also center content
  const contentWrapperStyle: React.CSSProperties = {
    position: 'relative',
    zIndex: 1,
    width: '100%',
    height: '100%',
    borderRadius: cust.borderRadius || 0,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  };
  
  if (cust.borderColor) {
    contentWrapperStyle.border = `${cust.borderWidth || 1}px solid ${cust.borderColor}`;
  }
  
  if (cust.shadowEnabled) {
    contentWrapperStyle.boxShadow = `0 ${cust.shadowBlur || 20}px ${cust.shadowBlur || 20}px ${cust.shadowColor || 'rgba(0,0,0,0.5)'}`;
  }
  
  return (
    <AbsoluteFill style={containerStyle}>
      {/* Background gradient overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `radial-gradient(ellipse at 30% 20%, ${colors.primary}15 0%, transparent 50%),
                       radial-gradient(ellipse at 70% 80%, ${colors.secondary}10 0%, transparent 50%)`,
          backdropFilter: cust.backgroundBlur ? `blur(${cust.backgroundBlur}px)` : undefined,
          pointerEvents: 'none',
        }}
      />

      {/* Block narration audio */}
      {audioSrc && <Audio src={audioSrc} volume={audioVolume} />}

      {/* Content */}
      <div style={contentWrapperStyle}>
        {children}
      </div>
    </AbsoluteFill>
  );
}

/**
 * Text component with theme colors
 */
export function ThemedText({
  children,
  variant = 'primary',
  theme = 'dark_modern',
  style,
}: {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'accent' | 'muted';
  theme?: string;
  style?: React.CSSProperties;
}): React.ReactElement {
  const colors = getTheme(theme);
  
  const colorMap: Record<string, string> = {
    primary: colors.foreground,
    secondary: colors.muted,
    accent: colors.accent,
    muted: colors.muted,
  };
  
  return (
    <span style={{ color: colorMap[variant], ...style }}>
      {children}
    </span>
  );
}

/**
 * Container with centered content
 */
export function CenteredContent({ 
  children, 
  style 
}: { 
  children: React.ReactNode;
  style?: React.CSSProperties;
}): React.ReactElement {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Extract customization props from block data
 */
export function extractCustomization<T extends Partial<BlockCustomization>>(data: T): Partial<BlockCustomization> {
  return {
    verticalAlign: data.verticalAlign,
    horizontalAlign: data.horizontalAlign,
    enterAnimation: data.enterAnimation,
    exitAnimation: data.exitAnimation,
    animationDuration: data.animationDuration,
    backgroundColor: data.backgroundColor,
    backgroundImage: data.backgroundImage,
    backgroundBlur: data.backgroundBlur,
    borderColor: data.borderColor,
    borderWidth: data.borderWidth,
    borderRadius: data.borderRadius,
    shadowEnabled: data.shadowEnabled,
    shadowColor: data.shadowColor,
    shadowBlur: data.shadowBlur,
    padding: data.padding,
    margin: data.margin,
  };
}
