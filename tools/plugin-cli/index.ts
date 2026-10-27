#!/usr/bin/env bun

// ============================================================================
// PLUGIN CLI - Command-line tool for managing video plugins
// ============================================================================

import fs from 'fs';
import path from 'path';

const PLUGINS_DIR = path.join(process.cwd(), 'plugins');

// ============================================================================
// TEMPLATES
// ============================================================================

const BASIC_BLOCK_TEMPLATE = {
  plugin: {
    id: '{{PLUGIN_ID}}',
    name: '{{PLUGIN_NAME}}',
    version: '1.0.0',
    description: '{{PLUGIN_DESCRIPTION}}',
    author: '{{AUTHOR}}',
    category: 'content',
    tags: [],
    icon: 'box',
    color: '#6366F1',
    main: './src/index.ts',
    scene: './src/Scene.tsx',
    editor: './src/Editor.tsx',
    schema: './schema.json',
    remotion: {
      compositionId: '{{PLUGIN_ID}}-scene',
      defaultDuration: 3,
      fps: 30,
      width: 1080,
      height: 1920,
    },
    dependencies: {
      external: [],
      peer: ['react', 'remotion'],
    },
    keywords: [],
    license: 'MIT',
    status: 'stable',
    features: {
      supportsTheming: true,
      supportsCustomization: true,
    },
  },
  schema: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    type: 'object',
    title: '{{PLUGIN_NAME}} Properties',
    properties: {
      title: {
        type: 'string',
        title: 'Title',
        description: 'The main title text',
        default: 'Hello World',
        editor: 'text',
      },
      subtitle: {
        type: 'string',
        title: 'Subtitle',
        description: 'Optional subtitle text',
        default: '',
        editor: 'text',
      },
      color: {
        type: 'string',
        title: 'Text Color',
        default: '#FFFFFF',
        editor: 'color',
      },
    },
    required: ['title'],
    ui: {
      sections: [
        {
          title: 'Content',
          icon: 'Type',
          fields: ['title', 'subtitle'],
          defaultOpen: true,
        },
        {
          title: 'Style',
          icon: 'Palette',
          fields: ['color'],
          defaultOpen: false,
        },
      ],
    },
    customization: {
      inherit: true,
    },
    defaults: {
      title: 'Hello World',
      subtitle: '',
      color: '#FFFFFF',
    },
  },
  scene: `import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate } from 'remotion';
import { BaseScene, extractCustomization, getThemeColors } from '../../../shared/plugin-utils';
import type { AnimationConfig } from '../../../shared/plugin-types';

export interface {{PLUGIN_CLASS_NAME}}Props {
  data: {
    title: string;
    subtitle?: string;
    color?: string;
  };
  theme?: string;
  animation?: AnimationConfig;
  motionProfile?: 'subtle' | 'dynamic' | 'energetic';
}

export const {{PLUGIN_CLASS_NAME}}: React.FC<{{PLUGIN_CLASS_NAME}}Props> = ({
  data,
  theme = 'dark_modern',
  animation = { enter: 0.4, hold: 2, exit: 0.4 },
  motionProfile = 'dynamic',
}) => {
  const frame = useCurrentFrame();
  const themeColors = getThemeColors(theme);
  
  const { title, subtitle, color } = data;
  const textColor = color || themeColors.text;
  
  // Fade in animation
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  
  return (
    <BaseScene
      theme={theme}
      customization={extractCustomization(data)}
      animation={animation}
    >
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
        opacity,
      }}>
        <div style={{
          fontSize: 80,
          fontWeight: 800,
          color: textColor,
          fontFamily: 'system-ui, sans-serif',
        }}>
          {title}
        </div>
        
        {subtitle && (
          <div style={{
            fontSize: 36,
            color: themeColors.textSecondary,
            fontFamily: 'system-ui, sans-serif',
          }}>
            {subtitle}
          </div>
        )}
      </div>
    </BaseScene>
  );
};

export default {{PLUGIN_CLASS_NAME}};
`,
  editor: `import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Type, Palette } from 'lucide-react';
import type { EditorProps } from '../../../shared/plugin-types';
import { CollapsibleSection, ColorPicker } from '@/components/editor/PropertiesPanel';

export const {{PLUGIN_CLASS_NAME}}Editor: React.FC<EditorProps> = ({ data, index, onChange }) => {
  const updateField = (field: string, value: unknown) => {
    onChange({ [field]: value });
  };
  
  return (
    <div className="space-y-1">
      <CollapsibleSection title="Content" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-400">Title</Label>
            <Input
              value={data.title as string ?? ''}
              onChange={(e) => updateField('title', e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-400">Subtitle</Label>
            <Input
              value={data.subtitle as string ?? ''}
              onChange={(e) => updateField('subtitle', e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10"
            />
          </div>
        </div>
      </CollapsibleSection>
      
      <CollapsibleSection title="Style" icon={Palette} defaultOpen={false}>
        <ColorPicker
          value={data.color as string ?? '#FFFFFF'}
          onChange={(v) => updateField('color', v)}
          label="Text Color"
        />
      </CollapsibleSection>
    </div>
  );
};

export default {{PLUGIN_CLASS_NAME}}Editor;
`,
  index: `export { default as Scene } from './Scene';
export { default as Editor } from './Editor';
export { default as manifest } from '../plugin.json';
export { default as schema } from '../schema.json';

import type { PluginDefinition } from '../../../shared/plugin-types';
import Scene from './Scene';
import Editor from './Editor';
import manifest from '../plugin.json';
import schema from '../schema.json';

export const plugin: PluginDefinition = {
  id: manifest.id,
  name: manifest.name,
  version: manifest.version,
  category: manifest.category,
  icon: manifest.icon,
  color: manifest.color,
  description: manifest.description,
  
  scene: Scene,
  editor: Editor,
  
  schema: schema,
  defaults: schema.defaults || {},
  
  remotion: manifest.remotion,
  features: manifest.features,
};

export default plugin;
`,
};

