import React from 'react';
import { useCurrentFrame, interpolate, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { CountdownBlock, AnimationPhase } from '../schemas';

interface CountdownSceneProps {
  data: CountdownBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function CountdownScene({ data, theme, motionProfile, animation }: CountdownSceneProps) {
  const frame = useCurrentFrame();
  const colors = getTheme(theme);
  const fps = 30;
  
  const { 
    title, 
    days = 0, 
    hours = 0, 
    minutes = 0, 
    seconds = 0, 
    style = 'modern', 
    color, 
    showLabels = true 
  } = data;
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Entrance animation
  const opacity = interpolate(
    frame,
    [0, animation.enter * fps],
    [0, 1],
    { extrapolateRight: 'clamp' }
  );
  
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  // Time units - only show if value > 0
  const timeUnits = [
    { value: days, label: 'Days' },
    { value: hours, label: 'Hours' },
    { value: minutes, label: 'Minutes' },
    { value: seconds, label: 'Seconds' },
  ].filter((u, idx) => u.value > 0 || idx < 2);
  
  // Style configurations
  const styles = {
    modern: {
      gap: 24,
      boxBg: colors.surface,
      borderRadius: 16,
      padding: '24px 32px',
      boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
    },
    classic: {
      gap: 16,
      boxBg: colors.background,
      borderRadius: 8,
      padding: '20px 24px',
      boxShadow: 'none',
      border: `2px solid ${color || colors.primary}`,
    },
    minimal: {
      gap: 40,
      boxBg: 'transparent',
      borderRadius: 0,
      padding: '16px 24px',
      boxShadow: 'none',
    },
    flip: {
      gap: 20,
      boxBg: colors.surface,
      borderRadius: 12,
      padding: '20px 28px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.1)',
    },
  };
  
  const styleConfig = styles[style] || styles.modern;
  
  return (
    <BaseScene theme={theme} customization={customization} animation={animation} opacity={opacity} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 48,
          transform: `scale(${scale})`,
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              fontSize: 36,
              fontFamily: 'system-ui, sans-serif',
              color: colors.muted,
              fontWeight: 600,
              textAlign: 'center',
              textTransform: 'uppercase',
              letterSpacing: 3,
            }}
          >
            {title}
          </div>
        )}
        
        {/* Countdown Units */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: styleConfig.gap,
          }}
        >
          {timeUnits.map((unit, index) => {
            const unitScale = spring({
              frame: frame - index * 5,
              fps,
              config: { damping: 12, stiffness: 100 },
            });
            
            return (
              <div
                key={unit.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  backgroundColor: styleConfig.boxBg,
                  borderRadius: styleConfig.borderRadius,
                  padding: styleConfig.padding,
                  boxShadow: styleConfig.boxShadow,
                  border: (styleConfig as any).border || 'none',
                  transform: `scale(${unitScale})`,
                }}
              >
                <div
                  style={{
                    fontFamily: 'system-ui, sans-serif',
                    color: color || colors.foreground,
                    fontSize: 72,
                    fontWeight: 800,
                  }}
                >
                  {String(unit.value).padStart(2, '0')}
                </div>
                {showLabels && (
                  <div
                    style={{
                      fontFamily: 'system-ui, sans-serif',
                      color: colors.muted,
                      fontSize: 16,
                      textTransform: 'uppercase',
                      letterSpacing: 2,
                    }}
                  >
                    {unit.label}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </BaseScene>
  );
}
