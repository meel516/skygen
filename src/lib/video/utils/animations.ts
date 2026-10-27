import { 
  interpolate, 
  spring as remotionSpring,
  useCurrentFrame,
  useVideoConfig,
  type SpringConfig,
} from 'remotion';

// ============================================================================
// ANIMATION UTILITIES - Physics-Based Animations
// ============================================================================

/**
 * Motion profile configurations for spring animations
 */
export const MOTION_PROFILES = {
  subtle: {
    damping: 20,
    stiffness: 100,
    mass: 1,
  },
  dynamic: {
    damping: 15,
    stiffness: 150,
    mass: 0.8,
  },
  energetic: {
    damping: 12,
    stiffness: 200,
    mass: 0.5,
  },
} as const;

export type MotionProfileType = keyof typeof MOTION_PROFILES;

/**
 * Spring animation hook with profile support
 */
export function useSpringAnimation(
  profile: MotionProfileType = 'dynamic',
  delay = 0
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const config = MOTION_PROFILES[profile];
  
  return remotionSpring({
    frame: frame - delay * fps,
    fps,
    config: {
      damping: config.damping,
      stiffness: config.stiffness,
      mass: config.mass,
    },
  });
}

/**
 * Sequence animation phases
 */
export interface SequenceConfig {
  enter: number;  // seconds
  hold: number;   // seconds
  exit: number;   // seconds
}

/**
 * Calculate current phase of animation
 */
export function useSequencePhase(sequence: SequenceConfig): {
  phase: 'enter' | 'hold' | 'exit' | 'complete';
  progress: number;
  frameInPhase: number;
} {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const enterFrames = sequence.enter * fps;
  const holdFrames = sequence.hold * fps;
  const exitFrames = sequence.exit * fps;
  
  if (frame < enterFrames) {
    return { 
      phase: 'enter', 
      progress: frame / enterFrames, 
      frameInPhase: frame 
    };
  }
  
  if (frame < enterFrames + holdFrames) {
    return { 
      phase: 'hold', 
      progress: 1, 
      frameInPhase: frame - enterFrames 
    };
  }
  
  if (frame < enterFrames + holdFrames + exitFrames) {
    return { 
      phase: 'exit', 
      progress: (frame - enterFrames - holdFrames) / exitFrames, 
      frameInPhase: frame - enterFrames - holdFrames 
    };
  }
  
  return { phase: 'complete', progress: 0, frameInPhase: 0 };
}

/**
 * Fade animation with spring physics
 */
export function useFadeIn(
  duration: number = 0.5,
  delay: number = 0,
  profile: MotionProfileType = 'dynamic'
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = delay * fps;
  const durationFrames = duration * fps;
  
  if (frame < startFrame) return 0;
  
  const config = MOTION_PROFILES[profile];
  const progress = remotionSpring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config.damping,
      stiffness: config.stiffness * 0.5,
      mass: config.mass,
    },
  });
  
  return interpolate(progress, [0, 1], [0, 1]);
}

/**
 * Scale animation with spring physics
 */
export function useScaleIn(
  duration: number = 0.5,
  delay: number = 0,
  profile: MotionProfileType = 'dynamic'
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = delay * fps;
  
  if (frame < startFrame) return 0;
  
  const config = MOTION_PROFILES[profile];
  const progress = remotionSpring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config.damping,
      stiffness: config.stiffness,
      mass: config.mass,
    },
  });
  
  return interpolate(progress, [0, 1], [0.8, 1]);
}

/**
 * Slide animation with spring physics
 */
