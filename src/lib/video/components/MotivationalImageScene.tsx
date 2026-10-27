import React from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  AbsoluteFill,
  interpolate,
  spring,
  Img,
} from 'remotion';
import { Audio } from '@remotion/media';
import {
  type MotivationalImageBlock,
  type ImageEffect,
  type ColorOverlay,
  type AnimationPhase,
} from '../schemas';
import { type MotionProfileType } from '../utils/animations';
import { TextLayer, OverlayLayer } from './TextOverlaySystem';

// Re-export for any remaining consumers
export { TextLayer, FONT_FAMILY_MAP } from './TextOverlaySystem';

// ============================================================================
// MOTIVATIONAL IMAGE SCENE
// ============================================================================

export interface MotivationalImageSceneProps {
  data: MotivationalImageBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

const IMAGE_POSITIONS: Record<string, string> = {
  center: 'center',
  top: 'top center',
  bottom: 'bottom center',
  left: 'center left',
  right: 'center right',
};

export function MotivationalImageScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: MotivationalImageSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterDuration = animation?.enter ?? 1.5;
  const holdDuration  = animation?.hold  ?? 5;
  const exitDuration  = animation?.exit  ?? 0.5;

  const exitStartFrame = fps * (enterDuration + holdDuration);

  const exitProgress = frame > exitStartFrame
    ? Math.min(1, (frame - exitStartFrame) / (fps * exitDuration))
    : 0;

  const imageAnimation = useImageAnimation({
    effect: data.imageEffect || 'ken-burns',
    frame,
    fps,
    duration: data.imageEffectDuration || 1.5,
  });

  const overlayType  = (data as any).overlayType  ?? 'gradient-bottom';
  const textData     = data.text || '';
  const textStyle    = data.textStyle || 'default';

  return (
    <AbsoluteFill style={{ backgroundColor: data.backgroundColor || '#000000' }}>
      {data.audioSrc && (
        <Audio src={data.audioSrc} volume={data.audioVolume ?? 0.7} />
      )}

      {/* Image Layer */}
      <AbsoluteFill
        style={{
          opacity: imageAnimation.opacity * (1 - exitProgress),
          transform: imageAnimation.transform,
          filter: imageAnimation.filter,
        }}
      >
        <Img
          src={data.imageSrc}
          style={{
            width: '100%',
            height: '100%',
            objectFit: data.imageFit || 'cover',
            objectPosition: IMAGE_POSITIONS[data.imagePosition || 'center'],
          }}
        />
      </AbsoluteFill>

      {/* Overlay Layer */}
      <OverlayLayer
        overlayType={overlayType}
        colorOverlay={data.colorOverlay}
        frame={frame}
        fps={fps}
        exitProgress={exitProgress}
      />

      {/* Text Layer */}
      {textData && (
        <TextLayer
          text={textData}
          textStyle={textStyle}
          frame={frame}
          fps={fps}
          enterDuration={enterDuration}
          holdDuration={holdDuration}
          fontSize={data.fontSize || 'xlarge'}
          fontWeight={data.fontWeight || 'bold'}
          textColor={data.textColor || '#FFFFFF'}
          textAlign={data.textAlign || 'center'}
          textPosition={data.textPosition || 'center'}
          animationDelay={data.textAnimationDelay || 0.3}
          exitProgress={exitProgress}
          wordsPerGroup={(data as any).wordsPerGroup ?? 3}
          wordsPerSecond={(data as any).wordsPerSecond ?? 3}
          highlightColor={(data as any).highlightColor ?? '#00FF88'}
          subtitleBackground={(data as any).subtitleBackground ?? 'none'}
          fontFamily={(data as any).fontFamily ?? 'inter'}
        />
      )}
    </AbsoluteFill>
  );
}

// ============================================================================
// IMAGE ANIMATION HOOK (stays here — specific to image-based scenes)
// ============================================================================

interface ImageAnimationValues {
  opacity: number;
  transform: string;
  filter: string;
}

export function useImageAnimation({
  effect, frame, fps, duration,
}: {
  effect: ImageEffect;
  frame: number;
  fps: number;
  duration: number;
}): ImageAnimationValues {
  const effectDuration = duration * fps;
  const progress       = Math.min(1, frame / effectDuration);

  switch (effect) {
    case 'none':
      return { opacity: 1, transform: 'none', filter: 'none' };
    case 'fade':
      return { opacity: interpolate(progress, [0, 1], [0, 1]), transform: 'none', filter: 'none' };
    case 'slide-up':
      return {
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.5, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [100, 0])}px)`,
        filter: 'none',
      };
    case 'slide-down':
      return {
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.5, 1]),
        transform: `translateY(${interpolate(progress, [0, 1], [-100, 0])}px)`,
        filter: 'none',
      };
    case 'zoom-in':
      return {
        opacity: interpolate(progress, [0, 0.5, 1], [0, 0.5, 1]),
        transform: `scale(${interpolate(progress, [0, 1], [0.5, 1])})`,
        filter: 'none',
      };
    case 'zoom-out':
      return {
        opacity: interpolate(progress, [0, 0.5, 1], [0, 0.5, 1]),
        transform: `scale(${interpolate(progress, [0, 1], [1.5, 1])})`,
        filter: 'none',
      };
    case 'ken-burns': {
      const time = frame / fps;
      const zoom = 1 + time * 0.018;
      const panX = Math.sin(time * 0.12) * 18;
      const panY = -time * 4;
      return {
        opacity: interpolate(Math.min(frame, fps * 0.6), [0, fps * 0.6], [0, 1]),
        transform: `scale(${zoom}) translate(${panX}px, ${panY}px)`,
        filter: 'none',
      };
    }
    case 'blur':
      return {
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.7, 1]),
        transform: 'none',
        filter: `blur(${interpolate(progress, [0, 1], [20, 0])}px)`,
      };
    case 'rotate':
      return {
        opacity: interpolate(progress, [0, 0.5, 1], [0, 0.7, 1]),
        transform: `rotate(${interpolate(progress, [0, 1], [-15, 0])}deg) scale(${interpolate(progress, [0, 1], [1.2, 1])})`,
        filter: 'none',
      };
    case 'bounce': {
      const bounceProgress = spring({ frame, fps, config: { damping: 10, stiffness: 100, mass: 0.8 } });
      return {
        opacity: interpolate(progress, [0, 0.3, 1], [0, 0.7, 1]),
        transform: `scale(${bounceProgress})`,
        filter: 'none',
      };
    }
    default:
      return { opacity: 1, transform: 'none', filter: 'none' };
  }
}

export default MotivationalImageScene;
