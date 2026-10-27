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
import type { TextBlock, QuoteBlock, AnimationPhase } from '../schemas';

// ============================================================================
// TEXT SCENE
// ============================================================================

export interface TextSceneProps {
  data: TextBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function TextScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'subtle',
  animation,
}: TextSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const customization = extractCustomization(data);

  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration  = animation?.hold  ?? 2;

  const isHigh = data.emphasis === 'high';

  // Animations
  const textSlide   = useSlideIn('up', 50, 0.6, 0, motionProfile);
  const textOpacity = useFadeIn(0.5, 0, motionProfile);
  const textScale   = useScaleIn(0.5, 0, motionProfile);

  const fontSize = isHigh ? 50 : data.emphasis === 'low' ? 28 : 36;

  // Exit
  const exitStart    = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity  = 1 - exitProgress;

  // For high emphasis: word-by-word pop
  const words = (data.content || '').split(' ');
  const framesPerWord = fps / 3.5;

  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      {/* Ambient glow blob behind text */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 600,
            height: 400,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${colors.primary}18 0%, transparent 70%)`,
            filter: 'blur(60px)',
            opacity: textOpacity,
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 60,
          transform: `translate(${textSlide.x}px, ${textSlide.y}px) scale(${textScale})`,
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontSize,
            fontWeight: isHigh ? 700 : 400,
            fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
            textAlign: 'center',
            lineHeight: 1.65,
            maxWidth: 900,
            margin: 0,
            // High emphasis: gradient text
            ...(isHigh ? {
              background: `linear-gradient(135deg, ${colors.foreground} 0%, ${colors.primary} 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            } : {
              color: colors.foreground,
            }),
          }}
        >
          {isHigh
            ? words.map((word, i) => {
                const wFrame  = Math.max(0, frame - i * framesPerWord);
                const wProg   = Math.min(1, wFrame / (framesPerWord * 0.7));
                const wOpacity = interpolate(wProg, [0, 1], [0, 1]);
                const wY       = interpolate(wProg, [0, 1], [16, 0]);
                return (
                  <span
                    key={i}
                    style={{
                      display: 'inline-block',
                      opacity: wOpacity,
                      transform: `translateY(${wY}px)`,
                      marginRight: '0.28em',
                    }}
                  >
                    {word}
                  </span>
                );
              })
            : data.content
          }
        </p>

        {/* Accent line below text for high emphasis */}
        {isHigh && (
          <div
            style={{
              marginTop: 28,
              height: 3,
              width: interpolate(frame, [0, fps * 0.8], [0, 200], { extrapolateRight: 'clamp' }),
              background: `linear-gradient(90deg, transparent, ${colors.primary}, transparent)`,
              opacity: textOpacity,
            }}
          />
        )}
      </div>
    </BaseScene>
  );
}

// ============================================================================
// QUOTE SCENE
// ============================================================================

export interface QuoteSceneProps {
  data: QuoteBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function QuoteScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: QuoteSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const customization = extractCustomization(data);

  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration  = animation?.hold  ?? 3;

  const quoteSlide   = useSlideIn('up', 60, 0.6, 0, motionProfile);
  const quoteOpacity = useFadeIn(0.5, 0, motionProfile);

  const authorSlide   = useSlideIn('up', 30, 0.4, 0.4, motionProfile);
  const authorOpacity = useFadeIn(0.4, 0.4, motionProfile);

  const markScale   = useScaleIn(0.4, 0, motionProfile);
  const markOpacity = useFadeIn(0.3, 0, motionProfile);

  // Animated underline width under author
  const underlineWidth = interpolate(
    frame,
    [fps * 0.5, fps * 1.2],
    [0, 100],
    { extrapolateRight: 'clamp' }
  );

