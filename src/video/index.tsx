import { Composition, registerRoot } from 'remotion';
import React from 'react';
import { DynamicVideo, getCompositionConfigFromProps, type CompositionProps } from './composition';

/**
 * Remotion Root - Entry point for Remotion CLI
 * 
 * This file registers all compositions that can be rendered.
 * Remotion CLI will use this to discover and render videos.
 */

// Default props for Remotion Studio preview
const defaultProps: CompositionProps = {
  input: {
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'dark_modern',
      fps: 30,
    },
    contentBlocks: [
      {
        type: 'whatsapp-chat',
        person1: {
          name: 'You',
          avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
          isOnline: true,
        },
        person2: {
          name: 'Sarah Johnson',
          avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&crop=face',
          isOnline: true,
        },
        messages: [
          { from: 'person2', text: 'Hey! Did you see the new project updates?', time: '10:30 AM' },
          { from: 'person1', text: 'Yes! The results look amazing 🎉', time: '10:31 AM' },
          { from: 'person2', text: 'Revenue is up 400K this quarter!', time: '10:32 AM' },
          { from: 'person1', text: "That's incredible! Great work everyone 💪", time: '10:33 AM' },
          { from: 'person2', text: "Let's celebrate this win! 🚀", time: '10:34 AM' },
        ],
        showTypingIndicator: true,
        lastSeen: 'online',
      },
      {
        type: 'stat',
        heading: 'Revenue',
        value: '400K',
        subtext: 'Year over year growth',
      },
    ],
  },
  plan: {
    decisions: [
      { componentId: 'whatsapp-chat-scene', motionProfile: 'subtle', duration: 8, animation: { enter: 0.5, hold: 7, exit: 0.5 } },
      { componentId: 'stat-scene', motionProfile: 'dynamic', duration: 3, animation: { enter: 0.4, hold: 2.2, exit: 0.4 } },
    ],
    totalDuration: 11,
    suggestedTransitions: ['fade'],
  },
  title: 'Video Report',
  subtitle: '',
};

/**
 * RemotionStudio - Root component registered with Remotion
 */
const RemotionStudio: React.FC = () => {
  // Use inputProps from Remotion if available, otherwise use defaults
  const config = getCompositionConfigFromProps(defaultProps);
  
  return (
    <>
      <Composition
        id="DynamicVideo"
        component={DynamicVideo}
        durationInFrames={config.durationInFrames}
        fps={config.fps}
        width={config.width}
        height={config.height}
      />
    </>
  );
};

// Register with Remotion
registerRoot(RemotionStudio);
