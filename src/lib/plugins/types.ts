// ============================================================================
// PLUGIN TYPES - Frontend plugin type definitions
// ============================================================================

// Re-export from shared types
export * from '../../../shared/plugin-types';

// Frontend-specific types
export interface PluginState {
  loading: boolean;
  error: string | null;
  plugins: Map<string, import('../../../shared/plugin-types').PluginDefinition>;
  registry: import('../../../shared/plugin-types').PluginRegistry | null;
}

export interface PluginHookResult {
  plugins: import('../../../shared/plugin-types').PluginRegistryEntry[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export interface PluginBlockConfig {
  pluginId: string;
  data: Record<string, unknown>;
  customization?: Partial<import('../../../shared/plugin-types').BlockCustomizationProps>;
}
