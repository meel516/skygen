// ============================================================================
// Spatial Canvas Camera System — types + interpolation + layout computation
// Pure math, zero AI. Used by DynamicVideo.tsx for spatial composition mode.
// ============================================================================

// ── Types ──────────────────────────────────────────────────────────────────

export interface SpatialLayout {
  strategy: 'grid' | 'linear' | 'free';
  canvasSize: { width: number; height: number };
  scenePositions: Array<{
    blockIndex: number;
    x: number;
    y: number;
  }>;
}

export interface CameraKeyframe {
  frame: number;
  x: number;
  y: number;
  zoom: number;
  easing: 'linear' | 'ease-in-out' | 'spring' | 'bezier';
}

export interface CameraPath {
  keyframes: CameraKeyframe[];
  viewportWidth: number;
  viewportHeight: number;
}

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

// ── Easing functions ───────────────────────────────────────────────────────

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

function springEasing(t: number): number {
  const w = 8.0;
  const d = 0.4;
  return 1 - Math.exp(-d * t * 10) * Math.cos(w * t * 10);
}

function applyEasing(t: number, easing: CameraKeyframe['easing']): number {
  switch (easing) {
    case 'ease-in-out': return easeInOutCubic(t);
    case 'spring': return springEasing(t);
    case 'bezier': return easeOutQuart(t); // simplified bezier — approximates easeOutQuart
    case 'linear':
    default: return t;
  }
}

// ── Interpolation ──────────────────────────────────────────────────────────

/**
 * Given a camera path and a frame number, returns the interpolated camera state
 * (position + zoom) at that frame. Finds the two bracketing keyframes and lerps
 * with the specified easing applied to the progress parameter.
 */
export function interpolateCamera(path: CameraPath, frame: number): CameraState {
  const { keyframes } = path;
  if (keyframes.length === 0) return { x: 0, y: 0, zoom: 1 };
  if (keyframes.length === 1) return { x: keyframes[0].x, y: keyframes[0].y, zoom: keyframes[0].zoom };

  // Clamp to first/last keyframe
  if (frame <= keyframes[0].frame) {
    return { x: keyframes[0].x, y: keyframes[0].y, zoom: keyframes[0].zoom };
  }
  const last = keyframes[keyframes.length - 1];
  if (frame >= last.frame) {
    return { x: last.x, y: last.y, zoom: last.zoom };
  }

  // Find bracketing keyframes
  let prev = keyframes[0];
  let next = keyframes[1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (frame >= keyframes[i].frame && frame < keyframes[i + 1].frame) {
      prev = keyframes[i];
      next = keyframes[i + 1];
      break;
    }
  }

  const span = next.frame - prev.frame;
  const raw = span > 0 ? (frame - prev.frame) / span : 0;
  const t = applyEasing(raw, next.easing);

  return {
    x: prev.x + (next.x - prev.x) * t,
    y: prev.y + (next.y - prev.y) * t,
    zoom: prev.zoom + (next.zoom - prev.zoom) * t,
  };
}

// ── Layout computation ─────────────────────────────────────────────────────

interface LayoutOptions {
  padding?: number;       // gap between scenes (default 280)
  direction?: 'horizontal' | 'vertical' | 'diagonal';
  columns?: number;       // for grid strategy
}

/**
 * Computes scene positions on the canvas for grid and linear strategies.
 * For 'free' strategy, positions must be provided externally.
 */
export function computeLayout(
  strategy: SpatialLayout['strategy'],
  blockCount: number,
  viewport: { width: number; height: number },
  options: LayoutOptions = {},
): SpatialLayout {
  const padding = options.padding ?? 280;

  if (strategy === 'linear') {
    const direction = options.direction ?? 'horizontal';
    const positions: SpatialLayout['scenePositions'] = [];

    for (let i = 0; i < blockCount; i++) {
      if (direction === 'horizontal') {
        positions.push({ blockIndex: i, x: i * (viewport.width + padding), y: 0 });
      } else if (direction === 'vertical') {
        positions.push({ blockIndex: i, x: 0, y: i * (viewport.height + padding) });
      } else {
        // diagonal
        positions.push({
          blockIndex: i,
          x: i * (viewport.width + padding) * 0.7,
          y: i * (viewport.height + padding) * 0.5,
        });
      }
    }

    // Canvas size = rightmost scene edge + padding
    const maxX = Math.max(...positions.map(p => p.x + viewport.width));
    const maxY = Math.max(...positions.map(p => p.y + viewport.height));
    return {
      strategy,
      canvasSize: { width: maxX + padding, height: maxY + padding },
      scenePositions: positions,
    };
  }

  if (strategy === 'grid') {
    const cols = options.columns ?? Math.ceil(Math.sqrt(blockCount));
    const positions: SpatialLayout['scenePositions'] = [];

    for (let i = 0; i < blockCount; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      positions.push({
        blockIndex: i,
        x: col * (viewport.width + padding),
        y: row * (viewport.height + padding),
      });
    }

    const maxX = Math.max(...positions.map(p => p.x + viewport.width));
    const maxY = Math.max(...positions.map(p => p.y + viewport.height));
    return {
      strategy,
      canvasSize: { width: maxX + padding, height: maxY + padding },
      scenePositions: positions,
    };
  }

  // 'free' — caller must provide positions; return a placeholder
  return {
    strategy: 'free',
    canvasSize: { width: viewport.width, height: viewport.height },
    scenePositions: [],
  };
}

