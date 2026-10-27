// ============================================================================
// ANIMATION UTILITIES - Shared animation helpers for plugins
// ============================================================================

import { interpolate, spring, Easing, useCurrentFrame, useVideoConfig } from 'remotion';

/**
 * Easing function types
 */
export type EasingType = 
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'easeOutCubic'
  | 'easeOutQuart'
  | 'easeOutExpo'
  | 'bounce'
  | 'elastic';

/**
 * Animation configuration for a single property
 */
export interface AnimationConfig {
  from: number;
  to: number;
  startFrame: number;
  duration: number;  // in frames
  easing?: EasingType;
}

/**
 * Apply easing to a progress value
 */
export function applyEasing(progress: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return progress;
    
    case 'easeIn':
      return progress * progress;
    
    case 'easeOut':
      return 1 - (1 - progress) * (1 - progress);
    
    case 'easeInOut':
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    
    case 'easeOutCubic':
      return 1 - Math.pow(1 - progress, 3);
    
    case 'easeOutQuart':
      return 1 - Math.pow(1 - progress, 4);
    
    case 'easeOutExpo':
      return progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    
    case 'bounce':
      // Simplified bounce - actual bounce should use spring()
      const n1 = 7.5625;
      const d1 = 2.75;
      if (progress < 1 / d1) {
        return n1 * progress * progress;
      } else if (progress < 2 / d1) {
        return n1 * (progress -= 1.5 / d1) * progress + 0.75;
      } else if (progress < 2.5 / d1) {
        return n1 * (progress -= 2.25 / d1) * progress + 0.9375;
      } else {
        return n1 * (progress -= 2.625 / d1) * progress + 0.984375;
      }
    
    case 'elastic':
      const c4 = (2 * Math.PI) / 3;
      return progress === 0
        ? 0
        : progress === 1
          ? 1
          : Math.pow(2, -10 * progress) * Math.sin((progress * 10 - 0.75) * c4) + 1;
    
    default:
      return progress;
  }
}

/**
 * Animate a value with configuration
 */
export function animateValue(config: AnimationConfig, frame: number): number {
  const { from, to, startFrame, duration, easing = 'easeOut' } = config;
  
  // Before animation starts
  if (frame < startFrame) {
    return from;
  }
  
  // After animation ends
  if (frame >= startFrame + duration) {
    return to;
  }
  
  // During animation
  const rawProgress = (frame - startFrame) / duration;
  const easedProgress = applyEasing(rawProgress, easing);
  
  return interpolate(easedProgress, [0, 1], [from, to]);
}

/**
 * Spring animation helper
 */
export interface SpringConfig {
  frame: number;
  fps: number;
  config?: {
    damping?: number;
    mass?: number;
    stiffness?: number;
    overshootClamping?: boolean;
  };
  from?: number;
  to?: number;
  durationInFrames?: number;
  durationRestThreshold?: number;
}

export function springValue(config: SpringConfig): number {
  const { frame, fps, config: springConfig = {}, from = 0, to = 1 } = config;
  
  const springProgress = spring({
    frame,
    fps,
    config: {
      damping: springConfig.damping ?? 10,
      mass: springConfig.mass ?? 1,
      stiffness: springConfig.stiffness ?? 100,
      overshootClamping: springConfig.overshootClamping ?? false,
    },
  });
  
  return interpolate(springProgress, [0, 1], [from, to]);
}

/**
 * Counter animation helper
 * Animates a number from start to end over duration frames
 */
export interface CounterAnimationConfig {
  frame: number;
  fps: number;
  startValue: number;
  endValue: number;
  duration: number;  // in seconds
  startFrame?: number;
  easing?: EasingType;
  useSpring?: boolean;
  springConfig?: SpringConfig['config'];
}

export function animateCounter(config: CounterAnimationConfig): number {
  const {
    frame,
    fps,
    startValue,
    endValue,
    duration,
    startFrame = 0,
    easing = 'easeOut',
    useSpring = false,
    springConfig,
  } = config;
  
  const durationFrames = duration * fps;
  const endFrame = startFrame + durationFrames;
  
  // Before animation
  if (frame < startFrame) {
    return startValue;
  }
  
  // After animation
  if (frame >= endFrame) {
    return endValue;
  }
  
  // During animation
  if (useSpring) {
    return springValue({
      frame: frame - startFrame,
      fps,
      config: springConfig,
      from: startValue,
      to: endValue,
    });
  }
  
  const rawProgress = (frame - startFrame) / durationFrames;
  const easedProgress = applyEasing(rawProgress, easing);
  
  return startValue + (endValue - startValue) * easedProgress;
}