const ANIMATED_BLOCK_TEMPLATE = {
  plugin: {
    ...BASIC_BLOCK_TEMPLATE.plugin,
    category: 'visual',
    icon: 'sparkles',
    color: '#F59E0B',
  },
  schema: {
    ...BASIC_BLOCK_TEMPLATE.schema,
    properties: {
      ...BASIC_BLOCK_TEMPLATE.schema.properties,
      animationStyle: {
        type: 'string',
        title: 'Animation Style',
        enum: ['fade', 'slide-up', 'slide-down', 'zoom', 'bounce'],
        default: 'fade',
        editor: 'select',
        enumLabels: {
          'fade': 'Fade',
          'slide-up': 'Slide Up',
          'slide-down': 'Slide Down',
          'zoom': 'Zoom',
          'bounce': 'Bounce',
        },
      },
    },
    ui: {
      sections: [
        {
          title: 'Content',
          icon: 'Type',
          fields: ['title', 'subtitle'],
          defaultOpen: true,
        },
        {
          title: 'Animation',
          icon: 'Zap',
          fields: ['animationStyle'],
          defaultOpen: false,
        },
        {
          title: 'Style',
          icon: 'Palette',
          fields: ['color'],
          defaultOpen: false,
        },
      ],
    },
  },
};

const DATA_BLOCK_TEMPLATE = {
  plugin: {
    ...BASIC_BLOCK_TEMPLATE.plugin,
    category: 'data',
    icon: 'bar-chart',
    color: '#10B981',
  },
  schema: {
    ...BASIC_BLOCK_TEMPLATE.schema,
    properties: {
      value: {
        type: 'number',
        title: 'Value',
        default: 0,
        editor: 'number',
      },
      label: {
        type: 'string',
        title: 'Label',
        default: '',
        editor: 'text',
      },
      unit: {
        type: 'string',
        title: 'Unit',
        default: '',
        editor: 'text',
      },
      color: {
        type: 'string',
        title: 'Color',
        default: '#10B981',
        editor: 'color',
      },
    },
    ui: {
      sections: [
        {
          title: 'Data',
          icon: 'Database',
          fields: ['value', 'label', 'unit'],
          defaultOpen: true,
        },
        {
          title: 'Style',
          icon: 'Palette',
          fields: ['color'],
          defaultOpen: false,
        },
      ],
    },
  },
};

// ============================================================================
// COMMANDS
// ============================================================================

/**
 * Create a new plugin
 */
