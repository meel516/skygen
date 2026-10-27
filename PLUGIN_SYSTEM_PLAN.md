# Plugin System Plan - Option B: Hot-Reload Architecture

## Overview

A plugin system that allows adding new blocks without modifying the core codebase. Plugins are stored as local files and automatically detected, compiled, and integrated.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PLUGIN SYSTEM ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        PLUGIN CREATOR CLI                              │  │
│  │                                                                        │  │
│  │   bun plugin create <name>     →    Generate plugin boilerplate       │  │
│  │   bun plugin dev              →    Develop with hot-reload            │  │
│  │   bun plugin build            →    Build for production               │  │
│  │   bun plugin test             →    Test plugin locally                │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                                    ▼                                        │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                         PLUGINS DIRECTORY                              │  │
│  │                                                                        │  │
│  │   plugins/                                                             │  │
│  │   ├── _registry.json              ← Auto-generated plugin registry     │  │
│  │   ├── counter-block/                                                    │  │
│  │   │   ├── plugin.json             ← Plugin manifest                    │  │
│  │   │   ├── schema.json             ← Block schema                       │  │
│  │   │   └── src/                                                          │  │
│  │   │       ├── index.ts            ← Main export                        │  │
│  │   │       ├── Scene.tsx           ← Remotion scene component           │  │
│  │   │       └── Editor.tsx          ← Properties panel editor            │  │
│  │   │                                                                     │  │
│  │   ├── weather-widget/                                                   │  │
│  │   │   ├── plugin.json                                                   │  │
│  │   │   ├── schema.json                                                   │  │
│  │   │   └── src/                                                          │  │
│  │   │       └── ...                                                        │  │
│  │   │                                                                     │  │
│  │   └── custom-chart/                                                     │  │
│  │       └── ...                                                           │  │
│  │                                                                        │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                    │                                        │
│                    ┌───────────────┴───────────────┐                       │
│                    │         PLUGIN LOADER          │                       │
│                    │                                │                       │
│                    │  • Scans plugins/ directory    │                       │
│                    │  • Validates plugin.json       │                       │
│                    │  • Generates registry          │                       │
│                    │  • Hot-reload on changes       │                       │
│                    └────────────────────────────────┘                       │
│                                    │                                        │
│          ┌─────────────────────────┼─────────────────────────┐             │
│          ▼                         ▼                         ▼             │
│  ┌───────────────┐        ┌───────────────┐        ┌───────────────┐      │
│  │   FRONTEND    │        │   PLUGIN      │        │   VIDEO       │      │
│  │   EDITOR      │        │   WATCHER     │        │   RENDERER    │      │
│  │               │        │               │        │               │      │
│  │ Next.js App   │        │ Dev Service   │        │ Remotion      │      │
│  │ Port: 3000    │        │ Port: 3034    │        │ Port: 3031    │      │
│  │               │        │               │        │               │      │
│  │ • Load plugin │        │ • Watch files │        │ • Bundle all │      │
│  │   registry    │        │ • Rebuild on  │        │   plugins     │      │
│  │ • Render UI   │        │   change      │        │ • Render with │      │
│  │ • Preview     │        │ • Notify      │        │   plugins     │      │
│  │   blocks      │        │   services    │        │               │      │
│  └───────────────┘        └───────────────┘        └───────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
video-editor-project/
│
├── plugins/                          # 🆕 All plugins live here
│   ├── _registry.json                # Auto-generated registry
│   ├── core/                         # Built-in plugins (shipped with app)
│   │   ├── text-block/
│   │   ├── image-block/
│   │   ├── quote-block/
│   │   ├── counter-block/
│   │   └── ... (all current blocks)
│   │
│   └── custom/                       # User-added plugins
│       └── .gitkeep
│
├── mini-services/
│   │
│   ├── video-renderer/               # Existing - Updated
│   │   ├── index.ts
│   │   ├── plugin-loader.ts          # 🆕 Loads plugins dynamically
│   │   ├── plugin-bundler.ts         # 🆕 Bundles plugins with Remotion
│   │   └── ...
│   │
│   └── plugin-watcher/               # 🆕 Development watcher service
│       ├── index.ts                  # Main watcher
│       ├── scanner.ts                # Scans plugins directory
│       ├── validator.ts              # Validates plugin structure
│       ├── bundler.ts                # Development bundler
│       ├── broadcaster.ts            # WebSocket for hot-reload
│       └── package.json
│
├── tools/
│   └── plugin-cli/                   # 🆕 CLI for creating plugins
│       ├── index.ts                  # CLI entry point
│       ├── commands/
│       │   ├── create.ts             # Create new plugin
│       │   ├── dev.ts                # Develop with hot-reload
│       │   ├── build.ts              # Build for production
│       │   ├── test.ts               # Test plugin
│       │   └── validate.ts           # Validate plugin
│       ├── templates/
│       │   ├── basic-block/          # Simple block template
│       │   ├── animated-block/       # Animated block template
│       │   ├── data-block/           # Data visualization template
│       │   └── media-block/          # Media block template
│       └── package.json
│
├── shared/
│   ├── plugin-types/                 # 🆕 Shared plugin types
│   │   ├── index.ts
│   │   ├── manifest.ts               # Plugin manifest types
│   │   ├── schema.ts                 # Block schema types
│   │   └── component.ts              # Component types
│   │
│   └── plugin-utils/                 # 🆕 Shared utilities for plugins
│       ├── base-scene.ts             # Base scene component
│       ├── animations.ts             # Animation helpers
│       └── hooks.ts                  # Plugin hooks
│
└── src/
    ├── lib/
    │   └── plugins/                  # 🆕 Frontend plugin system
    │       ├── plugin-loader.ts      # Load plugin registry
    │       ├── plugin-renderer.ts    # Render plugin preview
    │       ├── schema-to-ui.ts       # Convert schema to form UI
    │       └── types.ts
    │
    └── components/
        └── editor/
            └── PluginBlock.tsx       # 🆕 Dynamic plugin block wrapper
