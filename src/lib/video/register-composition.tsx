import { registerRoot } from 'remotion';
import { DynamicVideo } from './compositions/DynamicVideo';
import { type VideoInput, type VideoPlan } from './schemas';

/**
 * Register Remotion compositions
 * This file is used by Remotion CLI to discover compositions
 */

// Composition configuration
export interface CompositionProps {
  input: VideoInput;
  plan: VideoPlan;
  title?: string;
  subtitle?: string;
}

// Default props for preview
const defaultProps: CompositionProps = {
  input: {
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'dark_modern',
      fps: 30,
    },
    contentBlocks: [
      {
        type: 'stat',
        heading: 'Revenue',
        value: '400K',
        subtext: 'Year over year growth',
      },
      {
        type: 'comparison',
        title: 'Market Share',
        items: [
          { label: 'Product A', value: 45 },
          { label: 'Product B', value: 30 },
          { label: 'Product C', value: 25 },
        ],
      },
    ],
  },
  plan: {
    decisions: [
      {
        componentId: 'stat-scene',
        motionProfile: 'dynamic',
        duration: 3,
        animation: { enter: 0.4, hold: 2.2, exit: 0.4 },
      },
      {
        componentId: 'comparison-scene',
        motionProfile: 'dynamic',
        duration: 4,
        animation: { enter: 0.4, hold: 3.2, exit: 0.4 },
      },
    ],
    totalDuration: 7,
    suggestedTransitions: ['fade'],
  },
  title: 'Video Report',
  subtitle: '',
};

/**
 * Get composition configuration
 */
export function getCompositionConfigFromProps(props: CompositionProps) {
  const { input, plan } = props;
  
  const aspectRatios: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };
  
  const dimensions = aspectRatios[input.videoMeta.aspectRatio] || aspectRatios['9:16'];
  const introDuration = 2;
  const outroDuration = 2;
  const contentDuration = plan.decisions.reduce((sum, d) => sum + d.duration, 0);
  const totalDuration = introDuration + contentDuration + outroDuration;
  
  return {
    id: 'DynamicVideo',
    component: DynamicVideo,
    durationInFrames: Math.round(totalDuration * input.videoMeta.fps),
    fps: input.videoMeta.fps,
    width: dimensions.width,
    height: dimensions.height,
    defaultProps,
  };
}

/**
 * Register the composition with Remotion
 * Call this from remotion.config.ts
 */
export function registerComposition() {
  // For Remotion CLI, we need to register the root
  if (typeof window !== 'undefined') {
    registerRoot(() => {
      const config = getCompositionConfigFromProps(defaultProps);
      return {
        compositions: [config],
      };
    });
  }
}

export { DynamicVideo };
