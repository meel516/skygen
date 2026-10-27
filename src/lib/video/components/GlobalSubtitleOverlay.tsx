// ============================================================================
// GLOBAL SUBTITLE OVERLAY
// Renders timed subtitle entries across the entire video composition.
// Uses TextLayer from TextOverlaySystem for consistent text rendering.
// ============================================================================

import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import { TextLayer } from './TextOverlaySystem';
import type { SubtitleTrack, SubtitleStyle } from '../schemas';

interface GlobalSubtitleOverlayProps {
  subtitleTrack: SubtitleTrack;
}

export function GlobalSubtitleOverlay({ subtitleTrack }: GlobalSubtitleOverlayProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!subtitleTrack.enabled) return null;

  const currentTimeSec = frame / fps;

  // Find the active subtitle entry for the current time
  const activeEntry = subtitleTrack.entries.find(
    e => currentTimeSec >= e.startTime && currentTimeSec < e.endTime
  );

  if (!activeEntry) return null;

  const style: Partial<SubtitleStyle> = subtitleTrack.style ?? {};
  const entryDuration = activeEntry.endTime - activeEntry.startTime;

  // Entry-local frame — resets for each subtitle entry so word animations restart
  const entryFrame = frame - Math.round(activeEntry.startTime * fps);

  // Exit progress — fade out in the last 0.3s of each entry
  const fadeOutDuration = 0.3;
  const timeInEntry = currentTimeSec - activeEntry.startTime;
  const exitProgress = Math.max(0, (timeInEntry - (entryDuration - fadeOutDuration)) / fadeOutDuration);

  return (
    <AbsoluteFill style={{ zIndex: 1000, pointerEvents: 'none' }}>
      <TextLayer
        text={activeEntry.text}
        textStyle={style.textStyle ?? 'shorts'}
        frame={entryFrame}
        fps={fps}
        enterDuration={0.3}
        holdDuration={entryDuration - 0.5}
        fontSize={style.fontSize ?? 'large'}
        fontWeight={style.fontWeight ?? 'bold'}
        textColor={style.textColor ?? '#FFFFFF'}
        textAlign={style.textAlign ?? 'center'}
        textPosition={style.textPosition ?? 'bottom'}
        animationDelay={0}
        exitProgress={exitProgress}
        wordsPerGroup={style.wordsPerGroup ?? 3}
        wordsPerSecond={style.wordsPerSecond ?? 3}
        highlightColor={style.highlightColor ?? '#00FF88'}
        subtitleBackground={style.subtitleBackground ?? 'none'}
        fontFamily={style.fontFamily ?? 'inter'}
      />
    </AbsoluteFill>
  );
}
