import React from 'react';
import { useCurrentFrame, useVideoConfig, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { PricingTableBlock, AnimationPhase } from '../schemas';

interface PricingTableSceneProps {
  data: PricingTableBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function PricingTableScene({ data, theme, motionProfile, animation }: PricingTableSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  const customization = extractCustomization(data);

  const { title, subtitle, plans } = data;

  const exitStart = (animation.enter + animation.hold) * fps;
  const exitProgress = frame > exitStart
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;

  // Title entrance
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

        {/* Cards */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24 }}>
          {plans.map((plan, i) => {
            const delay = 6 + i * 5;
            const cardSpring = spring({ frame: Math.max(0, frame - delay), fps, config: { damping: 14, stiffness: 90 } });
            const isHighlighted = plan.highlighted;

            return (
              <div
                key={i}
                style={{
                  opacity: cardSpring,
                  transform: `scale(${0.85 + cardSpring * (isHighlighted ? 0.2 : 0.15)}) translateY(${(1 - cardSpring) * 40}px)`,
                  display: 'flex',
                  flexDirection: 'column',
                  background: isHighlighted ? `${colors.primary}18` : `${colors.foreground}08`,
                  border: `2px solid ${isHighlighted ? colors.primary : colors.border}`,
                  borderRadius: 16,
                  padding: '28px 24px',
                  width: plans.length <= 2 ? 320 : plans.length === 3 ? 260 : 220,
                  minHeight: 340,
                  boxShadow: isHighlighted ? `0 0 30px ${colors.primary}30` : 'none',
                }}
              >
                {/* Plan name */}
                <div style={{ fontSize: 20, fontWeight: 600, color: isHighlighted ? colors.primary : colors.foreground, marginBottom: 12 }}>
                  {plan.name}
                </div>

                {/* Price */}
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 20 }}>
                  <span style={{ fontSize: 40, fontWeight: 800, color: colors.foreground }}>{plan.price}</span>
                  {plan.period && <span style={{ fontSize: 16, color: colors.muted }}>{plan.period}</span>}
                </div>

                {/* Features */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {plan.features.map((feature, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: colors.foreground }}>
                      <span style={{ color: colors.primary, fontSize: 16 }}>✓</span>
                      {feature}
                    </div>
                  ))}
                </div>

                {/* CTA button */}
                <div
                  style={{
                    marginTop: 16,
                    padding: '10px 20px',
                    borderRadius: 8,
                    textAlign: 'center',
                    fontWeight: 600,
                    fontSize: 15,
                    background: isHighlighted ? colors.primary : 'transparent',
                    color: isHighlighted ? '#fff' : colors.primary,
                    border: isHighlighted ? 'none' : `2px solid ${colors.primary}`,
                  }}
                >
                  {plan.ctaText || 'Get Started'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </BaseScene>
  );
}