```

---

## Plugin Format Specification

### 1. Plugin Manifest (plugin.json)

```json
{
  "id": "counter-block",
  "name": "Animated Counter",
  "version": "1.0.0",
  "description": "Animated number counter with customizable styles",
  "author": "Saleem",
  "category": "data",
  "tags": ["counter", "animation", "numbers", "statistics"],
  
  "icon": "timer",
  "color": "#3B82F6",
  
  "main": "./src/index.ts",
  "scene": "./src/Scene.tsx",
  "editor": "./src/Editor.tsx",
  "preview": "./src/Preview.tsx",
  
  "schema": "./schema.json",
  
  "remotion": {
    "compositionId": "CounterScene",
    "defaultDuration": 4,
    "fps": 30,
    "width": 1080,
    "height": 1920
  },
  
  "dependencies": {
    "external": [],
    "peer": ["react", "remotion", "@remotion/player"]
  },
  
  "keywords": ["counter", "animated", "numbers"],
  "license": "MIT",
  "repository": ""
}
```

### 2. Block Schema (schema.json)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Counter Block Properties",
  
  "properties": {
    "value": {
      "type": "number",
      "title": "Target Value",
      "description": "The final number to count up to",
      "default": 10000,
      "editor": "number"
    },
    "prefix": {
      "type": "string",
      "title": "Prefix",
      "description": "Text before the number (e.g., $)",
      "default": "",
      "editor": "text"
    },
    "suffix": {
      "type": "string",
      "title": "Suffix",
      "description": "Text after the number (e.g., +)",
      "default": "",
      "editor": "text"
    },
    "label": {
      "type": "string",
      "title": "Label",
      "description": "Description text below the counter",
      "default": "Downloads",
      "editor": "text"
    },
    "color": {
      "type": "string",
      "title": "Text Color",
      "default": "#3B82F6",
      "editor": "color"
    },
    "animationStyle": {
      "type": "string",
      "title": "Animation Style",
      "enum": ["linear", "easeOut", "easeInOut", "bounce"],
      "default": "easeOut",
      "editor": "select",
      "enumLabels": {
        "linear": "Linear",
        "easeOut": "Ease Out",
        "easeInOut": "Ease In Out",
        "bounce": "Bounce"
      }
    },
    "duration": {
      "type": "number",
      "title": "Animation Duration",
      "default": 3,
      "editor": "slider",
      "editorConfig": {
        "min": 1,
        "max": 10,
        "step": 0.5,
        "unit": "s"
      }
    },
    "decimals": {
      "type": "number",
      "title": "Decimal Places",
      "default": 0,
      "editor": "number",
      "editorConfig": {
        "min": 0,
        "max": 5
      }
    }
  },
  
  "required": ["value"],
  
  "ui": {
    "sections": [
      {
        "title": "Content",
        "icon": "Type",
        "fields": ["value", "prefix", "suffix", "label"]
      },
      {
        "title": "Animation",
        "icon": "Zap",
        "fields": ["animationStyle", "duration", "decimals"]
      },
      {
        "title": "Style",
        "icon": "Palette",
        "fields": ["color"]
      }
    ]
  },
  
  "customization": {
    "inherit": true
  }
}
```

