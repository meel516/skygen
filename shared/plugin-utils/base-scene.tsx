// ============================================================================
// BASE SCENE COMPONENT - Foundation for all plugin scenes
// ============================================================================

import React, { useMemo, useEffect, useState } from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import type { BlockCustomizationProps, AnimationConfig } from '../plugin-types';

/**
 * Theme colors configuration
 */
export const THEMES: Record<string, ThemeColors> = {
  dark_modern: {
    background: '#0A0A0A',
    backgroundSecondary: '#1A1A1A',
    text: '#FFFFFF',
    textSecondary: '#9CA3AF',
    accent: '#3B82F6',
    accentSecondary: '#8B5CF6',
    border: 'rgba(255,255,255,0.1)',
  },
  light_clean: {
    background: '#FFFFFF',
    backgroundSecondary: '#F5F5F5',
    text: '#1F2937',
    textSecondary: '#6B7280',
    accent: '#3B82F6',
    accentSecondary: '#6366F1',
    border: 'rgba(0,0,0,0.1)',
  },
  gradient_vibrant: {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    backgroundSecondary: 'rgba(255,255,255,0.1)',
    text: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.8)',
    accent: '#FCD34D',
    accentSecondary: '#F472B6',
    border: 'rgba(255,255,255,0.2)',
  },
  minimal_bw: {
    background: '#000000',
    backgroundSecondary: '#111111',
    text: '#FFFFFF',
    textSecondary: '#666666',
    accent: '#FFFFFF',
    accentSecondary: '#888888',
    border: 'rgba(255,255,255,0.05)',
  },
};

export interface ThemeColors {
  background: string;
  backgroundSecondary: string;
  text: string;
  textSecondary: string;
  accent: string;
  accentSecondary: string;
  border: string;
}

/**
 * Base scene props
 */
