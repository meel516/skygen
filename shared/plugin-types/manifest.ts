// ============================================================================
// PLUGIN MANIFEST TYPES
// ============================================================================

/**
 * Plugin manifest - plugin.json
 * This defines the plugin metadata and configuration
 */
export interface PluginManifest {
  // Identity
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  
  // Classification
  category: PluginCategory;
  tags?: string[];
  
  // Visual
  icon?: string;
  color?: string;
  thumbnail?: string;
  
  // Entry points
  main: string;
  scene: string;
  editor?: string;
  preview?: string;
  
  // Schema
  schema: string;
  
  // Remotion configuration
  remotion: {
    compositionId: string;
    defaultDuration: number;
    fps?: number;
    width?: number;
    height?: number;
  };
  
  // Dependencies
  dependencies?: {
    external?: string[];
    peer?: string[];
  };
  
  // Metadata
  keywords?: string[];
  license?: string;
  repository?: string;
  homepage?: string;
  
  // Plugin status
  status?: 'stable' | 'beta' | 'experimental' | 'deprecated';
  
  // Feature flags
  features?: {
    supportsTheming?: boolean;
    supportsCustomization?: boolean;
    supportsAudio?: boolean;
    supportsVideo?: boolean;
  };
}

/**
 * Plugin categories
 */
export type PluginCategory = 
  | 'content'      // Text, quotes, lists
  | 'data'         // Stats, counters, charts
  | 'visual'       // Images, videos, gradients
  | 'interactive'  // CTAs, countdowns
  | 'social'       // WhatsApp, social stats
  | 'media'        // Audio, video players
  | 'layout'       // Containers, grids
  | 'other';       // Uncategorized

/**
 * Plugin status types
 */
export type PluginStatus = 'stable' | 'beta' | 'experimental' | 'deprecated';

/**
 * Plugin feature flags
 */
export interface PluginFeatures {
  supportsTheming?: boolean;
  supportsCustomization?: boolean;
  supportsAudio?: boolean;
  supportsVideo?: boolean;
  supportsAnimation?: boolean;
}

/**
 * Validate plugin manifest
 */
export function isValidManifest(manifest: unknown): manifest is PluginManifest {
  if (typeof manifest !== 'object' || manifest === null) return false;
  
  const m = manifest as Record<string, unknown>;
  
  return (
    typeof m.id === 'string' &&
    typeof m.name === 'string' &&
    typeof m.version === 'string' &&
    typeof m.category === 'string' &&
    typeof m.main === 'string' &&
    typeof m.scene === 'string' &&
    typeof m.schema === 'string' &&
    typeof m.remotion === 'object'
  );
}
