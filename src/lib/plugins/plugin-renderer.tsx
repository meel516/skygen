// ============================================================================
// PLUGIN RENDERER - Render plugin preview in editor
// ============================================================================

import React, { useMemo, Suspense, lazy } from 'react';
import type { PluginDefinition, PluginSchema } from '../../../shared/plugin-types';

/**
 * Plugin renderer props
 */
export interface PluginRendererProps {
  plugin: PluginDefinition | null;
  data: Record<string, unknown>;
  theme?: string;
  animation?: {
    enter: number;
    hold: number;
    exit: number;
  };
  motionProfile?: 'subtle' | 'dynamic' | 'energetic';
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Loading fallback component
 */
const LoadingFallback: React.FC = () => (
  <div className="flex items-center justify-center w-full h-full bg-gray-900 text-gray-400">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
      <div className="text-sm">Loading plugin...</div>
    </div>
  </div>
);

/**
 * Error fallback component
 */
const ErrorFallback: React.FC<{ message: string }> = ({ message }) => (
  <div className="flex items-center justify-center w-full h-full bg-red-900/20 text-red-400">
    <div className="text-center">
      <div className="text-4xl mb-2">⚠️</div>
      <div className="text-sm">{message}</div>
    </div>
  </div>
);

/**
 * Plugin Renderer Component
 * Dynamically renders a plugin's scene component
 */
export const PluginRenderer: React.FC<PluginRendererProps> = ({
  plugin,
  data,
  theme = 'dark_modern',
  animation = { enter: 0.4, hold: 3, exit: 0.4 },
  motionProfile = 'dynamic',
  width = 1080,
  height = 1920,
  className = '',
}) => {
  // Memoize the rendered component
  const rendered = useMemo(() => {
    if (!plugin) {
      return <ErrorFallback message="Plugin not found" />;
    }
    
    if (!plugin.scene) {
      return <ErrorFallback message="Plugin has no scene component" />;
    }
    
    const SceneComponent = plugin.scene;
    
    return (
      <SceneComponent
        data={data}
        theme={theme}
        animation={animation}
        motionProfile={motionProfile}
      />
    );
  }, [plugin, data, theme, animation, motionProfile]);
  
  return (
    <div 
      className={className}
      style={{ 
        width: '100%', 
        height: '100%',
        aspectRatio: `${width}/${height}`,
        overflow: 'hidden',
      }}
    >
      <Suspense fallback={<LoadingFallback />}>
        {rendered}
      </Suspense>
    </div>
  );
};

/**
 * Plugin Preview Component
 * Renders a preview for the block library sidebar
 */
export interface PluginPreviewProps {
  plugin: PluginDefinition;
  width?: number;
  height?: number;
  theme?: string;
}

export const PluginPreview: React.FC<PluginPreviewProps> = ({
  plugin,
  width = 200,
  height = 356,
  theme = 'dark_modern',
}) => {
  // Use default values from schema
  const defaultData = useMemo(() => {
    return plugin.defaults || {};
  }, [plugin.defaults]);
  
  return (
    <div 
      className="rounded-lg overflow-hidden border border-gray-700"
      style={{ width, height }}
    >
      <PluginRenderer
        plugin={plugin}
        data={defaultData}
        theme={theme}
        width={width}
        height={height}
        animation={{ enter: 0.2, hold: 1, exit: 0.2 }}
      />
    </div>
  );
};

export default PluginRenderer;
