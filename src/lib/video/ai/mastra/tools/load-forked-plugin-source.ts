import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';
import { db } from '@/lib/db';
import { getSignedS3Url } from '@/lib/s3';
import { createPluginRunLedger } from './plugin-run-ledger';
import { deriveAST } from './code-ast';

export const loadForkedPluginSourceTool = createTool({
  id: 'load-forked-plugin-source',
  description: 'Load the source code of an existing plugin into the current pendingPlugin state so you can modify it instead of creating from scratch. Use this when you are in mode "create" but a forkPluginId is provided.',
  inputSchema: z.object({
    threadId: z.string(),
    pluginId: z.string(),
    forkPluginId: z.string(),
  }),
  execute: async ({ context }) => {
    const { threadId, pluginId, forkPluginId } = context;
    
    // 1. Fetch source.json from S3
    const sourceS3Key = `plugins/${forkPluginId}/source.json`;
    let sourceJson;
    try {
      const url = await getSignedS3Url(sourceS3Key, 60);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Failed to fetch source: ${res.statusText}`);
      }
      sourceJson = await res.json();
    } catch (e: any) {
      console.error(`[load-forked-plugin-source] Failed to fetch source for ${forkPluginId}:`, e.message);
      return { 
        ok: false as const, 
        error: 'Source code not available for this plugin. Only plugins created after the source code update can be remixed.' 
      };
    }

    // 2. Fetch schema
    const result = await db.query('SELECT name, schema_json FROM plugins WHERE id = $1', [forkPluginId]);
    const pluginName = result.rows[0]?.name || forkPluginId;
    const schemaJson = result.rows[0]?.schema_json || '{}';

    const { sceneCode, modules, dependencies } = sourceJson;

    const pendingPlugin = {
      pluginId,
      pluginName: pluginName.startsWith('Copy of ') ? pluginName : `Copy of ${pluginName}`,
      sceneCode: sceneCode || '',
      modules: modules || null,
      schemaJson: schemaJson || '',
      dependencies: dependencies || {},
      runLedger: createPluginRunLedger(),
    };

    const ast = modules ? deriveAST(modules) : deriveAST({ 'Scene.tsx': sceneCode });

    await patchJobState(threadId, (s: any) => ({
      ...s,
      pendingPlugin: { ...pendingPlugin, ast },
    }));

    return { 
      ok: true as const,
      message: 'Successfully loaded forked plugin source into pendingPlugin state. You can now use getSourceMap and proceed as if in modify mode.',
    };
  },
});
