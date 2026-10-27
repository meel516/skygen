/**
 * Remotion Entry Point
 * This file is used by Remotion CLI to discover and bundle compositions
 */

import { registerRoot, Composition, continueRender, delayRender } from 'remotion';
import { DynamicVideo } from './src/lib/video/compositions/DynamicVideo';
import { useState, useEffect } from 'react';

function FontLoader() {
  const [handle] = useState(() => delayRender('Loading Google Fonts'));
  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;700;900&family=Roboto:wght@400;700;900&family=Montserrat:wght@400;700;900&family=Oswald:wght@400;700&family=Playfair+Display:wght@400;700&family=Bebas+Neue&family=Poppins:wght@400;700;900&family=Raleway:wght@400;700;900&display=swap';
    link.onload = () => continueRender(handle);
    link.onerror = () => continueRender(handle);
    document.head.appendChild(link);
  }, []);
  return null;
}

// Default props for the composition
const defaultProps = {
  input: {
    videoMeta: {
      aspectRatio: '9:16',
      theme: 'dark_modern',
      fps: 30,
      intro: {
        title: 'How AI Works',
        subtitle: 'A visual breakdown',
        duration: 2,
      },
      outro: {
        title: 'Follow for more',
        subtitle: 'Like & Share',
        duration: 2,
      },
    },
    contentBlocks: [
      {
        type: 'diagram',
        diagramType: 'flowchart',
        title: 'How AI Learns',
        layout: 'vertical',
        primaryColor: '#6366F1',
        nodes: [
          { id: 'n1', label: 'Raw Data',      type: 'start',   color: '#10B981' },
          { id: 'n2', label: 'Preprocessing', type: 'process', color: '#3B82F6' },
          { id: 'n3', label: 'Model Training', type: 'process', color: '#6366F1' },
          { id: 'n4', label: 'Validation',    type: 'decision', color: '#F59E0B' },
          { id: 'n5', label: 'Deploy',        type: 'end',     color: '#10B981' },
        ],
        edges: [
          { from: 'n1', to: 'n2', style: 'arrow' },
          { from: 'n2', to: 'n3', style: 'arrow' },
          { from: 'n3', to: 'n4', style: 'arrow' },
          { from: 'n4', to: 'n5', label: 'Pass', style: 'arrow' },
          { from: 'n4', to: 'n3', label: 'Retry', style: 'dashed' },
        ],
        audioSrc: '',
      },
      {
        type: 'diagram',
        diagramType: 'mindmap',
        title: 'AI Applications',
        layout: 'radial',
        primaryColor: '#EC4899',
        nodes: [
          { id: 'n1', label: 'Artificial Intelligence', type: 'start',   color: '#6366F1' },
          { id: 'n2', label: 'Vision',                  type: 'process', color: '#3B82F6' },
          { id: 'n3', label: 'Language',                type: 'process', color: '#10B981' },
          { id: 'n4', label: 'Robotics',                type: 'process', color: '#F59E0B' },
          { id: 'n5', label: 'Prediction',              type: 'process', color: '#EC4899' },
          { id: 'n6', label: 'Creativity',              type: 'process', color: '#8B5CF6' },
        ],
        edges: [
          { from: 'n1', to: 'n2', style: 'arrow' },
          { from: 'n1', to: 'n3', style: 'arrow' },
          { from: 'n1', to: 'n4', style: 'arrow' },
          { from: 'n1', to: 'n5', style: 'arrow' },
          { from: 'n1', to: 'n6', style: 'arrow' },
        ],
        audioSrc: '',
      },
    ],
  },
  plan: {
    decisions: [
      {
        componentId: 'diagram-scene',
        motionProfile: 'dynamic',
        duration: 7,
        animation: { enter: 0.5, hold: 6, exit: 0.5 },
      },
      {
        componentId: 'diagram-scene',
        motionProfile: 'dynamic',
        duration: 7,
        animation: { enter: 0.5, hold: 6, exit: 0.5 },
      },
    ],
    totalDuration: 18,
    suggestedTransitions: [],
  },
};

// Register the root composition
registerRoot(() => {
  return (
    <>
      <FontLoader />
      <Composition
      id="DynamicVideo"
      component={DynamicVideo}
      durationInFrames={360}
      fps={30}
      width={1080}
      height={1920}
      defaultProps={defaultProps}
      calculateMetadata={({ props }) => {
        const fps = props.input?.videoMeta?.fps ?? 30;
        const introDuration = props.input?.videoMeta?.intro?.duration ?? 2;
        const outroDuration = props.input?.videoMeta?.outro?.duration ?? 2;
        const contentDuration = (props.plan?.decisions ?? []).reduce(
          (sum: number, d: { duration: number }) => sum + (d.duration ?? 0),
          0
        );
        const totalDuration = introDuration + contentDuration + outroDuration;
        const durationInFrames = Math.max(1, Math.round(totalDuration * fps));

        const aspectRatio = props.input?.videoMeta?.aspectRatio ?? '9:16';
        const aspectRatios: Record<string, { width: number; height: number }> = {
          '16:9': { width: 1920, height: 1080 },
          '9:16': { width: 1080, height: 1920 },
          '1:1': { width: 1080, height: 1080 },
          '4:5': { width: 1080, height: 1350 },
        };
        const dims = aspectRatios[aspectRatio] ?? aspectRatios['9:16'];

        return { durationInFrames, fps, width: dims.width, height: dims.height };
      }}
    />
    </>
  );
});
