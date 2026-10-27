import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';

/**
 * Entry component for a Skygen custom plugin.
 * Author in real files, then: pack_plugin_dir / propose_plugin_preview
 */
export default function Scene({
  data,
  theme,
  animation,
}: {
  data: { title?: string; subtitle?: string };
  theme?: string;
  animation?: { enter: number; hold: number; exit: number };
}) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 15], [0, 1], {
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        background: theme === 'light_minimal' ? '#f8f8fc' : '#0a0a0f',
        color: theme === 'light_minimal' ? '#111' : '#f1f1f8',
        justifyContent: 'center',
        alignItems: 'center',
        fontFamily: 'system-ui, sans-serif',
        opacity,
      }}
    >
      <div style={{ textAlign: 'center', padding: 48 }}>
        <h1 style={{ fontSize: 64, margin: 0 }}>{data?.title ?? 'Title'}</h1>
        {data?.subtitle ? (
          <p style={{ fontSize: 28, opacity: 0.75, marginTop: 16 }}>{data.subtitle}</p>
        ) : null}
      </div>
    </AbsoluteFill>
  );
}
