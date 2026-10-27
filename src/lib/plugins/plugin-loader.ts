// ============================================================================
// PLUGIN LOADER - Frontend plugin loading and management
// ============================================================================

import type { 
  PluginDefinition, 
  PluginRegistry, 
  PluginRegistryEntry,
  PluginSchema 
} from '../../../shared/plugin-types';

/**
 * Plugin loader configuration
 */
export interface PluginLoaderConfig {
  registryPath: string;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

/**
 * Plugin loader class
 */
export class PluginLoader {
  private config: PluginLoaderConfig;
  private registry: PluginRegistry | null = null;
  private pluginCache: Map<string, PluginDefinition> = new Map();
  private schemaCache: Map<string, PluginSchema> = new Map();
  
  constructor(config: PluginLoaderConfig) {
    this.config = config;
  }
  
  /**
   * Load the plugin registry
   */
  async loadRegistry(): Promise<PluginRegistry> {
    if (this.registry) {
      return this.registry;
    }
    
    try {
      const response = await fetch('/api/plugins/registry');
      if (!response.ok) {
        throw new Error(`Failed to load registry: ${response.statusText}`);
      }
      
      this.registry = await response.json();
      return this.registry!;
    } catch (error) {
      console.error('Failed to load plugin registry:', error);
      throw error;
    }
  }
  
  /**
   * Get all plugins
   */
  async getAllPlugins(): Promise<PluginRegistryEntry[]> {
    const registry = await this.loadRegistry();
    return registry.plugins;
  }
  
  /**
   * Get plugins by category
   */
  async getPluginsByCategory(category: string): Promise<PluginRegistryEntry[]> {
    const registry = await this.loadRegistry();
    return registry.plugins.filter(p => p.category === category);
  }
  
  /**
   * Get a specific plugin
   */
  async getPlugin(id: string): Promise<PluginDefinition | null> {
    // Check cache first
    if (this.pluginCache.has(id)) {
      return this.pluginCache.get(id)!;
    }
    
    try {
      const response = await fetch(`/api/plugins/${id}`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to load plugin: ${response.statusText}`);
      }
      
      const plugin = await response.json();
      this.pluginCache.set(id, plugin);
      return plugin;
    } catch (error) {
      console.error(`Failed to load plugin ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Get plugin schema
   */
  async getPluginSchema(id: string): Promise<PluginSchema | null> {
    // Check cache first
    if (this.schemaCache.has(id)) {
      return this.schemaCache.get(id)!;
    }
    
    try {
      const response = await fetch(`/api/plugins/${id}/schema`);
      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Failed to load schema: ${response.statusText}`);
      }
      
      const schema = await response.json();
      this.schemaCache.set(id, schema);
      return schema;
    } catch (error) {
      console.error(`Failed to load schema for ${id}:`, error);
      throw error;
    }
  }
  
  /**
   * Clear caches
   */
  clearCache(): void {
    this.registry = null;
    this.pluginCache.clear();
    this.schemaCache.clear();
  }
  
  /**
   * Reload registry (for hot reload)
   */
  async reloadRegistry(): Promise<PluginRegistry> {
    this.clearCache();
    return this.loadRegistry();
  }
}

// Singleton instance
let pluginLoaderInstance: PluginLoader | null = null;

/**
 * Get the plugin loader instance
 */
export function getPluginLoader(): PluginLoader {
  if (!pluginLoaderInstance) {
    pluginLoaderInstance = new PluginLoader({
      registryPath: '/api/plugins/registry',
    });
  }
  return pluginLoaderInstance;
}

/**
 * Initialize plugin loader with custom config
 */
export function initPluginLoader(config: PluginLoaderConfig): PluginLoader {
  pluginLoaderInstance = new PluginLoader(config);
  return pluginLoaderInstance;
}