export function useSlideIn(
  direction: 'left' | 'right' | 'up' | 'down' = 'up',
  distance: number = 100,
  duration: number = 0.5,
  delay: number = 0,
  profile: MotionProfileType = 'dynamic'
): { x: number; y: number } {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = delay * fps;
  
  if (frame < startFrame) {
    switch (direction) {
      case 'left': return { x: -distance, y: 0 };
      case 'right': return { x: distance, y: 0 };
      case 'up': return { x: 0, y: distance };
      case 'down': return { x: 0, y: -distance };
    }
  }
  
  const config = MOTION_PROFILES[profile];
  const progress = remotionSpring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config.damping,
      stiffness: config.stiffness,
      mass: config.mass,
    },
  });
  
  const offset = interpolate(progress, [0, 1], [distance, 0]);
  
  switch (direction) {
    case 'left': return { x: -offset, y: 0 };
    case 'right': return { x: offset, y: 0 };
    case 'up': return { x: 0, y: offset };
    case 'down': return { x: 0, y: -offset };
  }
}

/**
 * Staggered animation for lists
 */
export function useStaggeredEntry(
  index: number,
  staggerDelay: number = 0.1,
  profile: MotionProfileType = 'dynamic'
): { opacity: number; translateY: number; scale: number } {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const delay = index * staggerDelay;
  const startFrame = delay * fps;
  
  if (frame < startFrame) {
    return { opacity: 0, translateY: 30, scale: 0.9 };
  }
  
  const config = MOTION_PROFILES[profile];
  const progress = remotionSpring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config.damping,
      stiffness: config.stiffness,
      mass: config.mass,
    },
  });
  
  return {
    opacity: interpolate(progress, [0, 1], [0, 1]),
    translateY: interpolate(progress, [0, 1], [30, 0]),
    scale: interpolate(progress, [0, 1], [0.9, 1]),
  };
}

/**
 * Counter animation for numbers
 */
export function useCountUp(
  endValue: number,
  duration: number = 1,
  delay: number = 0,
  profile: MotionProfileType = 'dynamic'
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = delay * fps;
  const durationFrames = duration * fps;
  
  if (frame < startFrame) return 0;
  
  const config = MOTION_PROFILES[profile];
  const progress = remotionSpring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config.damping,
      stiffness: config.stiffness,
      mass: config.mass,
    },
  });
  
  // Clamp progress for calculation
  const clampedProgress = Math.min(1, progress);
  
  return Math.round(interpolate(clampedProgress, [0, 1], [0, endValue]));
}

/**
 * Bar chart animation for comparison scenes
 */
export function useBarGrow(
  maxValue: number,
  currentValue: number,
  duration: number = 1,
  delay: number = 0,
  profile: MotionProfileType = 'dynamic'
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const startFrame = delay * fps;
  
  if (frame < startFrame) return 0;
  
  const config = MOTION_PROFILES[profile];
  const progress = remotionSpring({
    frame: frame - startFrame,
    fps,
    config: {
      damping: config.damping + 5, // Slightly more damping for bars
      stiffness: config.stiffness,
      mass: config.mass,
    },
  });
  
  const targetWidth = (currentValue / maxValue) * 100;
  
  return interpolate(Math.min(1, progress), [0, 1], [0, targetWidth]);
}

/**
 * Pulse animation for emphasis
 */
export function usePulse(
  interval: number = 1,
  scale: number = 1.05
): number {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const period = interval * fps;
  const progress = (frame % period) / period;
  
  // Create smooth pulse using sine wave
  const pulse = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
  
  return interpolate(pulse, [0, 1], [1, scale]);
}

/**
 * Transform string builder for Remotion
 */
export function buildTransform(options: {
  x?: number;
  y?: number;
  scale?: number;
  rotate?: number;
  opacity?: number;
}): string {
  const transforms: string[] = [];
  
  if (options.x !== undefined || options.y !== undefined) {
    transforms.push(`translate(${options.x ?? 0}px, ${options.y ?? 0}px)`);
  }
  
  if (options.scale !== undefined) {
    transforms.push(`scale(${options.scale})`);
  }
  
  if (options.rotate !== undefined) {
    transforms.push(`rotate(${options.rotate}deg)`);
  }
  
  return transforms.join(' ');
}
