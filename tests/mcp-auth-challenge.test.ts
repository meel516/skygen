import { beforeEach, expect, mock, test } from 'bun:test';

let authStatus = 401;
const callTool = mock(async () => ({ content: [{ type: 'text', text: 'ok' }] }));
mock.module('@/lib/api-security', () => ({
  requireAuthenticatedSession: async () => authStatus === 200
    ? { session: { user: { id: 'reviewer-test' } } }
    : { response: Response.json({ error: 'Authentication required' }, { status: authStatus }) },
}));
mock.module('@/lib/mcp/tools', () => ({ TOOL_DEFINITIONS: [], handleToolCall: callTool }));
const { POST } = await import('../src/app/api/mcp/route');
const metadata = await import('../src/app/.well-known/oauth-protected-resource/api/mcp/route');

beforeEach(() => { authStatus = 401; callTool.mockClear(); });
const request = (method = 'tools/call', token?: string) => new Request('https://skygen.salru.in/api/mcp', {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify({ jsonrpc: '2.0', id: 7, method, params: { name: 'list_plugins', arguments: {} } }),
});

for (const token of [undefined, 'invalid-token']) {
  test(`unauthorized call returns OAuth challenge (${token ?? 'missing token'})`, async () => {
    const response = await POST(request('tools/call', token));
    expect(response.status).toBe(401);
    expect(response.headers.get('WWW-Authenticate')).toBe('Bearer resource_metadata="https://skygen.salru.in/.well-known/oauth-protected-resource", scope="generate"');
    expect(response.headers.get('Access-Control-Expose-Headers')).toContain('WWW-Authenticate');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(callTool).not.toHaveBeenCalled();
  });
}
test('authenticated tool calls retain their JSON-RPC result', async () => {
  authStatus = 200;
  const response = await POST(request());
  expect(response.status).toBe(200);
  expect(response.headers.get('WWW-Authenticate')).toBeNull();
  expect((await response.json()).result.content[0].text).toBe('ok');
  expect(callTool).toHaveBeenCalledTimes(1);
});
test('permission denial stays HTTP 403 without a login challenge', async () => {
  authStatus = 403;
  const response = await POST(request());
  expect(response.status).toBe(403);
  expect(response.headers.get('WWW-Authenticate')).toBeNull();
  expect(callTool).not.toHaveBeenCalled();
});
test('public initialization stays accessible', async () => {
  const response = await POST(request('initialize'));
  expect(response.status).toBe(200);
  expect((await response.json()).result.serverInfo.name).toBe('videogen');
});
test('resource-path metadata identifies the same MCP resource and issuer', async () => {
  const response = await metadata.GET();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ resource: 'https://skygen.salru.in/api/mcp', authorization_servers: ['https://skygen.salru.in'] });
});
