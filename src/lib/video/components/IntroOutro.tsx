import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, Sequence } from 'remotion';
import { BaseScene } from './BaseScene';
import { useFadeIn, useScaleIn, useSlideIn, MOTION_PROFILES } from '../utils/animations';
import { getTheme } from '../utils/theme';

// ============================================================================
// INTRO COMPONENT (Fixed)
// ============================================================================

export interface IntroProps {
  title?: string;
  subtitle?: string;
  theme?: string;
  logoUrl?: string;
}

export function Intro({
  title = 'Video Report',
  subtitle = '',
  theme = 'dark_modern',
  logoUrl,
}: IntroProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Physics-based animations
  const logoScale = useScaleIn(0.6, 0, 'dynamic');
  const logoOpacity = useFadeIn(0.4, 0, 'dynamic');
  
  const titleSlide = useSlideIn('up', 50, 0.5, 0.2, 'dynamic');
  const titleOpacity = useFadeIn(0.5, 0.2, 'dynamic');
  
  const subtitleSlide = useSlideIn('up', 30, 0.4, 0.4, 'subtle');
  const subtitleOpacity = useFadeIn(0.4, 0.4, 'subtle');
  
  // Pulse animation for accent line
  const pulseFrame = frame % (fps * 2);
  const pulseOpacity = 0.5 + Math.sin(pulseFrame / fps * Math.PI) * 0.5;
  
  return (
    <BaseScene theme={theme}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 40,
        }}
      >
        {/* Logo or Icon */}
        {logoUrl ? (
          <img
            src={logoUrl}
            alt="Logo"
            style={{
              width: 120,
              height: 120,
              objectFit: 'contain',
              transform: `scale(${logoScale})`,
              opacity: logoOpacity,
            }}
          />
        ) : (
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transform: `scale(${logoScale})`,
              opacity: logoOpacity,
              boxShadow: `0 0 60px ${colors.primary}40`,
            }}
          >
            <svg
              width="50"
              height="50"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.foreground}
              strokeWidth="2"
            >
              <polygon points="5 3 19 12 5 21 5 3" />
            </svg>
          </div>
        )}
        
        {/* Title */}
        <div
          style={{
            transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
            opacity: titleOpacity,
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: colors.foreground,
              margin: 0,
              letterSpacing: '-2px',
            }}
          >
            {title}
          </h1>
        </div>
        
        {/* Accent line */}
        <div
          style={{
            width: 200,
            height: 4,
            background: `linear-gradient(90deg, ${colors.primary}, ${colors.accent})`,
            borderRadius: 2,
            opacity: pulseOpacity,
          }}
        />
        
        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              transform: `translate(${subtitleSlide.x}px, ${subtitleSlide.y}px)`,
              opacity: subtitleOpacity,
            }}
          >
            <p
              style={{
                fontSize: 28,
                color: colors.muted,
                margin: 0,
                textAlign: 'center',
              }}
            >
              {subtitle}
            </p>
          </div>
        )}
      </div>
    </BaseScene>
  );
}

// ============================================================================
// OUTRO COMPONENT (Fixed)
// ============================================================================

export interface OutroProps {
  message?: string;
  cta?: string;
  theme?: string;
  logoUrl?: string;
}

export function Outro({
  message = 'Thank You',
  cta = 'Learn More',
  theme = 'dark_modern',
  logoUrl,
}: OutroProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Physics-based animations
  const messageScale = useScaleIn(0.5, 0, 'dynamic');
  const messageOpacity = useFadeIn(0.4, 0, 'dynamic');
  
  const ctaSlide = useSlideIn('up', 30, 0.4, 0.3, 'dynamic');
  const ctaOpacity = useFadeIn(0.4, 0.3, 'dynamic');
  
  // Fade out near end
  const fadeOutStart = fps * 1.5;
  const fadeOut = frame > fadeOutStart 
    ? 1 - Math.min(1, (frame - fadeOutStart) / (fps * 0.4))
    : 1;
  
  return (
    <BaseScene theme={theme} opacity={fadeOut}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: 60,
        }}
      >
        {/* Logo or Icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transform: `scale(${messageScale})`,
            opacity: messageOpacity,
          }}
        >
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke={colors.foreground}
            strokeWidth="2.5"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        
        {/* Message */}
        <div style={{ textAlign: 'center', opacity: messageOpacity }}>
          <h1
            style={{
              fontSize: 80,
              fontWeight: 800,
              color: colors.foreground,
              margin: 0,
              letterSpacing: '-2px',
            }}
          >
            {message}
          </h1>
        </div>
        
        {/* CTA Button */}
        <div
          style={{
            transform: `translate(${ctaSlide.x}px, ${ctaSlide.y}px)`,
            opacity: ctaOpacity,
          }}
        >
          <div
            style={{
              padding: '16px 40px',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              borderRadius: 50,
              boxShadow: `0 10px 40px ${colors.primary}40`,
            }}
          >
            <span
              style={{
                fontSize: 24,
                fontWeight: 600,
                color: colors.foreground,
              }}
            >
              {cta}
            </span>
          </div>
        </div>
      </div>
    </BaseScene>
  );
}
