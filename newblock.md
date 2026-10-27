# Adding a New Video Block

This guide covers every registration point needed when adding a new block type (e.g. `my-block`).

---

## How It Works (Architecture)

```
User clicks block in sidebar
        │
        ▼
BlockLibrarySidebar.tsx ──► addBlock(type)
        │
        ▼
editor-store.ts ──► BLOCK_TEMPLATES[type] ──► creates block with defaults
        │                                      (if no template, nothing happens)
        ▼
VideoPreview.tsx ──► generatePlanFromBlocks()
        │              ├── typeToComponentId map ──► resolves COMPONENT_ID
        │              └── getDefaultDuration map ──► sets scene duration
        │
        ▼
Remotion Player renders DynamicVideo composition
        │
        ▼
DynamicVideo.tsx ──► SceneRenderer switch(componentId)
        │              ├── COMPONENT_IDS match ──► renders <MyBlockScene />
        │              └── no match ──► renderByBlockType fallback switch(block.type)
        │
        ▼
MyBlockScene.tsx ──► actual React component that renders in the video

When user clicks block in timeline:
        │
        ▼
PropertiesPanel.tsx ──► BLOCK_ICONS[type] for header icon
        │              └── blockType === 'my-block' ──► <MyBlockEditor />
        │                     └── useEditorStore().updateBlock() to save changes
```

---

## Step-by-Step Checklist

### 0. Add Block Template (CRITICAL — without this, clicking the block does nothing)

**File:** `src/store/editor-store.ts` — `BLOCK_TEMPLATES`

This is what `addBlock()` uses to create the initial block data. If missing, the click silently does nothing.

```ts
'my-block': {
  type: 'my-block',
  title: 'Default Title',
  // ... sensible default values for ALL fields
} as ContentBlock,
```

### 1. Define the Zod Schema

**File:** `src/lib/video/schemas/index.ts`

Three things in this file:

a) Create the block schema:
```ts
export const MyBlockSchema = z.object({
  type: z.literal('my-block'),
  title: z.string().optional(),
  // ... block-specific fields
}).merge(BaseBlockSchema);
```

b) Add to the `ContentBlockSchema` discriminated union:
```ts
export const ContentBlockSchema = z.discriminatedUnion('type', [
  // ...existing blocks
  MyBlockSchema,
]);
```

c) Export the type:
```ts
export type MyBlock = z.infer<typeof MyBlockSchema>;
```

### 2. Register the Component ID

**File:** `src/lib/video/schemas/index.ts` (same file as step 1)

a) Add to `COMPONENT_IDS`:
```ts
MY_BLOCK: 'my-block-scene',
```

b) Add to `TYPE_TO_COMPONENT_MAP`:
```ts
'my-block': [COMPONENT_IDS.MY_BLOCK],
```

### 3. Create the Scene Component

**File:** `src/lib/video/components/MyBlockScene.tsx` (new file)

This is the actual Remotion component that renders inside the video.

```tsx
import { AbsoluteFill, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { MyBlock } from '../schemas';

interface Props {
  data: MyBlock;
  theme: string;
  motionProfile: string;
  animation?: { enter: number; hold: number; exit: number };
}

export function MyBlockScene({ data, theme, motionProfile, animation }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  // ... render your block
}
```

### 4. Wire into DynamicVideo (TWO places)

**File:** `src/lib/video/compositions/DynamicVideo.tsx`

a) Import the scene component and type:
```ts
import { MyBlockScene } from '../components/MyBlockScene';
import type { MyBlock } from '../schemas';
```

b) Add a case in the `SceneRenderer` switch (primary, uses COMPONENT_IDS):
```ts
case COMPONENT_IDS.MY_BLOCK:
  return (
    <MyBlockScene
      data={block as MyBlock}
      theme={theme}
      motionProfile={motionProfile}
      animation={animation}
    />
  );
```

c) Add a case in `renderByBlockType` fallback switch (safety net, uses block.type string):
```ts
case 'my-block':
  return <MyBlockScene data={block} theme={theme} motionProfile={motionProfile} animation={animation} />;
```

### 5. Register in VideoPreview (CRITICAL — without this, preview shows warning icon)

**File:** `src/components/editor/VideoPreview.tsx`

This is what maps block types to component IDs for the Remotion player preview.

a) Add to `typeToComponentId` in `generatePlanFromBlocks()`:
```ts
'my-block': COMPONENT_IDS.MY_BLOCK,
```

b) Add to `getDefaultDuration()`:
```ts
'my-block': 5,  // duration in seconds
```

### 6. Add to the Editor Block Library

**File:** `src/components/editor/BlockLibrarySidebar.tsx`

This is the sidebar where users browse and click to add blocks.

- Import icon (if new): `import { MyIcon } from 'lucide-react';`
- Add to the appropriate category in `BLOCK_CATEGORIES`:
```ts
{ type: 'my-block', label: 'My Block', icon: MyIcon, gradient: 'from-blue-500 to-cyan-500', description: 'Short description' },
```