### 3. Scene Component (src/Scene.tsx)

```tsx
import React from 'react';
import { AbsoluteFill, useCurrentFrame, interpolate, spring, Easing } from 'remotion';
import { BaseScene, extractCustomization } from '@shared/plugin-utils';

export interface CounterSceneProps {
  data: {
    value: number;
    prefix?: string;
    suffix?: string;
    label?: string;
    color?: string;
    animationStyle?: 'linear' | 'easeOut' | 'easeInOut' | 'bounce';
    duration?: number;
    decimals?: number;
    // Customization props (inherited from BaseScene)
    verticalAlign?: 'top' | 'center' | 'bottom';
    horizontalAlign?: 'left' | 'center' | 'right';
    backgroundColor?: string;
    padding?: number;
    enterAnimation?: string;
    // ... etc
  };
  theme: string;
  motionProfile: string;
  animation: { enter: number; hold: number; exit: number };
}

export const CounterScene: React.FC<CounterSceneProps> = ({ 
  data, 
  theme, 
  motionProfile, 
  animation 
}) => {
  const frame = useCurrentFrame();
  const fps = 30;
  
  const {
    value = 10000,
    prefix = '',
    suffix = '',
    label = '',
    color = '#3B82F6',
    animationStyle = 'easeOut',
    duration = 3,
    decimals = 0,
  } = data;
  
  // Calculate progress
  const progress = Math.min(frame / (duration * fps), 1);
  
  // Apply easing
  let easedProgress = progress;
  switch (animationStyle) {
    case 'bounce':
      easedProgress = spring({ frame, fps, config: { damping: 10, stiffness: 100 } });
      break;
    case 'easeInOut':
      easedProgress = progress < 0.5 
        ? 2 * progress * progress 
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      break;
    case 'easeOut':
      easedProgress = 1 - Math.pow(1 - progress, 3);
      break;
    default:
      easedProgress = progress;
  }
  
  const currentValue = value * easedProgress;
  
  // Format number
  const formattedValue = decimals > 0 
    ? currentValue.toFixed(decimals) 
    : Math.round(currentValue).toLocaleString();
  
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
        gap: 16 
      }}>
        {/* Counter Value */}
        <div style={{
          fontSize: 120,
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
          color,
          textShadow: `0 0 40px ${color}40`,
        }}>
          {prefix}{formattedValue}{suffix}
        </div>
        
        {/* Label */}
        {label && (
          <div style={{
            fontSize: 36,
            fontFamily: 'system-ui, sans-serif',
            color: '#9CA3AF',
            letterSpacing: 1,
            textTransform: 'uppercase',
          }}>
            {label}
          </div>
        )}
      </div>
    </BaseScene>
  );
};

export default CounterScene;
```

