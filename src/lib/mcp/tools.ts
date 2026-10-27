import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import {
  getBaseBundleInfo,
  validatePluginLocal,
} from './local-plugin-sandbox';
import {
  getPluginDirLayoutInfo,
  packPluginDir,
} from './pack-plugin-dir';

export type ApiFetch = (path: string, init?: RequestInit) => Promise<any>;

/** Normalize block payloads for create/update/start. */
function normalizeTemplateBlocks(blocks: any[]): any[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((b) => {
    if (!b || typeof b !== 'object') return b;
    if (b.type === 'custom-plugin' && b.pluginData == null) {
      return { ...b, pluginData: {} };
    }
    return b;
  });
}

function extractBlocksFromTemplate(tmpl: any): any[] {
  if (!tmpl) return [];
  if (Array.isArray(tmpl.blocks)) return tmpl.blocks;
  if (Array.isArray(tmpl.data?.blocks)) return tmpl.data.blocks;
  if (Array.isArray(tmpl.data)) return tmpl.data;
  if (Array.isArray(tmpl.template?.blocks)) return tmpl.template.blocks;
  return [];
}

// ============================================================================
// Tool Definitions
// Shared between the stdio MCP server (mcp-server/index.ts) and the HTTP
// MCP route (src/app/api/mcp/route.ts).
//
// Scope: LangGraph template video pipeline + plugins/templates.
// Mastra chat tools (wizard_send_message etc.) are intentionally NOT exposed.
// ============================================================================

