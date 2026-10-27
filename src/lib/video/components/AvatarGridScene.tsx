import React from 'react';
import { useCurrentFrame, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { AvatarGridBlock, AnimationPhase } from '../schemas';

interface Avatar {
  name: string;
  role?: string;
  image?: string;
}

interface AvatarGridSceneProps {
  data: AvatarGridBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

// Generate placeholder avatar color
function getAvatarColor(name: string): string {
  const avatarColors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
  const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

// Get initials from name
function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AvatarGridScene({ data, theme, motionProfile, animation }: AvatarGridSceneProps) {
  const frame = useCurrentFrame();
  const colors = getTheme(theme);
  const fps = 30;
  
  const { title, subtitle, avatars = [], layout = 'grid', columns = 3 } = data;
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Default avatars if none provided
  const displayAvatars = avatars.length > 0 ? avatars : [
    { name: 'John Doe', role: 'CEO' },
    { name: 'Jane Smith', role: 'CTO' },
    { name: 'Bob Wilson', role: 'Designer' },
  ];
  
  // Entrance animation
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 100 },
  });
  
  return (
    <BaseScene theme={theme} customization={customization} animation={animation} style={{ padding: 40 }} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 40,
          transform: `scale(${scale})`,
        }}
      >
        {/* Title */}
        {title && (
          <div
            style={{
              fontSize: 36,
              fontFamily: 'system-ui, sans-serif',
              color: colors.foreground,
              fontWeight: 700,
              textAlign: 'center',
            }}
          >
            {title}
          </div>
        )}
        
        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: 20,
              fontFamily: 'system-ui, sans-serif',
              color: colors.muted,
              textAlign: 'center',
            }}
          >
            {subtitle}
          </div>
        )}
        
        {/* Avatar Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: 32,
            maxWidth: 800,
          }}
        >
          {displayAvatars.map((avatar, index) => {
            const avatarScale = spring({
              frame: frame - index * 5,
              fps,
              config: { damping: 12, stiffness: 100 },
            });
            
            const avatarColor = getAvatarColor(avatar.name);
            const initials = getInitials(avatar.name);
            
            return (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 12,
                  transform: `scale(${avatarScale})`,
                }}
              >
                {/* Avatar Circle */}
                <div
                  style={{
                    width: 100,
                    height: 100,
                    borderRadius: '50%',
                    backgroundColor: avatar.image ? 'transparent' : avatarColor,
                    overflow: 'hidden',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: 36,
                    fontWeight: 700,
                    color: '#FFFFFF',
                    boxShadow: `0 8px 24px ${avatarColor}40`,
                  }}
                >
                  {avatar.image ? (
                    <img
                      src={avatar.image}
                      alt={avatar.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    initials
                  )}
                </div>
                
                {/* Name */}
                <div
                  style={{
                    fontSize: 20,
                    fontFamily: 'system-ui, sans-serif',
                    color: colors.foreground,
                    fontWeight: 600,
                    textAlign: 'center',
                  }}
                >
                  {avatar.name}
                </div>
                
                {/* Role */}
                {avatar.role && (
                  <div
                    style={{
                      fontSize: 14,
                      fontFamily: 'system-ui, sans-serif',
                      color: colors.muted,
                      textAlign: 'center',
                    }}
                  >
                    {avatar.role}
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