/**
 * Stagger animation helper
 * Creates delayed animations for arrays of items
 */
export interface StaggerConfig {
  itemCount: number;
  staggerDelay: number;  // frames between each item
  totalDuration?: number;  // optional: total duration for all items
}

export function getStaggerDelays(config: StaggerConfig): number[] {
  const { itemCount, staggerDelay, totalDuration } = config;
  
  if (totalDuration) {
    // Calculate stagger to fit within total duration
    const adjustedDelay = totalDuration / itemCount;
    return Array.from({ length: itemCount }, (_, i) => i * adjustedDelay);
  }
  
  return Array.from({ length: itemCount }, (_, i) => i * staggerDelay);
}

/**
 * Check if an item should be visible at current frame
 */
export function isItemVisible(
  frame: number,
  itemIndex: number,
  staggerDelay: number,
  animationDuration: number
): boolean {
  const itemStartFrame = itemIndex * staggerDelay;
  return frame >= itemStartFrame && frame < itemStartFrame + animationDuration;
}

/**
 * Get progress for staggered item
 */
export function getStaggeredProgress(
  frame: number,
  itemIndex: number,
  staggerDelay: number,
  animationDuration: number,
  easing: EasingType = 'easeOut'
): number {
  const itemStartFrame = itemIndex * staggerDelay;
  const itemEndFrame = itemStartFrame + animationDuration;
  
  if (frame < itemStartFrame) return 0;
  if (frame >= itemEndFrame) return 1;
  
  const rawProgress = (frame - itemStartFrame) / animationDuration;
  return applyEasing(rawProgress, easing);
}

/**
 * Typewriter effect helper
 */
export interface TypewriterConfig {
  frame: number;
  fps: number;
  text: string;
  duration: number;  // in seconds
  startFrame?: number;
}

export function getTypewriterText(config: TypewriterConfig): string {
  const { frame, fps, text, duration, startFrame = 0 } = config;
  
  const durationFrames = duration * fps;
  const endFrame = startFrame + durationFrames;
  
  if (frame < startFrame) return '';
  if (frame >= endFrame) return text;
  
  const progress = (frame - startFrame) / durationFrames;
  const charCount = Math.floor(progress * text.length);
  
  return text.slice(0, charCount);
}

/**
 * Word-by-word animation helper
 */
export interface WordAnimationConfig {
  frame: number;
  fps: number;
  text: string;
  duration: number;
  startFrame?: number;
}

export function getWordAnimatedText(config: WordAnimationConfig): { 
  visibleText: string; 
  currentWordIndex: number;
  totalWords: number;
} {
  const { frame, fps, text, duration, startFrame = 0 } = config;
  
  const words = text.split(' ');
  const totalWords = words.length;
  const durationFrames = duration * fps;
  const endFrame = startFrame + durationFrames;
  
  if (frame < startFrame) {
    return { visibleText: '', currentWordIndex: 0, totalWords };
  }
  
  if (frame >= endFrame) {
    return { visibleText: text, currentWordIndex: totalWords - 1, totalWords };
  }
  
  const progress = (frame - startFrame) / durationFrames;
  const wordCount = Math.floor(progress * totalWords);
  
  return {
    visibleText: words.slice(0, wordCount + 1).join(' '),
    currentWordIndex: wordCount,
    totalWords,
  };
}

/**
 * Hook for getting animation utilities in components
 */
export function useAnimation() {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  
  return {
    frame,
    fps,
    durationInFrames,
    animate: (config: Omit<AnimationConfig, 'startFrame'>) => 
      animateValue({ ...config, startFrame: 0 }, frame),
    counter: (config: Omit<CounterAnimationConfig, 'frame' | 'fps'>) =>
      animateCounter({ ...config, frame, fps }),
    spring: (config: Omit<SpringConfig, 'frame' | 'fps'>) =>
      springValue({ ...config, frame, fps }),
    applyEasing,
    stagger: getStaggerDelays,
    typewriter: (config: Omit<TypewriterConfig, 'frame' | 'fps'>) =>
      getTypewriterText({ ...config, frame, fps }),
    wordAnimation: (config: Omit<WordAnimationConfig, 'frame' | 'fps'>) =>
      getWordAnimatedText({ ...config, frame, fps }),
  };
}
