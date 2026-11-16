import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { NextRequest, NextResponse } from 'next/server';
import { updateDraftSettings } from '../src/lib/plugins/draft-settings';

const schemaJson = JSON.stringify({
  properties: {
    title: { type: 'string', default: 'Hello' },
    color: { type: 'string', default: '#ff0000' },
    size: { type: 'number', minimum: 10, maximum: 100 },
    count: { type: 'integer' },
    alignment: { type: 'string', enum: ['left', 'right'] },
  },
  defaults: { title: 'Existing title', size: 20 },
});
let user: any;
let pending: any;
let conflict = false;
const build = mock(async () => { throw new Error('Settings must not trigger a build'); });
const query = mock(async (_sql: string, args: any[]) => {
  if (conflict) return { rows: [] };
  pending = { ...pending, schemaJson: JSON.parse(args[1]), sourceHash: JSON.parse(args[3]) };
  return { rows: [{ pending }] };
});
mock.module('@/lib/api-security', () => ({
  requireAuthenticatedSession: async () => user
    ? { session: { user } }
    : { response: NextResponse.json({ error: 'Authentication required' }, { status: 401 }) },
}));
mock.module('@/lib/db', () => ({ db: { query } }));
mock.module('@/lib/mcp/wizard-jobs', () => ({
  getJob: async () => ({ user_id: 'owner', state: { pendingPlugin: structuredClone(pending) } }),
  patchJobState: async () => { throw new Error('Settings must use a conditional update'); },
}));
mock.module('@/lib/plugins/preview-bundler', () => ({ bundlePreview: build }));
const { POST } = await import('../src/app/api/ai/wizard/plugin-sandbox/route');
const { useWizardChatStore } = await import('../src/store/wizard-chat-store');
const originalFetch = globalThis.fetch;
afterAll(() => { globalThis.fetch = originalFetch; });

beforeEach(() => {
  user = { id: 'owner', role: 'USER' };
  conflict = false;
  pending = { pluginId: 'draft', schemaJson, sceneCode: 'original source', modules: { 'Scene.tsx': 'original source', 'theme.ts': 'original theme' }, dependencies: {} };
  query.mockClear();
  build.mockClear();
  useWizardChatStore.setState({ isStreaming: false, flushPluginSettings: null, messages: [], error: null });
});

function request(overrides = {}) {
  return POST(new NextRequest('http://localhost/api/ai/wizard/plugin-sandbox', {
    method: 'POST', body: JSON.stringify({ action: 'update-settings', threadId: 'thread', pluginId: 'draft', expectedSchemaJson: schemaJson, changes: { title: 'Welcome' }, ...overrides }),
  }));
}

test('settings keep field definitions and untouched property defaults', () => {
  const result = JSON.parse(updateDraftSettings(schemaJson, { title: 'Welcome' }));
  expect(result.defaults).toEqual({ title: 'Welcome', color: '#ff0000', size: 20 });
  expect(result.properties).toEqual(JSON.parse(schemaJson).properties);
});

test('invalid types, ranges, enums and unknown fields are rejected', () => {
  for (const change of [{ size: 'large' }, { size: 101 }, { count: 1.5 }, { alignment: 'middle' }, { missing: true }, JSON.parse('{"__proto__":{}}')]) {
    expect(() => updateDraftSettings(schemaJson, change)).toThrow();
  }
});

test('nested arrays validate their item fields', () => {
  const nestedSchema = JSON.stringify({ properties: { items: { type: 'array', maxItems: 2, items: {
    type: 'object', properties: { label: { type: 'string' }, value: { type: 'number', minimum: 0 } },
  } } } });
  const items = [{ label: 'One', value: 1 }];
  expect(JSON.parse(updateDraftSettings(nestedSchema, { items })).defaults.items).toEqual(items);
  expect(() => updateDraftSettings(nestedSchema, { items: [{ label: 'One', value: -1 }] })).toThrow();
});

test('applying values preserves source/modules and does not build', async () => {
  const response = await request();
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(JSON.parse(result.pending.schemaJson).defaults.title).toBe('Welcome');
  expect(result.pending.modules['theme.ts']).toBe('original theme');
  expect(result.pending.sceneCode).toBe('original source');
  expect(result.pending.sourceHash).toHaveLength(16);
  expect(build).not.toHaveBeenCalled();
});

test('MCP preview settings still require authentication, including whitespace actions', async () => {
  user = null;
  const response = await request({ threadId: 'mcp_preview_example', action: ' update-settings ' });
  expect(response.status).toBe(401);
  expect(query).not.toHaveBeenCalled();
});

test('other users cannot edit settings', async () => {
  user.id = 'other';
  expect((await request({ threadId: 'mcp_preview_example' })).status).toBe(403);
  expect(query).not.toHaveBeenCalled();
});

test('stale schema and concurrent draft writes are rejected', async () => {
  expect((await request({ expectedSchemaJson: '{}' })).status).toBe(409);
  expect(query).not.toHaveBeenCalled();
  conflict = true;
  expect((await request()).status).toBe(409);
  expect(pending.schemaJson).toBe(schemaJson);
});

test('chat applies settings before starting a request', async () => {
  const events: string[] = [];
  useWizardChatStore.setState({ flushPluginSettings: async () => { events.push('settings applied'); } });
  globalThis.fetch = mock(async () => {
    events.push('chat requested');
    return Response.json({ error: 'End mocked chat here' }, { status: 400 });
  }) as any;
  await useWizardChatStore.getState().sendMessage('Change the background');
  expect(events).toEqual(['settings applied', 'chat requested']);
});

test('chat does not start if settings could not be applied', async () => {
  const fetchMock = mock(async () => { throw new Error('Unexpected request'); });
  globalThis.fetch = fetchMock as any;
  useWizardChatStore.setState({ flushPluginSettings: async () => { throw new Error('Draft changed'); } });
  await useWizardChatStore.getState().sendMessage('Save it');
  expect(fetchMock).not.toHaveBeenCalled();
  expect(useWizardChatStore.getState().error).toBe('Draft changed');
});
