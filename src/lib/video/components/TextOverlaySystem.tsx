// ============================================================================
// SHARED TEXT OVERLAY & OVERLAY SYSTEM
// Extracted from MotivationalImageScene — used by MotivationalImage, ParallaxStory,
// Video (enhanced mode), and GlobalSubtitleOverlay.
// ============================================================================

import React from 'react';
import { AbsoluteFill, interpolate, spring } from 'remotion';
import { type ColorOverlay } from '../schemas';

// ============================================================================
// CONSTANTS
// ============================================================================

export const FONT_SIZES: Record<string, number> = {
  small: 32,
  medium: 48,
  large: 64,
  xlarge: 80,
  xxlarge: 100,
};

export const FONT_FAMILY_MAP: Record<string, string> = {
  inter:      '"Inter", "SF Pro Display", system-ui, sans-serif',
  roboto:     '"Roboto", "Helvetica Neue", sans-serif',
  montserrat: '"Montserrat", "SF Pro Display", sans-serif',
  oswald:     '"Oswald", "Impact", sans-serif',
  playfair:   '"Playfair Display", "Georgia", serif',
  bebas:      '"Bebas Neue", "Impact", sans-serif',
  poppins:    '"Poppins", "Nunito", sans-serif',
  raleway:    '"Raleway", "Gill Sans", sans-serif',
};

// ============================================================================
// HELPERS
// ============================================================================

export function chunkWords(text: string, perGroup: number): string[] {
  const words = text.trim().split(/\s+/);
  const groups: string[] = [];
  for (let i = 0; i < words.length; i += perGroup) {
    groups.push(words.slice(i, i + perGroup).join(' '));
  }
  return groups;
}

function getSubtitlePosition(textPosition: string): { alignItems: 'flex-start' | 'center' | 'flex-end'; paddingTop: number; paddingBottom: number } {
  if (textPosition === 'top')    return { alignItems: 'flex-start', paddingTop: 100, paddingBottom: 0 };
  if (textPosition === 'center') return { alignItems: 'center',     paddingTop: 0,   paddingBottom: 0 };
  return                                { alignItems: 'flex-end',   paddingTop: 0,   paddingBottom: 100 };
}

function getPositionStyles(position: string): { alignItems: string } {
  switch (position) {
    case 'top':    return { alignItems: 'flex-start' };
    case 'bottom': return { alignItems: 'flex-end' };
    default:       return { alignItems: 'center' };
  }
}

// ============================================================================
// OVERLAY LAYER
// ============================================================================

export function getOverlayOpacity(overlay: ColorOverlay, frame: number, fps: number): number {
  const baseOpacity  = overlay.opacity ?? 0.4;
  const fadeInFrames = fps * 0.5;
  const progress     = Math.min(1, frame / fadeInFrames);

  switch (overlay.animation) {
    case 'none':  return baseOpacity;
    case 'fade':  return baseOpacity * progress;
    case 'pulse': {
      const pulse = 0.5 + 0.5 * Math.sin((frame / fps) * Math.PI * 2);
      return baseOpacity * (0.7 + 0.3 * pulse);
    }
    default: return baseOpacity * progress;
  }
}

export function OverlayLayer({
  overlayType,
  colorOverlay,
  frame,
  fps,
  exitProgress,
}: {
  overlayType: string;
  colorOverlay?: ColorOverlay;
  frame: number;
  fps: number;
  exitProgress: number;
}) {
  const fadeIn = Math.min(1, frame / (fps * 0.8));

  // Legacy solid colorOverlay support
  if (overlayType === 'solid' && colorOverlay?.enabled) {
    const opacity = getOverlayOpacity(colorOverlay, frame, fps);
    return (
      <AbsoluteFill
        style={{
          backgroundColor: colorOverlay.color || '#000000',
          opacity: opacity * (1 - exitProgress),
        }}
      />
    );
  }

  const gradients: Record<string, string> = {
    'gradient-bottom':
      'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.1) 60%, transparent 80%)',
    'gradient-top':
      'linear-gradient(to bottom, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.1) 60%, transparent 80%)',
    vignette:
      'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.75) 100%)',
    none: 'none',
  };

  const background = gradients[overlayType] ?? gradients['gradient-bottom'];
  if (background === 'none') return null;

  return (
    <AbsoluteFill
      style={{
        background,
        opacity: fadeIn * (1 - exitProgress),
      }}
    />
  );
}