### 4. Editor Component (src/Editor.tsx) - Optional

```tsx
import React from 'react';
import { useEditorStore } from '@/store/editor-store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { ColorPicker, SliderInput, CollapsibleSection } from '@/components/editor/PropertiesPanel';
import { Type, Zap, Palette } from 'lucide-react';

interface EditorProps {
  block: Record<string, unknown>;
  index: number;
}

export const CounterEditor: React.FC<EditorProps> = ({ block, index }) => {
  const { updateBlock } = useEditorStore();
  
  return (
    <>
      {/* Content Section */}
      <CollapsibleSection title="Content" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-400">Target Value</Label>
            <Input
              type="number"
              value={(block.value as number) || 0}
              onChange={(e) => updateBlock(index, { value: parseFloat(e.target.value) || 0 })}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs text-gray-400">Prefix</Label>
              <Input
                value={(block.prefix as string) || ''}
                onChange={(e) => updateBlock(index, { prefix: e.target.value })}
                className="bg-gray-800/50 border-gray-700/50 text-white h-10"
                placeholder="$"
              />
            </div>
            <div>
              <Label className="text-xs text-gray-400">Suffix</Label>
              <Input
                value={(block.suffix as string) || ''}
                onChange={(e) => updateBlock(index, { suffix: e.target.value })}
                className="bg-gray-800/50 border-gray-700/50 text-white h-10"
                placeholder="+"
              />
            </div>
          </div>
          <div>
            <Label className="text-xs text-gray-400">Label</Label>
            <Input
              value={(block.label as string) || ''}
              onChange={(e) => updateBlock(index, { label: e.target.value })}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10"
              placeholder="Downloads"
            />
          </div>
        </div>
      </CollapsibleSection>
      
      {/* Animation Section */}
      <CollapsibleSection title="Animation" icon={Zap} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-400">Animation Style</Label>
            <Select 
              value={(block.animationStyle as string) || 'easeOut'} 
              onValueChange={(v) => updateBlock(index, { animationStyle: v })}
            >
              <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="easeOut">Ease Out</SelectItem>
                <SelectItem value="easeInOut">Ease In Out</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderInput
            label="Duration"
            value={(block.duration as number) || 3}
            onChange={(v) => updateBlock(index, { duration: v })}
            min={1}
            max={10}
            step={0.5}
            unit="s"
          />
          <SliderInput
            label="Decimal Places"
            value={(block.decimals as number) || 0}
            onChange={(v) => updateBlock(index, { decimals: v })}
            min={0}
            max={5}
            step={1}
            unit=""
          />
        </div>
      </CollapsibleSection>
      
      {/* Style Section */}
      <CollapsibleSection title="Style" icon={Palette} defaultOpen={false}>
        <ColorPicker
          value={(block.color as string) || '#3B82F6'}
          onChange={(v) => updateBlock(index, { color: v })}
          label="Text Color"
        />
      </CollapsibleSection>
    </>
  );
};

export default CounterEditor;
```

### 5. Main Export (src/index.ts)

```tsx
// src/index.ts
export { default as Scene } from './Scene';
export { default as Editor } from './Editor';
export { default as Preview } from './Preview';
export { default as schema } from '../schema.json';
export { default as manifest } from '../plugin.json';
```

---

## Plugin Registry (_registry.json)

Auto-generated by the plugin watcher:

```json
{
  "version": "1.0.0",
  "generatedAt": "2024-01-15T10:30:00Z",
  "plugins": [
    {
      "id": "counter-block",
      "name": "Animated Counter",
      "path": "./plugins/core/counter-block",
      "category": "data",
      "icon": "timer",
      "color": "#3B82F6"
    },
    {
      "id": "weather-widget",
      "name": "Weather Widget",
      "path": "./plugins/custom/weather-widget",
      "category": "interactive",
      "icon": "cloud",
      "color": "#10B981"
    }
  ],
  "categories": {
    "content": ["text-block", "quote-block", "list-block"],
    "data": ["counter-block", "stat-block", "progress-bar-block"],
    "visual": ["image-block", "video-block", "gradient-text-block"],
    "interactive": ["cta-block", "countdown-block", "weather-widget"],
    "social": ["whatsapp-chat-block", "avatar-grid-block", "social-stats-block"]
  }
}
```

