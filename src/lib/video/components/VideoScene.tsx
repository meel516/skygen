import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, spring, Video } from 'remotion';
import { Audio } from '@remotion/media';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { VideoBlock, AnimationPhase } from '../schemas';
import { TextLayer, OverlayLayer } from './TextOverlaySystem';

interface VideoSceneProps {
  data: VideoBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: AnimationPhase;
}

export function VideoScene({ data, theme, animation }: VideoSceneProps) {
  const hasTextOverlay = !!data.text;

  if (hasTextOverlay) {
    return <EnhancedVideoScene data={data} theme={theme} animation={animation} />;
  }
  return <LegacyVideoScene data={data} theme={theme} />;
}

// ============================================================================
// ENHANCED MODE — full-bleed video + overlay + text (like motivational-image)
// ============================================================================

function EnhancedVideoScene({ data, theme, animation }: {
  data: VideoBlock;
  theme: string;
  animation: AnimationPhase;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterDuration = animation?.enter ?? 1.5;
  const holdDuration  = animation?.hold  ?? 5;
  const exitDuration  = animation?.exit  ?? 0.5;

  const exitStartFrame = fps * (enterDuration + holdDuration);
  const exitProgress = frame > exitStartFrame
    ? Math.min(1, (frame - exitStartFrame) / (fps * exitDuration))
    : 0;

  const { src, muted = true, loop = false } = data;
  const overlayType = data.overlayType ?? 'gradient-bottom';

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Full-bleed video layer */}
      {src && (
        <AbsoluteFill style={{ opacity: 1 - exitProgress }}>
          <Video
            src={src}
            muted={muted}
            loop={loop}
            style={{
              width: '100%',
              height: '100%',
              objectFit: data.videoFit || 'cover',
            }}
          />
        </AbsoluteFill>
      )}

      {/* Overlay layer */}
      <OverlayLayer
        overlayType={overlayType}
        colorOverlay={data.colorOverlay}
        frame={frame}
        fps={fps}
        exitProgress={exitProgress}
      />

      {/* Text layer */}
      {data.text && (
        <TextLayer
          text={data.text}
          textStyle={data.textStyle || 'shorts'}
          frame={frame}
          fps={fps}
          enterDuration={enterDuration}
          holdDuration={holdDuration}
          fontSize={data.fontSize || 'xlarge'}
          fontWeight={data.fontWeight || 'bold'}
          textColor={data.textColor || '#FFFFFF'}
          textAlign={data.textAlign || 'center'}
          textPosition={data.textPosition || 'bottom'}
          animationDelay={data.textAnimationDelay ?? 0.3}
          exitProgress={exitProgress}
          wordsPerGroup={data.wordsPerGroup ?? 3}
          wordsPerSecond={data.wordsPerSecond ?? 3}
          highlightColor={data.highlightColor ?? '#00FF88'}
          subtitleBackground={data.subtitleBackground ?? 'none'}
          fontFamily={data.fontFamily ?? 'inter'}
        />
      )}

      {/* Narration audio (TTS voice-over) */}
      {data.audioSrc && (
        <Audio src={data.audioSrc} volume={data.audioVolume ?? 1} />
      )}

      {/* Overlay audio (separate from video audio & narration) */}
      {data.overlayAudioSrc && (
        <Audio src={data.overlayAudioSrc} volume={data.overlayAudioVolume ?? 0.7} />
      )}
    </AbsoluteFill>
  );
}

// ============================================================================
// LEGACY MODE — centered video container + caption (original behavior)
// ============================================================================

function LegacyVideoScene({ data, theme }: { data: VideoBlock; theme: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);

  const { src, caption, muted = true, loop = true } = data;

  const opacity = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 50 },
  });

  return (
    <AbsoluteFill style={{ backgroundColor: '#000000' }}>
      {/* Full-bleed video layer */}
      {src ? (
        <AbsoluteFill style={{ opacity }}>
          <Video
            src={src}
            muted={muted}
            loop={loop}
            style={{
              width: '100%',
              height: '100%',
              objectFit: data.videoFit || 'cover',
            }}
          />
        </AbsoluteFill>
      ) : (
        <AbsoluteFill
          style={{
            backgroundColor: colors.background,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            opacity,
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              width: 80,
              height: 80,
              borderRadius: '50%',
              backgroundColor: 'rgba(255,255,255,0.2)',
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: '24px solid white',
                borderTop: '14px solid transparent',
                borderBottom: '14px solid transparent',
                marginLeft: 6,
              }}
            />
          </div>
        </AbsoluteFill>
      )}

      {/* Narration audio (TTS voice-over) */}
      {data.audioSrc && (
        <Audio src={data.audioSrc} volume={data.audioVolume ?? 1} />
      )}

      {/* Overlay audio */}
      {data.overlayAudioSrc && (
        <Audio src={data.overlayAudioSrc} volume={data.overlayAudioVolume ?? 0.7} />
      )}

      {/* Caption overlay at bottom */}
      {caption && (
        <AbsoluteFill
          style={{
            justifyContent: 'flex-end',
            alignItems: 'center',
            paddingBottom: 60,
            background: 'linear-gradient(transparent 60%, rgba(0,0,0,0.7) 100%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              fontSize: 24,
              fontFamily: 'system-ui, sans-serif',
              color: '#FFFFFF',
              textAlign: 'center',
              maxWidth: '85%',
              textShadow: '0 2px 8px rgba(0,0,0,0.6)',
            }}
          >
            {caption}
          </div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
}