// ============================================================================
// TEXT LAYER — dispatches to the right style component
// ============================================================================

export interface TextLayerProps {
  text: string;
  textStyle: string;
  frame: number;
  fps: number;
  enterDuration: number;
  holdDuration: number;
  fontSize: string;
  fontWeight: string;
  textColor: string;
  textAlign: string;
  textPosition: string;
  animationDelay: number;
  exitProgress: number;
  wordsPerGroup: number;
  wordsPerSecond: number;
  highlightColor: string;
  subtitleBackground: string;
  fontFamily?: string;
}

export function TextLayer(props: TextLayerProps) {
  const { textStyle } = props;

  if (textStyle === 'shorts') return <ShortsSubtitle {...props} />;
  if (textStyle === 'three-line') return <ThreeLineSubtitle {...props} />;
  if (textStyle === 'cinematic') return <CinematicText {...props} />;
  if (textStyle === 'neon') return <NeonText {...props} />;
  if (textStyle === 'karaoke') return <KaraokeSubtitle {...props} />;
  if (textStyle === 'karaoke-full') return <KaraokeFullSubtitle {...props} />;
  return <ClassicTextLayer {...props} />;
}

// ============================================================================
// SHORTS SUBTITLE — groups pop in one-by-one with spring bounce
// ============================================================================

function ShortsSubtitle({
  text, frame, fps, holdDuration, wordsPerGroup, wordsPerSecond, highlightColor,
  subtitleBackground, exitProgress, textPosition = 'bottom', textAlign = 'center', fontFamily = 'inter',
}: TextLayerProps) {
  const groups = chunkWords(text, wordsPerGroup);
  const secsPerGroup   = wordsPerGroup / wordsPerSecond;
  const framesPerGroup = Math.max(1, secsPerGroup * fps);
  const currentGroup   = Math.min(groups.length - 1, Math.floor(frame / framesPerGroup));
  const groupLocalFrame = frame - currentGroup * framesPerGroup;

  const scale = spring({
    frame: groupLocalFrame,
    fps,
    config: { damping: 10, stiffness: 220, mass: 0.6 },
  });
  const displayScale = interpolate(scale, [0, 1], [0, 1.18], {
    extrapolateRight: 'clamp',
  });
  const clampedScale = Math.min(1.05, displayScale);

  const groupText = groups[currentGroup] ?? '';
  const hasBg = subtitleBackground !== 'none';
  const pos = getSubtitlePosition(textPosition);
  const jc = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: pos.alignItems,
        justifyContent: jc,
        paddingTop: pos.paddingTop,
        paddingBottom: pos.paddingBottom,
        opacity: 1 - exitProgress,
      }}
    >
      <div
        style={{
          transform: `scale(${clampedScale})`,
          transformOrigin: 'center bottom',
          textAlign: textAlign as React.CSSProperties['textAlign'],
          padding: hasBg ? '14px 28px' : '0',
          background: hasBg
            ? subtitleBackground === 'pill'
              ? 'rgba(0,0,0,0.72)'
              : 'rgba(0,0,0,0.6)'
            : 'none',
          borderRadius: subtitleBackground === 'pill' ? 999 : subtitleBackground === 'bar' ? 0 : 0,
          width: '90%',
          boxSizing: 'border-box' as const,
        }}
      >
        <span
          style={{
            fontSize: 88,
            fontWeight: 900,
            color: highlightColor,
            fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
            WebkitTextStroke: '3px rgba(0,0,0,0.9)',
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
            textShadow: '0 4px 24px rgba(0,0,0,0.8)',
            display: 'block',
          }}
        >
          {groupText}
        </span>
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// THREE-LINE SUBTITLE — previous (dim) / CURRENT (colored) / next (dim)
// ============================================================================