export interface BaseSceneProps {
  children: React.ReactNode;
  theme?: string;
  customization?: Partial<BlockCustomizationProps>;
  animation?: AnimationConfig;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Base Scene Component
 * Provides common functionality for all plugin scenes:
 * - Theme support
 * - Customization (alignment, padding, etc.)
 * - Enter/Exit animations
 * - Background handling
 */
export const BaseScene: React.FC<BaseSceneProps> = ({
  children,
  theme = 'dark_modern',
  customization = {},
  animation = { enter: 0.4, hold: 2, exit: 0.4 },
  className = '',
  style = {},
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  
  // Get theme colors
  const themeColors = THEMES[theme] || THEMES.dark_modern;
  
  // Animation calculations
  const totalFrames = (animation.enter + animation.hold + animation.exit) * fps;
  const enterEndFrame = animation.enter * fps;
  const exitStartFrame = (animation.enter + animation.hold) * fps;
  
  // Enter animation progress (0 to 1 during enter phase)
  const enterProgress = frame <= enterEndFrame
    ? frame / enterEndFrame
    : 1;
  
  // Exit animation progress (0 to 1 during exit phase)
  const exitProgress = frame >= exitStartFrame
    ? (frame - exitStartFrame) / (animation.exit * fps)
    : 0;
  
  // Get animation style based on customization
  const animationStyle = useMemo(() => {
    const enterAnim = customization.enterAnimation || 'fade';
    const exitAnim = customization.exitAnimation || 'fade';
    
    const enterStyles: Record<string, React.CSSProperties> = {
      'fade': { opacity: enterProgress },
      'slide-up': { 
        opacity: enterProgress,
        transform: `translateY(${interpolate(enterProgress, [0, 1], [50, 0])}px)`,
      },
      'slide-down': { 
        opacity: enterProgress,
        transform: `translateY(${interpolate(enterProgress, [0, 1], [-50, 0])}px)`,
      },
      'slide-left': { 
        opacity: enterProgress,
        transform: `translateX(${interpolate(enterProgress, [0, 1], [50, 0])}px)`,
      },
      'slide-right': { 
        opacity: enterProgress,
        transform: `translateX(${interpolate(enterProgress, [0, 1], [-50, 0])}px)`,
      },
      'zoom': { 
        opacity: enterProgress,
        transform: `scale(${interpolate(enterProgress, [0, 1], [0.8, 1])})`,
      },
      'bounce': {
        opacity: enterProgress,
        transform: `scale(${spring({ frame, fps, config: { damping: 10, stiffness: 100 } })})`,
      },
      'rotate': {
        opacity: enterProgress,
        transform: `rotate(${interpolate(enterProgress, [0, 1], [-10, 0])}deg)`,
      },
      'flip': {
        opacity: enterProgress,
        transform: `rotateY(${interpolate(enterProgress, [0, 1], [90, 0])}deg)`,
      },
      'none': {},
    };
    
    const exitStyles: Record<string, React.CSSProperties> = {
      'fade': { opacity: 1 - exitProgress },
      'slide-up': { 
        opacity: 1 - exitProgress,
        transform: `translateY(${interpolate(exitProgress, [0, 1], [0, -50])}px)`,
      },
      'slide-down': { 
        opacity: 1 - exitProgress,
        transform: `translateY(${interpolate(exitProgress, [0, 1], [0, 50])}px)`,
      },
      'slide-left': { 
        opacity: 1 - exitProgress,
        transform: `translateX(${interpolate(exitProgress, [0, 1], [0, -50])}px)`,
      },
      'slide-right': { 
        opacity: 1 - exitProgress,
        transform: `translateX(${interpolate(exitProgress, [0, 1], [0, 50])}px)`,
      },
      'zoom': { 
        opacity: 1 - exitProgress,
        transform: `scale(${interpolate(exitProgress, [0, 1], [1, 0.8])})`,
      },
      'bounce': { opacity: 1 - exitProgress },
      'rotate': {
        opacity: 1 - exitProgress,
        transform: `rotate(${interpolate(exitProgress, [0, 1], [0, 10])}deg)`,
      },
      'flip': {
        opacity: 1 - exitProgress,
        transform: `rotateY(${interpolate(exitProgress, [0, 1], [0, 90])}deg)`,
      },
      'none': {},
    };
    
    // Combine enter and exit animations
    const enterStyle = enterStyles[enterAnim] || enterStyles.fade;
    const exitStyle = exitStyles[exitAnim] || exitStyles.fade;
    
    return {
      ...enterStyle,
      ...(exitProgress > 0 ? exitStyle : {}),
    };
  }, [customization.enterAnimation, customization.exitAnimation, frame, fps, enterProgress, exitProgress]);
  
  // Calculate alignment styles
  const alignmentStyle = useMemo(() => {
    const verticalAlign = customization.verticalAlign || 'center';
    const horizontalAlign = customization.horizontalAlign || 'center';
    
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
    
    return {
      justifyContent: justifyContentMap[verticalAlign],
      alignItems: alignItemsMap[horizontalAlign],
    };
  }, [customization.verticalAlign, customization.horizontalAlign]);
  
  // Calculate background style
  const backgroundStyle = useMemo(() => {
    const bgStyle: React.CSSProperties = {};
    
    // Custom background color takes precedence
    if (customization.backgroundColor) {
      bgStyle.background = customization.backgroundColor;
    } else if (customization.backgroundImage) {
      bgStyle.backgroundImage = `url(${customization.backgroundImage})`;
      bgStyle.backgroundSize = 'cover';
      bgStyle.backgroundPosition = 'center';
      if (customization.backgroundBlur) {
        // Blur is handled via overlay
      }
    } else {
      // Use theme background
      bgStyle.background = themeColors.background;
    }
    
    return bgStyle;
  }, [customization.backgroundColor, customization.backgroundImage, themeColors.background]);
  
  // Calculate border styles
  const borderStyle = useMemo(() => {
    if (!customization.borderWidth && !customization.borderRadius) {
      return {};
    }
    
    return {
      borderWidth: customization.borderWidth ? `${customization.borderWidth}px` : undefined,
      borderColor: customization.borderColor || themeColors.border,
      borderRadius: customization.borderRadius ? `${customization.borderRadius}px` : undefined,
      borderStyle: customization.borderWidth ? 'solid' : undefined,
    };
  }, [customization.borderWidth, customization.borderColor, customization.borderRadius, themeColors.border]);
  
  // Calculate shadow styles
  const shadowStyle = useMemo(() => {
    if (!customization.shadowEnabled) {
      return {};
    }
    
    return {
      boxShadow: `0 ${customization.shadowBlur || 20}px ${customization.shadowBlur || 20}px ${customization.shadowColor || 'rgba(0,0,0,0.5)'}`,
    };
  }, [customization.shadowEnabled, customization.shadowBlur, customization.shadowColor]);
  
  // Calculate spacing styles
  const spacingStyle = useMemo(() => {
    return {
      padding: customization.padding ? `${customization.padding}px` : undefined,
      margin: customization.margin ? `${customization.margin}px` : undefined,
    };
  }, [customization.padding, customization.margin]);
  
  // Combined styles
  const combinedStyle: React.CSSProperties = {
    ...alignmentStyle,
    ...backgroundStyle,
    ...borderStyle,
    ...shadowStyle,
    ...spacingStyle,
    ...animationStyle,
    ...style,
  };
  
  return (
    <AbsoluteFill className={className} style={combinedStyle}>
      {/* Blur overlay for background images */}
      {customization.backgroundImage && customization.backgroundBlur && (
        <AbsoluteFill
          style={{
            backdropFilter: `blur(${customization.backgroundBlur}px)`,
            background: 'rgba(0,0,0,0.3)',
          }}
        />
      )}
      
      {/* Content container */}
      <AbsoluteFill style={{ ...alignmentStyle, padding: customization.padding || 40 }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * Themed Text Component
 * Applies theme colors to text
 */
export interface ThemedTextProps {
  children: React.ReactNode;
  theme?: string;
  variant?: 'primary' | 'secondary' | 'accent';
  style?: React.CSSProperties;
  className?: string;
}

export const ThemedText: React.FC<ThemedTextProps> = ({
  children,
  theme = 'dark_modern',
  variant = 'primary',
  style = {},
  className = '',
}) => {
  const themeColors = THEMES[theme] || THEMES.dark_modern;
  
  const colorMap: Record<string, string> = {
    'primary': themeColors.text,
    'secondary': themeColors.textSecondary,
    'accent': themeColors.accent,
  };
  
  return (
    <span 
      className={className} 
      style={{ 
        color: colorMap[variant], 
        fontFamily: 'system-ui, -apple-system, sans-serif',
        ...style 
      }}
    >
      {children}
    </span>
  );
};

/**
 * Centered Content Component
 * Helper for centering content within a scene
 */
export interface CenteredContentProps {
  children: React.ReactNode;
  direction?: 'column' | 'row';
  gap?: number;
  style?: React.CSSProperties;
}

export const CenteredContent: React.FC<CenteredContentProps> = ({
  children,
  direction = 'column',
  gap = 16,
  style = {},
}) => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        justifyContent: 'center',
        alignItems: 'center',
        gap,
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {children}
    </div>
  );
};

/**
 * Extract customization props from data
 * Helper function for plugin developers
 */
export function extractCustomization(
  data: Record<string, unknown>
): Partial<BlockCustomizationProps> {
  return {
    verticalAlign: data.verticalAlign as BlockCustomizationProps['verticalAlign'],
    horizontalAlign: data.horizontalAlign as BlockCustomizationProps['horizontalAlign'],
    enterAnimation: data.enterAnimation as BlockCustomizationProps['enterAnimation'],
    exitAnimation: data.exitAnimation as BlockCustomizationProps['exitAnimation'],
    animationDuration: data.animationDuration as number,
    backgroundColor: data.backgroundColor as string,
    backgroundImage: data.backgroundImage as string,
    backgroundBlur: data.backgroundBlur as number,
    borderColor: data.borderColor as string,
    borderWidth: data.borderWidth as number,
    borderRadius: data.borderRadius as number,
    shadowEnabled: data.shadowEnabled as boolean,
    shadowColor: data.shadowColor as string,
    shadowBlur: data.shadowBlur as number,
    padding: data.padding as number,
    margin: data.margin as number,
  };
}

export default BaseScene;
