import React from 'react';
import { useCurrentFrame, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { MotionProfileType } from '../utils/animations';
import type { SocialStatsBlock, AnimationPhase } from '../schemas';

interface SocialStatsSceneProps {
  data: SocialStatsBlock;
  theme: string;
  motionProfile: MotionProfileType;
  animation: { enter: number; hold: number; exit: number };
}

// Platform configurations
const platformConfig: Record<string, { color: string; icon: string }> = {
  twitter: { color: '#1DA1F2', icon: '𝕏' },
  instagram: { color: '#E4405F', icon: '📷' },
  youtube: { color: '#FF0000', icon: '▶️' },
  tiktok: { color: '#000000', icon: '🎵' },
  linkedin: { color: '#0A66C2', icon: '💼' },
  facebook: { color: '#1877F2', icon: '📘' },
};

export function SocialStatsScene({ data, theme, motionProfile, animation }: SocialStatsSceneProps) {
  const frame = useCurrentFrame();
  const colors = getTheme(theme);
  const fps = 30;
  
  const {
    platform = 'twitter',
    username = '@username',
    followers = 50000,
    posts,
    likes,
    verified = false,
    showGrowth = true,
    growthPercentage = 15.5,
  } = data;
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  const platformData = platformConfig[platform] || platformConfig.twitter;
  
  // Entrance animation
  const scale = spring({
    frame,
    fps,
    config: { damping: 12, stiffness: 80 },
  });
  
  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };
  
  return (
    <BaseScene theme={theme} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          transform: `scale(${scale})`,
        }}
      >
        {/* Platform Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              backgroundColor: platformData.color,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              fontSize: 32,
            }}
          >
            {platformData.icon}
          </div>
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  fontSize: 28,
                  fontFamily: 'system-ui, sans-serif',
                  color: colors.foreground,
                  fontWeight: 700,
                }}
              >
                {username}
              </span>
              {verified && (
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    backgroundColor: platformData.color,
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    fontSize: 14,
                    color: '#FFFFFF',
                  }}
                >
                  ✓
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: 16,
                fontFamily: 'system-ui, sans-serif',
                color: colors.muted,
              }}
            >
              {platform.charAt(0).toUpperCase() + platform.slice(1)}
            </span>
          </div>
        </div>
        
        {/* Main Stats */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 48,
          }}
        >
          {/* Followers */}
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 64,
                fontFamily: 'system-ui, sans-serif',
                color: colors.foreground,
                fontWeight: 800,
              }}
            >
              {formatNumber(followers)}
            </div>
            <div
              style={{
                fontSize: 18,
                fontFamily: 'system-ui, sans-serif',
                color: colors.muted,
                textTransform: 'uppercase',
                letterSpacing: 2,
              }}
            >
              Followers
            </div>
            {showGrowth && growthPercentage && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  marginTop: 8,
                  color: '#10B981',
                  fontSize: 16,
                  fontWeight: 600,
                }}
              >
                ↑ {growthPercentage}%
              </div>
            )}
          </div>
          
          {/* Posts */}
          {posts !== undefined && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 40,
                  fontFamily: 'system-ui, sans-serif',
                  color: colors.muted,
                  fontWeight: 700,
                }}
              >
                {formatNumber(posts)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontFamily: 'system-ui, sans-serif',
                  color: colors.muted,
                  textTransform: 'uppercase',
                }}
              >
                Posts
              </div>
            </div>
          )}
          
          {/* Likes */}
          {likes !== undefined && (
            <div style={{ textAlign: 'center' }}>
              <div
                style={{
                  fontSize: 40,
                  fontFamily: 'system-ui, sans-serif',
                  color: colors.muted,
                  fontWeight: 700,
                }}
              >
                {formatNumber(likes)}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontFamily: 'system-ui, sans-serif',
                  color: colors.muted,
                  textTransform: 'uppercase',
                }}
              >
                Likes
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseScene>
  );
}
