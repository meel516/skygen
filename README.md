# 🚀 Video Editor with Plugin System

A modern, production-ready video editor application with a powerful hot-reload plugin system, built with Next.js 16, Remotion, and cutting-edge technologies.

## ✨ Technology Stack

### 🎯 Core Framework
- **⚡ Next.js 16** - The React framework for production with App Router
- **📘 TypeScript 5** - Type-safe JavaScript for better developer experience
- **🎨 Tailwind CSS 4** - Utility-first CSS framework for rapid UI development
- **🎬 Remotion** - Create videos programmatically with React

### 🧩 UI Components & Styling
- **🧩 shadcn/ui** - High-quality, accessible components built on Radix UI
- **🎯 Lucide React** - Beautiful & consistent icon library
- **🌈 Framer Motion** - Production-ready motion library for React

### 🎬 Video Engine
- **🎥 Remotion Player** - Real-time video preview
- **📦 Remotion Renderer** - Server-side video rendering
- **🎞️ Dynamic Compositions** - Programmatic video generation

### 🔄 State Management
- **🐻 Zustand** - Simple, scalable state management

### 🗄️ Database & Backend
- **🗄️ Prisma** - Next-generation TypeScript ORM
- **🔌 Plugin System** - Hot-reload plugin architecture

---

## 🔌 Plugin System

This project features a **hot-reload plugin system** that allows you to create, extend, and customize video blocks without modifying the core codebase.

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     PLUGIN ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    │
│   │   plugins/  │    │   Watcher   │    │  Registry   │    │
│   │   core/     │───►│  Service    │───►│  (JSON)     │    │
│   │   custom/   │    │  (Port 3034)│    │             │    │
│   └─────────────┘    └─────────────┘    └─────────────┘    │
│          │                                     │             │
│          ▼                                     ▼             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              FRONTEND EDITOR (Next.js)              │   │
│   │                                                      │   │
│   │   • Load plugins dynamically                        │   │
│   │   • Auto-generate property editors from schema      │   │
│   │   • Real-time preview                               │   │
│   └─────────────────────────────────────────────────────┘   │
│                            │                                 │
│                            ▼                                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │              VIDEO RENDERER (Remotion)              │   │
│   │                                                      │   │
│   │   • Bundle all plugins                              │   │
│   │   • Render video with plugins                       │   │
│   │   • Output MP4 files                                │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🛠️ How to Create a Plugin

### Quick Start

```bash
# Create a new plugin from template
bun tools/plugin-cli/index.ts create my-plugin

# Create with a specific template
bun tools/plugin-cli/index.ts create my-plugin --template=animated

# Create as a custom plugin (goes to custom/ folder)
bun tools/plugin-cli/index.ts create my-plugin --custom

# List all plugins
bun tools/plugin-cli/index.ts list

# Validate a plugin
bun tools/plugin-cli/index.ts validate my-plugin
```

### Plugin Templates

| Template | Description | Best For |
|----------|-------------|----------|
| `basic` | Simple text/content block | Text, headings, paragraphs |
| `animated` | Block with animations | Animated elements, transitions |
| `data` | Data visualization | Charts, stats, counters |

---

## 📁 Plugin Structure

Each plugin follows this structure:

```
plugins/
├── core/                    # Built-in plugins
│   └── my-plugin/
│       ├── plugin.json      # Plugin manifest
│       ├── schema.json      # Properties schema
│       └── src/
│           ├── index.ts     # Main export
│           ├── Scene.tsx    # Remotion scene component
│           └── Editor.tsx   # Properties panel editor
│
└── custom/                  # User-created plugins
    └── my-custom-plugin/
        └── ...
```

---

## 📝 Step-by-Step: Creating a Plugin

### Step 1: Create the Plugin Directory

```bash
bun tools/plugin-cli/index.ts create weather-block --template=basic
```

### Step 2: Define the Manifest (`plugin.json`)

```json
{
  "id": "weather-block",
  "name": "Weather Widget",
  "version": "1.0.0",
  "description": "Display weather information with animated icons",
  "category": "visual",
  "icon": "cloud-sun",
  "color": "#38BDF8",
  "main": "./src/index.ts",
  "scene": "./src/Scene.tsx",
  "editor": "./src/Editor.tsx",
  "schema": "./schema.json",
  "remotion": {
    "compositionId": "WeatherScene",
    "defaultDuration": 4,
    "fps": 30
  },
  "status": "stable",
  "features": {
    "supportsTheming": true,
    "supportsCustomization": true
  }
}
```

### Step 3: Define the Schema (`schema.json`)