function ThreeLineSubtitle({
  text, frame, fps, holdDuration, wordsPerGroup, wordsPerSecond, highlightColor,
  subtitleBackground, exitProgress, textPosition = 'bottom', fontFamily = 'inter',
}: TextLayerProps) {
  const groups = chunkWords(text, wordsPerGroup);
  const secsPerGroup   = wordsPerGroup / wordsPerSecond;
  const framesPerGroup = Math.max(1, secsPerGroup * fps);
  const currentGroup   = Math.min(groups.length - 1, Math.floor(frame / framesPerGroup));
  const groupLocalFrame = frame - currentGroup * framesPerGroup;

  const currentScale = spring({
    frame: groupLocalFrame,
    fps,
    config: { damping: 12, stiffness: 200, mass: 0.7 },
  });

  const prev = currentGroup > 0 ? groups[currentGroup - 1] : null;
  const curr = groups[currentGroup] ?? '';
  const next = currentGroup < groups.length - 1 ? groups[currentGroup + 1] : null;

  const hasBg = subtitleBackground !== 'none';

  const lineWrap = (
    content: string | null,
    size: number,
    opacity: number,
    isActive: boolean,
    scale = 1
  ) => {
    if (!content) return <div style={{ height: 80 }} />;
    return (
      <div
        style={{
          textAlign: 'center',
          padding: hasBg && isActive ? '10px 24px' : '4px 0',
          background:
            hasBg && isActive
              ? subtitleBackground === 'pill'
                ? 'rgba(0,0,0,0.65)'
                : 'rgba(0,0,0,0.5)'
              : 'none',
          borderRadius: hasBg && subtitleBackground === 'pill' ? 999 : 0,
          width: hasBg && subtitleBackground === 'bar' ? '100%' : 'auto',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
        }}
      >
        <span
          style={{
            fontSize: size,
            fontWeight: isActive ? 900 : 600,
            color: isActive ? highlightColor : '#FFFFFF',
            fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
            WebkitTextStroke: isActive ? '2px rgba(0,0,0,0.8)' : 'none',
            letterSpacing: '-0.02em',
            lineHeight: 1.15,
            opacity,
            display: 'block',
            textShadow: isActive
              ? `0 0 30px ${highlightColor}66, 0 4px 20px rgba(0,0,0,0.9)`
              : '0 2px 8px rgba(0,0,0,0.7)',
          }}
        >
          {content}
        </span>
      </div>
    );
  };

  const pos = getSubtitlePosition(textPosition);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: pos.alignItems,
        justifyContent: 'center',
        paddingTop: pos.paddingTop,
        paddingBottom: pos.paddingBottom,
        opacity: 1 - exitProgress,
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          paddingLeft: 24,
          paddingRight: 24,
        }}
      >
        {lineWrap(prev, 46, 0.45, false)}
        {lineWrap(curr, 78, 1, true, interpolate(currentScale, [0, 1], [0.85, 1]))}
        {lineWrap(next, 46, 0.45, false)}
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// CINEMATIC TEXT — letter-spacing collapses + elegant fade from bottom
// ============================================================================

function CinematicText({
  text, frame, fps, animationDelay, textColor, exitProgress, textPosition, fontFamily = 'inter',
}: TextLayerProps) {
  const delayedFrame = Math.max(0, frame - animationDelay * fps);

  const slideSpring = spring({
    frame: delayedFrame,
    fps,
    config: { damping: 22, stiffness: 80, mass: 1.2 },
  });

  const translateY = interpolate(slideSpring, [0, 1], [70, 0]);
  const opacity    = interpolate(delayedFrame, [0, fps * 0.6], [0, 1], { extrapolateRight: 'clamp' });

  const spacingProgress = Math.min(1, delayedFrame / (fps * 1.8));
  const letterSpacing   = interpolate(spacingProgress, [0, 1], [0.35, -0.02]);

  const positionStyles = getPositionStyles(textPosition);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: positionStyles.alignItems,
        padding: '80px 60px',
        opacity: opacity * (1 - exitProgress),
        transform: `translateY(${translateY}px)`,
      }}
    >
      <span
        style={{
          fontSize: 72,
          fontWeight: 700,
          color: textColor,
          fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
          letterSpacing: `${letterSpacing}em`,
          lineHeight: 1.3,
          textAlign: 'center',
          textTransform: 'uppercase',
          textShadow: `0 4px 30px rgba(0,0,0,0.9), 0 0 60px rgba(0,0,0,0.5)`,
          background: `linear-gradient(135deg, ${textColor}, #fff8e7)`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
}

// ============================================================================
// NEON TEXT — flicker entrance + continuous glow pulse
// ============================================================================

function NeonText({
  text, frame, fps, animationDelay, textColor, exitProgress, textPosition, fontFamily = 'inter',
}: TextLayerProps) {
  const delayedFrame = Math.max(0, frame - animationDelay * fps);

  let opacity: number;
  if (delayedFrame < 10) {
    const flickerValues = [0, 1, 0.3, 1, 0, 0.7, 1, 0.4, 1, 1];
    opacity = flickerValues[Math.min(delayedFrame, 9)] ?? 1;
  } else {
    opacity = 1;
  }

  const glowIntensity = 0.7 + 0.3 * Math.sin((frame / fps) * Math.PI * 1.5);
  const positionStyles = getPositionStyles(textPosition);
  const glow = `0 0 10px ${textColor}, 0 0 30px ${textColor}, 0 0 60px ${textColor}80, 0 0 100px ${textColor}40`;

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: positionStyles.alignItems,
        padding: '80px 60px',
        opacity: opacity * glowIntensity * (1 - exitProgress),
      }}
    >
      <span
        style={{
          fontSize: 80,
          fontWeight: 800,
          color: textColor,
          fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
          letterSpacing: '-0.02em',
          lineHeight: 1.2,
          textAlign: 'center',
          textShadow: glow,
        }}
      >
        {text}
      </span>
    </AbsoluteFill>
  );
}

