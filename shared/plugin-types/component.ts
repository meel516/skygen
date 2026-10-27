// ============================================================================
// PLUGIN COMPONENT TYPES
// ============================================================================

import type { ReactNode, ComponentType } from 'react';

/**
 * Animation configuration passed to scene components
 */
export interface AnimationConfig {
  enter: number;  // Duration in seconds
  hold: number;   // Duration in seconds
  exit: number;   // Duration in seconds
}

/**
 * Base scene props - all plugin scenes receive these
 */
export interface BaseSceneProps {
  // Block data
  data: Record<string, unknown>;
  
  // Theme
  theme: string;
  
  // Animation
  animation: AnimationConfig;
  
  // Motion profile
  motionProfile?: 'subtle' | 'dynamic' | 'energetic';
  
  // Frame information (from Remotion)
  frame?: number;
  fps?: number;
  durationInFrames?: number;
}

/**
 * Customization props inherited from BlockCustomization
 */
export interface BlockCustomizationProps {
  // Position/Alignment
  verticalAlign?: 'top' | 'center' | 'bottom';
  horizontalAlign?: 'left' | 'center' | 'right';
  
  // Animation settings
  enterAnimation?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom' | 'bounce' | 'rotate' | 'flip' | 'none';
  exitAnimation?: 'fade' | 'slide-up' | 'slide-down' | 'slide-left' | 'slide-right' | 'zoom' | 'bounce' | 'rotate' | 'flip' | 'none';
  animationDuration?: number;
  
  // Background settings
  backgroundColor?: string;
  backgroundImage?: string;
  backgroundBlur?: number;
  
  // Border settings
  borderColor?: string;
  borderWidth?: number;
  borderRadius?: number;
  shadowEnabled?: boolean;
  shadowColor?: string;
  shadowBlur?: number;
  
  // Spacing settings
  padding?: number;
  margin?: number;
}

/**
 * Editor component props
 */
export interface EditorProps {
  // Current block data
  data: Record<string, unknown>;
  
  // Block index in timeline
  index: number;
  
  // Update callback
  onChange: (data: Partial<Record<string, unknown>>) => void;
  
  // Schema reference
  schema?: Record<string, unknown>;
}

/**
 * Preview component props
 */
export interface PreviewProps {
  // Block data
  data: Record<string, unknown>;
  
  // Dimensions
  width: number;
  height: number;
  
  // Theme
  theme?: string;
}

/**
 * Plugin scene component type
 */
export type PluginSceneComponent = ComponentType<BaseSceneProps>;

/**
 * Plugin editor component type
 */
export type PluginEditorComponent = ComponentType<EditorProps>;

/**
 * Plugin preview component type
 */
export type PluginPreviewComponent = ComponentType<PreviewProps>;

/**
 * Plugin hooks for lifecycle events
 */
export interface PluginHooks {
  // Called before rendering
  beforeRender?: (data: Record<string, unknown>) => Record<string, unknown>;
  
  // Called after rendering
  afterRender?: (data: Record<string, unknown>, output: unknown) => void;
  
  // Called when data changes
  onDataChange?: (oldData: Record<string, unknown>, newData: Record<string, unknown>) => void;
  
  // Custom duration calculator
  calculateDuration?: (data: Record<string, unknown>) => number;
}

/**
 * Complete plugin definition (runtime)
 */
export interface PluginDefinition {
  // From manifest
  id: string;
  name: string;
  version: string;
  category: string;
  icon?: string;
  color?: string;
  description?: string;
  
  // Components
  scene: PluginSceneComponent;
  editor?: PluginEditorComponent;
  preview?: PluginPreviewComponent;
  
  // Schema
  schema: Record<string, unknown>;
  
  // Default values
  defaults: Record<string, unknown>;
  
  // Hooks
  hooks?: PluginHooks;
  
  // Remotion config
  remotion: {
    compositionId: string;
    defaultDuration: number;
    fps?: number;
    width?: number;
    height?: number;
  };
  
  // Features
  features?: {
    supportsTheming?: boolean;
    supportsCustomization?: boolean;
    supportsAudio?: boolean;
    supportsVideo?: boolean;
  };
}

/**
 * Extract customization props from block data
 */
export function extractCustomization(data: Record<string, unknown>): BlockCustomizationProps {
  return {
    verticalAlign: data.verticalAlign as BlockCustomizationProps['verticalAlign'],
    horizontalAlign: data.horizontalAlign as BlockCustomizationProps['horizontalAlign'],
    enterAnimation: data.enterAnimation as BlockCustomizationProps['enterAnimation'],
    exitAnimation: data.exitAnimation as BlockCustomizationProps['exitAnimation'],
    animationDuration: data.animationDuration as number,
    backgroundColor: data.backgroundColor as string,
    backgroundImage: data.backgroundImage as string,
    backgroundBlur: data.backgroundBlur as number,
    borderColor: data.borderColor as string,
    borderWidth: data.borderWidth as number,
    borderRadius: data.borderRadius as number,
    shadowEnabled: data.shadowEnabled as boolean,
    shadowColor: data.shadowColor as string,
    shadowBlur: data.shadowBlur as number,
    padding: data.padding as number,
    margin: data.margin as number,
  };
}
