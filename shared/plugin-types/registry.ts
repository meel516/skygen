// ============================================================================
// PLUGIN REGISTRY TYPES
// ============================================================================

import type { PluginCategory, PluginManifest } from './manifest';

/**
 * Plugin registry entry (lightweight)
 */
export interface PluginRegistryEntry {
  id: string;
  name: string;
  path: string;
  category: PluginCategory;
  icon?: string;
  color?: string;
  description?: string;
  version: string;
  status?: 'stable' | 'beta' | 'experimental' | 'deprecated';
}

/**
 * Complete plugin registry
 */
export interface PluginRegistry {
  version: string;
  generatedAt: string;
  plugins: PluginRegistryEntry[];
  categories: Record<PluginCategory, string[]>;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  success: boolean;
  plugin?: PluginManifest;
  error?: string;
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  valid: boolean;
  pluginId: string;
  errors: PluginValidationError[];
  warnings: PluginValidationWarning[];
}

export interface PluginValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface PluginValidationWarning {
  code: string;
  message: string;
  path?: string;
}

/**
 * Plugin build result
 */
export interface PluginBuildResult {
  success: boolean;
  pluginId: string;
  output?: {
    path: string;
    size: number;
    hash: string;
  };
  error?: string;
}

/**
 * Plugin watcher event
 */
export interface PluginWatcherEvent {
  type: 'add' | 'change' | 'unlink' | 'error';
  pluginId: string;
  path: string;
  timestamp: number;
}

/**
 * Plugin hot-reload notification
 */
export interface PluginReloadNotification {
  type: 'reload' | 'rebuild' | 'error';
  pluginId?: string;
  message?: string;
  timestamp: number;
}

/**
 * Create a plugin registry entry from manifest
 */
export function createRegistryEntry(
  manifest: PluginManifest, 
  path: string
): PluginRegistryEntry {
  return {
    id: manifest.id,
    name: manifest.name,
    path,
    category: manifest.category,
    icon: manifest.icon,
    color: manifest.color,
    description: manifest.description,
    version: manifest.version,
    status: manifest.status,
  };
}

/**
 * Group plugins by category
 */
export function groupPluginsByCategory(
  plugins: PluginRegistryEntry[]
): Record<PluginCategory, PluginRegistryEntry[]> {
  const categories: Record<PluginCategory, PluginRegistryEntry[]> = {
    content: [],
    data: [],
    visual: [],
    interactive: [],
    social: [],
    media: [],
    layout: [],
    other: [],
  };
  
  for (const plugin of plugins) {
    const category = plugin.category || 'other';
    if (categories[category]) {
      categories[category].push(plugin);
    } else {
      categories.other.push(plugin);
    }
  }
  
  return categories;
}