function createPlugin(name: string, options: { template?: string; category?: string }): void {
  const pluginId = name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const pluginName = name;
  const pluginClassName = name
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  
  const template = options.template || 'basic';
  const category = options.category || 'content';
  const type = category === 'custom' ? 'custom' : 'core';
  
  // Select template
  let templateData = BASIC_BLOCK_TEMPLATE;
  if (template === 'animated') {
    templateData = ANIMATED_BLOCK_TEMPLATE;
  } else if (template === 'data') {
    templateData = DATA_BLOCK_TEMPLATE;
  }
  
  // Create plugin directory
  const pluginDir = path.join(PLUGINS_DIR, type, pluginId);
  const srcDir = path.join(pluginDir, 'src');
  
  if (fs.existsSync(pluginDir)) {
    console.error(`❌ Plugin "${pluginId}" already exists`);
    process.exit(1);
  }
  
  fs.mkdirSync(srcDir, { recursive: true });
  
  // Replace placeholders
  const replacePlaceholders = (str: string): string => {
    return str
      .replace(/\{\{PLUGIN_ID\}\}/g, pluginId)
      .replace(/\{\{PLUGIN_NAME\}\}/g, pluginName)
      .replace(/\{\{PLUGIN_CLASS_NAME\}\}/g, pluginClassName)
      .replace(/\{\{PLUGIN_DESCRIPTION\}\}/g, `${pluginName} block for videos`)
      .replace(/\{\{AUTHOR\}\}/g, 'Developer');
  };
  
  // Write files
  const pluginJson = { ...templateData.plugin, id: pluginId, name: pluginName, category };
  fs.writeFileSync(
    path.join(pluginDir, 'plugin.json'),
    JSON.stringify(pluginJson, null, 2)
  );
  
  const schemaJson = JSON.parse(replacePlaceholders(JSON.stringify(templateData.schema)));
  fs.writeFileSync(
    path.join(pluginDir, 'schema.json'),
    JSON.stringify(schemaJson, null, 2)
  );
  
  fs.writeFileSync(
    path.join(srcDir, 'Scene.tsx'),
    replacePlaceholders(templateData.scene)
  );
  
  fs.writeFileSync(
    path.join(srcDir, 'Editor.tsx'),
    replacePlaceholders(templateData.editor)
  );
  
  fs.writeFileSync(
    path.join(srcDir, 'index.ts'),
    replacePlaceholders(templateData.index)
  );
  
  console.log(`✅ Created plugin "${pluginId}" at ${pluginDir}`);
  console.log(`📁 Files created:`);
  console.log(`   - plugin.json`);
  console.log(`   - schema.json`);
  console.log(`   - src/Scene.tsx`);
  console.log(`   - src/Editor.tsx`);
  console.log(`   - src/index.ts`);
}

/**
 * List all plugins
 */
function listPlugins(): void {
  const plugins: Array<{ id: string; type: string; name: string }> = [];
  
  // Scan core plugins
  const coreDir = path.join(PLUGINS_DIR, 'core');
  if (fs.existsSync(coreDir)) {
    fs.readdirSync(coreDir).forEach((id) => {
      const pluginDir = path.join(coreDir, id);
      if (fs.statSync(pluginDir).isDirectory()) {
        const manifestPath = path.join(pluginDir, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          plugins.push({ id, type: 'core', name: manifest.name });
        }
      }
    });
  }
  
  // Scan custom plugins
  const customDir = path.join(PLUGINS_DIR, 'custom');
  if (fs.existsSync(customDir)) {
    fs.readdirSync(customDir).forEach((id) => {
      const pluginDir = path.join(customDir, id);
      if (fs.statSync(pluginDir).isDirectory() && !id.startsWith('.')) {
        const manifestPath = path.join(pluginDir, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          plugins.push({ id, type: 'custom', name: manifest.name });
        }
      }
    });
  }
  
  console.log(`📦 Found ${plugins.length} plugins:\n`);
  
  // Group by type
  const corePlugins = plugins.filter((p) => p.type === 'core');
  const customPlugins = plugins.filter((p) => p.type === 'custom');
  
  if (corePlugins.length > 0) {
    console.log('Core Plugins:');
    corePlugins.forEach((p) => console.log(`  - ${p.id} (${p.name})`));
  }
  
  if (customPlugins.length > 0) {
    console.log('\nCustom Plugins:');
    customPlugins.forEach((p) => console.log(`  - ${p.id} (${p.name})`));
  }
  
  if (plugins.length === 0) {
    console.log('No plugins found.');
  }
}

/**
 * Validate a plugin
 */
