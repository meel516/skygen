import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getJob } from '@/lib/mcp/wizard-jobs';
import { preparePluginRemix } from '@/lib/plugins/remix-session';

export const loadForkedPluginSourceTool = createTool({
  id: 'load-forked-plugin-source',
  description: 'Ensure the saved remix copy is loaded for editing. Normally the server has already loaded it. Repeated calls preserve current edits. pluginId must equal forkPluginId; do not invent a new ID.',
  inputSchema: z.object({
    threadId: z.string(),
    pluginId: z.string(),
    forkPluginId: z.string(),
  }),
  execute: async (rawInput: any) => {
    const { threadId, pluginId, forkPluginId } = rawInput?.context ?? rawInput;
    if (pluginId !== forkPluginId) {
      return { ok: false as const, error: 'Use the existing remix ID as pluginId. Do not create a second plugin for this remix.' };
    }
    try {
      const job = await getJob(threadId);
      if (!job) return { ok: false as const, error: 'Chat session not found.' };
      const pending = await preparePluginRemix(threadId, job.user_id, forkPluginId);
      return {
        ok: true as const,
        pluginId: pending.pluginId,
        mode: 'modify' as const,
        message: 'Existing remix code is available in pendingPlugin. Call getSourceMap with refresh: true, read the affected lines, and edit only the requested behavior.',
      };
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'Failed to load remix source.' };
    }
  },
});
