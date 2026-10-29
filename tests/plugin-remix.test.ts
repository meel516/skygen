import { afterAll, beforeEach, describe, expect, mock, test } from 'bun:test';

// Exercise real remix preparation, agent tools, and client state without live
// Postgres, S3, model calls, or sandbox builds.
let job: any;
let plugin: any;
const originalFetch = globalThis.fetch;
const fetchMock = mock(async (_url: any, _init?: any): Promise<Response> => Response.json(source));
let source: any;
let skipStateWrites = false;
const previewMock = mock(async (..._args: any[]): Promise<any> => { throw new Error('Unexpected preview build'); });

mock.module('@/lib/db', () => ({ db: { query: async () => ({ rows: plugin ? [plugin] : [] }) } }));
mock.module('@/lib/mcp/wizard-jobs', () => ({
  getJob: async () => structuredClone(job),
  patchJobState: async (_id: string, update: (state: any) => any) => {
    if (skipStateWrites) return;
    job.state = update(structuredClone(job.state ?? {}));
  },
}));
mock.module('@/lib/s3', () => ({ getSignedS3Url: async (key: string) => `https://example.test/${key}` }));
mock.module('@/lib/plugins/create-plugin', () => ({ createPluginFromSource: async () => { throw new Error('Unexpected build'); } }));
mock.module('@/lib/plugins/preview-bundler', () => ({ bundlePreview: previewMock }));

const { preparePluginRemix, remixAgentContext } = await import('../src/lib/plugins/remix-session');
const { loadForkedPluginSourceTool } = await import('../src/lib/video/ai/mastra/tools/load-forked-plugin-source');
const { setInitialSceneTool, recordPluginPlanTool, editSceneCodeTool, readSceneCodeTool, readModuleTool, compilePreviewTool, savePendingPluginTool } = await import('../src/lib/video/ai/mastra/tools/plugin-creator-tools');
const { sourceMapTools } = await import('../src/lib/video/ai/mastra/tools/source-map-tools');
const { useWizardChatStore } = await import('../src/store/wizard-chat-store');

const execute = (tool: any, input: any) => tool.execute(input, {});
const remixId = 'original-remix-abc123';
const scene = `import React from 'react';
import { color } from './theme';
export default function Scene() {
  return <div style={{ background: color }}>Existing animation</div>;
}`;

beforeEach(() => {
  skipStateWrites = false;
  previewMock.mockReset();
  previewMock.mockImplementation(async () => { throw new Error('Unexpected preview build'); });
  job = { thread_id: 'thread-1', user_id: 'user-1', state: {} };
  plugin = { name: 'Copy of Original', description: 'An animated title', user_id: 'user-1', schema_json: { properties: { title: { type: 'string' } }, defaults: { title: 'Existing title' } } };
  source = { sceneCode: scene, modules: { 'Scene.tsx': scene, 'theme.ts': "export const color = 'red';" }, dependencies: { remotion: '4.0.529' } };
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => Response.json(source));
  globalThis.fetch = fetchMock as any;
  useWizardChatStore.getState().reset();
});
afterAll(() => { globalThis.fetch = originalFetch; });