// ── Camera keyframe generation ─────────────────────────────────────────────

interface SceneTiming {
  startFrame: number;
  durationFrames: number;
}

type TransitionStyle = 'dolly' | 'pan' | 'flyover';

/**
 * Generates camera keyframes from scene positions and timings.
 * For each scene: focus keyframe (zoom 1.0) → transition keyframes to next scene.
 *
 * Transition styles:
 * - 'dolly': zoom out → pan → zoom in (cinematic)
 * - 'pan': slide directly (fast)
 * - 'flyover': zoom way out (bird's eye) → pan → zoom in (dramatic)
 */
export function computeCameraKeyframes(
  layout: SpatialLayout,
  timings: SceneTiming[],
  fps: number,
  transitionStyle: TransitionStyle = 'dolly',
): CameraPath {
  const { scenePositions } = layout;
  const keyframes: CameraKeyframe[] = [];

  const transitionFrames = Math.round(fps * 0.8); // 0.8 seconds for transitions
  const peakOutZoom = transitionStyle === 'flyover' ? 0.25 : 0.45;

  for (let i = 0; i < scenePositions.length; i++) {
    const pos = scenePositions[i];
    const timing = timings[i];
    if (!timing) continue;

    const centerX = pos.x;
    const centerY = pos.y;

    // Focus start — camera centered on this scene at full zoom
    keyframes.push({
      frame: timing.startFrame,
      x: centerX,
      y: centerY,
      zoom: 1.0,
      easing: 'ease-in-out',
    });

    // Focus hold — stay focused until near end of scene
    const holdEnd = timing.startFrame + timing.durationFrames - transitionFrames;
    if (holdEnd > timing.startFrame) {
      keyframes.push({
        frame: holdEnd,
        x: centerX,
        y: centerY,
        zoom: 1.0,
        easing: 'linear',
      });
    }

    // Transition to next scene
    const nextPos = scenePositions[i + 1];
    const nextTiming = timings[i + 1];
    if (nextPos && nextTiming) {
      const nextCenterX = nextPos.x;
      const nextCenterY = nextPos.y;
      const midX = (centerX + nextCenterX) / 2;
      const midY = (centerY + nextCenterY) / 2;
      const transStart = holdEnd;

      if (transitionStyle === 'pan') {
        // Single smooth slide
        keyframes.push({
          frame: transStart + transitionFrames,
          x: nextCenterX,
          y: nextCenterY,
          zoom: 1.0,
          easing: 'ease-in-out',
        });
      } else {
        // dolly / flyover: zoom out → pan → zoom in
        const midFrame = transStart + Math.round(transitionFrames * 0.5);
        keyframes.push({
          frame: midFrame,
          x: midX,
          y: midY,
          zoom: peakOutZoom,
          easing: 'ease-in-out',
        });
        keyframes.push({
          frame: transStart + transitionFrames,
          x: nextCenterX,
          y: nextCenterY,
          zoom: 1.0,
          easing: 'ease-in-out',
        });
      }
    }
  }

  return {
    keyframes,
    viewportWidth: 0, // caller fills from composition config
    viewportHeight: 0,
  };
}

// ── Visibility culling ─────────────────────────────────────────────────────

/**
 * Returns opacity (0–1) for a scene based on camera position.
 * Scenes fully outside the viewport get 0 (skip rendering).
 * Scenes partially visible get a smooth fade at the edges.
 */
export function getSceneVisibility(
  cam: CameraState,
  scenePos: { x: number; y: number },
  sceneSize: { width: number; height: number },
  viewport: { width: number; height: number },
): number {
  // Camera viewport bounds in canvas coordinates
  const vpLeft = cam.x - (viewport.width / 2) / cam.zoom;
  const vpRight = cam.x + (viewport.width / 2) / cam.zoom;
  const vpTop = cam.y - (viewport.height / 2) / cam.zoom;
  const vpBottom = cam.y + (viewport.height / 2) / cam.zoom;

  // Scene bounds
  const sLeft = scenePos.x;
  const sRight = scenePos.x + sceneSize.width;
  const sTop = scenePos.y;
  const sBottom = scenePos.y + sceneSize.height;

  // No overlap → invisible
  if (sRight < vpLeft || sLeft > vpRight || sBottom < vpTop || sTop > vpBottom) {
    return 0;
  }

  // Partial overlap → fade based on how much is visible
  const overlapX = Math.min(sRight, vpRight) - Math.max(sLeft, vpLeft);
  const overlapY = Math.min(sBottom, vpBottom) - Math.max(sTop, vpTop);
  const overlapArea = overlapX * overlapY;
  const sceneArea = sceneSize.width * sceneSize.height;

  if (sceneArea === 0) return 0;
  const ratio = overlapArea / sceneArea;

  // Smooth fade: fully visible at >50% overlap, fade below
  return ratio > 0.5 ? 1 : ratio / 0.5;
}