The schema defines all configurable properties for your block:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "title": "Weather Block Properties",
  
  "properties": {
    "location": {
      "type": "string",
      "title": "Location",
      "default": "San Francisco",
      "editor": "text"
    },
    "temperature": {
      "type": "number",
      "title": "Temperature",
      "default": 72,
      "editor": "number"
    },
    "condition": {
      "type": "string",
      "title": "Weather Condition",
      "enum": ["sunny", "cloudy", "rainy", "snowy"],
      "default": "sunny",
      "editor": "select",
      "enumLabels": {
        "sunny": "☀️ Sunny",
        "cloudy": "☁️ Cloudy",
        "rainy": "🌧️ Rainy",
        "snowy": "❄️ Snowy"
      }
    },
    "accentColor": {
      "type": "string",
      "title": "Accent Color",
      "default": "#38BDF8",
      "editor": "color"
    }
  },
  
  "required": ["temperature"],
  
  "ui": {
    "sections": [
      {
        "title": "Content",
        "icon": "Type",
        "fields": ["location", "temperature", "condition"],
        "defaultOpen": true
      },
      {
        "title": "Style",
        "icon": "Palette",
        "fields": ["accentColor"],
        "defaultOpen": false
      }
    ]
  },
  
  "defaults": {
    "location": "San Francisco",
    "temperature": 72,
    "condition": "sunny",
    "accentColor": "#38BDF8"
  }
}
```

### Step 4: Create the Scene Component (`src/Scene.tsx`)

This is the Remotion component that renders in the video:

```tsx
import React from 'react';
import { useCurrentFrame, interpolate, spring } from 'remotion';
import { BaseScene, extractCustomization, getThemeColors } from '../../../shared/plugin-utils';
import type { AnimationConfig } from '../../../shared/plugin-types';

export interface WeatherSceneProps {
  data: {
    location?: string;
    temperature: number;
    condition?: string;
    accentColor?: string;
  };
  theme?: string;
  animation?: AnimationConfig;
}

export const WeatherScene: React.FC<WeatherSceneProps> = ({
  data,
  theme = 'dark_modern',
  animation = { enter: 0.4, hold: 3, exit: 0.4 },
}) => {
  const frame = useCurrentFrame();
  const themeColors = getThemeColors(theme);
  
  const { location = 'Unknown', temperature = 72, condition = 'sunny', accentColor = '#38BDF8' } = data;
  
  // Animation
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });
  const scale = spring({ frame, fps: 30, config: { damping: 15, stiffness: 100 } });
  
  // Weather icons
  const icons: Record<string, string> = {
    sunny: '☀️',
    cloudy: '☁️',
    rainy: '🌧️',
    snowy: '❄️',
  };
  
  return (
    <BaseScene theme={theme} customization={extractCustomization(data)} animation={animation}>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        opacity,
        transform: `scale(${scale})`,
      }}>
        <div style={{ fontSize: 120 }}>{icons[condition]}</div>
        <div style={{ fontSize: 96, fontWeight: 800, color: themeColors.text }}>
          {temperature}°F
        </div>
        <div style={{ fontSize: 36, color: themeColors.textSecondary }}>
          {location}
        </div>
      </div>
    </BaseScene>
  );
};

export default WeatherScene;
```

### Step 5: Create the Editor Component (`src/Editor.tsx`)

This is the properties panel shown when the block is selected:

```tsx
import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, Palette } from 'lucide-react';
import type { EditorProps } from '../../../shared/plugin-types';
import { CollapsibleSection, ColorPicker } from '@/components/editor/PropertiesPanel';

export const WeatherEditor: React.FC<EditorProps> = ({ data, onChange }) => {
  const update = (field: string, value: unknown) => {
    onChange({ [field]: value });
  };
  
  return (
    <div className="space-y-1">
      <CollapsibleSection title="Content" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-gray-400">Location</Label>
            <Input
              value={data.location as string ?? ''}
              onChange={(e) => update('location', e.target.value)}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-400">Temperature</Label>
            <Input
              type="number"
              value={data.temperature as number ?? 72}
              onChange={(e) => update('temperature', parseFloat(e.target.value))}
              className="bg-gray-800/50 border-gray-700/50 text-white h-10"
            />
          </div>
          <div>
            <Label className="text-xs text-gray-400">Condition</Label>
            <Select value={data.condition as string ?? 'sunny'} onValueChange={(v) => update('condition', v)}>
              <SelectTrigger className="bg-gray-800/50 border-gray-700/50 text-white h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sunny">☀️ Sunny</SelectItem>
                <SelectItem value="cloudy">☁️ Cloudy</SelectItem>
                <SelectItem value="rainy">🌧️ Rainy</SelectItem>
                <SelectItem value="snowy">❄️ Snowy</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
      
      <CollapsibleSection title="Style" icon={Palette} defaultOpen={false}>
        <ColorPicker
          value={data.accentColor as string ?? '#38BDF8'}
          onChange={(v) => update('accentColor', v)}
          label="Accent Color"
        />
      </CollapsibleSection>
    </div>
  );
};

