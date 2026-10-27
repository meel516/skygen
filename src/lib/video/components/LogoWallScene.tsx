import React from 'react';
import { useCurrentFrame, useVideoConfig, spring, Img } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { LogoWallBlock, AnimationPhase } from '../schemas';

interface LogoWallSceneProps {
  data: LogoWallBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function LogoWallScene({ data, theme, motionProfile, animation }: LogoWallSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  const customization = extractCustomization(data);

  const { title, subtitle, logos, columns = 4 } = data;

  const exitStart = (animation.enter + animation.hold) * fps;
  const exitProgress = frame > exitStart
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;

  const titleSpring = spring({ frame, fps, config: { damping: 15, stiffness: 80 } });

  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '40px 50px', gap: 24 }}>
        {/* Header */}
        {(title || subtitle) && (
          <div style={{ textAlign: 'center', opacity: titleSpring, transform: `translateY(${(1 - titleSpring) * 30}px)` }}>
            {title && (
              <h2 style={{ fontSize: 42, fontWeight: 700, color: colors.foreground, margin: 0 }}>{title}</h2>
            )}
            {subtitle && (
              <p style={{ fontSize: 22, color: colors.muted, margin: '8px 0 0' }}>{subtitle}</p>
            )}
          </div>
        )}

        {/* Logo Grid */}
        <div
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 24,
            alignContent: 'center',
            justifyItems: 'center',
            padding: '20px 0',
          }}
        >
          {logos.map((logo, i) => {
            const delay = 8 + i * 3;
            const logoSpring = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 100 } });
            const isUrl = logo.src?.startsWith('http') || logo.src?.startsWith('data:');

            return (
              <div
                key={i}
                style={{
                  opacity: logoSpring,
                  transform: `scale(${logoSpring})`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {isUrl ? (
                  <Img
                    src={logo.src}
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: 'contain',
                      borderRadius: 12,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 80,
                      height: 80,
                      borderRadius: 12,
                      background: `${colors.primary}20`,
                      border: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 28,
                      fontWeight: 700,
                      color: colors.primary,
                    }}
                  >
                    {logo.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span style={{ fontSize: 13, color: colors.muted, textAlign: 'center' }}>
                  {logo.name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </BaseScene>
  );
}
