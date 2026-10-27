// ============================================================================
// GLOBAL TEXT OVERLAY
// Renders persistent text overlay tracks across the entire video composition.
// Each track is an independent layer (watermark, lower third, ticker, etc.)
// Uses TextLayer from TextOverlaySystem for consistent text rendering.
// ============================================================================

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { TextLayer } from './TextOverlaySystem';
import type { TextOverlayTrack } from '../schemas';

interface GlobalTextOverlayProps {
  tracks: TextOverlayTrack[];
}

export function GlobalTextOverlay({ tracks }: GlobalTextOverlayProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeSec = frame / fps;

  const activeTracks = tracks.filter(track => {
    if (!track.enabled) return false;
    if (currentTimeSec < track.startTime) return false;
    if (track.endTime !== null && currentTimeSec >= track.endTime) return false;
    return true;
  });

  if (activeTracks.length === 0) return null;

  return (
    <>
      {activeTracks.map((track) => {
        // Track-local frame — resets for each track so animations start from track's startTime
        const trackFrame = frame - Math.round(track.startTime * fps);
        const trackDuration = track.endTime !== null
          ? track.endTime - track.startTime
          : 9999; // effectively infinite

        // Exit progress — fade out in the last 0.3s if the track has an endTime
        let exitProgress = 0;
        if (track.endTime !== null) {
          const fadeOutDuration = 0.3;
          const timeInTrack = currentTimeSec - track.startTime;
          exitProgress = Math.max(0, (timeInTrack - (trackDuration - fadeOutDuration)) / fadeOutDuration);
        }

        return (
          <AbsoluteFill
            key={track.id}
            style={{
              zIndex: 999,
              pointerEvents: 'none',
              opacity: track.opacity ?? 1,
            }}
          >
            <TextLayer
              text={track.text}
              textStyle={track.textStyle ?? 'default'}
              frame={trackFrame}
              fps={fps}
              enterDuration={0.3}
              holdDuration={trackDuration - 0.5}
              fontSize={track.fontSize ?? 'medium'}
              fontWeight={track.fontWeight ?? 'normal'}
              textColor={track.textColor ?? '#FFFFFF'}
              textAlign={track.textAlign ?? 'center'}
              textPosition={track.textPosition ?? 'bottom'}
              animationDelay={0}
              exitProgress={exitProgress}
              wordsPerGroup={track.wordsPerGroup ?? 3}
              wordsPerSecond={track.wordsPerSecond ?? 3}
              highlightColor={track.highlightColor ?? '#00FF88'}
              subtitleBackground={track.subtitleBackground ?? 'none'}
              fontFamily={track.fontFamily ?? 'inter'}
            />
          </AbsoluteFill>
        );
      })}
    </>
  );
}