  // Exit
  const exitStart    = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity  = 1 - exitProgress;

  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      {/* Ambient glow */}
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div
          style={{
            position: 'absolute',
            top: '40%', left: '50%',
            transform: 'translate(-50%, -50%)',
            width: 700,
            height: 500,
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${colors.primary}12 0%, transparent 65%)`,
            filter: 'blur(80px)',
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: '80px 80px',
          gap: 36,
        }}
      >
        {/* Opening quote mark — gradient */}
        <div
          style={{
            transform: `scale(${markScale})`,
            opacity: markOpacity,
            lineHeight: 0.6,
            alignSelf: 'flex-start',
          }}
        >
          <span
            style={{
              fontSize: 160,
              fontWeight: 900,
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.accent ?? colors.primary}88)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 0.6,
              display: 'block',
              filter: `drop-shadow(0 0 20px ${colors.primary}44)`,
            }}
          >
            "
          </span>
        </div>

        {/* Quote text */}
        <div
          style={{
            transform: `translate(${quoteSlide.x}px, ${quoteSlide.y}px)`,
            opacity: quoteOpacity,
            textAlign: 'center',
          }}
        >
          <p
            style={{
              fontSize: 46,
              fontWeight: 500,
              fontFamily: '"Inter", "SF Pro Display", system-ui, sans-serif',
              color: colors.foreground,
              fontStyle: 'italic',
              lineHeight: 1.55,
              maxWidth: 820,
              margin: 0,
              textShadow: `0 2px 20px rgba(0,0,0,0.3)`,
            }}
          >
            {data.text}
          </p>
        </div>

        {/* Author with animated gradient underline */}
        {data.author && (
          <div
            style={{
              transform: `translate(${authorSlide.x}px, ${authorSlide.y}px)`,
              opacity: authorOpacity,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 50,
                  height: 2,
                  background: `linear-gradient(90deg, transparent, ${colors.primary})`,
                }}
              />
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 600,
                  fontFamily: '"Inter", system-ui, sans-serif',
                  color: colors.muted,
                  letterSpacing: '1px',
                }}
              >
                {data.author}
              </span>
              <div
                style={{
                  width: 50,
                  height: 2,
                  background: `linear-gradient(90deg, ${colors.primary}, transparent)`,
                }}
              />
            </div>
            {/* Animated underline */}
            <div
              style={{
                width: `${underlineWidth}%`,
                height: 2,
                background: `linear-gradient(90deg, transparent, ${colors.primary}88, transparent)`,
              }}
            />
          </div>
        )}
      </div>
    </BaseScene>
  );
}

// ============================================================================
// HIGHLIGHT TEXT SCENE
// ============================================================================

export interface HighlightTextSceneProps {
  text: string;
  highlightWords?: string[];
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function HighlightTextScene({
  text,
  highlightWords = [],
  theme = 'dark_modern',
  motionProfile = 'dynamic',
}: HighlightTextSceneProps): React.ReactElement {
  const colors = getTheme(theme);

  const textSlide   = useSlideIn('up', 40, 0.5, 0, motionProfile);
  const textOpacity = useFadeIn(0.4, 0, motionProfile);

  const renderText = () => {
    const words = text.split(' ');
    return words.map((word, index) => {
      const isHighlighted = highlightWords.some(
        hw => word.toLowerCase().includes(hw.toLowerCase())
      );
      return (
        <span
          key={index}
          style={{
            color: isHighlighted ? colors.primary : colors.foreground,
            fontWeight: isHighlighted ? 700 : 400,
          }}
        >
          {word}{' '}
        </span>
      );
    });
  };

  return (
    <BaseScene theme={theme}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 60,
          transform: `translate(${textSlide.x}px, ${textSlide.y}px)`,
          opacity: textOpacity,
        }}
      >
        <p
          style={{
            fontSize: 42,
            fontFamily: '"Inter", system-ui, sans-serif',
            textAlign: 'center',
            lineHeight: 1.6,
            maxWidth: 900,
          }}
        >
          {renderText()}
        </p>
      </div>
    </BaseScene>
  );
}
