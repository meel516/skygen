import { z } from 'zod';
import { db } from '@/lib/db';
import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';
import { getSignedS3Url } from '@/lib/s3';
import { deriveAST } from '@/lib/video/ai/mastra/tools/code-ast';
import { createPluginRunLedger } from '@/lib/video/ai/mastra/tools/plugin-run-ledger';

const storedSourceSchema = z.object({
  sceneCode: z.string().optional(),
  modules: z.record(z.string(), z.string()).nullish(),
  dependencies: z.record(z.string(), z.string()).optional(),
});

export class RemixSessionError extends Error {
  constructor(message: string, public readonly status: 400 | 403 | 404 | 409 | 500) {
    super(message);
  }
}

/** Load the saved copy once, before the model runs. Job state owns all later edits. */
export async function preparePluginRemix(threadId: string, userId: string, requestedPluginId?: string | null) {
  const job = await getJob(threadId);
  if (!job) throw new RemixSessionError('Chat session could not be loaded. Please retry.', 500);
  if (job.user_id !== userId) throw new RemixSessionError('Chat session is not owned by this user.', 403);

  const state = job.state ?? {};
  const boundId = state.pluginRemix?.pluginId as string | undefined;
  if (boundId && requestedPluginId && boundId !== requestedPluginId) {
    throw new RemixSessionError('This chat is already editing another remix. Open a new chat for a different plugin.', 409);
  }
  const pluginId = boundId || requestedPluginId;
  if (!pluginId) return null;
  if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,199}$/.test(pluginId)) {
    throw new RemixSessionError('Invalid remix plugin ID.', 400);
  }
  if (state.pendingPlugin && state.pendingPlugin.pluginId !== pluginId) {
    throw new RemixSessionError('A different plugin draft already exists in this chat.', 409);
  }

  // The Remix action has already created a copy owned by this user. Never edit
  // the library original or let a model choose a new ID for this draft.
  const result = await db.query(
    'SELECT name, description, schema_json, user_id FROM plugins WHERE id = $1', [pluginId],
  );
  const plugin = result.rows[0];
  if (!plugin) throw new RemixSessionError('Remix plugin not found.', 404);
  if (plugin.user_id !== userId) throw new RemixSessionError('Remix this plugin from the library to create your own copy first.', 403);

  if (state.pendingPlugin) {
    if (!boundId) {
      await patchJobState(threadId, current => ({ ...current, pluginRemix: { pluginId } }));
    }
    return state.pendingPlugin;
  }

  let source: z.infer<typeof storedSourceSchema>;
  let schemaJson: string;
  try {
    const url = await getSignedS3Url(`plugins/${pluginId}/source.json`, 60);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Source unavailable');
    source = storedSourceSchema.parse(await response.json());
    schemaJson = typeof plugin.schema_json === 'string' ? plugin.schema_json : JSON.stringify(plugin.schema_json);
    const schema = JSON.parse(schemaJson);
    if (!schema || typeof schema.properties !== 'object' || !schema.properties) throw new Error('Invalid schema');
    if (!(source.modules?.['Scene.tsx'] || source.sceneCode)?.trim()) throw new Error('Empty source');
  } catch {
    throw new RemixSessionError('The remix source could not be loaded. No new code was generated. Please retry or choose a plugin with stored source.', 400);
  }

  const modules = source.modules && Object.keys(source.modules).length > 0
    ? { ...source.modules, 'Scene.tsx': source.modules['Scene.tsx'] || source.sceneCode! }
    : { 'Scene.tsx': source.sceneCode! };
  const pending = {
    pluginId,
    pluginName: plugin.name,
    description: plugin.description ?? '',
    userId,
    sceneCode: modules['Scene.tsx'],
    modules,
    schemaJson,
    dependencies: source.dependencies ?? {},
    ast: deriveAST(modules),
  };
  const loaded = { ...pending, runLedger: createPluginRunLedger(pending, plugin.description ?? '') };
  await patchJobState(threadId, current => {
    if (current.pluginRemix?.pluginId && current.pluginRemix.pluginId !== pluginId) {
      throw new RemixSessionError('This chat is already editing another remix.', 409);
    }
    if (current.pendingPlugin && current.pendingPlugin.pluginId !== pluginId) {
      throw new RemixSessionError('A different plugin draft already exists in this chat.', 409);
    }
    return { ...current, pluginRemix: { pluginId }, pendingPlugin: current.pendingPlugin ?? loaded };
  });
  // Another request may have edited the draft while the source was loading.
  return (await getJob(threadId))?.state?.pendingPlugin ?? loaded;
}

export function remixAgentContext(pending: Record<string, any> | null): string {
  if (!pending) return '';
  return `\nPLUGIN REMIX STATE: ${JSON.stringify({ pluginId: pending.pluginId, pluginName: pending.pluginName, mode: 'modify' })}
The server has loaded the existing source into pendingPlugin for this thread. It is the source of truth, including edits from earlier turns.
For plugin change requests, delegate directly to agent-pluginOrchestrator with this exact pluginId and mode="modify". Do not request or design a new plugin.
The orchestrator must call getSourceMap({ threadId, refresh: true }), read the affected code, and make focused edits preserving unrelated visuals, motion, modules, and schema.
Do not call setInitialScene or reload the saved source over this draft. Do not infer code from conversation memory.
For approval, follow the existing compile/preview/build flow. For requests to make a video using this plugin, follow the video workflow.`;
}
