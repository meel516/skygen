import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { ProcessStepsBlock, AnimationPhase } from '../schemas';

interface ProcessStepsSceneProps {
  data: ProcessStepsBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function ProcessStepsScene({ data, theme, motionProfile, animation }: ProcessStepsSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  const customization = extractCustomization(data);

  const { title, subtitle, steps } = data;
  const isVertical = steps.length > 4;

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

        {/* Steps */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: isVertical ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: isVertical ? 16 : 8,
            padding: '10px 0',
          }}
        >
          {steps.map((step, i) => {
            const delay = 10 + i * 8;
            const stepSpring = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 80 } });
            const circleSize = isVertical ? 48 : 56;

            return (
              <React.Fragment key={i}>
                {/* Step */}
                <div
                  style={{
                    opacity: stepSpring,
                    transform: `scale(${0.7 + stepSpring * 0.3})`,
                    display: 'flex',
                    flexDirection: isVertical ? 'row' : 'column',
                    alignItems: 'center',
                    gap: isVertical ? 16 : 10,
                    flex: isVertical ? undefined : 1,
                  }}
                >
                  {/* Circle */}
                  <div
                    style={{
                      width: circleSize,
                      height: circleSize,
                      borderRadius: '50%',
                      background: `${colors.primary}20`,
                      border: `3px solid ${colors.primary}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: step.icon ? 24 : 20,
                      fontWeight: 700,
                      color: colors.primary,
                      flexShrink: 0,
                    }}
                  >
                    {step.icon || step.number}
                  </div>

                  {/* Text */}
                  <div style={{ textAlign: isVertical ? 'left' : 'center', maxWidth: isVertical ? 500 : 160 }}>
                    <div style={{ fontSize: isVertical ? 20 : 17, fontWeight: 600, color: colors.foreground }}>
                      {step.title}
                    </div>
                    {step.description && (
                      <div style={{ fontSize: isVertical ? 15 : 13, color: colors.muted, marginTop: 4 }}>
                        {step.description}
                      </div>
                    )}
                  </div>
                </div>

                {/* Connector line */}
                {i < steps.length - 1 && (
                  <div
                    style={{
                      opacity: stepSpring,
                      ...(isVertical
                        ? { width: 2, height: 20, marginLeft: circleSize / 2 - 1, background: colors.border }
                        : { height: 2, width: 24, background: colors.border, flexShrink: 0 }),
                    }}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </BaseScene>
  );
}