### 7. Add to the Command Palette

**File:** `src/components/editor/CommandPalette.tsx`

The Ctrl+K search dialog for quickly adding blocks.

- Import icon (if new)
- Add to `COMMAND_BLOCKS`:
```ts
{ type: 'my-block', label: 'My Block', icon: MyIcon },
```

### 8. Register in Decision Router (CRITICAL — without this, Lambda renders blank)

**File:** `src/lib/video/ai/decision-router.ts`

This generates the video plan (componentId + duration) for each block when rendering via Lambda or the AI pipeline.

a) Add to `validateComponentId()` mapping:
```ts
'my-block': COMPONENT_IDS.MY_BLOCK,
```

b) Add to `getDefaultDecision()` `typeToComponent` mapping:
```ts
'my-block': COMPONENT_IDS.MY_BLOCK,
```

c) Add duration logic in `getDefaultDecision()`:
```ts
} else if (block.type === 'my-block') {
  duration = 5;
}
```

### 9. Create the Properties Panel Editor

**File:** `src/components/editor/PropertiesPanel.tsx`

This is the right-side panel that appears when a block is selected in the timeline.

Three changes needed:

a) **Add icon to `BLOCK_ICONS`** (~line 35):
```ts
'my-block': MyIcon,
```

b) **Create the editor function** (at end of file):
```tsx
function MyBlockEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="My Block" icon={MyIcon} defaultOpen={true}>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-gray-400">Title</Label>
          <Input
            value={(block.title as string) || ''}
            onChange={(e) => updateBlock(index, { title: e.target.value })}
            className="bg-gray-800/50 border-gray-700/50 text-white h-10"
          />
        </div>
        {/* ... more fields matching your schema */}
      </div>
    </CollapsibleSection>
  );
}
```

c) **Register in the render section** (~line 530):
```tsx
{blockType === 'my-block' && <MyBlockEditor block={selectedBlock} index={selectedBlockIndex} />}
```

### 10. Register in Generate API Route (CRITICAL — this is what prod uses)

**File:** `src/app/api/video/generate/route.ts`

This is the main API route the frontend calls to render videos. It has its own block type mappings.

a) Add to `TYPE_TO_COMPONENT_ID`:
```ts
'my-block': 'my-block-scene',
```

b) Add to `DEFAULT_DURATIONS`:
```ts
'my-block': 5,
```

### 11. Add to the Video Renderer Service

**File:** `mini-services/video-renderer/index.ts`

The Bun-based renderer service that handles server-side rendering.

a) Add the Zod schema in the `contentBlocks` discriminated union:
```ts
z.object({
  type: z.literal('my-block'),
  title: z.string().optional(),
  // ... same fields as main schema
}).passthrough(),
```

b) Add to the `typeToComponentId` mapping:
```ts
'my-block': 'my-block-scene',
```

### 11. Add AI Block Config

**File:** `src/lib/video/ai/graph.ts`

This tells the AI how to generate this block type automatically.

- Add to `BLOCK_SCHEMAS`:
```ts
'my-block': {
  contentFields: ['title', 'field1', 'field2', 'audioSrc'],
  textFields: `title (string — heading)\nfield1 (string — description)`,
  exampleBlock: `{ "type": "my-block", "title": "Example", "field1": "value" }`,
},
```

---

## Summary

| # | What | File |
|---|------|------|
| 0 | Block template (default data) | `src/store/editor-store.ts` |
| 1 | Zod schema + union + type export | `src/lib/video/schemas/index.ts` |
| 2 | COMPONENT_IDS + TYPE_TO_COMPONENT_MAP | `src/lib/video/schemas/index.ts` |
| 3 | Scene component (new file) | `src/lib/video/components/MyBlockScene.tsx` |
| 4 | DynamicVideo (both switches) | `src/lib/video/compositions/DynamicVideo.tsx` |
| 5 | VideoPreview (componentId + duration) | `src/components/editor/VideoPreview.tsx` |
| 6 | Block Library sidebar | `src/components/editor/BlockLibrarySidebar.tsx` |
| 7 | Command Palette | `src/components/editor/CommandPalette.tsx` |
| 8 | Decision Router (componentId + duration) | `src/lib/video/ai/decision-router.ts` |
| 9 | Properties Panel (icon + editor + render) | `src/components/editor/PropertiesPanel.tsx` |
| 10 | Generate API route (componentId + duration) | `src/app/api/video/generate/route.ts` |
| 11 | Video renderer schema + mapping | `mini-services/video-renderer/index.ts` |
| 12 | AI block config | `src/lib/video/ai/graph.ts` |

**Total: 13 steps across 11 files.**

### After Adding

1. Run `npx tsc --noEmit` to verify no type errors
2. Rebuild the Remotion bundle: `npx remotion bundle remotion-entry.tsx --public-dir=public`
3. Deploy to Lambda: `npx remotion lambda sites create remotion-entry.tsx --site-name=skygen-renderer --region=us-east-1`
4. Update the bun renderer service if running separately
