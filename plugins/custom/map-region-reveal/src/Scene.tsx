import React, { useMemo } from 'react';
import {
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Easing,
  AbsoluteFill,
} from 'remotion';

// Inline theme helper (no shared/ dependency needed)
function getThemeColors(themeName: string) {
  const themes: Record<string, { background: string; text: string; textSecondary: string; accent: string; border: string }> = {
    dark_modern:      { background: '#0f1923', text: '#f1f5f9', textSecondary: '#94a3b8', accent: '#06B6D4', border: '#1e293b' },
    light_clean:      { background: '#f8fafc', text: '#0f172a', textSecondary: '#64748b', accent: '#3b82f6', border: '#e2e8f0' },
    gradient_vibrant: { background: '#1a1040', text: '#ffffff', textSecondary: '#c4b5fd', accent: '#a78bfa', border: '#312e81' },
    minimal_bw:       { background: '#111111', text: '#ffffff', textSecondary: '#9ca3af', accent: '#ffffff', border: '#374151' },
  };
  return themes[themeName] ?? themes.dark_modern;
}

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────
interface RegionDef {
  regionId: string;
  label: string;
  accentColor: string;
  imageUrl?: string;
  stat1Label?: string;
  stat1Value?: string;
  stat2Label?: string;
  stat2Value?: string;
  stat3Label?: string;
  stat3Value?: string;
}

interface MapRegionData {
  mapStyle?: 'dark' | 'light' | 'satellite' | 'neon';
  animationStyle?: 'lightning' | 'pulse' | 'dash' | 'glow';
  regions?: RegionDef[];
  showCutout?: boolean;
  showStats?: boolean;
  staggerDelay?: number;
  mapTitle?: string;
  showTitle?: boolean;
  [key: string]: unknown;
}

interface SceneProps {
  data: MapRegionData;
  theme: string;
  animation: { enter: number; hold: number; exit: number };
  motionProfile?: 'subtle' | 'dynamic' | 'energetic';
}