export const TOOL_DEFINITIONS = [
  {
    name: 'get_remotion_cinematic_patterns',
    description: 'Fetch the 69 premium cinematic and motion graphics patterns (Blur-to-Sharp, CSS 3D, Aurora backgrounds, etc.) to use when writing Remotion React code.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_arcs',
    description:
      'List available story arc presets. Show these to the user so they can pick one, or skip entirely and craft a fully custom arc based on your conversation with the user. ' +
      'A custom arc is often better because you know the user\'s topic and tone. Pass it directly to start_video_generation as the `arc` parameter.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_visual_styles',
    description: 'List available visual styles for image generation (e.g. photorealistic, anime, minimalist, cinematic). Show to the user to let them choose.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_templates',
    description:
      'List available video templates (yours + public). Each template defines ordered content blocks. ' +
      'Use get_template for full block detail. Use create_template to build a new one from built-in blocks + custom plugins.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_template',
    description:
      'Fetch a single template by id, including its full blocks array. ' +
      'Use before start_video_generation or before update_template.',
    inputSchema: {
      type: 'object',
      required: ['template_id'],
      properties: {
        template_id: { type: 'string', description: 'Template ID from list_templates or create_template.' },
      },
    },
  },
  {
    name: 'create_template',
    description: `Create a reusable video template from built-in blocks and/or custom plugins.
Premium required. After creation, pass template_id to start_video_generation.

BLOCK SHAPES:
- Built-in: { "type": "stat" | "text" | "quote" | "list" | "timeline" | "motivational-image" | ... } — see list_content_blocks
- Custom plugin: { "type": "custom-plugin", "pluginId": "<id>", "pluginData": { ...schema defaults } }

Typical workflow:
1. list_content_blocks + list_plugins
2. propose_plugin_preview if you need a custom Remotion block
3. create_template with mixed blocks
4. start_video_generation({ user_story, template_id })`,
    inputSchema: {
      type: 'object',
      required: ['name', 'blocks'],
      properties: {
        name: { type: 'string', description: 'Template display name.' },
        description: { type: 'string', description: 'What this template is for.' },
        category: {
          type: 'string',
          description: 'Category slug, e.g. "review", "explainer", "motivational", "general".',
        },
        is_public: {
          type: 'boolean',
          description: 'If true, other users can see this template. Default false.',
        },
        blocks: {
          type: 'array',
          description:
            'Ordered content blocks. Built-in types from list_content_blocks, or custom-plugin entries.',
          items: {
            type: 'object',
            required: ['type'],
            properties: {
              type: {
                type: 'string',
                description: 'Block type e.g. "stat", "text", "motivational-image", "custom-plugin".',
              },
              pluginId: {
                type: 'string',
                description: 'Required when type is "custom-plugin".',
              },
              pluginData: {
                type: 'object',
                description: 'Plugin field values / defaults when type is "custom-plugin".',
              },
            },
            additionalProperties: true,
          },
        },
      },
    },
  },
  {
    name: 'update_template',
    description:
      'Update a template you own (name, description, category, is_public, and/or full blocks list). Premium required.',
    inputSchema: {
      type: 'object',
      required: ['template_id'],
      properties: {
        template_id: { type: 'string' },
        name: { type: 'string' },
        description: { type: 'string' },
        category: { type: 'string' },
        is_public: { type: 'boolean' },
        blocks: {
          type: 'array',
          description: 'If provided, replaces the entire blocks array.',
          items: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
  {
    name: 'delete_template',
    description: 'Delete a template you own. Premium required. Templates you do not own cannot be deleted.',
    inputSchema: {
      type: 'object',
      required: ['template_id'],
      properties: {
        template_id: { type: 'string' },
      },
    },
  },
  {
    name: 'list_voices',
    description: 'List available TTS voices with gender and provider info. Show to the user to let them choose a narration voice.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_plugins',
    description:
      'List installed plugins (core + user custom). Use plugin ids with type "custom-plugin" in create_template / start_video_generation blocks. ' +
      'Call get_plugin for schema/defaults of a specific plugin.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_plugin',
    description:
      "Get a plugin's metadata and schema (fields/defaults). Use before filling pluginData in a custom-plugin block.",
    inputSchema: {
      type: 'object',
      required: ['plugin_id'],
      properties: {
        plugin_id: { type: 'string', description: 'Plugin id from list_plugins or propose_plugin_preview.' },
      },
    },
  },
  {
    name: 'start_video_generation',
    description: `Start LangGraph video generation. Returns immediately with a thread_id — generation runs in the background.

BLOCKS — provide ONE of:
- template_id: use a saved template (from list_templates / create_template)
- blocks: ad-hoc block list (same shape as create_template). When both are set, \`blocks\` wins.

ARC SELECTION — choose ONE:
- arc_id: preset from list_arcs
- arc: { roles, tone } custom narrative roles (one role per block preferred)
- Neither: AI director auto-detects

CUSTOM PLUGIN BLOCKS:
{ "type": "custom-plugin", "pluginId": "<id>", "pluginData": { ... } }
LangGraph fills generation_fields (image/audio/video) from schema + scene annotations.

After start: poll get_generation_status every 10-15s → approve_story / approve_images / approve_audio as needed → get_video_preview.`,
    inputSchema: {
      type: 'object',
      required: ['user_story'],
      properties: {
        user_story: {
          type: 'string',
          description: 'The topic or description of the video (e.g. "Odysseus game review — epic score card and verdict")',
        },
        template_id: {
          type: 'string',
          description: 'Template ID from list_templates or create_template. Required unless blocks is provided.',
        },
        blocks: {
          type: 'array',
          description:
            'Optional ad-hoc blocks. If set, used instead of loading template blocks. Mix built-in types and custom-plugin.',
          items: { type: 'object', additionalProperties: true },
        },
        arc_id: {
          type: 'string',
          description: 'Preset arc ID from list_arcs. Ignored if custom arc object is provided.',
        },
        arc: {
          type: 'object',
          description: 'Custom arc — define roles + tone yourself based on the user conversation. Takes priority over arc_id.',
          properties: {
            roles: {
              type: 'array',
              items: { type: 'string' },
              description: 'Ordered narrative roles, one per block.',
            },
            tone: {
              type: 'string',
              description: 'Overall tone/style direction for the director agent.',
            },
          },
          required: ['roles', 'tone'],
        },
        visual_style: {
          type: 'string',
          description: 'Visual style ID from list_visual_styles. Optional.',
        },
        voice: {
          type: 'string',
          description: 'Voice ID from list_voices. Optional.',
        },
        language: {
          type: 'string',
          description: 'Language code, e.g. "en", "es". Defaults to "en".',
        },
        model: {
          type: 'string',
          description: 'AI model to use, e.g. "grok-3", "grok-3-mini", "deepseek-chat". Defaults to "grok-3".',
        },
      },
    },
  },
  {
    name: 'get_generation_status',
    description:
      'Poll the status of a video generation job (reads from DB instantly — no blocking). ' +
      'Call every 10-15 seconds while status = "running". ' +
      'status = "interrupted" → generation paused for review, check interrupt.type for details. ' +
      'status = "complete" → call get_video_preview. ' +
      'status = "error" → generation failed, check error field.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string', description: 'Thread ID from start_video_generation' },
      },
    },
  },
  {
    name: 'approve_story',
    description:
      'Approve the narrative plan and start image generation. ' +
      'Optionally pass edited_scripts to revise block scripts before image generation begins. ' +
      'Returns immediately — poll get_generation_status to track progress.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string' },
        edited_scripts: {
          type: 'object',
          description:
            'Optional. Map of block index (string key) to revised script text. ' +
            'Example: { "0": "New intro script", "3": "New conclusion" }. ' +
            'Only include blocks the user wants to change. Omit to approve all as-is.',
          additionalProperties: { type: 'string' },
        },
      },
    },
  },
  {
    name: 'regenerate_image',
    description:
      'Generate a new image from a description. Returns a URL. ' +
      'For parallax layers, pass field_path (e.g. "layers[1].image") and set remove_background appropriately. ' +
      'Use update_block_image to regenerate and persist in one step.',
    inputSchema: {
      type: 'object',
      required: ['thread_id', 'block_index', 'description'],
      properties: {
        thread_id:          { type: 'string' },
        block_index:        { type: 'number', description: '0-based index of the block (blockIdx from imageItem)' },
        field_path:         { type: 'string', description: 'Dot-notation field path within the block, e.g. "layers[1].image". Required for parallax layer images.' },
        description:        { type: 'string', description: 'New image description / prompt' },
        remove_background:  { type: 'boolean', description: 'Match the removeBackground field from the imageItem. True for parallax foreground/midground layers, false for background.' },
        visual_style_guide: { type: 'string', description: 'Pass interrupt.visualStyleGuide for visual consistency across blocks.' },
      },
    },
  },
  {
    name: 'approve_images',
    description:
      'Approve generated visuals and start audio generation. ' +
      'Optionally pass updated_blocks with new image URLs if any images were changed. ' +
      'Returns immediately — poll get_generation_status to track progress.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string' },
        updated_blocks: {
          type: 'array',
          description:
            'Optional. The full blocks array from interrupt.blocks with imageUrl fields replaced by URLs from regenerate_image. ' +
            'Pass this if any images were regenerated.',
          items: { type: 'object' },
        },
      },
    },
  },
  {
    name: 'regenerate_audio',
    description:
      'Generate audio for a single block from a script. Returns { block_index, new_audio_url }. ' +
      'Use update_block_audio to regenerate and persist in one step.',
    inputSchema: {
      type: 'object',
      required: ['thread_id', 'block_index', 'script'],
      properties: {
        thread_id:   { type: 'string' },
        block_index: { type: 'number', description: '0-based block index' },
        script:      { type: 'string', description: 'Text to speak. Use interrupt.audioItems[i].script if not changing the script.' },
        voice:       { type: 'string', description: 'Voice ID from list_voices. Omit to use default voice.' },
      },
    },
  },
  {
    name: 'approve_audio',
    description:
      'Approve audio and start final video assembly. ' +
      'Optionally pass updated_blocks with new audioSrc URLs if any audio was changed. ' +
      'Returns immediately — poll get_generation_status to track progress.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string' },
        updated_blocks: {
          type: 'array',
          description: 'Full blocks array from interrupt.blocks with audioSrc fields replaced by URLs from regenerate_audio.',
          items: { type: 'object' },
        },
      },
    },
  },
  {
    name: 'get_video_preview',
    description:
      'Get the final video after generation is complete. ' +
      'Call this only when get_generation_status returns status = "complete". ' +
      'Returns an HTML video player with the video URL and block timeline.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string' },
      },
    },
  },
  // ── Catalog + plugins ───────────────────────────────────────────────────────
  {
    name: 'list_content_blocks',
    description:
      'Returns available built-in content block types with descriptions, key fields, and guidance on when to use each. ' +
      'Call this before create_template / start_video_generation. ' +
      'If no existing block fits the user\'s need, use propose_plugin_preview to build a custom one, then reference it as type custom-plugin.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_plugin_base_bundle',
    description:
      'Describe the MCP local sandbox + preferred FILE-based plugin layout. ' +
      'Agents should write real files (Scene.tsx, schema.json, package.json, components/*), then use ' +
      'pack_plugin_dir and propose_plugin_preview. JSON modules are only for the API edge. ' +
      'Does NOT change the main app create path.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'pack_plugin_dir',
    description: `Pack a real on-disk plugin folder into propose_plugin_preview JSON (modules + schema_json + dependencies).

PREFERRED authoring: write files on disk with the MCP client, then pack once.

Folder layout:
  Scene.tsx (required entry)
  schema.json
  package.json (dependencies)
  plugin.json (optional id/name/description/category)
  components/**, lib/** (multi-file)

Skips node_modules, dist, lockfiles. Returns propose_plugin_args ready for propose_plugin_preview.

Requires filesystem access (stdio MCP on the machine). On HTTP MCP (Vercel), use the pack CLI:
  node mcp-server/scripts/pack-plugin.mjs ./my-plugin --out packed.json`,
    inputSchema: {
      type: 'object',
      required: ['path'],
      properties: {
        path: {
          type: 'string',
          description: 'Absolute or relative path to the plugin project folder.',
        },
        id: { type: 'string', description: 'Override plugin id (else plugin.json / folder name).' },
        name: { type: 'string', description: 'Override display name.' },
        description: { type: 'string' },
        category: { type: 'string' },
      },
    },
  },
  {
    name: 'propose_plugin_preview',
    description: 'Propose a plugin via MCP and generate a live preview URL for the user to review in the web UI. Once the user approves it (either in the UI or via approve_plugin_preview), it becomes a fully saved plugin.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Plugin ID (kebab-case)' },
        name: { type: 'string', description: 'Human readable plugin name' },
        description: { type: 'string', description: 'Short description of what the block does' },
        category: { type: 'string', description: 'Plugin category (e.g. "content", "visual")' },
        scene_code: { type: 'string', description: 'The main React source code for Scene.tsx' },
        modules: {
          type: 'object',
          description: 'Optional additional files (e.g. { "utils.ts": "..." })',
          additionalProperties: { type: 'string' },
        },
        schema_json: { type: 'string', description: 'A JSON string of the block\'s schema' },
        dependencies: {
          type: 'object',
          description: 'npm dependencies the plugin imports (package -> semver)',
          additionalProperties: { type: 'string' },
        },

      },
      required: ['id', 'name', 'schema_json'],
    },
  },
  {
    name: 'approve_plugin_preview',
    description: 'Approve a pending plugin preview (previously proposed by propose_plugin_preview). This will finalize the build and save it to the database.',
    inputSchema: {
      type: 'object',
      properties: {
        thread_id: { type: 'string', description: 'The thread_id returned by propose_plugin_preview' },
      },
      required: ['thread_id'],
    },
  },
  {
    name: 'delete_plugin',
    description:
      'Delete a custom plugin created via propose_plugin_preview. ' +
      'Core plugins (counter-block, stat-block, cta-block) cannot be deleted.',
    inputSchema: {
      type: 'object',
      required: ['plugin_id'],
      properties: {
        plugin_id: {
          type: 'string',
          description: 'The plugin id returned by propose_plugin_preview.',
        },
      },
    },
  },
  // ── Post-generation edit tools ─────────────────────────────────────────────
  {
    name: 'get_generation_state',
    description:
      'Read the full current generation state for a thread: narrative plan with scripts, ' +
      'all blocks with their current images and audio URLs, imageItems metadata, and videoMeta. ' +
      'Use this to inspect what was generated before deciding what to change.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string', description: 'Thread ID from start_video_generation' },
      },
    },
  },
  {
    name: 'update_block_image',
    description:
      'Regenerate the image for a specific block and persist it to the generation state. ' +
      'Can be called at any time — including after the video has been assembled. ' +
      'For parallax layers, pass field_path (e.g. "layers[1].image"). ' +
      'Returns { block_index, field_path, new_image_url }.',
    inputSchema: {
      type: 'object',
      required: ['thread_id', 'block_index', 'description'],
      properties: {
        thread_id:          { type: 'string' },
        block_index:        { type: 'number', description: '0-based block index' },
        description:        { type: 'string', description: 'New image description / prompt' },
        field_path:         { type: 'string', description: 'Field path within the block, e.g. "layers[1].image". Defaults to "imageUrl".' },
        remove_background:  { type: 'boolean', description: 'Whether to remove the image background. Default false.' },
        visual_style_guide: { type: 'string', description: 'Visual style guide for consistency. Pass state.visualStyleGuide.' },
      },
    },
  },
  {
    name: 'update_block_audio',
    description:
      'Regenerate audio for a specific block and persist it to the generation state. ' +
      'Can be called at any time — including after the video has been assembled. ' +
      'Returns { block_index, new_audio_url }.',
    inputSchema: {
      type: 'object',
      required: ['thread_id', 'block_index', 'script'],
      properties: {
        thread_id:   { type: 'string' },
        block_index: { type: 'number', description: '0-based block index' },
        script:      { type: 'string', description: 'Text to speak for this block.' },
        voice:       { type: 'string', description: 'Voice ID from list_voices. Omit to use default.' },
      },
    },
  },
  {
    name: 'assemble_video',
    description:
      'Rebuild the final video from the current generation state. ' +
      'Creates or updates the Video record and returns a previewUrl. ' +
      'Call this when satisfied with all blocks — can be called multiple times after any edits.',
    inputSchema: {
      type: 'object',
      required: ['thread_id'],
      properties: {
        thread_id: { type: 'string' },
      },
    },
  },
  {
    name: 'patch_generation_state',
    description: `Set any field in the generation state using a dot-notation path.
Use this to update fields not covered by update_block_image / update_block_audio.

Examples:
  path "videoMeta.audioTracks"           value [{"src":"https://...","volume":0.8}]  → add background music
  path "videoMeta.theme"                 value "light_minimal"                       → change theme
  path "narrativePlan[0].spokenScript"   value "New narration text"                  → edit a voice-over script
  path "filledBlocks[2].headline"        value "New headline"                        → edit a text field
  path "visualStyleGuide"                value "Use warm earthy tones throughout"    → update style guide

After patching, call assemble_video(thread_id) to rebuild the video with the updated state.`,
    inputSchema: {
      type: 'object',
      required: ['thread_id', 'path', 'value'],
      properties: {
        thread_id: {
          type: 'string',
          description: 'Thread ID from start_video_generation.',
        },
        path: {
          type: 'string',
          description: 'Dot/bracket-notation path relative to the state root. e.g. "videoMeta.audioTracks" or "filledBlocks[2].headline".',
        },
        value: {
          description: 'The value to set at the given path. Can be any JSON type (string, number, array, object, null).',
        },
      },
    },
  },
];