---

## Implementation Phases

### Phase 1: Foundation (Days 1-3)

**Goal:** Basic plugin infrastructure

```
Tasks:
├── 1.1 Create shared plugin types
│   ├── shared/plugin-types/manifest.ts
│   ├── shared/plugin-types/schema.ts
│   └── shared/plugin-types/component.ts
│
├── 1.2 Create plugin directory structure
│   ├── plugins/core/ (migrate existing blocks)
│   ├── plugins/_registry.json
│   └── plugins/custom/.gitkeep
│
├── 1.3 Create plugin loader (frontend)
│   ├── src/lib/plugins/plugin-loader.ts
│   ├── src/lib/plugins/schema-to-ui.ts
│   └── src/lib/plugins/types.ts
│
└── 1.4 Migrate one block as proof-of-concept
    └── plugins/core/counter-block/
```

### Phase 2: Plugin Watcher Service (Days 4-6)

**Goal:** Auto-detection and hot-reload

```
Tasks:
├── 2.1 Create plugin watcher service
│   ├── mini-services/plugin-watcher/index.ts
│   ├── mini-services/plugin-watcher/scanner.ts
│   └── mini-services/plugin-watcher/validator.ts
│
├── 2.2 Implement hot-reload
│   ├── mini-services/plugin-watcher/bundler.ts
│   └── mini-services/plugin-watcher/broadcaster.ts
│
└── 2.3 Integrate with frontend
    └── WebSocket listener for reload events
```

### Phase 3: CLI Tool (Days 7-9)

**Goal:** Easy plugin creation

```
Tasks:
├── 3.1 Create CLI entry point
│   └── tools/plugin-cli/index.ts
│
├── 3.2 Implement commands
│   ├── tools/plugin-cli/commands/create.ts
│   ├── tools/plugin-cli/commands/validate.ts
│   └── tools/plugin-cli/commands/build.ts
│
└── 3.3 Create templates
    ├── tools/plugin-cli/templates/basic-block/
    ├── tools/plugin-cli/templates/animated-block/
    └── tools/plugin-cli/templates/data-block/
```

### Phase 4: Video Renderer Integration (Days 10-12)

**Goal:** Bundle plugins with Remotion

```
Tasks:
├── 4.1 Update video-renderer
│   ├── mini-services/video-renderer/plugin-loader.ts
│   └── mini-services/video-renderer/plugin-bundler.ts
│
├── 4.2 Dynamic component loading
│   └── Load plugins at render time
│
└── 4.3 Bundle optimization
    └── Tree-shaking for unused plugins
```

### Phase 5: Migration & Polish (Days 13-15)

**Goal:** Migrate all existing blocks

```
Tasks:
├── 5.1 Migrate all existing blocks to plugins
│   └── Move from src/lib/video/components to plugins/core/
│
├── 5.2 Update editor store
│   └── Load blocks from plugin registry
│
├── 5.3 Update properties panel
│   └── Auto-generate UI from schema
│
└── 5.4 Testing & Documentation
    ├── Test all plugins
    └── Write plugin development guide
```

---

## CLI Commands

```bash
# Create a new plugin
bun plugin create my-awesome-block

# Create from template
bun plugin create my-block --template=animated

# Validate plugin structure
bun plugin validate my-block

# Build plugin for production
bun plugin build my-block

# Test plugin locally
bun plugin test my-block

# List all plugins
bun plugin list

# Watch for changes during development
bun plugin dev
```

---

## API Integration

### Plugin Loader API