describe('single-file edit persistence', () => {
  const redScene = [
    "import React from 'react';", ...Array(99).fill(''),
    'export default function Scene() {',
    "  return <div style={{background:'#0b0003'}}>Existing animation</div>;",
    '}',
  ].join('\n');
  const blueScene = redScene.replace('#0b0003', '#00060b');

  async function loadSingleFile() {
    source = { sceneCode: redScene, modules: { 'Scene.tsx': redScene }, dependencies: {} };
    await preparePluginRemix('thread-1', 'user-1', remixId);
    return execute(sourceMapTools.getSourceMap, { threadId: 'thread-1', refresh: true });
  }

  async function editColor(method: string) {
    return method === 'editLines'
      ? execute(sourceMapTools.editLines, { threadId: 'thread-1', file: 'Scene.tsx', startLine: 102, endLine: 102, newLines: [blueScene.split('\n')[101]] })
      : execute(editSceneCodeTool, { threadId: 'thread-1', oldString: '#0b0003', newString: '#00060b' });
  }

  for (const method of ['editLines', 'editSceneCode']) {
    test(`${method} persists the same edited source for readers, fingerprints, preview, and follow-ups`, async () => {
      const before = await loadSingleFile();
      expect((await editColor(method)).ok).toBe(true);
      expect(job.state.pendingPlugin.sceneCode).toBe(blueScene);
      expect(job.state.pendingPlugin.modules['Scene.tsx']).toBe(blueScene);
      expect((await execute(readSceneCodeTool, { threadId: 'thread-1' })).sceneCode).toBe(blueScene);
      expect((await execute(readModuleTool, { threadId: 'thread-1', filePath: 'Scene.tsx' })).code).toBe(blueScene);
      const lines = await execute(sourceMapTools.readLines, { threadId: 'thread-1', file: 'Scene.tsx', startLine: 102, endLine: 102, context: 0 });
      expect(lines.lines[0].text).toBe(blueScene.split('\n')[101]);
      const after = await execute(sourceMapTools.getSourceMap, { threadId: 'thread-1', refresh: true });
      expect(after.sourceMap.overallHash).not.toBe(before.sourceMap.overallHash);
      expect(after.sourceMap.files[0].hash).not.toBe(before.sourceMap.files[0].hash);

      previewMock.mockImplementation(async () => ({ ok: true, bundleJs: 'compiled preview' }));
      expect((await execute(compilePreviewTool, { threadId: 'thread-1' })).ok).toBe(true);
      expect(previewMock.mock.calls[0][0]).toBe(blueScene);
      expect(previewMock.mock.calls[0][2].modules['Scene.tsx']).toBe(blueScene);
      const emit = mock(async (_event: any) => {});
      expect((await savePendingPluginTool.execute!({ threadId: 'thread-1' }, { writer: { custom: emit } } as any) as any).ok).toBe(true);
      expect(emit.mock.calls[0][0].data.pendingPlugin.modules['Scene.tsx']).toBe(blueScene);
      const reopened = await preparePluginRemix('thread-1', 'user-1');
      expect(reopened.sceneCode).toBe(blueScene);
      expect(reopened.modules['Scene.tsx']).toBe(blueScene);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    test(`${method} does not report success if the state write does not persist`, async () => {
      await loadSingleFile();
      skipStateWrites = true;
      expect((await editColor(method)).ok).toBe(false);
      expect(job.state.pendingPlugin.modules['Scene.tsx']).toBe(redScene);
    });

    test(`${method} repairs the source mismatch left by an earlier failed edit`, async () => {
      await loadSingleFile();
      job.state.pendingPlugin.sceneCode = blueScene;
      expect((await execute(readModuleTool, { threadId: 'thread-1', filePath: 'Scene.tsx' })).code).toBe(redScene);
      expect((await editColor(method)).ok).toBe(true);
      expect(job.state.pendingPlugin.sceneCode).toBe(blueScene);
      expect(job.state.pendingPlugin.modules['Scene.tsx']).toBe(blueScene);
    });

    test(`${method} also works for a new single-file plugin without a modules map`, async () => {
      expect((await execute(setInitialSceneTool, {
        threadId: 'thread-1', pluginId: 'new-single', pluginName: 'New single', description: '',
        schemaJson: JSON.stringify(plugin.schema_json), sceneCode: redScene,
      })).ok).toBe(true);
      expect((await editColor(method)).ok).toBe(true);
      expect((await execute(readSceneCodeTool, { threadId: 'thread-1' })).sceneCode).toBe(blueScene);
      expect((await execute(readModuleTool, { threadId: 'thread-1', filePath: 'Scene.tsx' })).code).toBe(blueScene);
    });
  }

  test('deleteLines updates the singleton module as well as sceneCode', async () => {
    await loadSingleFile();
    expect((await execute(sourceMapTools.deleteLines, { threadId: 'thread-1', file: 'Scene.tsx', startLine: 2, endLine: 2 })).ok).toBe(true);
    const expected = redScene.split('\n').filter((_, index) => index !== 1).join('\n');
    expect((await execute(readSceneCodeTool, { threadId: 'thread-1' })).sceneCode).toBe(expected);
    expect(job.state.pendingPlugin.sceneCode).toBe(expected);
  });

  test('previewEdit checks the edited singleton module without mutating the draft', async () => {
    await loadSingleFile();
    const before = structuredClone(job.state);
    const preview = await execute(sourceMapTools.previewEdit, {
      threadId: 'thread-1', file: 'Scene.tsx', startLine: 1, endLine: 1,
      newLines: ["import React from 'react';", "import {missing} from './missing';"],
    });
    expect(preview.ok).toBe(true);
    expect(preview.wouldPassValidation).toBe(false);
    expect(preview.guard.importIssues.length).toBeGreaterThan(0);
    expect(job.state).toEqual(before);
  });
});

describe('server remix preparation', () => {
  test('loads the exact legacy 64-character ID without guessing or trimming its trailing hyphen', async () => {
    const legacyId = 'bloodline-v4-responsive-kinetic-typographyv4-remix-9bcf8a-remix-';
    plugin.schema_json = JSON.stringify({ type: 'object', properties: {}, defaults: { durationSec: 210 } });
    source.modules = { 'Scene.tsx': source.sceneCode };
    const pending = await preparePluginRemix('thread-1', 'user-1', legacyId);
    expect(pending.pluginId).toBe(legacyId);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://example.test/plugins/${legacyId}/source.json`);
    expect(pending.runLedger.baseline.files).toEqual(['Scene.tsx']);
    expect(job.state.pluginRemix.pluginId).toBe(legacyId);
  });

  test('loads the exact saved copy, including modules, schema, dependencies, and a baseline', async () => {
    const pending = await preparePluginRemix('thread-1', 'user-1', remixId);
    expect(pending.pluginId).toBe(remixId);
    expect(pending.modules).toEqual(source.modules);
    expect(pending.sceneCode).toBe(scene);
    expect(pending.dependencies).toEqual(source.dependencies);
    expect(JSON.parse(pending.schemaJson)).toEqual(plugin.schema_json);
    expect(pending.runLedger.baseline.files).toEqual(['Scene.tsx', 'theme.ts']);
    expect(job.state.pluginRemix).toEqual({ pluginId: remixId });
    expect(remixAgentContext(pending)).toContain('"mode":"modify"');
  });

  test('follow-up requests without the ID preserve all current edits', async () => {
    await preparePluginRemix('thread-1', 'user-1', remixId);
    job.state.pendingPlugin.modules['theme.ts'] = "export const color = 'blue';";
    job.state.pendingPlugin.previewSourceHash = 'draft-preview';
    const current = structuredClone(job.state.pendingPlugin);
    const pending = await preparePluginRemix('thread-1', 'user-1');
    expect(pending).toEqual(current);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('reopens the latest saved copy after approval cleared the pending draft', async () => {
    await preparePluginRemix('thread-1', 'user-1', remixId);
    delete job.state.pendingPlugin;
    source.modules['theme.ts'] = "export const color = 'green';";
    const pending = await preparePluginRemix('thread-1', 'user-1');
    expect(pending.modules['theme.ts']).toContain('green');
    expect(pending.pluginId).toBe(remixId);
  });

  test('ordinary chats do not fetch or initialize plugin source', async () => {
    expect(await preparePluginRemix('thread-1', 'user-1')).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
    expect(job.state).toEqual({});
  });

  test('fails closed when stored source is missing', async () => {
    fetchMock.mockImplementation(async () => new Response('', { status: 404 }));
    await expect(preparePluginRemix('thread-1', 'user-1', remixId)).rejects.toThrow('No new code was generated');
    expect(job.state).toEqual({});
  });

  test('rejects malformed source instead of starting an empty draft', async () => {
    source = { modules: {}, sceneCode: '' };
    await expect(preparePluginRemix('thread-1', 'user-1', remixId)).rejects.toThrow('No new code was generated');
    expect(job.state).toEqual({});
  });

  test('does not overwrite another draft or switch a bound remix', async () => {
    job.state.pendingPlugin = { pluginId: 'other-draft', sceneCode: 'keep me' };
    await expect(preparePluginRemix('thread-1', 'user-1', remixId)).rejects.toThrow('different plugin draft');
    expect(job.state.pendingPlugin.sceneCode).toBe('keep me');
    job.state = { pluginRemix: { pluginId: remixId } };
    await expect(preparePluginRemix('thread-1', 'user-1', 'different-remix')).rejects.toThrow('another remix');
  });

  test('requires both thread ownership and a user-owned remix copy', async () => {
    await expect(preparePluginRemix('thread-1', 'someone-else', remixId)).rejects.toThrow('not owned');
    plugin.user_id = 'someone-else';
    await expect(preparePluginRemix('thread-1', 'user-1', remixId)).rejects.toThrow('own copy');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(job.state).toEqual({});
  });
});

describe('agent safeguards', () => {
  test('fresh plugin initialization still works in a new chat', async () => {
    const result = await execute(setInitialSceneTool, {
      threadId: 'thread-1', pluginId: 'new-plugin', pluginName: 'New Plugin', description: '',
      schemaJson: JSON.stringify(plugin.schema_json), modules: source.modules, dependencies: source.dependencies,
    });
    expect(result.ok).toBe(true);
    expect(job.state.pendingPlugin.pluginId).toBe('new-plugin');
  });

  test('a targeted edit keeps the original scene, schema, and other modules intact', async () => {
    await preparePluginRemix('thread-1', 'user-1', remixId);
    const schemaJson = job.state.pendingPlugin.schemaJson;
    await execute(sourceMapTools.getSourceMap, { threadId: 'thread-1', refresh: true });
    const result = await execute(sourceMapTools.editLines, {
      threadId: 'thread-1', file: 'theme.ts', startLine: 1, endLine: 1,
      newLines: ["export const color = 'blue';"],
    });
    expect(result.ok).toBe(true);
    expect(job.state.pendingPlugin.modules['theme.ts']).toContain('blue');
    expect(job.state.pendingPlugin.modules['Scene.tsx']).toBe(scene);
    expect(job.state.pendingPlugin.schemaJson).toBe(schemaJson);
    await preparePluginRemix('thread-1', 'user-1');
    expect(job.state.pendingPlugin.modules['theme.ts']).toContain('blue');
  });

  test('repeated source-loader calls preserve a modified draft and reject a new ID', async () => {
    await preparePluginRemix('thread-1', 'user-1', remixId);
    job.state.pendingPlugin.sceneCode = 'edited code';
    const args = { threadId: 'thread-1', pluginId: remixId, forkPluginId: remixId };
    expect((await execute(loadForkedPluginSourceTool, args)).ok).toBe(true);
    expect(job.state.pendingPlugin.sceneCode).toBe('edited code');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((await execute(loadForkedPluginSourceTool, { ...args, pluginId: 'brand-new' })).ok).toBe(false);
  });

  test('initialization cannot replace a remix, even after its draft was cleared', async () => {
    await preparePluginRemix('thread-1', 'user-1', remixId);
    const previous = structuredClone(job.state);
    const args = { threadId: 'thread-1', pluginId: 'brand-new', pluginName: 'Replacement', description: '', schemaJson: JSON.stringify(plugin.schema_json), sceneCode: 'replacement' };
    expect((await execute(setInitialSceneTool, args)).ok).toBe(false);
    expect(job.state).toEqual(previous);
    delete job.state.pendingPlugin;
    expect((await execute(setInitialSceneTool, args)).ok).toBe(false);
    expect(job.state.pendingPlugin).toBeUndefined();
  });

  test('planning requires source recon, enforces the remix ID, and forces modify mode', async () => {
    await preparePluginRemix('thread-1', 'user-1', remixId);
    const plan = {
      threadId: 'thread-1', pluginId: remixId, mode: 'create',
      frozenContracts: { schemaPaths: ['title'], files: ['Scene.tsx', 'theme.ts'], dependencies: source.dependencies, generationFields: [] },
      steps: [{ id: 'color', title: 'Change color', category: 'core_remotion_logic', owner: 'remotion_coder', goal: 'Change red to blue', files: ['theme.ts'] }],
    };
    expect((await execute(recordPluginPlanTool, { ...plan, pluginId: 'new-plugin' })).ok).toBe(false);
    expect((await execute(recordPluginPlanTool, plan)).requiredAction).toBe('getSourceMap');
    await execute(sourceMapTools.getSourceMap, { threadId: 'thread-1', refresh: true });
    const result = await execute(recordPluginPlanTool, plan);
    expect(result.ok).toBe(true);
    expect(job.state.pluginExecution.mode).toBe('modify');
    expect(job.state.pendingPlugin.sceneCode).toBe(scene);
  });
});

describe('client remix identity', () => {
  test('sends the remix ID independently of the edited prompt and displays server errors', async () => {
    useWizardChatStore.getState().setForkPluginId(remixId);
    fetchMock.mockImplementation(async () => Response.json({ error: 'The remix source could not be loaded.' }, { status: 400 }));
    await useWizardChatStore.getState().sendMessage('Only make the title blue');
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.forkPluginId).toBe(remixId);
    expect(body.messages.at(-1).content).toBe('Only make the title blue');
    expect(useWizardChatStore.getState().error).toBe('The remix source could not be loaded.');
    useWizardChatStore.getState().reset();
    expect(useWizardChatStore.getState().forkPluginId).toBeNull();
  });

  test('restores the binding when a saved chat is opened', async () => {
    fetchMock.mockImplementation(async (url: any) => String(url).includes('/threads/')
      ? Response.json({ messages: [] })
      : Response.json({ state: { pluginRemix: { pluginId: remixId } } }));
    await useWizardChatStore.getState().hydrateFromThread('thread-1');
    expect(useWizardChatStore.getState().forkPluginId).toBe(remixId);
  });
});
