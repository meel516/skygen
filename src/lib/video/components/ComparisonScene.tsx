import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { BaseScene, extractCustomization } from './BaseScene';
import { 
  useFadeIn, 
  useScaleIn, 
  useSlideIn, 
  useBarGrow,
  useStaggeredEntry,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { ComparisonBlock, ComparisonItem, AnimationPhase } from '../schemas';

// ============================================================================
// COMPARISON SCENE COMPONENT
// ============================================================================

export interface ComparisonSceneProps {
  data: ComparisonBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function ComparisonScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: ComparisonSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Extract customizations
  const customization = extractCustomization(data);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 3;
  
  // Title animations
  const titleSlide = useSlideIn('up', 40, 0.5, 0, motionProfile);
  const titleOpacity = useFadeIn(0.4, 0, motionProfile);
  
  // Get max value for bar scaling
  const maxValue = Math.max(...data.items.map(item => item.value));
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;

  return (
    <BaseScene theme={theme} opacity={exitOpacity} customization={customization} animation={animation} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '40px 60px',
          gap: 40,
        }}
      >
        {/* Title */}
        {data.title && (
          <div
            style={{
              transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
              opacity: titleOpacity,
            }}
          >
            <h2
              style={{
                fontSize: 42,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
          </div>
        )}
        
        {/* Bars container */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 30,
          }}
        >
          {data.items.map((item, index) => (
            <ComparisonBar
              key={index}
              item={item}
              index={index}
              maxValue={maxValue}
              theme={theme}
              motionProfile={motionProfile}
              colors={colors}
            />
          ))}
        </div>
      </div>
    </BaseScene>
  );
}

// ============================================================================
// COMPARISON BAR COMPONENT
// ============================================================================

interface ComparisonBarProps {
  item: ComparisonItem;
  index: number;
  maxValue: number;
  theme: string;
  motionProfile: MotionProfileType;
  colors: ReturnType<typeof getTheme>;
}

function ComparisonBar({
  item,
  index,
  maxValue,
  theme,
  motionProfile,
  colors,
}: ComparisonBarProps): React.ReactElement {
  const stagger = useStaggeredEntry(index, 0.15, motionProfile);
  const barWidth = useBarGrow(maxValue, item.value, 1, index * 0.15, motionProfile);
  
  // Color for the bar
  const barColor = item.color || generateBarColor(index, colors);
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        opacity: stagger.opacity,
        transform: `translateY(${stagger.translateY}px) scale(${stagger.scale})`,
      }}
    >
      {/* Label */}
      <div
        style={{
          width: 120,
          textAlign: 'right',
        }}
      >
        <span
          style={{
            fontSize: 24,
            fontWeight: 600,
            color: colors.foreground,
          }}
        >
          {item.label}
        </span>
      </div>
      
      {/* Bar container */}
      <div
        style={{
          flex: 1,
          height: 50,
          background: `${colors.primary}15`,
          borderRadius: 25,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Animated bar */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${barWidth}%`,
            background: `linear-gradient(90deg, ${barColor}, ${adjustColor(barColor, 20)})`,
            borderRadius: 25,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            paddingRight: 20,
            boxShadow: `0 4px 20px ${barColor}40`,
          }}
        >
          {/* Value on bar */}
          <span
            style={{
              fontSize: 22,
              fontWeight: 700,
              color: colors.foreground,
            }}
          >
            {item.value.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DONUT CHART COMPARISON
// ============================================================================

export interface DonutComparisonProps {
  data: ComparisonBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function DonutComparison({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
}: DonutComparisonProps): React.ReactElement {
  const colors = getTheme(theme);
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const total = data.items.reduce((sum, item) => sum + item.value, 0);
  
  // Title animations
  const titleOpacity = useFadeIn(0.4, 0, motionProfile);
  const titleSlide = useSlideIn('up', 30, 0.4, 0, motionProfile);
  
  // Chart scale animation
  const chartScale = useScaleIn(0.6, 0.2, motionProfile);
  const chartOpacity = useFadeIn(0.4, 0.2, motionProfile);
  
  // Calculate stroke-dasharray for each segment
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  
  return (
    <BaseScene theme={theme}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          height: '100%',
          gap: 40,
        }}
      >
        {/* Title */}
        {data.title && (
          <div
            style={{
              transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
              opacity: titleOpacity,
            }}
          >
            <h2
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
          </div>
        )}
        
        {/* Donut chart */}
        <div
          style={{
            position: 'relative',
            transform: `scale(${chartScale})`,
            opacity: chartOpacity,
          }}
        >
          <svg width={300} height={300} style={{ transform: 'rotate(-90deg)' }}>
            {data.items.map((item, index) => {
              const percentage = item.value / total;
              const prevPercentages = data.items
                .slice(0, index)
                .reduce((sum, i) => sum + i.value / total, 0);
              
              const strokeDasharray = circumference * percentage;
              const strokeDashoffset = -circumference * prevPercentages;
              const color = item.color || generateBarColor(index, colors);
              
              return (
                <circle
                  key={index}
                  cx={150}
                  cy={150}
                  r={radius}
                  fill="none"
                  stroke={color}
                  strokeWidth={40}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  style={{
                    transition: 'stroke-dasharray 0.5s ease',
                  }}
                />
              );
            })}
          </svg>
          
          {/* Center text */}
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 48,
                fontWeight: 800,
                color: colors.foreground,
              }}
            >
              {total.toLocaleString()}
            </div>
            <div
              style={{
                fontSize: 18,
                color: colors.muted,
              }}
            >
              Total
            </div>
          </div>
        </div>
        
        {/* Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 20,
            justifyContent: 'center',
          }}
        >
          {data.items.map((item, index) => (
            <LegendItem
              key={index}
              item={item}
              index={index}
              total={total}
              colors={colors}
            />
          ))}
        </div>
      </div>
    </BaseScene>
  );
}

interface LegendItemProps {
  item: ComparisonItem;
  index: number;
  total: number;
  colors: ReturnType<typeof getTheme>;
}

function LegendItem({ item, index, total, colors }: LegendItemProps): React.ReactElement {
  const opacity = useFadeIn(0.3, 0.5 + index * 0.1, 'subtle');
  const color = item.color || generateBarColor(index, colors);
  const percentage = ((item.value / total) * 100).toFixed(1);
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 4,
          background: color,
        }}
      />
      <span style={{ fontSize: 18, color: colors.foreground }}>
        {item.label}
      </span>
      <span style={{ fontSize: 16, color: colors.muted }}>
        {percentage}%
      </span>
    </div>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function generateBarColor(index: number, colors: ReturnType<typeof getTheme>): string {
  const palette = [
    colors.primary,
    colors.secondary,
    colors.accent,
    '#10b981',
    '#f59e0b',
    '#ef4444',
  ];
  return palette[index % palette.length];
}

function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}