// ============================================================================
// Tool Handlers
// Generation runs fire-and-forget to /api/ai/wizard/execute (LangGraph).
// Status is read instantly from the wizard_jobs DB table.
// ============================================================================

export async function handleToolCall(
  name: string,
  args: Record<string, any>,
  apiFetch: ApiFetch,
): Promise<{ content: any[] }> {
  switch (name) {

    case 'get_remotion_cinematic_patterns': {
      const { REMOTION_SKILLS } = await import('@/lib/video/ai/mastra/agents/remotion-skills');
      return {
        content: [{
          type: 'text',
          text: REMOTION_SKILLS,
        }],
      };
    }

    case 'list_arcs': {
      const data = await apiFetch('/api/story-arcs');
      const arcs = Array.isArray(data) ? data : data.arcs ?? [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(arcs.map((a: any) => ({
            id:          a.id,
            label:       a.label,
            description: a.description,
            roles:       a.arc_pattern?.roles ?? [],
          })), null, 2),
        }],
      };
    }

    case 'list_visual_styles': {
      const data = await apiFetch('/api/visual-styles');
      const styles = Array.isArray(data) ? data : data.styles ?? [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(styles.map((s: any) => ({
            id:          s.id,
            label:       s.label,
            description: s.description,
          })), null, 2),
        }],
      };
    }

    case 'list_templates': {
      const data = await apiFetch('/api/templates');
      const templates = Array.isArray(data) ? data : data.templates ?? [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(templates.map((t: any) => {
            const blocks = extractBlocksFromTemplate(t);
            return {
              id:          t.id,
              name:        t.name,
              description: t.description,
              category:    t.category,
              is_public:   t.isPublic,
              block_count: blocks.length,
              block_types: blocks.map((b: any) =>
                b?.type === 'custom-plugin' ? `custom-plugin:${b.pluginId ?? '?'}` : b?.type
              ),
            };
          }), null, 2),
        }],
      };
    }

    case 'get_template': {
      const { template_id } = args;
      if (!template_id) throw new McpError(ErrorCode.InvalidParams, 'template_id is required');
      const tmpl = await apiFetch(`/api/templates/${encodeURIComponent(template_id)}`);
      const blocks = extractBlocksFromTemplate(tmpl);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id:          tmpl.id,
            name:        tmpl.name,
            description: tmpl.description,
            category:    tmpl.category,
            is_public:   tmpl.isPublic,
            blocks,
          }, null, 2),
        }],
      };
    }

    case 'create_template': {
      const { name, description, category, is_public, blocks } = args;
      if (!name) throw new McpError(ErrorCode.InvalidParams, 'name is required');
      if (!Array.isArray(blocks) || blocks.length === 0) {
        throw new McpError(ErrorCode.InvalidParams, 'blocks must be a non-empty array');
      }
      const normalized = normalizeTemplateBlocks(blocks);
      for (const b of normalized) {
        if (b?.type === 'custom-plugin' && !b.pluginId) {
          throw new McpError(ErrorCode.InvalidParams, 'custom-plugin blocks require pluginId');
        }
      }
      const result = await apiFetch('/api/templates', {
        method: 'POST',
        body: JSON.stringify({
          name,
          description: description ?? '',
          category: category ?? 'general',
          type: 'user',
          isPublic: !!is_public,
          data: { blocks: normalized },
        }),
      });
      if (result.error) {
        throw new McpError(ErrorCode.InternalError, result.error);
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            template_id: result.id,
            name: result.name,
            block_count: normalized.length,
            block_types: normalized.map((b: any) =>
              b?.type === 'custom-plugin' ? `custom-plugin:${b.pluginId}` : b?.type
            ),
            usage: `start_video_generation({ user_story: "...", template_id: "${result.id}" })`,
          }, null, 2),
        }],
      };
    }

    case 'update_template': {
      const { template_id, name, description, category, is_public, blocks } = args;
      if (!template_id) throw new McpError(ErrorCode.InvalidParams, 'template_id is required');
      const body: Record<string, any> = {};
      if (name != null) body.name = name;
      if (description != null) body.description = description;
      if (category != null) body.category = category;
      if (is_public != null) body.isPublic = !!is_public;
      if (Array.isArray(blocks)) {
        const normalized = normalizeTemplateBlocks(blocks);
        for (const b of normalized) {
          if (b?.type === 'custom-plugin' && !b.pluginId) {
            throw new McpError(ErrorCode.InvalidParams, 'custom-plugin blocks require pluginId');
          }
        }
        body.data = { blocks: normalized };
      }
      const result = await apiFetch(`/api/templates/${encodeURIComponent(template_id)}`, {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      if (result.error) {
        throw new McpError(ErrorCode.InternalError, result.error);
      }
      const updatedBlocks = extractBlocksFromTemplate(result);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            template_id: result.id,
            name: result.name,
            block_count: updatedBlocks.length,
            blocks: updatedBlocks,
            success: true,
          }, null, 2),
        }],
      };
    }

    case 'delete_template': {
      const { template_id } = args;
      if (!template_id) throw new McpError(ErrorCode.InvalidParams, 'template_id is required');
      const result = await apiFetch(`/api/templates/${encodeURIComponent(template_id)}`, {
        method: 'DELETE',
      });
      if (result.error) {
        throw new McpError(ErrorCode.InternalError, result.error);
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, deleted: template_id }, null, 2),
        }],
      };
    }

    case 'list_voices': {
      const data = await apiFetch('/api/voices');
      const voices = Array.isArray(data) ? data : data.voices ?? [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(voices.map((v: any) => ({
            id:       v.id,
            name:     v.name,
            gender:   v.gender,
            provider: v.provider,
            preview:  v.previewUrl,
          })), null, 2),
        }],
      };
    }

    case 'list_plugins': {
      const data = await apiFetch('/api/plugins/registry');
      const plugins = Array.isArray(data) ? data : data.plugins ?? [];
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(plugins.map((p: any) => ({
            id:          p.id,
            name:        p.name,
            description: p.description,
            category:    p.category,
            version:     p.version,
            status:      p.status,
            tags:        p.tags ?? [],
          })), null, 2),
        }],
      };
    }

    case 'get_plugin': {
      const { plugin_id } = args;
      if (!plugin_id) throw new McpError(ErrorCode.InvalidParams, 'plugin_id is required');

      let meta: any = null;
      try {
        const registry = await apiFetch('/api/plugins/registry');
        const plugins = Array.isArray(registry) ? registry : registry.plugins ?? [];
        meta = plugins.find((p: any) => p.id === plugin_id) ?? null;
      } catch { /* non-fatal */ }

      let schema: any = null;
      try {
        schema = await apiFetch(`/api/plugins/${encodeURIComponent(plugin_id)}/schema`);
        if (schema?.error) schema = null;
      } catch { /* non-fatal */ }

      if (!meta && !schema) {
        throw new McpError(ErrorCode.InvalidParams, `Plugin not found: ${plugin_id}`);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            id:          plugin_id,
            name:        meta?.name ?? plugin_id,
            description: meta?.description ?? null,
            category:    meta?.category ?? null,
            version:     meta?.version ?? null,
            schema,
            defaults:    schema?.defaults ?? {},
            usage: {
              type: 'custom-plugin',
              pluginId: plugin_id,
              pluginData: schema?.defaults ?? {},
            },
          }, null, 2),
        }],
      };
    }

    case 'start_video_generation': {
      const {
        user_story, template_id, blocks,
        arc_id, arc,
        visual_style, voice,
        language = 'en',
        model = 'grok-3',
      } = args;

      if (!user_story) {
        throw new McpError(ErrorCode.InvalidParams, 'user_story is required');
      }

      let templateBlocks: any[] = [];
      if (Array.isArray(blocks) && blocks.length > 0) {
        templateBlocks = normalizeTemplateBlocks(blocks);
      } else if (template_id) {
        const tmplData = await apiFetch(`/api/templates/${encodeURIComponent(template_id)}`);
        templateBlocks = extractBlocksFromTemplate(tmplData);
      } else {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Provide template_id or a non-empty blocks array',
        );
      }

      if (!templateBlocks.length) {
        throw new McpError(ErrorCode.InvalidParams, 'Template has no blocks');
      }

      for (const b of templateBlocks) {
        if (b?.type === 'custom-plugin' && !b.pluginId) {
          throw new McpError(ErrorCode.InvalidParams, 'custom-plugin blocks require pluginId');
        }
      }

      const threadId = `mcp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await apiFetch('/api/mcp/jobs', {
        method: 'POST',
        body:   JSON.stringify({ threadId }),
      });

      // Fire LangGraph wizard execution in the background — do NOT await
      apiFetch('/api/ai/wizard/execute', {
        method: 'POST',
        body:   JSON.stringify({
          action:               'start',
          threadId,
          userStory:            user_story,
          templateBlocks,
          language,
          preferredArc:         arc ? null : (arc_id ?? null),
          customArc:            arc ? { roles: arc.roles, defaultTone: arc.tone } : null,
          preferredVisualStyle: visual_style ?? null,
          preferredVoice:       voice ?? null,
          partialVideoMeta:     {},
          model,
        }),
      }).catch((err: any) => {
        console.error('[mcp] background wizard failed:', err?.message);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            thread_id: threadId,
            status:    'running',
            template_id: template_id ?? null,
            block_count: templateBlocks.length,
            block_types: templateBlocks.map((b: any) =>
              b?.type === 'custom-plugin' ? `custom-plugin:${b.pluginId}` : b?.type
            ),
            message:   'LangGraph generation started. Poll get_generation_status every 10-15 seconds.',
          }, null, 2),
        }],
      };
    }

    case 'get_generation_status': {
      const { thread_id } = args;

      const job = await apiFetch(`/api/mcp/jobs/${encodeURIComponent(thread_id)}`);

      if (!job) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({ thread_id, status: 'not_found', message: 'Job not found. Check thread_id.' }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            thread_id,
            status:    job.status,
            interrupt: job.interrupt ?? null,
            payload:   job.status === 'complete' ? job.payload : undefined,
            error:     job.error ?? undefined,
          }, null, 2),
        }],
      };
    }

    case 'approve_story': {
      const { thread_id, edited_scripts } = args;

      const value: Record<string, any> = { approved: true };
      if (edited_scripts && Object.keys(edited_scripts).length > 0) {
        value.editedScripts = edited_scripts;
      }

      await apiFetch('/api/mcp/jobs', {
        method: 'POST',
        body:   JSON.stringify({ threadId: thread_id, status: 'running' }),
      });

      apiFetch('/api/ai/wizard/execute', {
        method: 'POST',
        body:   JSON.stringify({ action: 'resume', threadId: thread_id, value }),
      }).catch((err: any) => {
        console.error('[mcp] background resume failed:', err?.message);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            thread_id,
            status:  'running',
            message: 'Story approved. Poll get_generation_status for visual generation progress.',
          }, null, 2),
        }],
      };
    }

    case 'regenerate_image': {
      const { block_index, field_path, description, remove_background = false, visual_style_guide = '' } = args;

      const result = await apiFetch('/api/ai/wizard/regenerate-image', {
        method: 'POST',
        body:   JSON.stringify({
          description:      `${visual_style_guide ? visual_style_guide + '. ' : ''}${description}`,
          removeBackground: remove_background,
        }),
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ block_index, field_path: field_path ?? null, new_image_url: result.url }, null, 2),
        }],
      };
    }

    case 'approve_images': {
      const { thread_id, updated_blocks } = args;

      const value: Record<string, any> = { approved: true };
      if (Array.isArray(updated_blocks) && updated_blocks.length > 0) {
        value.updatedBlocks = updated_blocks;
      }

      await apiFetch('/api/mcp/jobs', {
        method: 'POST',
        body:   JSON.stringify({ threadId: thread_id, status: 'running' }),
      });

      apiFetch('/api/ai/wizard/execute', {
        method: 'POST',
        body:   JSON.stringify({ action: 'resume', threadId: thread_id, value }),
      }).catch((err: any) => {
        console.error('[mcp] background resume failed:', err?.message);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            thread_id,
            status:  'running',
            message: 'Images approved. Poll get_generation_status until status = "complete", then call get_video_preview.',
          }, null, 2),
        }],
      };
    }

    case 'regenerate_audio': {
      const { block_index, script, voice } = args;
      const result = await apiFetch('/api/ai/wizard/regenerate-audio', {
        method: 'POST',
        body:   JSON.stringify({ script, voice }),
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ block_index, new_audio_url: result.url }, null, 2),
        }],
      };
    }

    case 'approve_audio': {
      const { thread_id, updated_blocks } = args;
      const value: Record<string, any> = { approved: true };
      if (Array.isArray(updated_blocks) && updated_blocks.length > 0) {
        value.updatedBlocks = updated_blocks;
      }

      await apiFetch('/api/mcp/jobs', {
        method: 'POST',
        body:   JSON.stringify({ threadId: thread_id, status: 'running' }),
      });

      apiFetch('/api/ai/wizard/execute', {
        method: 'POST',
        body:   JSON.stringify({ action: 'resume', threadId: thread_id, value }),
      }).catch((err: any) => {
        console.error('[mcp] background resume failed:', err?.message);
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            thread_id,
            status:  'running',
            message: 'Audio approved. Poll get_generation_status until status = "complete", then call get_video_preview.',
          }, null, 2),
        }],
      };
    }

    case 'get_video_preview': {
      const { thread_id } = args;

      const job = await apiFetch(`/api/mcp/jobs/${encodeURIComponent(thread_id)}`);

      if (!job || job.status !== 'complete' || !job.payload) {
        return {
          content: [{
            type: 'text',
            text: `Video not ready yet. Status: ${job?.status ?? 'unknown'}. Keep polling get_generation_status.`,
          }],
        };
      }

      const payload    = job.payload;
      const previewUrl = payload.previewUrl ?? '';
      const blocks: any[] = payload.contentBlocks ?? [];

      const blockChips = blocks.map((b: any, i: number) => {
        const role = b.narrativeRole ?? b.role ?? `block_${i + 1}`;
        return `<span style="background:#1a1a2e;border:1px solid rgba(124,58,237,0.3);padding:4px 12px;border-radius:20px;font-size:12px;color:#c4b5fd">${i + 1} · ${role}</span>`;
      }).join('');

      const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0a0f; color: #f1f1f8; font-family: -apple-system, sans-serif; padding: 16px; }
  .btn { display: block; width: 100%; padding: 16px; background: linear-gradient(135deg,#7c3aed,#4f46e5); color: #fff; text-align: center; border-radius: 10px; font-size: 16px; font-weight: 600; text-decoration: none; }
  .btn:hover { opacity: 0.9; }
  .chips { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 8px; }
  .meta { margin-top: 10px; font-size: 12px; color: #6b6b8a; }
</style></head>
<body>
  ${previewUrl
    ? `<a href="${previewUrl}" target="_blank" class="btn">Open Live Preview in Editor →</a>`
    : `<div style="padding:16px;border-radius:10px;background:#111;color:#6b6b8a;font-size:14px">Preview not available</div>`
  }
  <div class="chips">${blockChips}</div>
  <div class="meta">Thread: ${thread_id} · ${blocks.length} blocks · Arc: ${payload.videoMeta?.selectedArc ?? 'custom'}</div>
</body>
</html>`;

      return {
        content: [{
          type:     'resource',
          resource: {
            uri:      `videogen://preview/${thread_id}`,
            mimeType: 'text/html',
            text:     html,
          },
        }],
      };
    }

    case 'list_content_blocks': {
      const data = await apiFetch('/api/plugins/content-blocks');
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(data, null, 2),
        }],
      };
    }

    case 'list_plugin_base_bundle': {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ...getBaseBundleInfo(),
            file_layout: getPluginDirLayoutInfo(),
          }, null, 2),
        }],
      };
    }

    case 'pack_plugin_dir': {
      const { path: dirPath, id, name: pluginName, description, category } = args;
      if (!dirPath) throw new McpError(ErrorCode.InvalidParams, 'path is required');
      const packed = packPluginDir(String(dirPath), {
        id,
        name: pluginName,
        description,
        category,
      });
      // Omit huge module bodies from default response summary? Agents need full propose_plugin_args.
      return {
        content: [{ type: 'text', text: JSON.stringify(packed, null, 2) }],
      };
    }

    case 'propose_plugin_preview': {
      const {
        id,
        name: pluginName,
        description,
        category,
        scene_code,
        modules,
        schema_json,
        dependencies,
      } = args;
      
      console.log(`[mcp-tool] propose_plugin_preview: id=${id}, name=${pluginName}`);

      const result = await apiFetch('/api/mcp/plugins/propose-preview', {
        method: 'POST',
        body: JSON.stringify({
          pluginId: id,
          name: pluginName,
          description,
          category,
          scene_code,
          modules,
          schema_json,
          dependencies,
        }),
      });

      if (result.error) {
        throw new McpError(ErrorCode.InternalError, result.error + (result.errors ? '\n' + result.errors.join('\n') : ''));
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            thread_id: result.threadId,
            preview_url: result.url,
            message: `Preview created successfully! Please tell the user to review it at ${result.url}. Once approved, call approve_plugin_preview with the thread_id.`,
          }, null, 2),
        }],
      };
    }

    case 'approve_plugin_preview': {
      const { thread_id } = args;
      console.log(`[mcp-tool] approve_plugin_preview: thread_id=${thread_id}`);

      const result = await apiFetch('/api/mcp/plugins/approve-preview', {
        method: 'POST',
        body: JSON.stringify({ threadId: thread_id }),
      });

      if (result.error) {
        throw new McpError(ErrorCode.InternalError, result.error + (result.errors ? '\n' + result.errors.join('\n') : ''));
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }

    case 'delete_plugin': {
      const { plugin_id } = args;
      const result = await apiFetch(`/api/plugins/${encodeURIComponent(plugin_id)}`, {
        method: 'DELETE',
      });
      if (result.error) {
        throw new McpError(ErrorCode.InternalError, result.error);
      }
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, deleted: plugin_id }, null, 2),
        }],
      };
    }

    case 'get_generation_state': {
      const { thread_id } = args;
      const state = await apiFetch(`/api/mcp/jobs/${encodeURIComponent(thread_id)}/state`);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(state, null, 2),
        }],
      };
    }

    case 'update_block_image': {
      const { thread_id, block_index, description, field_path, remove_background = false, visual_style_guide = '' } = args;

      const result = await apiFetch('/api/ai/wizard/regenerate-image', {
        method: 'POST',
        body: JSON.stringify({
          description:      `${visual_style_guide ? visual_style_guide + '. ' : ''}${description}`,
          removeBackground: remove_background,
        }),
      });

      await apiFetch(`/api/mcp/jobs/${encodeURIComponent(thread_id)}/state`, {
        method: 'PATCH',
        body: JSON.stringify({
          blockIndex: block_index,
          field:      field_path ?? 'imageUrl',
          value:      result.url,
        }),
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ block_index, field_path: field_path ?? 'imageUrl', new_image_url: result.url }, null, 2),
        }],
      };
    }

    case 'update_block_audio': {
      const { thread_id, block_index, script, voice } = args;

      const result = await apiFetch('/api/ai/wizard/regenerate-audio', {
        method: 'POST',
        body: JSON.stringify({ script, voice }),
      });

      await apiFetch(`/api/mcp/jobs/${encodeURIComponent(thread_id)}/state`, {
        method: 'PATCH',
        body: JSON.stringify({
          blockIndex: block_index,
          field:      'audioSrc',
          value:      result.url,
        }),
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ block_index, new_audio_url: result.url }, null, 2),
        }],
      };
    }

    case 'assemble_video': {
      const { thread_id } = args;
      const result = await apiFetch('/api/ai/wizard/assemble', {
        method: 'POST',
        body: JSON.stringify({ threadId: thread_id }),
      });
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ preview_url: result.previewUrl, video_id: result.videoId }, null, 2),
        }],
      };
    }

    case 'patch_generation_state': {
      const { thread_id, path, value } = args;
      await apiFetch(`/api/mcp/jobs/${encodeURIComponent(thread_id)}/state`, {
        method: 'PATCH',
        body: JSON.stringify({ path, value }),
      });
      return {
        content: [{ type: 'text', text: JSON.stringify({ ok: true, patched: path }, null, 2) }],
      };
    }

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
}
