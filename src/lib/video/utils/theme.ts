import type { VideoMeta } from '../schemas';

// ============================================================================
// THEME UTILITIES
// ============================================================================

export interface ThemeColors {
  background: string;
  foreground: string;
  primary: string;
  secondary: string;
  accent: string;
  muted: string;
  border: string;
}

export const THEMES: Record<string, ThemeColors> = {
  dark_modern: {
    background: '#0a0a0f',
    foreground: '#ffffff',
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#22d3ee',
    muted: '#6b7280',
    border: '#1f2937',
  },
  light_minimal: {
    background: '#ffffff',
    foreground: '#0a0a0f',
    primary: '#18181b',
    secondary: '#3f3f46',
    accent: '#0ea5e9',
    muted: '#a1a1aa',
    border: '#e4e4e7',
  },
  bold_vibrant: {
    background: '#1a0a2e',
    foreground: '#ffffff',
    primary: '#f43f5e',
    secondary: '#ec4899',
    accent: '#fbbf24',
    muted: '#9ca3af',
    border: '#3b0764',
  },
  corporate: {
    background: '#0f172a',
    foreground: '#f8fafc',
    primary: '#3b82f6',
    secondary: '#1e40af',
    accent: '#10b981',
    muted: '#64748b',
    border: '#1e293b',
  },
};

/**
 * Get theme colors by name
 */
export function getTheme(themeName: string): ThemeColors {
  return THEMES[themeName] ?? THEMES.dark_modern;
}

/**
 * Get aspect ratio dimensions
 */
export function getAspectRatioDimensions(ratio: string): { width: number; height: number } {
  const ratios: Record<string, { width: number; height: number }> = {
    '16:9': { width: 1920, height: 1080 },
    '9:16': { width: 1080, height: 1920 },
    '1:1': { width: 1080, height: 1080 },
    '4:5': { width: 1080, height: 1350 },
  };
  
  return ratios[ratio] ?? ratios['9:16'];
}

/**
 * Generate video configuration from metadata
 */
export function getVideoConfig(meta: VideoMeta) {
  const dimensions = getAspectRatioDimensions(meta.aspectRatio);
  
  return {
    width: dimensions.width,
    height: dimensions.height,
    fps: meta.fps,
    durationInFrames: 0, // Will be set dynamically
  };
}

/**
 * Generate gradient CSS for background
 */
export function getBackgroundGradient(theme: ThemeColors): string {
  return `linear-gradient(135deg, ${theme.background} 0%, ${adjustColor(theme.background, 20)} 50%, ${theme.background} 100%)`;
}

/**
 * Adjust color brightness
 */
function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, Math.max(0, (num >> 16) + amt));
  const G = Math.min(255, Math.max(0, ((num >> 8) & 0x00ff) + amt));
  const B = Math.min(255, Math.max(0, (num & 0x0000ff) + amt));
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}
