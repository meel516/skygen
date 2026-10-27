import React from 'react';
import { AbsoluteFill, useCurrentFrame, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { AnimatedBackgroundBlock, AnimationPhase } from '../schemas';

interface AnimatedBgSceneProps {
  data: AnimatedBackgroundBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

export function AnimatedBgScene({ data, theme, motionProfile, animation }: AnimatedBgSceneProps) {
  const frame = useCurrentFrame();
  const colors = getTheme(theme);
  const fps = 30;
  
  const {
    style = 'particles',
    primaryColor = '#3B82F6',
    secondaryColor = '#8B5CF6',
    speed = 1,
    intensity = 0.5,
    overlay = false,
    overlayOpacity = 0.3,
  } = data;
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Entrance animation
  const scale = spring({
    frame,
    fps,
    config: { damping: 15, stiffness: 50 },
  });
  
  const particleCount = Math.round(20 * intensity);
  
  return (
    <BaseScene theme={theme} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      {/* Background Effects */}
      <AbsoluteFill style={{ overflow: 'hidden' }}>
        {/* Particles Style */}
        {style === 'particles' && (
          <>
            {Array.from({ length: particleCount }).map((_, i) => {
              const angle = (i / particleCount) * Math.PI * 2 + frame * 0.01 * speed;
              const distance = 100 + Math.sin(frame * 0.02 + i) * 50 * intensity;
              const x = Math.cos(angle) * distance;
              const y = Math.sin(angle) * distance;
              const size = 4 + Math.sin(frame * 0.03 + i) * 2;
              
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    backgroundColor: i % 2 === 0 ? primaryColor : secondaryColor,
                    opacity: 0.3 + intensity * 0.5,
                    transform: 'translate(-50%, -50%)',
                    boxShadow: `0 0 ${size * 3}px ${i % 2 === 0 ? primaryColor : secondaryColor}`,
                  }}
                />
              );
            })}
          </>
        )}
        
        {/* Waves Style */}
        {style === 'waves' && (
          <>
            {Array.from({ length: 5 }).map((_, i) => {
              const offset = i * 20;
              const waveOpacity = (1 - i / 5) * 0.3 * intensity;
              const waveSize = 200 + offset + Math.sin(frame * 0.05 * speed) * 50;
              
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: waveSize,
                    height: waveSize,
                    borderRadius: '50%',
                    border: `2px solid ${primaryColor}`,
                    opacity: waveOpacity,
                    transform: 'translate(-50%, -50%)',
                  }}
                />
              );
            })}
          </>
        )}
        
        {/* Gradient Style */}
        {style === 'gradient' && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `linear-gradient(${frame * speed}deg, ${primaryColor}, ${secondaryColor}, ${primaryColor})`,
              backgroundSize: '200% 200%',
              opacity: intensity,
            }}
          />
        )}
        
        {/* Aurora Style */}
        {style === 'aurora' && (
          <>
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: `radial-gradient(ellipse at ${30 + Math.sin(frame * 0.01 * speed) * 20}% ${50 + Math.cos(frame * 0.015 * speed) * 20}%, ${primaryColor}40 0%, transparent 50%)`,
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: '-50%',
                left: '-50%',
                width: '200%',
                height: '200%',
                background: `radial-gradient(ellipse at ${70 + Math.cos(frame * 0.02 * speed) * 20}% ${40 + Math.sin(frame * 0.01 * speed) * 20}%, ${secondaryColor}40 0%, transparent 50%)`,
              }}
            />
          </>
        )}
        
        {/* Geometric Style */}
        {style === 'geometric' && (
          <>
            {Array.from({ length: 6 }).map((_, i) => {
              const angle = (i * 60) + frame * 0.5 * speed;
              const distance = 150 + Math.sin(frame * 0.02 + i) * 50;
              const x = Math.cos(angle * Math.PI / 180) * distance;
              const y = Math.sin(angle * Math.PI / 180) * distance;
              const shapes = ['polygon(50% 0%, 100% 100%, 0% 100%)', 'circle(50%)'];
              
              return (
                <div
                  key={i}
                  style={{
                    position: 'absolute',
                    left: `calc(50% + ${x}px)`,
                    top: `calc(50% + ${y}px)`,
                    width: 40,
                    height: 40,
                    backgroundColor: i % 2 === 0 ? primaryColor : secondaryColor,
                    clipPath: shapes[i % shapes.length],
                    opacity: 0.3,
                    transform: `translate(-50%, -50%) rotate(${frame * speed * 0.2}deg)`,
                  }}
                />
              );
            })}
          </>
        )}
      </AbsoluteFill>
      
      {/* Dark Overlay */}
      {overlay && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.8)',
            opacity: overlayOpacity,
          }}
        />
      )}
      
      {/* Center indicator */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          transform: `scale(${scale})`,
        }}
      >
        <div
          style={{
            fontSize: 48,
            fontFamily: 'system-ui, sans-serif',
            color: colors.foreground,
            fontWeight: 700,
            textShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          Animated Background
        </div>
      </div>
    </BaseScene>
  );
}
