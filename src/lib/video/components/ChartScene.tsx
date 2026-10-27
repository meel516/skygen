import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { BaseScene } from './BaseScene';
import { 
  useFadeIn, 
  useScaleIn, 
  useSlideIn,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { LineChartBlock, PieChartBlock, AnimationPhase } from '../schemas';

// ============================================================================
// LINE CHART SCENE COMPONENT
// ============================================================================

export interface LineChartSceneProps {
  data: LineChartBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function LineChartScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: LineChartSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 4;
  
  // Title animations
  const titleSlide = useSlideIn('up', 40, 0.5, 0, motionProfile);
  const titleOpacity = useFadeIn(0.4, 0, motionProfile);
  
  // Chart animation
  const chartOpacity = useFadeIn(0.6, 0.2, motionProfile);
  const chartScale = useScaleIn(0.3, 0.2, motionProfile);
  
  // Line animation progress
  const lineProgress = interpolate(
    frame,
    [0.3 * fps, 1.5 * fps],
    [0, 1],
    { extrapolateRight: 1, extrapolateLeft: 0 }
  );
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  // Calculate chart dimensions
  const chartWidth = 800;
  const chartHeight = 400;
  const padding = 60;
  
  const max = Math.max(...data.data);
  const min = Math.min(...data.data);
  const range = max - min || 1;
  
  // Generate points
  const points = data.data.map((value, index) => {
    const x = padding + (index / (data.data.length - 1)) * (chartWidth - 2 * padding);
    const y = chartHeight - padding - ((value - min) / range) * (chartHeight - 2 * padding);
    return { x, y, value };
  });
  
  // Create path
  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  
  // Animated path length
  const totalLength = chartWidth;
  const dashOffset = totalLength * (1 - lineProgress);

  return (
    <BaseScene theme={theme} opacity={exitOpacity} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '50px 60px',
          gap: 30,
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
                fontSize: 44,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
            {data.subtitle && (
              <p style={{ fontSize: 24, color: colors.muted, margin: '8px 0 0' }}>
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        {/* Chart */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: chartOpacity,
            transform: `scale(${chartScale})`,
          }}
        >
          <svg width={chartWidth} height={chartHeight}>
            {/* Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding + ratio * (chartHeight - 2 * padding);
              return (
                <line
                  key={ratio}
                  x1={padding}
                  y1={y}
                  x2={chartWidth - padding}
                  y2={y}
                  stroke={colors.border}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />
              );
            })}
            
            {/* Y-axis labels */}
            {[0, 0.5, 1].map((ratio) => {
              const y = padding + ratio * (chartHeight - 2 * padding);
              const value = max - ratio * range;
              return (
                <text
                  key={ratio}
                  x={padding - 15}
                  y={y + 5}
                  textAnchor="end"
                  fill={colors.muted}
                  fontSize={14}
                >
                  {value.toFixed(0)}{data.unit || ''}
                </text>
              );
            })}
            
            {/* X-axis labels */}
            {data.labels && points.map((p, i) => (
              <text
                key={i}
                x={p.x}
                y={chartHeight - padding + 25}
                textAnchor="middle"
                fill={colors.muted}
                fontSize={14}
              >
                {data.labels?.[i] || ''}
              </text>
            ))}
            
            {/* Gradient definition */}
            <defs>
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={colors.primary} />
                <stop offset="100%" stopColor={colors.secondary} />
              </linearGradient>
              <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={colors.primary} stopOpacity={0.3} />
                <stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
              </linearGradient>
            </defs>
            
            {/* Area fill */}
            <path
              d={`${pathD} L ${points[points.length - 1].x} ${chartHeight - padding} L ${padding} ${chartHeight - padding} Z`}
              fill="url(#areaGradient)"
            />
            
            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke="url(#lineGradient)"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={totalLength}
              strokeDashoffset={dashOffset}
            />
            
            {/* Y-axis label (rotated) */}
            {data.yAxisLabel && (
              <text
                x={12}
                y={chartHeight / 2}
                textAnchor="middle"
                fill={colors.muted}
                fontSize={13}
                transform={`rotate(-90, 12, ${chartHeight / 2})`}
              >
                {data.yAxisLabel}
              </text>
            )}

            {/* X-axis label */}
            {data.xAxisLabel && (
              <text
                x={chartWidth / 2}
                y={chartHeight - 8}
                textAnchor="middle"
                fill={colors.muted}
                fontSize={13}
              >
                {data.xAxisLabel}
              </text>
            )}

            {/* Data points */}
            {points.map((p, i) => {
              const visible = lineProgress > i / points.length;
              return (
                <React.Fragment key={i}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={6}
                    fill={colors.foreground}
                    stroke={colors.primary}
                    strokeWidth={3}
                    opacity={visible ? 1 : 0}
                  />
                  {/* Data label above point */}
                  {data.showDataLabels && visible && (
                    <text
                      x={p.x}
                      y={p.y - 14}
                      textAnchor="middle"
                      fill={colors.foreground}
                      fontSize={12}
                      fontWeight={600}
                    >
                      {p.value.toFixed(0)}{data.unit || ''}
                    </text>
                  )}
                </React.Fragment>
              );
            })}
          </svg>
        </div>
      </div>
    </BaseScene>
  );
}

// ============================================================================
// PIE CHART SCENE COMPONENT
// ============================================================================

export interface PieChartSceneProps {
  data: PieChartBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function PieChartScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: PieChartSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 4;
  
  // Title animations
  const titleSlide = useSlideIn('up', 40, 0.5, 0, motionProfile);
  const titleOpacity = useFadeIn(0.4, 0, motionProfile);
  
  // Chart animation
  const chartOpacity = useFadeIn(0.6, 0.2, motionProfile);
  const chartScale = useScaleIn(0.3, 0.2, motionProfile);
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  // Calculate pie values
  const total = data.segments.reduce((sum, s) => sum + s.value, 0);
  const radius = 120;
  const circumference = 2 * Math.PI * radius;
  
  // Color palette
  const palette = [colors.primary, colors.secondary, colors.accent, '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
  
  return (
    <BaseScene theme={theme} opacity={exitOpacity} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '50px 60px',
          gap: 30,
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
                fontSize: 44,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
            {data.subtitle && (
              <p style={{ fontSize: 24, color: colors.muted, margin: '8px 0 0' }}>
                {data.subtitle}
              </p>
            )}
          </div>
        )}

        {/* Pie Chart */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 60,
            opacity: chartOpacity,
            transform: `scale(${chartScale})`,
          }}
        >
          {/* Donut Chart */}
          <div style={{ position: 'relative' }}>
            <svg width={300} height={300} style={{ transform: 'rotate(-90deg)' }}>
              {data.segments.map((segment, index) => {
                const percentage = segment.value / total;
                const prevPercentages = data.segments
                  .slice(0, index)
                  .reduce((sum, s) => sum + s.value / total, 0);
                
                const strokeDasharray = circumference * percentage;
                const strokeDashoffset = -circumference * prevPercentages;
                const color = segment.color || palette[index % palette.length];
                
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
                  />
                );
              })}
            </svg>
            
            {/* Center */}
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
          {data.showLegend !== false && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {data.segments.map((segment, index) => {
                const color = segment.color || palette[index % palette.length];
                const percentage = ((segment.value / total) * 100).toFixed(1);

                return (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 6,
                        background: color,
                      }}
                    />
                    <span style={{ fontSize: 20, color: colors.foreground }}>
                      {segment.label}
                    </span>
                    {data.showPercentage !== false && (
                      <span style={{ fontSize: 18, color: colors.muted }}>
                        {percentage}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </BaseScene>
  );
}
