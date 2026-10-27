import { requireAuthenticatedSession } from '@/lib/api-security';
import { TOOL_DEFINITIONS, handleToolCall } from '@/lib/mcp/tools';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';

export const maxDuration = 300;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, MCP-Protocol-Version',
};

function jsonRpc(result: unknown, id: unknown) {
  return Response.json({ jsonrpc: '2.0', result, id }, { headers: CORS_HEADERS });
}

function jsonRpcError(code: number, message: string, id: unknown) {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id },
    { status: 200, headers: CORS_HEADERS },
  );
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET() {
  return new Response('SSE not supported, please use POST for stateless MCP', { 
    status: 405, 
    headers: CORS_HEADERS 
  });
}

export async function POST(request: Request) {

  // Build apiFetch scoped to this request's auth + origin
  const incomingAuth = request.headers.get('authorization') ?? '';
  const origin       = new URL(request.url).origin;

  const apiFetch = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${origin}${path}`, {
      ...init,
      headers: {
        'Authorization': incomingAuth,
        'Content-Type':  'application/json',
        ...(init?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      const body = contentType.includes('application/json')
        ? await res.json().catch(() => null)
        : await res.text().catch(() => res.statusText);
      const detail = typeof body === 'string'
        ? body
        : JSON.stringify(body ?? { error: res.statusText }, null, 2);
      throw new McpError(ErrorCode.InternalError, `API error ${res.status}: ${detail}`);
    }
    return res.json();
  };

  let body: any;
  try {
    body = await request.json();
  } catch {
    return jsonRpcError(-32700, 'Parse error', null);
  }

  const { jsonrpc, method, params, id } = body;

  if (jsonrpc !== '2.0') {
    return jsonRpcError(-32600, 'Invalid Request', id ?? null);
  }

  // Handle MCP protocol methods
  switch (method) {

    case 'initialize':
      return jsonRpc({
        protocolVersion: params?.protocolVersion ?? '2024-11-05',
        capabilities:    { tools: {} },
        serverInfo:      { name: 'videogen', version: '1.0.0' },
      }, id);

    case 'notifications/initialized':
      return new Response(null, { status: 202, headers: CORS_HEADERS });

    case 'ping':
      return jsonRpc({}, id);

    case 'tools/list':
      return jsonRpc({ tools: TOOL_DEFINITIONS }, id);

    case 'tools/call': {
      // Auth is required ONLY for calling tools
      const authResult = await requireAuthenticatedSession();
      if ('response' in authResult) {
        return jsonRpcError(-32000, 'Unauthorized - Authentication required', id);
      }
      const toolName = params?.name as string | undefined;
      const toolArgs = params?.arguments ?? {};

      if (!toolName) {
        return jsonRpcError(-32602, 'Missing tool name', id);
      }

      try {
        const result = await handleToolCall(toolName, toolArgs, apiFetch);
        return jsonRpc(result, id);
      } catch (err: any) {
        if (err instanceof McpError) {
          return jsonRpcError(err.code, err.message, id);
        }
        return jsonRpcError(-32603, err?.message ?? 'Internal error', id);
      }
    }

    default:
      return jsonRpcError(-32601, `Method not found: ${method}`, id);
  }
}
