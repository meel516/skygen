// ============================================================================
// TOP PLAYERS SCENE - AE-level countdown with true CSS 3D depth zoom
// Uses backgroundImage: url() for images (proven in ParallaxStoryScene).
// Uses CSS perspective + translateZ for real depth dolly-zoom.
// No BaseScene (it flattens 3D via its wrapper divs).
// Canvas: 1080x1920 (9:16) — all sizes tuned for this resolution.
// ============================================================================

import React, { useMemo } from 'react';
import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
  Sequence,
} from 'remotion';
import { Audio } from '@remotion/media';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { TopPlayersBlock, TopPlayersPlayer } from '../schemas';

// ============================================================================
// TYPES
// ============================================================================

interface TopPlayersSceneProps {
  data: TopPlayersBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

interface PlayerWindow {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

// ============================================================================
// HELPERS
// ============================================================================

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}

function computeWindows(
  playerCount: number,
  totalFrames: number,
  offset: number,
): PlayerWindow[] {
  const perPlayer = Math.floor(totalFrames / playerCount);
  return Array.from({ length: playerCount }, (_, i) => {
    const start = i * perPlayer + offset;
    const end = (i === playerCount - 1 ? totalFrames : (i + 1) * perPlayer) + offset;
    return { startFrame: start, endFrame: end, durationFrames: end - start };
  });
}

function getRankColor(rank: number): string {
  if (rank === 1) return '#FFD700';
  if (rank === 2) return '#C0C0C0';
  if (rank === 3) return '#CD7F32';
  return '#6366F1';
}

function getRankGradient(rank: number): string {
  if (rank === 1) return 'linear-gradient(135deg, #FFD700, #FFA500)';
  if (rank === 2) return 'linear-gradient(135deg, #E8E8E8, #A0A0A0)';
  if (rank === 3) return 'linear-gradient(135deg, #CD7F32, #A0522D)';
  return 'linear-gradient(135deg, #6366F1, #4F46E5)';
}

/**
 * Smooth camera Z: interpolates between player depth positions.
 * cameraZ goes from 0 (player 0) to -(N-1)*spacing (deepest player).
 */
function computeCameraZ(
  frame: number,
  windows: PlayerWindow[],
  spacing: number,
): number {
  if (windows.length <= 1) return 0;
  for (let i = 0; i < windows.length - 1; i++) {
    if (frame < windows[i + 1].startFrame) {
      const t = easeInOutCubic(
        Math.min(1, Math.max(0, (frame - windows[i].startFrame) / (windows[i].durationFrames || 1))),
      );
      return (-i * spacing) + (-spacing * t);
    }
  }
  return -(windows.length - 1) * spacing;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TopPlayersScene({
  data,
  theme,
  animation,
}: TopPlayersSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const colors = getTheme(theme);

  const {
    title,
    subtitle,
    backgroundImage,
    revealOrder = 'top-last',
    players: rawPlayers = [],
    audioSrc,
    audioVolume = 0.8,
  } = data;

  const players = useMemo(() => {
    const sorted = [...rawPlayers].sort((a, b) => a.rank - b.rank);
    return revealOrder === 'top-last' ? sorted.reverse() : sorted;
  }, [rawPlayers, revealOrder]);

  const playerCount = players.length;
  const enterFrames = Math.round((animation?.enter ?? 0.5) * fps);
  const exitFrames = Math.round((animation?.exit ?? 0.5) * fps);
  const contentFrames = Math.max(1, durationInFrames - enterFrames - exitFrames);
  const windows = useMemo(
    () => computeWindows(playerCount, contentFrames, enterFrames),
    [playerCount, contentFrames, enterFrames],
  );

  // Depth spacing between player layers in px
  const depthSpacing = 200;
  const cameraZ = computeCameraZ(frame, windows, depthSpacing);

  // Scene enter/exit
  const sceneOpacity = interpolate(
    frame,
    [0, enterFrames, durationInFrames - exitFrames, durationInFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );

  // Background parallax: responds to camera progress
  const maxCameraZ = -(playerCount - 1) * depthSpacing;
  const cameraProgress = maxCameraZ !== 0 ? cameraZ / maxCameraZ : 0; // 0..1
  const bgScale = 1 + Math.abs(cameraProgress) * 0.2;
  const bgZoom = interpolate(frame, [0, durationInFrames], [1, 1.06], { extrapolateRight: 'clamp' });

  // Title
  const titleOpacity = interpolate(
    frame,
    [enterFrames, enterFrames + Math.round(fps * 0.5), enterFrames + Math.round(fps * 2.5), enterFrames + Math.round(fps * 3)],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
  );
  const titleY = interpolate(frame, [enterFrames, enterFrames + Math.round(fps * 0.5)], [-50, 0], {
    extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: colors.background, overflow: 'hidden' }}>
      {audioSrc && <Audio src={audioSrc} volume={audioVolume} />}

      <AbsoluteFill style={{ opacity: sceneOpacity }}>

        {/* ── 1. BACKGROUND (flat, outside 3D, zIndex 0) ────────── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 0,
          backgroundImage: backgroundImage ? `url(${backgroundImage})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          transform: `scale(${bgScale * bgZoom})`,
          filter: 'brightness(0.5) saturate(1.3)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'radial-gradient(ellipse at 50% 50%, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* ── 2. 3D PERSPECTIVE CONTAINER ──────────────────────── */}
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 10,
          perspective: '1200px',
          perspectiveOrigin: '50% 50%',
        }}>
          {/* Camera rig — translateZ animates to dolly through layers */}
          <div style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transform: `translateZ(${-cameraZ}px)`,
          }}>
            {players.map((player, i) => {
              const w = windows[i] ?? { startFrame: 0, endFrame: durationInFrames, durationFrames: durationInFrames };
              const layerZ = -i * depthSpacing;
              const rankColor = getRankColor(player.rank);

              // ── Opacity: approach → hold → depart ──
              const approachStart = w.startFrame - Math.round(fps * 0.5);
              const holdStart = w.startFrame;
              const holdEnd = w.endFrame - Math.round(fps * 0.3);
              const departEnd = w.endFrame + Math.round(fps * 0.15);

              const playerOpacity = interpolate(
                frame,
                [approachStart, holdStart, holdEnd, departEnd],
                [0, 1, 1, 0],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );

              // ── Scale: grow on entrance, breathe, then explode past on exit ──
              const entranceScale = interpolate(
                frame,
                [approachStart, holdStart + Math.round(fps * 0.2)],
                [0.85, 1],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              const exitScale = interpolate(
                frame,
                [holdEnd, departEnd],
                [1, 2],
                { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
              );
              const breathe = 1 + Math.sin((frame / fps) * 1.2 + i * 0.8) * 0.012;

              const playerScale =
                frame < holdStart + Math.round(fps * 0.2)
                  ? entranceScale
                  : frame > holdEnd
                    ? exitScale
                    : breathe;

              // Subtle float
              const swayX = Math.sin((frame / fps) * 0.7 + i * 1.1) * 4;
              const swayY = Math.cos((frame / fps) * 0.5 + i * 0.9) * 2;

              // Lateral offset for visual depth variety
              const xOffsets = [0, 10, -8, 6, -12, 14, -6, 12, -10, 8];
              const baseX = xOffsets[i % xOffsets.length];

              if (playerOpacity < 0.01) return null;

              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    transform: `translateZ(${layerZ}px) translateX(${baseX + swayX}px) translateY(${swayY}px) scale(${playerScale})`,
                    transformStyle: 'preserve-3d',
                    opacity: playerOpacity,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                  }}
                >
                  {/* Player cutout — backgroundImage pattern (proven in ParallaxStoryScene) */}
                  <div style={{
                    width: '50%',
                    height: '85%',
                    position: 'relative',
                  }}>
                    {player.image ? (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        backgroundImage: `url(${player.image})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center bottom',
                        backgroundRepeat: 'no-repeat',
                        filter: 'drop-shadow(0 10px 50px rgba(0,0,0,0.8))',
                      }} />
                    ) : (
                      <div style={{
                        position: 'absolute',
                        bottom: 0,
                        left: '50%',
                        transform: 'translateX(-50%)',
                        width: 280,
                        height: 440,
                        borderRadius: '50% 50% 8% 8%',
                        background: `linear-gradient(180deg, ${rankColor}bb, ${rankColor}33)`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 120,
                        fontWeight: 900,
                        color: 'white',
                        textShadow: '0 4px 20px rgba(0,0,0,0.6)',
                        border: `3px solid ${rankColor}66`,
                      }}>
                        {player.name.charAt(0).toUpperCase()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── 3. TITLE ──────────────────────────────────────────── */}
        {title && titleOpacity > 0.01 && (
          <div style={{
            position: 'absolute', top: '4%', left: 0, right: 0,
            textAlign: 'center', zIndex: 300,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            pointerEvents: 'none',
          }}>
            <div style={{
              fontSize: 72, fontWeight: 900, color: '#FFFFFF',
              textShadow: '0 4px 40px rgba(0,0,0,0.9)', letterSpacing: -2,
            }}>
              {title}
            </div>
            {subtitle && (
              <div style={{
                fontSize: 32, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
                marginTop: 10, textShadow: '0 2px 16px rgba(0,0,0,0.8)',
              }}>
                {subtitle}
              </div>
            )}
          </div>
        )}

        {/* ── 4. CINEMATIC PLAYER OVERLAY (full-screen, broadcast quality) ── */}
        {players.map((player, i) => {
          const w = windows[i];
          if (!w) return null;
          const rankColor = getRankColor(player.rank);

          const localProgress = interpolate(
            frame, [w.startFrame, w.endFrame], [0, 1],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          // ── Staggered entrance timing ──
          const rankEnterProg = interpolate(localProgress, [0, 0.08], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const nameEnterProg = interpolate(localProgress, [0.05, 0.15], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const subEnterProg = interpolate(localProgress, [0.12, 0.25], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

          // Exit
          const exitProg = interpolate(localProgress, [0.82, 1], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
          const exitX = interpolate(exitProg, [0, 1], [0, -180]);

          // Overall opacity
          const overallOpacity = interpolate(
            localProgress, [0, 0.05, 0.8, 1], [0, 1, 1, 0],
            { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
          );

          if (overallOpacity < 0.01) return null;

          // Rank badge spring
          const badgeFrame = Math.max(0, frame - w.startFrame);
          const badgeScale = spring({
            frame: badgeFrame, fps,
            config: { damping: 10, stiffness: 300, mass: 0.3 },
            from: 0, to: 1,
          });

          // Name slide + scale (with overshoot)
          const nameScale = interpolate(easeOutBack(nameEnterProg), [0, 1], [0.5, 1]);
          const nameX = interpolate(easeOutExpo(nameEnterProg), [0, 1], [150, 0]);

          // Subtitle typewriter
          const sub = player.subtitle || '';
          const visibleChars = Math.round(easeOutExpo(subEnterProg) * sub.length);

          // Accent line grow
          const lineWidth = interpolate(easeOutExpo(nameEnterProg), [0, 1], [0, 100]);

          // Parse subtitle into individual achievement tokens
          const achievements = sub.split(/[•·\-–—]/).map(s => s.trim()).filter(Boolean);

          return (
            <div
              key={`card-${i}`}
              style={{
                position: 'absolute', inset: 0,
                zIndex: 200,
                opacity: overallOpacity,
                transform: `translateX(${exitX}px)`,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                padding: '4% 6%',
              }}
            >
              {/* ── ACHIEVEMENT BAR (top area) ── */}
              {achievements.length > 0 && (
                <div style={{
                  position: 'absolute',
                  top: '8%',
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 80,
                  opacity: easeOutExpo(subEnterProg),
                  transform: `translateY(${interpolate(easeOutExpo(subEnterProg), [0, 1], [-40, 0])}px)`,
                }}>
                  {achievements.map((ach, ai) => {
                    const achProg = interpolate(
                      subEnterProg,
                      [0.12 + ai * 0.05, 0.22 + ai * 0.05],
                      [0, 1],
                      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' },
                    );
                    const achOpacity = easeOutExpo(achProg);
                    const achScale = interpolate(easeOutBack(achProg), [0, 1], [0.3, 1]);
                    if (achOpacity < 0.01) return null;

                    const hasNumber = /^\d+/.test(ach);
                    const numberPart = ach.match(/^\d+/)?.[0] || '';
                    const labelPart = ach.replace(/^\d+\s*/, '').toUpperCase();

                    return (
                      <div
                        key={ai}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          gap: 12,
                          opacity: achOpacity,
                          transform: `scale(${achScale})`,
                        }}
                      >
                        {/* Big number on top, small label underneath */}
                        {hasNumber ? (
                          <div style={{
                            fontSize: 140,
                            fontWeight: 900,
                            lineHeight: 1,
                            textShadow: `0 0 60px ${rankColor}55, 0 8px 40px rgba(0,0,0,0.8)`,
                            background: `linear-gradient(180deg, #FFFFFF 20%, ${rankColor})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}>
                            {numberPart}
                          </div>
                        ) : (
                          <div style={{
                            fontSize: 56,
                            fontWeight: 800,
                            color: '#FFFFFF',
                            textShadow: `0 0 30px ${rankColor}66, 0 4px 20px rgba(0,0,0,0.8)`,
                            background: `linear-gradient(180deg, #FFFFFF, ${rankColor})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                          }}>
                            {labelPart}
                          </div>
                        )}
                        {hasNumber && labelPart && (
                          <div style={{
                            fontSize: 22,
                            fontWeight: 600,
                            color: rankColor,
                            textTransform: 'uppercase',
                            letterSpacing: 5,
                            textShadow: `0 0 20px ${rankColor}66`,
                            opacity: 0.8,
                          }}>
                            {labelPart}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── BOTTOM SECTION: rank + name + subtitle ── */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 14,
                maxWidth: '92%',
              }}>

                {/* Rank badge — big, glowing */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 20,
                  opacity: easeOutExpo(rankEnterProg),
                  transform: `scale(${badgeScale})`,
                }}>
                  <div style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    background: getRankGradient(player.rank),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 40,
                    fontWeight: 900,
                    color: '#fff',
                    boxShadow: `0 0 50px ${rankColor}aa, 0 0 100px ${rankColor}44, 0 6px 30px rgba(0,0,0,0.8)`,
                    border: '3px solid rgba(255,255,255,0.3)',
                  }}>
                    #{player.rank}
                  </div>
                  <div style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: rankColor,
                    textTransform: 'uppercase',
                    letterSpacing: 6,
                    textShadow: `0 0 20px ${rankColor}88`,
                  }}>
                    {player.rank === 1 ? 'G.O.A.T' : `Rank ${player.rank}`}
                  </div>
                </div>

                {/* Accent line */}
                <div style={{
                  width: `${lineWidth}%`,
                  height: 6,
                  borderRadius: 3,
                  background: `linear-gradient(90deg, ${rankColor}, transparent)`,
                  boxShadow: `0 0 25px ${rankColor}66`,
                  maxWidth: 700,
                }} />

                {/* NAME — MASSIVE, bold, cinematic */}
                <div style={{
                  fontSize: 100,
                  fontWeight: 900,
                  lineHeight: 1,
                  letterSpacing: -3,
                  textShadow: `0 0 60px ${rankColor}44, 0 6px 40px rgba(0,0,0,0.9)`,
                  opacity: easeOutExpo(nameEnterProg),
                  transform: `translateX(${nameX}px) scale(${nameScale})`,
                  background: `linear-gradient(180deg, #FFFFFF 15%, #FFFFFFdd 60%, ${rankColor}bb)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  filter: `drop-shadow(0 0 40px ${rankColor}22)`,
                }}>
                  {player.name.toUpperCase()}
                </div>

                {/* Subtitle / achievements line — typewriter */}
                {sub && easeOutExpo(subEnterProg) > 0.01 && (
                  <div style={{
                    fontSize: 32,
                    fontWeight: 600,
                    color: 'rgba(255,255,255,0.8)',
                    letterSpacing: 1,
                    textShadow: '0 3px 16px rgba(0,0,0,0.9)',
                    opacity: easeOutExpo(subEnterProg),
                    maxWidth: '85%',
                  }}>
                    {sub.slice(0, visibleChars)}
                    {visibleChars < sub.length && (
                      <span style={{
                        opacity: 0.7,
                        color: rankColor,
                        fontSize: 36,
                        fontWeight: 300,
                      }}>|</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}



      </AbsoluteFill>
    </AbsoluteFill>
  );
}
