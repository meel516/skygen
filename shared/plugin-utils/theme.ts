// ============================================================================
// THEME UTILITIES - Theme helpers for plugins
// ============================================================================

import { THEMES, type ThemeColors } from './base-scene';

export { THEMES, type ThemeColors };

/**
 * Get theme colors by name
 */
export function getThemeColors(themeName: string): ThemeColors {
  return THEMES[themeName] || THEMES.dark_modern;
}

/**
 * Check if theme is dark
 */
export function isDarkTheme(themeName: string): boolean {
  const theme = THEMES[themeName];
  if (!theme) return true;
  
  // Simple check: if background is darker than #808080, consider it dark
  const bgColor = theme.background;
  if (bgColor.startsWith('linear-gradient') || bgColor.startsWith('rgb')) {
    // For gradients, default based on name
    return themeName.includes('dark') || themeName.includes('minimal');
  }
  
  // Parse hex color
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance < 0.5;
}

/**
 * Get contrasting text color for a background
 */
export function getContrastingTextColor(backgroundColor: string): string {
  // Remove # if present
  const hex = backgroundColor.replace('#', '');
  
  // Parse RGB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  // Calculate luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Blend two colors
 */
export function blendColors(color1: string, color2: string, ratio: number): string {
  const hex1 = color1.replace('#', '');
  const hex2 = color2.replace('#', '');
  
  const r1 = parseInt(hex1.slice(0, 2), 16);
  const g1 = parseInt(hex1.slice(2, 4), 16);
  const b1 = parseInt(hex1.slice(4, 6), 16);
  
  const r2 = parseInt(hex2.slice(0, 2), 16);
  const g2 = parseInt(hex2.slice(2, 4), 16);
  const b2 = parseInt(hex2.slice(4, 6), 16);
  
  const r = Math.round(r1 + (r2 - r1) * ratio);
  const g = Math.round(g1 + (g2 - g1) * ratio);
  const b = Math.round(b1 + (b2 - b1) * ratio);
  
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a color
 */
export function lightenColor(color: string, amount: number): string {
  return blendColors(color, '#FFFFFF', amount);
}

/**
 * Darken a color
 */
export function darkenColor(color: string, amount: number): string {
  return blendColors(color, '#000000', amount);
}

/**
 * Create a color with alpha
 */
export function colorWithAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '');
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Available theme names
 */
export const AVAILABLE_THEMES = Object.keys(THEMES) as (keyof typeof THEMES)[];

/**
 * Theme display names
 */
export const THEME_DISPLAY_NAMES: Record<string, string> = {
  dark_modern: 'Dark Modern',
  light_clean: 'Light Clean',
  gradient_vibrant: 'Gradient Vibrant',
  minimal_bw: 'Minimal B&W',
};
