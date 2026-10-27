// ============================================================================
// WEATHER SCENE COMPONENT - Animated weather widget for video blocks
// ============================================================================

import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { getTheme } from '../utils/theme';
import type { WeatherBlock, AnimationPhase } from '../schemas';
import type { MotionProfileType } from '../utils/animations';

/**
 * Weather condition types
 */
type WeatherCondition = 
  | 'sunny' 
  | 'partly-cloudy' 
  | 'cloudy' 
  | 'rainy' 
  | 'stormy' 
  | 'snowy' 
  | 'windy' 
  | 'foggy'
  | 'night-clear'
  | 'night-cloudy';

/**
 * Weather scene props
 */
export interface WeatherSceneProps {
  data: WeatherBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

/**
 * Weather Icon Component
 */
const WeatherIcon: React.FC<{ 
  condition: WeatherCondition; 
  size: number; 
  color: string;
  animate?: boolean;
  frame: number;
}> = ({ condition, size, color, animate = true, frame }) => {
  const rotation = animate ? Math.sin(frame * 0.05) * 5 : 0;
  const pulse = animate ? 1 + Math.sin(frame * 0.1) * 0.05 : 1;
  const float = animate ? Math.sin(frame * 0.03) * 5 : 0;
  
  const iconStyle: React.CSSProperties = {
    fontSize: size,
    filter: `drop-shadow(0 4px 20px ${color}40)`,
    transform: `rotate(${rotation}deg) scale(${pulse}) translateY(${float}px)`,
  };
  
  // Weather icons mapping
  const icons: Record<WeatherCondition, string> = {
    'sunny': '☀️',
    'partly-cloudy': '⛅',
    'cloudy': '☁️',
    'rainy': '🌧️',
    'stormy': '⛈️',
    'snowy': '❄️',
    'windy': '💨',
    'foggy': '🌫️',
    'night-clear': '🌙',
    'night-cloudy': '☁️',
  };
  
  return (
    <div style={iconStyle}>
      {icons[condition] || '🌤️'}
    </div>
  );
};

/**
 * Weather Scene Component
 */
export function WeatherScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation = { enter: 0.4, hold: 3, exit: 0.4 },
}: WeatherSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const fps = 30;
  const colors = getTheme(theme);
  
  const {
    location = 'Unknown Location',
    temperature = 72,
    unit = 'F',
    condition = 'partly-cloudy',
    description = 'Partly cloudy',
    humidity = 65,
    windSpeed = 10,
    highTemp = 78,
    lowTemp = 58,
    showForecast = true,
    showDetails = true,
    cardStyle = 'glass',
    accentColor = '#38BDF8',
    animateIcon = true,
  } = data;
  
  // Animation values
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const slideUp = interpolate(frame, [0, 20], [30, 0], { extrapolateRight: 'clamp' });
  const scale = spring({ frame, fps, config: { damping: 15, stiffness: 100 } });
  
  // Card style variations
  const cardStyles: Record<string, React.CSSProperties> = {
    glass: {
      background: 'rgba(255, 255, 255, 0.1)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.2)',
      borderRadius: 24,
    },
    solid: {
      background: colors.backgroundSecondary || 'rgba(30, 41, 59, 0.9)',
      borderRadius: 24,
    },
    minimal: {
      background: 'transparent',
    },
    gradient: {
      background: `linear-gradient(135deg, ${accentColor}20 0%, ${colors.backgroundSecondary || 'rgba(30, 41, 59, 0.9)'} 100%)`,
      borderRadius: 24,
      border: `1px solid ${accentColor}30`,
    },
  };
  
  const cardStyleProps = cardStyles[cardStyle] || cardStyles.glass;
  
  // Format temperature
  const formatTemp = (temp: number): string => {
    return `${Math.round(temp)}°${unit}`;
  };
  
  return (
    <BaseScene
      theme={theme}
      customization={extractCustomization(data)}
      animation={animation}
      audioSrc={data.audioSrc}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          padding: 40,
          opacity,
          transform: `translateY(${slideUp}px)`,
        }}
      >
        {/* Weather Card */}
        <div
          style={{
            width: '90%',
            maxWidth: 600,
            padding: 40,
            ...cardStyleProps,
            opacity,
            transform: `scale(${scale})`,
          }}
        >
          {/* Location */}
          <div
            style={{
              fontSize: 28,
              fontWeight: 500,
              color: colors.muted,
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            <span>📍</span>
            {location}
          </div>
          
          {/* Main Weather Display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 24,
              marginBottom: 16,
            }}
          >
            {/* Weather Icon */}
            <WeatherIcon
              condition={condition as WeatherCondition}
              size={120}
              color={accentColor}
              animate={animateIcon}
              frame={frame}
            />
            
            {/* Temperature */}
            <div
              style={{
                fontSize: 96,
                fontWeight: 800,
                color: colors.foreground,
                lineHeight: 1,
              }}
            >
              {formatTemp(temperature)}
            </div>
          </div>
          
          {/* Description */}
          <div
            style={{
              fontSize: 28,
              color: colors.muted,
              textAlign: 'center',
              marginBottom: 24,
            }}
          >
            {description || condition.replace('-', ' ')}
          </div>
          
          {/* High/Low Forecast */}
          {showForecast && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 32,
                marginBottom: 24,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: colors.muted }}>High</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#F97316' }}>
                  {formatTemp(highTemp)}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 16, color: colors.muted }}>Low</div>
                <div style={{ fontSize: 32, fontWeight: 600, color: '#38BDF8' }}>
                  {formatTemp(lowTemp)}
                </div>
              </div>
            </div>
          )}
          
          {/* Humidity & Wind */}
          {showDetails && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                gap: 48,
                borderTop: `1px solid ${colors.border || 'rgba(255,255,255,0.1)'}`,
                paddingTop: 20,
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: colors.muted }}>Humidity</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: accentColor }}>
                  {humidity}%
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 14, color: colors.muted }}>Wind</div>
                <div style={{ fontSize: 24, fontWeight: 600, color: accentColor }}>
                  {windSpeed} {unit === 'F' ? 'mph' : 'km/h'}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </BaseScene>
  );
}

export default WeatherScene;