```typescript
// src/lib/plugins/plugin-loader.ts

interface PluginLoader {
  // Load plugin registry
  loadRegistry(): Promise<PluginRegistry>;
  
  // Get plugin by ID
  getPlugin(id: string): Promise<Plugin>;
  
  // Get plugin schema
  getSchema(id: string): Promise<PluginSchema>;
  
  // Get plugin scene component
  getSceneComponent(id: string): Promise<React.ComponentType>;
  
  // Get plugin editor component
  getEditorComponent(id: string): Promise<React.ComponentType | null>;
  
  // Get all plugins by category
  getByCategory(category: string): Promise<Plugin[]>;
}
```

### Plugin Watcher API

```typescript
// mini-services/plugin-watcher/index.ts

interface PluginWatcher {
  // Start watching plugins directory
  start(): void;
  
  // Stop watching
  stop(): void;
  
  // Force rebuild all plugins
  rebuildAll(): Promise<void>;
  
  // Rebuild specific plugin
  rebuild(id: string): Promise<void>;
  
  // Validate all plugins
  validateAll(): Promise<ValidationResult[]>;
}
```

---

## Editor Integration

### Block Library Sidebar

```tsx
// src/components/editor/BlockLibrarySidebar.tsx

import { usePlugins } from '@/hooks/usePlugins';

export function BlockLibrarySidebar() {
  const { plugins, loading } = usePlugins();
  
  // Group plugins by category
  const categories = useMemo(() => {
    return plugins.reduce((acc, plugin) => {
      const cat = plugin.category || 'other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(plugin);
      return acc;
    }, {} as Record<string, Plugin[]>);
  }, [plugins]);
  
  return (
    <div className="...">
      {Object.entries(categories).map(([category, categoryPlugins]) => (
        <div key={category}>
          <h3>{category}</h3>
          {categoryPlugins.map(plugin => (
            <BlockButton 
              key={plugin.id}
              plugin={plugin}
              onClick={() => addBlock(plugin.id)}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
```

### Auto-Generated Properties Panel

```tsx
// src/components/editor/AutoPropertyEditor.tsx

import { generateEditorFromSchema } from '@/lib/plugins/schema-to-ui';

export function AutoPropertyEditor({ block, index, schema }: Props) {
  // Generate editor UI from schema
  const editorSections = useMemo(() => {
    return generateEditorFromSchema(schema);
  }, [schema]);
  
  return (
    <div>
      {editorSections.map(section => (
        <CollapsibleSection 
          key={section.title}
          title={section.title}
          icon={section.icon}
        >
          {section.fields.map(field => (
            <FieldEditor 
              key={field.key}
              field={field}
              value={block[field.key]}
              onChange={(v) => updateBlock(index, { [field.key]: v })}
            />
          ))}
        </CollapsibleSection>
      ))}
    </div>
  );
}
```

---

## Testing Strategy

### 1. Plugin Validation Tests

```typescript
// tests/plugin-validation.test.ts

describe('Plugin Validation', () => {
  it('should validate plugin.json structure', () => {
    // ...
  });
  
  it('should validate schema.json against JSON Schema', () => {
    // ...
  });
  
  it('should validate Scene component exports', () => {
    // ...
  });
});
```

### 2. Plugin Loading Tests

```typescript
// tests/plugin-loader.test.ts

describe('Plugin Loader', () => {
  it('should load plugin registry', async () => {
    // ...
  });
  
  it('should load plugin scene component', async () => {
    // ...
  });
  
  it('should handle missing plugins gracefully', async () => {
    // ...
  });
});
```

### 3. Rendering Tests

```typescript
// tests/plugin-rendering.test.ts

describe('Plugin Rendering', () => {
  it('should render plugin in video preview', () => {
    // ...
  });
  
  it('should apply customization props', () => {
    // ...
  });
});
```

---

## Security Considerations

### 1. Plugin Sandboxing

```typescript
// Plugin code runs in isolated context
const sandboxedEval = (code: string) => {
  // Run in separate context with limited globals
  const sandbox = {
    React,
    remotion: { AbsoluteFill, useCurrentFrame, ... },
    // No access to Node.js APIs, file system, etc.
  };
  
  return runInContext(code, createContext(sandbox));
};
```

