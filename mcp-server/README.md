# VideoGen MCP Server (LangGraph)

LangGraph template + plugin video generation for Claude Code, Antigravity, and other MCP clients.

**Not included:** Mastra chat tools (`wizard_send_message` / chat UI agent). This server is the template pipeline only.

## Setup

```bash
cd mcp-server
npm install
```

### 1. Generate an API key
Go to your VideoGen account page → **API Keys** → Generate Key. Copy the `sk-vg-...` key.

Also save your **xAI / DeepSeek** (and TTS) keys in the account UI so LangGraph can load them from the DB for MCP (no browser cookies).

### 2. Add to MCP client config

**HTTP (recommended — Antigravity / remote):**
```json
{
  "mcpServers": {
    "skygen": {
      "serverUrl": "https://skygen.salru.in/api/mcp",
      "headers": {
        "Authorization": "Bearer sk-vg-your-key-here"
      }
    }
  }
}
```

**stdio (local):**
```json
{
  "mcpServers": {
    "videogen": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/mcp-server/index.ts"],
      "env": {
        "VIDEOGEN_BASE_URL": "https://skygen.salru.in",
        "VIDEOGEN_API_KEY": "sk-vg-your-key-here"
      }
    }
  }
}
```

## Typical workflows

### A) Use an existing template
```
list_templates → start_video_generation(user_story, template_id)
→ poll get_generation_status → approve_* as needed → get_video_preview
```

### B) Build a custom template (plugins + built-in blocks)
```
list_content_blocks + list_plugins
→ propose_plugin_preview (optional custom Remotion scene)
→ create_template({ name, blocks: [ built-ins..., { type: "custom-plugin", pluginId, pluginData } ] })
→ start_video_generation({ user_story, template_id })
```

### C) One-shot ad-hoc blocks (no saved template)
```
start_video_generation({
  user_story: "...",
  blocks: [
    { type: "motivational-image" },
    { type: "stat" },
    { type: "custom-plugin", pluginId: "odysseus-review-score", pluginData: {} }
  ]
})
```

## Available Tools

### Catalog
| Tool | What it does |
|---|---|
| `list_arcs` | Story arc presets |
| `list_visual_styles` | Visual style options |
| `list_voices` | TTS voices |
| `list_content_blocks` | Built-in Remotion block types |
| `list_plugins` | Core + installed custom plugins |
| `get_plugin` | Plugin schema + defaults |

### Templates
| Tool | What it does |
|---|---|
| `list_templates` | Your + public templates |
| `get_template` | Full template + blocks |
| `create_template` | Save blocks (built-in + plugins) as a template |
| `update_template` | Edit name/blocks on a template you own |
| `delete_template` | Delete a template you own |

### Plugins — file-first (recommended)

MCP clients are best at **real files**. Author on disk, pack to JSON only at the API edge.

```
my-plugin/
  Scene.tsx          # required entry
  schema.json        # properties + defaults
  package.json       # dependencies (any npm package)
  plugin.json        # optional id, name, description, category
  components/Foo.tsx # multi-file OK
```

Template: `mcp-server/plugin-template/`

| Tool | What it does |
|---|---|
| `list_plugin_base_bundle` | Host kit + file layout + workflow |
| `pack_plugin_dir` | Folder → modules/schema/deps JSON |
| `validate_plugin_dir` | Pack + local npm install + esbuild |
| `propose_plugin_preview` | Propose a plugin for live preview |
| `approve_plugin_preview` | Finalize a proposed plugin |
| `delete_plugin` | Remove custom plugin |

**Preferred workflow (stdio MCP on your machine):**
```
1. Copy mcp-server/plugin-template → ./my-plugin
2. Edit real files
3. propose_plugin_preview({ path: "./my-plugin" })

Or on HTTP MCP (no disk access):
1. node mcp-server/scripts/pack-plugin.mjs ./my-plugin
# then propose_plugin_preview with propose_plugin_args from packed.json
```

Local sandbox: npm install any `package.json` deps + esbuild (no Vercel; chat/Mastra untouched).

### LangGraph generation
| Tool | What it does |
|---|---|
| `start_video_generation` | Start job (`template_id` **or** ad-hoc `blocks`) |
| `get_generation_status` | Poll job status |
| `approve_story` | Approve scripts → images |
| `approve_images` | Approve visuals → audio |
| `approve_audio` | Approve audio → assemble |
| `regenerate_image` | Regen image URL |
| `regenerate_audio` | Regen audio URL |
| `get_video_preview` | Final preview link |
| `get_generation_state` | Full editable state |
| `update_block_image` | Regen + persist image |
| `update_block_audio` | Regen + persist audio |
| `assemble_video` | Rebuild final video |
| `patch_generation_state` | Dot-path patch any state field |