// ============================================================================
// KARAOKE — group of N words visible, each word highlights in sequence
// ============================================================================

function KaraokeSubtitle({
  text, frame, fps, wordsPerGroup, wordsPerSecond, highlightColor, subtitleBackground, exitProgress,
  textPosition = 'bottom', textAlign = 'center', fontFamily = 'inter',
}: TextLayerProps) {
  const allWords       = text.trim().split(/\s+/);
  const framesPerWord  = fps / wordsPerSecond;

  const currentWordIdx  = Math.min(allWords.length - 1, Math.floor(frame / framesPerWord));
  const currentGroupIdx = Math.floor(currentWordIdx / wordsPerGroup);
  const groupStart      = currentGroupIdx * wordsPerGroup;
  const groupWords      = allWords.slice(groupStart, groupStart + wordsPerGroup);

  const groupStartFrame = currentGroupIdx * wordsPerGroup * framesPerWord;
  const groupFade       = Math.min(1, (frame - groupStartFrame) / (fps * 0.12));

  const activeInGroup = currentWordIdx - groupStart;

  const pos = getSubtitlePosition(textPosition);
  const jc = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: pos.alignItems,
        justifyContent: jc,
        paddingTop: pos.paddingTop,
        paddingBottom: pos.paddingBottom,
        opacity: groupFade * (1 - exitProgress),
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '0.22em',
          padding: subtitleBackground !== 'none' ? '12px 28px' : '0',
          background:
            subtitleBackground === 'pill' ? 'rgba(0,0,0,0.65)' :
            subtitleBackground === 'bar'  ? 'rgba(0,0,0,0.55)' : 'none',
          borderRadius: subtitleBackground === 'pill' ? 999 : subtitleBackground === 'bar' ? 8 : 0,
          width: '90%',
          boxSizing: 'border-box' as const,
        }}
      >
        {groupWords.map((word, i) => {
          const isActive = i === activeInGroup;
          const wordActivatedFrame = groupStartFrame + (groupStart + i) * framesPerWord;
          const localF = Math.max(0, frame - wordActivatedFrame);
          const scaleSpring = spring({ frame: localF, fps, config: { damping: 18, stiffness: 300, mass: 0.5 } });
          const wordScale = isActive ? interpolate(scaleSpring, [0, 1], [0.9, 1.12]) : 1;

          return (
            <span
              key={`${currentGroupIdx}-${i}`}
              style={{
                fontSize: 72,
                fontWeight: 900,
                fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
                color: isActive ? highlightColor : '#FFFFFF',
                WebkitTextStroke: '2.5px rgba(0,0,0,0.85)',
                textShadow: isActive
                  ? `0 0 20px ${highlightColor}88, 0 3px 16px rgba(0,0,0,0.9)`
                  : '0 2px 10px rgba(0,0,0,0.8)',
                letterSpacing: '-0.01em',
                lineHeight: 1.15,
                display: 'inline-block',
                transform: `scale(${wordScale})`,
                transformOrigin: 'center bottom',
                transition: 'color 0.06s ease',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// KARAOKE FULL — all words visible, currently-spoken word highlighted
// ============================================================================

function KaraokeFullSubtitle({
  text, frame, fps, wordsPerSecond, highlightColor, subtitleBackground, exitProgress,
  textPosition = 'bottom', textAlign = 'center', fontFamily = 'inter',
}: TextLayerProps) {
  const allWords      = text.trim().split(/\s+/);
  const framesPerWord = fps / wordsPerSecond;
  const currentIdx    = Math.min(allWords.length - 1, Math.floor(frame / framesPerWord));

  const entranceFade = Math.min(1, frame / (fps * 0.3));

  const pos = getSubtitlePosition(textPosition);
  const jc = textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center';

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        alignItems: pos.alignItems,
        justifyContent: jc,
        paddingTop: pos.paddingTop,
        paddingBottom: pos.paddingBottom,
        opacity: entranceFade * (1 - exitProgress),
      }}
    >
      <div
        style={{
          maxWidth: '88%',
          textAlign: 'center',
          padding: subtitleBackground !== 'none' ? '16px 32px' : '0',
          background:
            subtitleBackground === 'pill' ? 'rgba(0,0,0,0.6)' :
            subtitleBackground === 'bar'  ? 'rgba(0,0,0,0.5)' : 'none',
          borderRadius: subtitleBackground === 'pill' ? 999 : subtitleBackground === 'bar' ? 10 : 0,
          lineHeight: 1.5,
        }}
      >
        {allWords.map((word, i) => {
          const isActive = i === currentIdx;
          const isPast   = i < currentIdx;
          return (
            <span
              key={i}
              style={{
                fontSize: 52,
                fontWeight: isActive ? 900 : 700,
                fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
                color: isActive ? highlightColor : isPast ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.85)',
                WebkitTextStroke: isActive ? '2px rgba(0,0,0,0.8)' : '1px rgba(0,0,0,0.4)',
                textShadow: isActive
                  ? `0 0 16px ${highlightColor}66, 0 2px 12px rgba(0,0,0,0.9)`
                  : '0 1px 6px rgba(0,0,0,0.6)',
                display: 'inline-block',
                marginRight: '0.28em',
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                transformOrigin: 'center bottom',
                transition: 'color 0.08s ease, transform 0.08s ease',
              }}
            >
              {word}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// CLASSIC TEXT LAYER — existing styles (default, quote, typing, words, glow, etc.)
// ============================================================================

function ClassicTextLayer({
  text, textStyle, frame, fps, fontSize, fontWeight, textColor, textAlign,
  textPosition, animationDelay, exitProgress, wordsPerSecond, fontFamily = 'inter',
}: TextLayerProps) {
  const delayedFrame    = Math.max(0, frame - animationDelay * fps);
  const animationFrames = 1 * fps;
  const progress        = Math.min(1, delayedFrame / animationFrames);

  const positionStyles  = getPositionStyles(textPosition);
  const animationStyles = getTextAnimation(textStyle, progress, delayedFrame, fps);
  const fontSizePx      = FONT_SIZES[fontSize] || FONT_SIZES.large;

  const baseStyles: React.CSSProperties = {
    fontSize: fontSizePx,
    fontWeight: fontWeight as React.CSSProperties['fontWeight'],
    color: textColor,
    textAlign: textAlign as React.CSSProperties['textAlign'],
    fontFamily: FONT_FAMILY_MAP[fontFamily] ?? FONT_FAMILY_MAP.inter,
    letterSpacing: '-0.02em',
    lineHeight: 1.4,
    padding: '40px',
    maxWidth: '95%',
    width: '100%',
    wordBreak: 'break-word',
    overflowWrap: 'anywhere',
    opacity: animationStyles.opacity * (1 - exitProgress),
    transform: animationStyles.transform,
  };

  const styleSpecifics = getTextStyleSpecifics(textStyle, textColor);

  return (
    <AbsoluteFill
      style={{
        display: 'flex',
        justifyContent: textAlign === 'left' ? 'flex-start' : textAlign === 'right' ? 'flex-end' : 'center',
        alignItems: positionStyles.alignItems,
        padding: '40px',
        pointerEvents: 'none',
      }}
    >
      <div style={{ ...baseStyles, ...styleSpecifics }}>
        {textStyle === 'typing' ? (
          <TypewriterText text={text} frame={delayedFrame} fps={fps} />
        ) : textStyle === 'words' ? (
          <WordByWordText text={text} frame={delayedFrame} fps={fps} wordsPerSecond={wordsPerSecond} />
        ) : (
          text
        )}
      </div>
    </AbsoluteFill>
  );
}

// ============================================================================
// CLASSIC TEXT STYLES
// ============================================================================

function getTextStyleSpecifics(textStyle: string, textColor: string): React.CSSProperties {
  switch (textStyle) {
    case 'quote':
      return {
        fontStyle: 'italic',
        textShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.5)`,
        borderLeft: `4px solid ${textColor}`,
        paddingLeft: '30px',
      };
    case 'glow':
      return {
        textShadow: `0 0 10px ${textColor}, 0 0 20px ${textColor}, 0 0 40px ${textColor}, 0 0 80px ${textColor}`,
      };
    case 'outline':
      return {
        color: 'transparent',
        WebkitTextStroke: `2px ${textColor}`,
        textShadow: 'none',
      };
    case 'bold-glow':
      return {
        fontWeight: 900,
        textShadow: `0 0 10px ${textColor}, 0 4px 20px rgba(0,0,0,0.9)`,
      };
    case 'shadow':
      return {
        textShadow: `3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.5)`,
      };
    default:
      return {
        textShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)`,
      };
  }
}

function getTextAnimation(
  textStyle: string,
  progress: number,
  frame: number,
  fps: number
): { opacity: number; transform: string } {
  switch (textStyle) {
    case 'typing':
    case 'words':
      return { opacity: 1, transform: 'none' };
    case 'quote':
      return {
        opacity: interpolate(progress, [0, 0.5, 1], [0, 0.8, 1]),
        transform: `translateX(${interpolate(progress, [0, 1], [-30, 0])}px)`,
      };
    case 'glow': {
      const pulse = 0.8 + 0.2 * Math.sin((frame / fps) * Math.PI * 2);
      return {
        opacity: interpolate(progress, [0, 1], [0, 1]) * pulse,
        transform: 'none',
      };
    }
    case 'outline':
      return {
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `scale(${interpolate(progress, [0, 1], [0.9, 1])})`,
      };
    case 'bold-glow': {
      const sp = spring({ frame, fps, config: { damping: 12, stiffness: 100 } });
      return {
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `scale(${sp})`,
      };
    }
    case 'shadow':
      return {
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [30, 0])}px)`,
      };
    default:
      return {
        opacity: interpolate(progress, [0, 1], [0, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [20, 0])}px)`,
      };
  }
}

// ============================================================================
// TYPEWRITER
// ============================================================================

function TypewriterText({ text, frame, fps }: { text: string; frame: number; fps: number }) {
  const charsPerSecond = 20;
  const totalChars     = text.length;
  const duration       = totalChars / charsPerSecond;
  const progress       = Math.min(1, frame / fps / duration);
  const visibleChars   = Math.floor(progress * totalChars);

  return (
    <>
      {text.slice(0, visibleChars)}
      {progress < 1 && <span style={{ opacity: 0.8 }}>|</span>}
    </>
  );
}

// ============================================================================
// WORD-BY-WORD (slide up + fade per word)
// ============================================================================

function WordByWordText({ text, frame, fps, wordsPerSecond = 3 }: { text: string; frame: number; fps: number; wordsPerSecond?: number }) {
  const words         = text.split(' ');
  const framesPerWord = fps / wordsPerSecond;

  return (
    <span style={{ display: 'inline', wordBreak: 'break-word', overflowWrap: 'anywhere' }}>
      {words.map((word, i) => {
        const wordStartFrame = i * framesPerWord;
        const wordFrame    = Math.max(0, frame - wordStartFrame);
        const wordProgress = Math.min(1, wordFrame / (framesPerWord * 0.6));
        const wordOpacity  = interpolate(wordProgress, [0, 1], [0, 1]);
        const wordY        = interpolate(wordProgress, [0, 1], [18, 0]);
        return (
          <span
            key={i}
            style={{
              opacity: wordOpacity,
              display: 'inline-block',
              transform: `translateY(${wordY}px)`,
              marginRight: '0.3em',
            }}
          >
            {word}
          </span>
        );
      })}
    </span>
  );
}