export default WeatherEditor;
```

### Step 6: Create the Main Export (`src/index.ts`)

```tsx
export { default as Scene } from './Scene';
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
```

---

## 📋 Schema Editor Types

| Editor Type | Description | Use For |
|-------------|-------------|---------|
| `text` | Single-line text input | Names, titles, short text |
| `textarea` | Multi-line text input | Descriptions, content |
| `number` | Number input with optional min/max | Counts, sizes |
| `slider` | Slider with min/max/step | Percentages, durations |
| `color` | Color picker with hex input | Colors |
| `select` | Dropdown selection | Options, enums |
| `toggle` | Boolean switch | Enable/disable options |
| `image` | Image URL input with preview | Images |
| `video` | Video URL input | Videos |
| `audio` | Audio URL input | Sounds, music |
| `code` | Code editor | Scripts, code |

---

## 🎨 Available Themes

| Theme | Background | Text | Best For |
|-------|------------|------|----------|
| `dark_modern` | #0A0A0A | #FFFFFF | Modern, sleek videos |
| `light_clean` | #FFFFFF | #1F2937 | Professional, corporate |
| `gradient_vibrant` | Gradient | #FFFFFF | Creative, energetic |
| `minimal_bw` | #000000 | #FFFFFF | Minimal, artistic |

---

## 🔧 Plugin Categories

| Category | Description | Examples |
|----------|-------------|----------|
| `content` | Text and content blocks | Text, quotes, lists |
| `data` | Data visualization | Stats, counters, charts |
| `visual` | Visual elements | Images, weather, icons |
| `interactive` | Interactive elements | CTA buttons, countdowns |
| `social` | Social media elements | WhatsApp, social stats |
| `media` | Media elements | Videos, audio players |

---

## 📦 Built-in Plugins

| Plugin | Category | Description |
|--------|----------|-------------|
| `counter-block` | data | Animated counting numbers |
| `text-block` | content | Text with typography options |
| `stat-block` | data | Statistics with trends |
| `cta-block` | interactive | Call-to-action button |
| `weather-block` | visual | Weather widget with icons |

---

## 🚀 Quick Start

```bash
# Install dependencies
bun install

# Start development server
bun run dev

# Start the plugin watcher (for hot-reload)
cd mini-services/plugin-watcher && bun run dev

# Create a new plugin
bun tools/plugin-cli/index.ts create my-awesome-block

# Validate a plugin
bun tools/plugin-cli/index.ts validate my-awesome-block

# List all plugins
bun tools/plugin-cli/index.ts list
```

---

## 📁 Project Structure

```
├── plugins/                      # Plugin system
│   ├── _registry.json            # Auto-generated registry
│   ├── core/                     # Built-in plugins
│   │   ├── counter-block/
│   │   ├── text-block/
│   │   ├── stat-block/
│   │   ├── cta-block/
│   │   └── weather-block/
│   └── custom/                   # User-created plugins
│
├── shared/                       # Shared code
│   ├── plugin-types/             # Type definitions
│   └── plugin-utils/             # Base components & utilities
│
├── src/                          # Next.js application
│   ├── app/                      # App Router pages
│   ├── components/               # React components
│   ├── lib/                      # Utilities
│   │   ├── plugins/              # Frontend plugin system
│   │   └── video/                # Video engine
│   └── store/                    # Zustand stores
│
├── mini-services/                # Microservices
│   ├── video-renderer/           # Remotion renderer (Port 3031)
│   └── plugin-watcher/           # Hot-reload watcher (Port 3034)
│
└── tools/                        # CLI tools
    └── plugin-cli/               # Plugin creation CLI
```

---

## 🎯 Development Tips

1. **Use BaseScene**: All plugins should use `BaseScene` for consistent theming and customization support.

2. **Schema-Driven UI**: Define properties in `schema.json` - the editor UI auto-generates from it.

3. **Hot Reload**: The plugin watcher automatically rebuilds the registry when files change.

4. **Customization Inheritance**: Set `"customization": { "inherit": true }` in schema to inherit common styling options.

5. **Animation Helpers**: Use utilities from `shared/plugin-utils/animations.ts` for consistent animations.

---

## 🤝 Get Started

1. **Clone this project** to jumpstart your video editor
2. **Create plugins** using the CLI tool
3. **Customize** the editor to fit your needs
4. **Deploy with confidence** using the production-ready setup

---

Built with ❤️ for the developer community. 🚀
