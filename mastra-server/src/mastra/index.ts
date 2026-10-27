import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { storage } from '../../../src/lib/video/ai/mastra/storage';
import { observability } from '../../../src/lib/video/ai/mastra/observability';
import { videoGenWorkflow } from '../../../src/lib/video/ai/mastra/workflows/video-gen.workflow';
import { wizardWorkflow } from '../../../src/lib/video/ai/mastra/workflows/wizard.workflow';
import { directorAgent } from '../../../src/lib/video/ai/mastra/agents/director.agent';
import { wizardAgent } from '../../../src/lib/video/ai/mastra/agents/wizard.agent';
import { supervisorAgent } from '../../../src/lib/video/ai/mastra/agents/supervisor.agent';
import { pluginOrchestratorAgent } from '../../../src/lib/video/ai/mastra/agents/plugin-orchestrator.agent';
import { pluginPlannerAgent } from '../../../src/lib/video/ai/mastra/agents/plugin-planner.agent';
import { storyAgent } from '../../../src/lib/video/ai/mastra/agents/story.agent';
import { generatorAgent } from '../../../src/lib/video/ai/mastra/agents/generator.agent';
import { plannerAgent } from '../../../src/lib/video/ai/mastra/agents/planner.agent';
import { chatHandler } from '../routes/chat';
import { threadsListHandler } from '../routes/threads';
import { threadMessagesHandler } from '../routes/thread-messages';
import { runEventsHandler } from '../routes/run-events';
import { runCancelHandler } from '../routes/run-cancel';

// Mastra reserves /api/* for its own agent/workflow endpoints, so we mount the
// wizard routes under /wizard/*. The reverse proxy rewrites
// /api/ai/wizard/* -> /wizard/* before forwarding to this server.
const apiRoutes = [
  registerApiRoute('/wizard/chat', {
    method: 'POST',
    handler: chatHandler,
  }),
  registerApiRoute('/wizard/threads', {
    method: 'GET',
    handler: threadsListHandler,
  }),
  registerApiRoute('/wizard/threads/:threadId', {
    method: 'GET',
    handler: threadMessagesHandler,
  }),
  registerApiRoute('/wizard/runs/:runId/events', {
    method: 'GET',
    handler: runEventsHandler,
  }),
  registerApiRoute('/wizard/runs/:runId/cancel', {
    method: 'POST',
    handler: runCancelHandler,
  }),
];

export const mastra = new Mastra({
  storage,
  ...(observability ? { observability } : {}),
  workflows: { videoGenWorkflow, wizardWorkflow },
  agents: {
    directorAgent,
    wizardAgent,
    supervisorAgent,
    pluginOrchestratorAgent,
    pluginPlannerAgent,
    storyAgent,
    generatorAgent,
    plannerAgent,
  },
  server: {
    port: Number(process.env.PORT ?? 4111),
    apiRoutes,
  },
});

export default mastra;