### 2. Input Validation

```typescript
// Validate all plugin inputs
const validatePluginInput = (data: unknown, schema: PluginSchema) => {
  const result = schemaValidator.validate(data, schema);
  if (!result.valid) {
    throw new Error(`Invalid input: ${result.errors}`);
  }
  return result.data;
};
```

### 3. Plugin Signing (Future)

```typescript
// Verify plugin authenticity
const verifyPlugin = async (plugin: Plugin) => {
  const signature = plugin.signature;
  const publicKey = await getPublicKey(plugin.author);
  return verifySignature(plugin.code, signature, publicKey);
};
```

---

## Performance Optimization

### 1. Lazy Loading

```typescript
// Load plugins on demand
const loadPlugin = lazy(async (id: string) => {
  const module = await import(`../plugins/${id}/src/index.ts`);
  return module.default;
});
```

### 2. Caching

```typescript
// Cache compiled plugins
const pluginCache = new Map<string, CompiledPlugin>();

const getOrCompile = async (id: string) => {
  if (pluginCache.has(id)) {
    return pluginCache.get(id);
  }
  
  const compiled = await compilePlugin(id);
  pluginCache.set(id, compiled);
  return compiled;
};
```

### 3. Tree Shaking

```typescript
// Only bundle used plugins
const bundlePlugins = (usedPluginIds: string[]) => {
  return usedPluginIds.map(id => ({
    id,
    code: fs.readFileSync(`plugins/${id}/dist/bundle.js`)
  }));
};
```

---

## Migration Checklist

### Existing Blocks to Migrate

- [ ] stat-block
- [ ] comparison-block
- [ ] text-block
- [ ] image-block
- [ ] quote-block
- [ ] list-block
- [ ] timeline-block
- [ ] callout-block
- [ ] icon-list-block
- [ ] line-chart-block
- [ ] pie-chart-block
- [ ] code-block
- [ ] testimonial-block
- [ ] whatsapp-chat-block
- [ ] motivational-image-block
- [ ] counter-block
- [ ] progress-bar-block
- [ ] qr-code-block
- [ ] video-block
- [ ] avatar-grid-block
- [ ] social-stats-block
- [ ] cta-block
- [ ] gradient-text-block
- [ ] animated-bg-block
- [ ] countdown-block

---

## Success Metrics

1. **Plugin Creation Time**: < 5 minutes to create a basic plugin
2. **Hot Reload Time**: < 2 seconds to see changes
3. **Build Time**: < 30 seconds to build all plugins
4. **Bundle Size Impact**: < 10% increase in initial bundle
5. **Developer Experience**: CLI guides user through creation

---

## Future Enhancements

1. **Plugin Marketplace** - Browse and install community plugins
2. **Plugin Versioning** - Semantic versioning with rollback
3. **Plugin Dependencies** - Share utilities between plugins
4. **Visual Plugin Builder** - Drag-and-drop plugin creator
5. **Plugin Analytics** - Usage tracking and optimization

---

## Questions & Decisions

### Decision Points

1. **Plugin storage location**
   - Option A: `plugins/` at root (recommended)
   - Option B: Inside `src/plugins/`
   - Option C: Separate repository

2. **Plugin format**
   - Option A: TypeScript source (recommended for development)
   - Option B: Pre-compiled JavaScript
   - Option C: JSON config only

3. **Hot reload mechanism**
   - Option A: WebSocket notifications (recommended)
   - Option B: File system polling
   - Option C: Manual refresh

4. **Plugin distribution**
   - Option A: Bundled with app (recommended initially)
   - Option B: CDN-hosted
   - Option C: NPM packages

---

## Next Steps

1. Review this plan and provide feedback
2. Decide on key architectural choices
3. Start Phase 1 implementation
4. Iterate based on learnings

---

*Last Updated: 2024*