// ─────────────────────────────────────────────────────────────────────────────
// MAP PALETTE
// ─────────────────────────────────────────────────────────────────────────────
const MAP_PALETTES = {
  dark: {
    ocean: '#0d1b2a',
    land: '#1a2940',
    border: '#243552',
    grid: '#1a2940',
    titleColor: '#e2e8f0',
    bg: 'linear-gradient(160deg,#060d1a 0%,#0f1e35 100%)',
  },
  light: {
    ocean: '#dbeafe',
    land: '#e2e8f0',
    border: '#94a3b8',
    grid: '#cbd5e1',
    titleColor: '#1e293b',
    bg: 'linear-gradient(160deg,#f0f4ff 0%,#dbeafe 100%)',
  },
  satellite: {
    ocean: '#0a1628',
    land: '#1b2f20',
    border: '#2d4a35',
    grid: '#0a1628',
    titleColor: '#a7f3d0',
    bg: 'linear-gradient(160deg,#050e14 0%,#0a1628 100%)',
  },
  neon: {
    ocean: '#050510',
    land: '#0d0d2b',
    border: '#1a1a4e',
    grid: '#0d0d2b',
    titleColor: '#e879f9',
    bg: 'linear-gradient(160deg,#020208 0%,#0d0d2b 100%)',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// SIMPLIFIED SVG WORLD MAP DATA
// ViewBox: "0 0 1000 500" — equirectangular projection (simplified outlines)
// Each country has: path (SVG d attr), centroid [x,y], label offset [dx,dy]
// ─────────────────────────────────────────────────────────────────────────────
const COUNTRY_PATHS: Record<string, { d: string; cx: number; cy: number; cardDir: 'left' | 'right' | 'top' | 'bottom' }> = {
  US: {
    d: 'M 128 140 L 165 135 L 190 140 L 210 145 L 215 165 L 200 180 L 185 185 L 165 185 L 148 178 L 135 168 L 125 155 Z',
    cx: 170, cy: 160, cardDir: 'bottom',
  },
  CA: {
    d: 'M 118 90 L 125 88 L 165 85 L 205 88 L 215 100 L 210 120 L 195 125 L 170 122 L 148 125 L 130 118 L 118 106 Z',
    cx: 165, cy: 106, cardDir: 'top',
  },
  MX: {
    d: 'M 135 188 L 165 185 L 185 190 L 192 205 L 182 215 L 165 218 L 148 212 L 137 200 Z',
    cx: 163, cy: 202, cardDir: 'left',
  },
  BR: {
    d: 'M 270 240 L 310 230 L 335 240 L 340 270 L 330 300 L 310 315 L 285 308 L 270 290 L 262 265 Z',
    cx: 303, cy: 275, cardDir: 'right',
  },
  AR: {
    d: 'M 270 310 L 295 305 L 305 325 L 300 355 L 282 368 L 270 355 L 265 335 Z',
    cx: 285, cy: 338, cardDir: 'left',
  },
  GB: {
    d: 'M 455 120 L 465 115 L 472 122 L 468 132 L 458 135 L 452 128 Z',
    cx: 462, cy: 125, cardDir: 'top',
  },
  FR: {
    d: 'M 462 140 L 478 136 L 490 143 L 490 158 L 478 165 L 462 160 L 455 150 Z',
    cx: 474, cy: 151, cardDir: 'bottom',
  },
  DE: {
    d: 'M 490 125 L 508 120 L 520 128 L 518 145 L 505 150 L 490 146 L 485 135 Z',
    cx: 503, cy: 136, cardDir: 'top',
  },
  ES: {
    d: 'M 455 155 L 478 150 L 490 158 L 486 170 L 468 174 L 453 167 Z',
    cx: 471, cy: 162, cardDir: 'left',
  },
  IT: {
    d: 'M 490 150 L 505 148 L 512 162 L 508 175 L 498 180 L 490 168 L 488 155 Z',
    cx: 500, cy: 164, cardDir: 'right',
  },
  RU: {
    d: 'M 510 80 L 600 72 L 700 78 L 750 90 L 755 115 L 720 125 L 650 130 L 580 125 L 520 115 L 505 100 Z',
    cx: 630, cy: 104, cardDir: 'top',
  },
  CN: {
    d: 'M 680 145 L 730 138 L 770 148 L 778 175 L 760 195 L 730 205 L 700 200 L 678 185 L 672 165 Z',
    cx: 725, cy: 174, cardDir: 'bottom',
  },
  IN: {
    d: 'M 650 165 L 678 160 L 688 180 L 685 210 L 668 225 L 652 215 L 642 190 Z',
    cx: 665, cy: 193, cardDir: 'left',
  },
  JP: {
    d: 'M 780 138 L 796 132 L 806 140 L 802 155 L 788 160 L 778 152 Z',
    cx: 792, cy: 146, cardDir: 'right',
  },
  KR: {
    d: 'M 762 152 L 775 148 L 780 158 L 774 166 L 763 164 Z',
    cx: 772, cy: 157, cardDir: 'bottom',
  },
  AU: {
    d: 'M 730 290 L 790 280 L 840 290 L 850 325 L 830 350 L 790 358 L 750 348 L 725 325 L 720 305 Z',
    cx: 785, cy: 320, cardDir: 'bottom',
  },
  ZA: {
    d: 'M 530 330 L 565 322 L 580 340 L 572 365 L 548 375 L 525 360 L 518 342 Z',
    cx: 549, cy: 349, cardDir: 'left',
  },
  NG: {
    d: 'M 490 245 L 515 240 L 528 252 L 524 270 L 505 278 L 487 268 Z',
    cx: 508, cy: 260, cardDir: 'bottom',
  },
  EG: {
    d: 'M 535 190 L 562 186 L 572 200 L 568 218 L 545 222 L 530 210 Z',
    cx: 551, cy: 204, cardDir: 'top',
  },
  SA: {
    d: 'M 580 190 L 615 184 L 632 198 L 628 222 L 605 230 L 578 220 Z',
    cx: 605, cy: 208, cardDir: 'right',
  },
  // Continent / region pseudo-codes
  EU: {
    d: 'M 452 120 L 530 110 L 545 135 L 525 175 L 490 185 L 455 175 L 440 150 Z',
    cx: 492, cy: 148, cardDir: 'top',
  },
  AF: {
    d: 'M 468 218 L 590 210 L 610 280 L 590 360 L 548 380 L 490 370 L 455 310 L 450 255 Z',
    cx: 530, cy: 295, cardDir: 'left',
  },
  AS: {
    d: 'M 580 120 L 800 110 L 830 200 L 780 240 L 640 250 L 565 200 Z',
    cx: 697, cy: 180, cardDir: 'top',
  },
  NA: {
    d: 'M 100 88 L 220 88 L 230 200 L 195 230 L 120 220 L 90 180 L 95 120 Z',
    cx: 162, cy: 165, cardDir: 'right',
  },
  SA_CONT: {
    d: 'M 220 218 L 340 210 L 355 310 L 320 380 L 255 390 L 210 340 L 205 265 Z',
    cx: 278, cy: 300, cardDir: 'right',
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// LIGHTNING PATH GENERATOR
// Creates a jagged lightning-bolt path along an SVG shape's bounding perimeter
// ─────────────────────────────────────────────────────────────────────────────
function generateLightningPoints(seed: number, amplitude: number, steps: number): string {
  const pts: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    // pseudo-random jitter driven by seed (deterministic)
    const jitter = amplitude * Math.sin((t * 31.7 + seed * 7.3) * 2.718) * Math.cos((t * 17.3 + seed * 3.1) * 1.414);
    pts.push(`${(t * 100).toFixed(1)}% ${(50 + jitter).toFixed(1)}%`);
  }
  return pts.join(', ');
}

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  accentColor: string;
  delay: number; // frames
  frame: number;
  fps: number;
  index: number;
}

function StatItem({ label, value, accentColor, delay, frame, fps, index }: StatCardProps) {
  const localFrame = Math.max(0, frame - delay - index * Math.round(fps * 0.12));
  const appear = spring({ frame: localFrame, fps, config: { damping: 18, stiffness: 160, mass: 0.7 } });
  const opacity = interpolate(localFrame, [0, 10], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <div
      style={{
        opacity,
        transform: `translateY(${interpolate(appear, [0, 1], [18, 0])}px)`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 4,
        minWidth: 90,
      }}
    >
      <span
        style={{
          fontSize: 22,
          fontWeight: 800,
          color: accentColor,
          letterSpacing: -0.5,
          lineHeight: 1,
          textShadow: `0 0 16px ${accentColor}88`,
        }}
      >
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 1 }}>
        {label}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE REGION OVERLAY
// ─────────────────────────────────────────────────────────────────────────────
interface RegionOverlayProps {
  region: RegionDef;
  frame: number;
  fps: number;
  startFrame: number;
  animStyle: string;
  showCutout: boolean;
  showStats: boolean;
  mapPalette: typeof MAP_PALETTES['dark'];
  viewScale: number; // map-to-canvas scale
  offsetX: number;
  offsetY: number;
}

function RegionOverlay({
  region,
  frame,
  fps,
  startFrame,
  animStyle,
  showCutout,
  showStats,
  mapPalette,
  viewScale,
  offsetX,
  offsetY,
}: RegionOverlayProps) {
  const localFrame = Math.max(0, frame - startFrame);
  const countryData = COUNTRY_PATHS[region.regionId] ?? COUNTRY_PATHS['US'];
  const color = region.accentColor || '#06B6D4';

  // Phase timing (in frames)
  const borderInFrames = Math.round(fps * 0.8);
  const glowFullFrames = Math.round(fps * 1.2);
  const cutoutStartFrames = Math.round(fps * 1.0);
  const statsStartFrames = Math.round(fps * 1.5);

  // Border draw progress (0→1)
  const borderProgress = interpolate(localFrame, [0, borderInFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.cubic),
  });

  // Glow intensity
  const glowIntensity = interpolate(localFrame, [0, glowFullFrames], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Lightning pulse (cycles every ~20 frames after glow)
  const lightningPulse = localFrame > borderInFrames
    ? 0.6 + 0.4 * Math.abs(Math.sin((localFrame - borderInFrames) * 0.18))
    : 0;

  // Fill flash
  const fillOpacity = interpolate(localFrame, [0, 8, 20], [0, 0.35, 0.15], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Cutout reveal
  const cutoutLocalFrame = Math.max(0, localFrame - cutoutStartFrames);
  const cutoutSpring = spring({ frame: cutoutLocalFrame, fps, config: { damping: 16, stiffness: 140 } });
  const cutoutOpacity = interpolate(cutoutLocalFrame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  // Stats reveal
  const statsStarted = localFrame > statsStartFrames;

  // Card position relative to map centroid
  const cx = countryData.cx * viewScale + offsetX;
  const cy = countryData.cy * viewScale + offsetY;
  const dir = countryData.cardDir;

  // Card offset
  const CARD_W = 220;
  const CARD_H = showStats ? 180 : 100;
  const CUTOUT_SIZE = 80;
  const CARD_OFFSET = 90;

  let cardX = cx;
  let cardY = cy;
  if (dir === 'right') { cardX = cx + CARD_OFFSET; cardY = cy - CARD_H / 2; }
  else if (dir === 'left') { cardX = cx - CARD_OFFSET - CARD_W; cardY = cy - CARD_H / 2; }
  else if (dir === 'top') { cardX = cx - CARD_W / 2; cardY = cy - CARD_OFFSET - CARD_H; }
  else { cardX = cx - CARD_W / 2; cardY = cy + CARD_OFFSET; }

  // Clamp to safe canvas area
  cardX = Math.max(10, Math.min(1910 - CARD_W, cardX));
  cardY = Math.max(10, Math.min(1070 - CARD_H, cardY));

  // Connector line endpoints
  const connectorX2 = cardX + (dir === 'right' ? 0 : dir === 'left' ? CARD_W : CARD_W / 2);
  const connectorY2 = cardY + (dir === 'top' ? CARD_H : dir === 'bottom' ? 0 : CARD_H / 2);
  const connectorLen = spring({ frame: Math.max(0, cutoutLocalFrame - 5), fps, config: { damping: 20, stiffness: 120 } });

  // Derived SVG path scaled to canvas
  const scaledPath = scalePathToCanvas(countryData.d, viewScale, offsetX, offsetY);

  // Lightning segments (deterministic, driven by frame)
  const lightningSegs = useMemo(() => {
    if (animStyle !== 'lightning') return [];
    const seed = region.regionId.charCodeAt(0) + region.regionId.charCodeAt(1 % region.regionId.length);
    return Array.from({ length: 4 }, (_, i) => ({
      x1: cx + Math.sin(i * 1.9) * 30,
      y1: cy + Math.cos(i * 2.3) * 20,
      x2: cx + Math.sin(i * 1.9 + 1.2) * 60,
      y2: cy + Math.cos(i * 2.3 + 0.9) * 50,
      opacity: lightningPulse * (0.5 + 0.5 * Math.sin(localFrame * 0.4 + i * 1.1)),
    }));
  }, [localFrame, animStyle, cx, cy, lightningPulse]);

  return (
    <g>
      {/* Country fill flash */}
      <path
        d={scaledPath}
        fill={color}
        fillOpacity={fillOpacity * glowIntensity}
        stroke="none"
      />

      {/* Animated border */}
      {animStyle === 'dash' ? (
        <path
          d={scaledPath}
          fill="none"
          stroke={color}
          strokeWidth={3 * viewScale}
          strokeDasharray={`${borderProgress * 30} 8`}
          strokeLinecap="round"
          opacity={glowIntensity}
          style={{ filter: `drop-shadow(0 0 ${8 * viewScale}px ${color})` }}
        />
      ) : (
        <path
          d={scaledPath}
          fill="none"
          stroke={color}
          strokeWidth={3 * viewScale}
          strokeDasharray={`${borderProgress * 1000} 1000`}
          strokeLinecap="round"
          opacity={glowIntensity}
          style={{ filter: `drop-shadow(0 0 ${10 * viewScale}px ${color})` }}
        />
      )}

      {/* Outer glow ring (pulse / glow styles) */}
      {(animStyle === 'pulse' || animStyle === 'glow') && (
        <path
          d={scaledPath}
          fill="none"
          stroke={color}
          strokeWidth={(animStyle === 'pulse' ? 8 + 6 * Math.sin(localFrame * 0.15) : 6) * viewScale}
          opacity={(animStyle === 'pulse' ? 0.3 + 0.2 * Math.sin(localFrame * 0.15) : 0.2) * glowIntensity}
          style={{ filter: `blur(${6 * viewScale}px)` }}
        />
      )}

      {/* Lightning bolts */}
      {animStyle === 'lightning' && lightningSegs.map((seg, i) => (
        <line
          key={i}
          x1={seg.x1} y1={seg.y1}
          x2={seg.x2} y2={seg.y2}
          stroke={color}
          strokeWidth={1.5 * viewScale}
          opacity={seg.opacity}
          style={{ filter: `drop-shadow(0 0 ${4 * viewScale}px ${color})` }}
        />
      ))}

      {/* Pulse rings (expanding) */}
      {animStyle === 'pulse' && glowIntensity > 0.3 && [0, 1, 2].map((i) => {
        const ringProgress = ((localFrame - borderInFrames + i * Math.round(fps * 0.4)) % Math.round(fps * 1.2)) / Math.round(fps * 1.2);
        return (
          <circle
            key={i}
            cx={cx} cy={cy}
            r={20 * viewScale + ringProgress * 60 * viewScale}
            fill="none"
            stroke={color}
            strokeWidth={2 * viewScale}
            opacity={Math.max(0, (1 - ringProgress) * 0.6 * glowIntensity)}
          />
        );
      })}

      {/* Connector line to card */}
      {cutoutLocalFrame > 0 && (
        <line
          x1={cx} y1={cy}
          x2={cx + (connectorX2 - cx) * connectorLen}
          y2={cy + (connectorY2 - cy) * connectorLen}
          stroke={color}
          strokeWidth={1.5 * viewScale}
          strokeDasharray={`${4 * viewScale} ${4 * viewScale}`}
          opacity={0.7 * glowIntensity}
        />
      )}

      {/* Centroid dot */}
      <circle
        cx={cx} cy={cy}
        r={4 * viewScale}
        fill={color}
        opacity={glowIntensity}
        style={{ filter: `drop-shadow(0 0 ${8 * viewScale}px ${color})` }}
      />
    </g>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// REGION INFO CARD (HTML overlay for cutout + stats)
// ─────────────────────────────────────────────────────────────────────────────
interface RegionCardProps {
  region: RegionDef;
  frame: number;
  fps: number;
  startFrame: number;
  showCutout: boolean;
  showStats: boolean;
  viewScale: number;
  offsetX: number;
  offsetY: number;
}

function RegionCard({
  region,
  frame,
  fps,
  startFrame,
  showCutout,
  showStats,
  viewScale,
  offsetX,
  offsetY,
}: RegionCardProps) {
  const localFrame = Math.max(0, frame - startFrame);
  const cutoutStartFrames = Math.round(fps * 1.0);
  const statsStartFrames = Math.round(fps * 1.5);
  const color = region.accentColor || '#06B6D4';

  const countryData = COUNTRY_PATHS[region.regionId] ?? COUNTRY_PATHS['US'];
  const cx = countryData.cx * viewScale + offsetX;
  const cy = countryData.cy * viewScale + offsetY;
  const dir = countryData.cardDir;

  const CARD_W = 220;
  const CARD_H = showStats ? 175 : 90;
  const CARD_OFFSET = 90;

  let cardX = cx;
  let cardY = cy;
  if (dir === 'right') { cardX = cx + CARD_OFFSET; cardY = cy - CARD_H / 2; }
  else if (dir === 'left') { cardX = cx - CARD_OFFSET - CARD_W; cardY = cy - CARD_H / 2; }
  else if (dir === 'top') { cardX = cx - CARD_W / 2; cardY = cy - CARD_OFFSET - CARD_H; }
  else { cardX = cx - CARD_W / 2; cardY = cy + CARD_OFFSET; }

  cardX = Math.max(10, Math.min(1910 - CARD_W, cardX));
  cardY = Math.max(10, Math.min(1070 - CARD_H, cardY));

  const cutoutLocalFrame = Math.max(0, localFrame - cutoutStartFrames);
  const cardSpring = spring({ frame: cutoutLocalFrame, fps, config: { damping: 14, stiffness: 130 } });
  const cardOpacity = interpolate(cutoutLocalFrame, [0, 12], [0, 1], { extrapolateRight: 'clamp' });
  const cardScale = interpolate(cardSpring, [0, 1], [0.8, 1]);

  const statsLocalFrame = Math.max(0, localFrame - statsStartFrames);

  if (cutoutLocalFrame <= 0) return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: cardX,
        top: cardY,
        width: CARD_W,
        opacity: cardOpacity,
        transform: `scale(${cardScale})`,
        transformOrigin: dir === 'right' ? 'left center' : dir === 'left' ? 'right center' : dir === 'top' ? 'bottom center' : 'top center',
        background: 'rgba(5,12,28,0.88)',
        backdropFilter: 'blur(12px)',
        borderRadius: 14,
        border: `1.5px solid ${color}55`,
        boxShadow: `0 0 24px ${color}33, inset 0 0 20px ${color}0a`,
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        overflow: 'hidden',
      }}
    >
      {/* Glowing top border line */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 2,
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          opacity: 0.9,
        }}
      />

      {/* Header row: cutout image + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showCutout && region.imageUrl && (
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              border: `2px solid ${color}88`,
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: `0 0 12px ${color}44`,
            }}
          >
            <img
              src={region.imageUrl}
              alt={region.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
        )}

        {showCutout && !region.imageUrl && (
          /* Placeholder avatar with country initials */
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 10,
              border: `2px solid ${color}88`,
              background: `linear-gradient(135deg, ${color}22, ${color}44)`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 18,
              fontWeight: 800,
              color,
              flexShrink: 0,
            }}
          >
            {region.regionId.slice(0, 2)}
          </div>
        )}

        <div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: '#f1f5f9',
              letterSpacing: 0.2,
              lineHeight: 1.2,
            }}
          >
            {region.label}
          </div>
          <div
            style={{
              fontSize: 10,
              color: color,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 1.5,
              marginTop: 2,
            }}
          >
            {region.regionId}
          </div>
        </div>
      </div>

      {/* Divider */}
      {showStats && (
        <div
          style={{
            height: 1,
            background: `linear-gradient(90deg, ${color}66, transparent)`,
            marginTop: 2,
          }}
        />
      )}

      {/* Stats row */}
      {showStats && (
        <div style={{ display: 'flex', justifyContent: 'space-around', gap: 4 }}>
          {[
            { label: region.stat1Label || '', value: region.stat1Value || '' },
            { label: region.stat2Label || '', value: region.stat2Value || '' },
            { label: region.stat3Label || '', value: region.stat3Value || '' },
          ]
            .filter((s) => s.label && s.value)
            .map((stat, i) => (
              <StatItem
                key={i}
                label={stat.label}
                value={stat.value}
                accentColor={color}
                delay={0}
                frame={statsLocalFrame}
                fps={fps}
                index={i}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────
function scalePathToCanvas(d: string, scale: number, offsetX: number, offsetY: number): string {
  // Scale all coordinate pairs in an SVG path string
  return d.replace(/(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/g, (_, x, y) => {
    return `${(parseFloat(x) * scale + offsetX).toFixed(1)} ${(parseFloat(y) * scale + offsetY).toFixed(1)}`;
  });
}

// Simplified land masses for the full world map background
const WORLD_LAND_PATHS = [
  // North America
  'M 100 88 L 220 84 L 230 145 L 215 185 L 192 218 L 160 225 L 120 215 L 90 175 L 90 130 Z',
  // South America
  'M 210 218 L 345 210 L 360 310 L 325 385 L 260 395 L 210 350 L 200 275 Z',
  // Europe + W Africa (simplified blob)
  'M 445 115 L 555 108 L 580 155 L 570 220 L 510 260 L 455 250 L 430 190 L 440 140 Z',
  // Africa
  'M 478 218 L 605 210 L 620 290 L 600 370 L 548 388 L 480 375 L 448 315 L 450 255 Z',
  // Russia / N Asia
  'M 505 75 L 760 68 L 790 115 L 775 155 L 720 165 L 640 158 L 565 145 L 500 115 Z',
  // Middle East + S Asia
  'M 565 175 L 700 165 L 712 230 L 680 250 L 615 245 L 558 220 Z',
  // SE Asia
  'M 710 195 L 800 188 L 840 240 L 800 268 L 740 260 L 700 230 Z',
  // Australia
  'M 718 280 L 855 272 L 868 355 L 835 380 L 750 378 L 712 340 L 710 305 Z',
  // Greenland
  'M 250 55 L 310 48 L 320 80 L 290 95 L 255 88 Z',
  // Japan
  'M 778 130 L 808 125 L 815 155 L 795 168 L 775 160 Z',
];

// ─────────────────────────────────────────────────────────────────────────────
// MAIN SCENE
// ─────────────────────────────────────────────────────────────────────────────
export default function MapRegionRevealScene({ data, theme, animation }: SceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();

  const {
    mapStyle = 'dark',
    animationStyle = 'lightning',
    regions = [],
    showCutout = true,
    showStats = true,
    staggerDelay = 0.8,
    mapTitle = 'Global Highlights',
    showTitle = true,
  } = data;

  const palette = MAP_PALETTES[mapStyle] ?? MAP_PALETTES.dark;
  const enterFrames = Math.round(animation.enter * fps);

  // Overall scene fade-in
  const sceneOpacity = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: 'clamp' });

  // Title animation
  const titleSpring = spring({ frame, fps, config: { damping: 18, stiffness: 130 } });
  const titleY = interpolate(titleSpring, [0, 1], [-30, 0]);
  const titleOpacity = interpolate(frame, [0, enterFrames * 0.6], [0, 1], { extrapolateRight: 'clamp' });

  // Map view — SVG viewBox is "0 0 1000 500", map is drawn at scale to fill canvas
  // We center the map and add padding for cards
  const MAP_PAD_TOP = 80;  // room for title
  const MAP_PAD_BOTTOM = 30;
  const MAP_PAD_H = 60;
  const mapAreaW = width - MAP_PAD_H * 2;
  const mapAreaH = height - MAP_PAD_TOP - MAP_PAD_BOTTOM;
  const viewScale = Math.min(mapAreaW / 1000, mapAreaH / 500);
  const offsetX = MAP_PAD_H + (mapAreaW - 1000 * viewScale) / 2;
  const offsetY = MAP_PAD_TOP + (mapAreaH - 500 * viewScale) / 2;

  // Grid lines (lat/lon graticule)
  const gridLines = useMemo(() => {
    const lines = [];
    // Horizontal (lat lines): every ~45 units in 500-tall map
    for (let y = 0; y <= 500; y += 55) {
      lines.push({ x1: 0, y1: y, x2: 1000, y2: y, type: 'h' });
    }
    // Vertical (lon lines): every ~90 units in 1000-wide map
    for (let x = 0; x <= 1000; x += 90) {
      lines.push({ x1: x, y1: 0, x2: x, y2: 500, type: 'v' });
    }
    return lines;
  }, []);

  // Per-region start frame
  const regionStartFrames = useMemo(
    () => regions.map((_, i) => enterFrames + Math.round(i * staggerDelay * fps)),
    [regions, enterFrames, staggerDelay, fps]
  );

  // Animated subtle map pan (very slight drift for life)
  const mapDrift = interpolate(frame, [0, fps * 6], [0, 2 * viewScale], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
    easing: Easing.inOut(Easing.sin),
  });

  return (
    <AbsoluteFill style={{ background: palette.bg, overflow: 'hidden', fontFamily: '"Inter","Segoe UI",sans-serif' }}>
      <AbsoluteFill style={{ opacity: sceneOpacity }}>

        {/* ── SVG World Map Layer ───────────────────────────────────── */}
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          <defs>
            {/* Ocean gradient */}
            <radialGradient id="oceanGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor={palette.ocean} stopOpacity="1" />
              <stop offset="100%" stopColor={palette.ocean} stopOpacity="0.6" />
            </radialGradient>
            {/* Subtle vignette overlay */}
            <radialGradient id="vignetteGrad" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="transparent" />
              <stop offset="100%" stopColor="#000000" stopOpacity="0.55" />
            </radialGradient>
          </defs>

          {/* Ocean fill */}
          <rect
            x={offsetX} y={offsetY}
            width={1000 * viewScale} height={500 * viewScale}
            fill={`url(#oceanGrad)`}
            rx={8}
          />

          {/* Grid graticule */}
          <g opacity={0.35}>
            {gridLines.map((l, i) => (
              <line
                key={i}
                x1={l.x1 * viewScale + offsetX}
                y1={l.y1 * viewScale + offsetY}
                x2={l.x2 * viewScale + offsetX}
                y2={l.y2 * viewScale + offsetY}
                stroke={palette.grid}
                strokeWidth={0.5}
                strokeDasharray={l.type === 'h' ? '3 6' : 'none'}
              />
            ))}
          </g>

          {/* World land masses */}
          <g transform={`translate(${mapDrift},${mapDrift * 0.3})`}>
            {WORLD_LAND_PATHS.map((d, i) => (
              <path
                key={i}
                d={scalePathToCanvas(d, viewScale, offsetX, offsetY)}
                fill={palette.land}
                stroke={palette.border}
                strokeWidth={0.8}
                opacity={0.95}
              />
            ))}

            {/* All individual country outlines (faint) */}
            {Object.entries(COUNTRY_PATHS).map(([id, c]) => (
              <path
                key={id}
                d={scalePathToCanvas(c.d, viewScale, offsetX, offsetY)}
                fill="none"
                stroke={palette.border}
                strokeWidth={0.7}
                opacity={0.5}
              />
            ))}
          </g>

          {/* Region overlays (SVG part: borders, glow, lightning) */}
          {regions.map((region, i) => (
            <RegionOverlay
              key={region.regionId + i}
              region={region}
              frame={frame}
              fps={fps}
              startFrame={regionStartFrames[i] ?? enterFrames}
              animStyle={animationStyle}
              showCutout={showCutout}
              showStats={showStats}
              mapPalette={palette}
              viewScale={viewScale}
              offsetX={offsetX}
              offsetY={offsetY}
            />
          ))}

          {/* Vignette */}
          <rect
            x={0} y={0}
            width={width} height={height}
            fill="url(#vignetteGrad)"
            opacity={0.4}
          />
        </svg>

        {/* ── HTML Overlay Layer: Cards + Title ───────────────────── */}

        {/* Title */}
        {showTitle && (
          <div
            style={{
              position: 'absolute',
              top: 20,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              opacity: titleOpacity,
              transform: `translateY(${titleY}px)`,
            }}
          >
            <div
              style={{
                background: 'rgba(5,12,28,0.7)',
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 50,
                padding: '8px 28px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: regions[0]?.accentColor ?? '#06B6D4',
                  boxShadow: `0 0 10px ${regions[0]?.accentColor ?? '#06B6D4'}`,
                }}
              />
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: palette.titleColor,
                  letterSpacing: 1.5,
                  textTransform: 'uppercase',
                }}
              >
                {mapTitle}
              </span>
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: regions[regions.length - 1]?.accentColor ?? '#F59E0B',
                  boxShadow: `0 0 10px ${regions[regions.length - 1]?.accentColor ?? '#F59E0B'}`,
                }}
              />
            </div>
          </div>
        )}

        {/* Region cards (HTML layer for image + stats) */}
        {regions.map((region, i) => (
          <RegionCard
            key={region.regionId + i}
            region={region}
            frame={frame}
            fps={fps}
            startFrame={regionStartFrames[i] ?? enterFrames}
            showCutout={showCutout}
            showStats={showStats}
            viewScale={viewScale}
            offsetX={offsetX}
            offsetY={offsetY}
          />
        ))}

        {/* Corner watermark dots */}
        <div style={{ position: 'absolute', bottom: 20, right: 24, display: 'flex', gap: 6, opacity: 0.4 }}>
          {regions.map((r, i) => (
            <div
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: r.accentColor || '#06B6D4',
                boxShadow: `0 0 8px ${r.accentColor || '#06B6D4'}`,
              }}
            />
          ))}
        </div>

      </AbsoluteFill>
    </AbsoluteFill>
  );
}
