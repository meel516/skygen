#!/usr/bin/env node
/**
 * VideoGen MCP Server (stdio transport — for local Claude Desktop / Claude Code)
 *
 * For remote/public access, the HTTP MCP endpoint is at /api/mcp on the Next.js app.
 *
 * Setup:
 *   1. Generate an API key at your VideoGen account page
 *   2. Add to .mcp.json or claude_desktop_config.json:
 *      {
 *        "mcpServers": {
 *          "videogen": {
 *            "command": "npx",
 *            "args": ["tsx", "mcp-server/index.ts"],
 *            "env": {
 *              "VIDEOGEN_BASE_URL": "http://localhost:3000",
 *              "VIDEOGEN_API_KEY": "sk-vg-..."
 *            }
 *          }
 *        }
 *      }
 *
 *   For remote HTTP access (any MCP client, no subprocess needed):
 *      {
 *        "mcpServers": {
 *          "videogen": {
 *            "type": "http",
 *            "url": "https://your-site.com/api/mcp",
 *            "headers": { "Authorization": "Bearer sk-vg-..." }
 *          }
 *        }
 *      }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_DEFINITIONS, handleToolCall } from '../src/lib/mcp/tools.js';

// ============================================================================
// Config
// ============================================================================

const BASE_URL = process.env.VIDEOGEN_BASE_URL ?? 'http://localhost:3000';
const API_KEY  = process.env.VIDEOGEN_API_KEY  ?? '';

if (!API_KEY) {
  console.error('[videogen-mcp] ERROR: VIDEOGEN_API_KEY env var is required');
  process.exit(1);
}

function authHeaders() {
  return {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type':  'application/json',
  };
}

async function apiFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new McpError(ErrorCode.InternalError, `VideoGen API error ${res.status}: ${text}`);
  }
  return res.json();
}

// ============================================================================
// MCP Server
// ============================================================================

const server = new Server(
  { name: 'videogen', version: '1.0.0' },
  { capabilities: { tools: {}, resources: {} } }
);

// ============================================================================
// Tool Definitions & Handlers (shared with HTTP route)
// ============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, args ?? {}, apiFetch);
});

// ============================================================================
// Resource Handler
// ============================================================================

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));
server.setRequestHandler(ReadResourceRequestSchema, async () => ({
  contents: [{ uri: '', mimeType: 'text/plain', text: '' }],
}));

// ============================================================================
// Start
// ============================================================================

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`[videogen-mcp] Server running (stdio). BASE_URL=${BASE_URL}`);