function validatePlugin(pluginId: string): void {
  const pluginsDir = PLUGINS_DIR;
  
  // Find plugin
  let pluginDir: string | null = null;
  let type: 'core' | 'custom' = 'core';
  
  const corePath = path.join(pluginsDir, 'core', pluginId);
  const customPath = path.join(pluginsDir, 'custom', pluginId);
  
  if (fs.existsSync(corePath)) {
    pluginDir = corePath;
    type = 'core';
  } else if (fs.existsSync(customPath)) {
    pluginDir = customPath;
    type = 'custom';
  }
  
  if (!pluginDir) {
    console.error(`❌ Plugin "${pluginId}" not found`);
    process.exit(1);
  }
  
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Check required files
  const manifestPath = path.join(pluginDir, 'plugin.json');
  const schemaPath = path.join(pluginDir, 'schema.json');
  const scenePath = path.join(pluginDir, 'src', 'Scene.tsx');
  const indexPath = path.join(pluginDir, 'src', 'index.ts');
  
  if (!fs.existsSync(manifestPath)) {
    errors.push('Missing plugin.json');
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      
      // Validate manifest fields
      if (!manifest.id) errors.push('Missing "id" in plugin.json');
      if (!manifest.name) errors.push('Missing "name" in plugin.json');
      if (!manifest.category) errors.push('Missing "category" in plugin.json');
      if (!manifest.scene) errors.push('Missing "scene" in plugin.json');
      if (!manifest.remotion) errors.push('Missing "remotion" config in plugin.json');
    } catch (e) {
      errors.push(`Failed to parse plugin.json: ${e}`);
    }
  }
  
  if (!fs.existsSync(schemaPath)) {
    errors.push('Missing schema.json');
  } else {
    try {
      JSON.parse(fs.readFileSync(schemaPath, 'utf-8'));
    } catch (e) {
      errors.push(`Failed to parse schema.json: ${e}`);
    }
  }
  
  if (!fs.existsSync(scenePath)) {
    errors.push('Missing src/Scene.tsx');
  }
  
  if (!fs.existsSync(indexPath)) {
    warnings.push('Missing src/index.ts (optional but recommended)');
  }
  
  // Print results
  console.log(`\n🔍 Validating plugin "${pluginId}" (${type})\n`);
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Plugin is valid!\n');
  } else {
    if (errors.length > 0) {
      console.log('❌ Errors:');
      errors.forEach((e) => console.log(`   - ${e}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Warnings:');
      warnings.forEach((w) => console.log(`   - ${w}`));
    }
    
    if (errors.length > 0) {
      process.exit(1);
    }
  }
}

/**
 * Show help
 */
function showHelp(): void {
  console.log(`
📦 Plugin CLI - Manage video plugins

Usage:
  bun plugin <command> [options]

Commands:
  create <name>           Create a new plugin
    --template <name>     Use a template (basic, animated, data)
    --category <name>     Set the category (content, data, visual, etc.)
    --custom              Create as a custom plugin
    
  list                    List all plugins
  
  validate <id>           Validate a plugin
  
  help                    Show this help message

Examples:
  bun plugin create my-block
  bun plugin create my-block --template=animated
  bun plugin create my-block --category=data
  bun plugin list
  bun plugin validate counter-block
`);
}

// ============================================================================
// MAIN
// ============================================================================

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'create': {
    const name = args[1];
    if (!name) {
      console.error('❌ Please provide a plugin name');
      process.exit(1);
    }
    
    const options: { template?: string; category?: string } = {};
    
    for (let i = 2; i < args.length; i++) {
      if (args[i].startsWith('--template=')) {
        options.template = args[i].split('=')[1];
      } else if (args[i].startsWith('--category=')) {
        options.category = args[i].split('=')[1];
      } else if (args[i] === '--custom') {
        options.category = 'custom';
      }
    }
    
    createPlugin(name, options);
    break;
  }
  
  case 'list':
    listPlugins();
    break;
    
  case 'validate': {
    const pluginId = args[1];
    if (!pluginId) {
      console.error('❌ Please provide a plugin ID');
      process.exit(1);
    }
    validatePlugin(pluginId);
    break;
  }
  
  case 'help':
  case '--help':
  case '-h':
    showHelp();
    break;
  
  default:
    if (command) {
      console.error(`❌ Unknown command: ${command}`);
    }
    showHelp();
    process.exit(command ? 1 : 0);
}
