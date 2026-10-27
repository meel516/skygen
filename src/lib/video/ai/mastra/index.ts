import { Mastra } from '@mastra/core';
import { storage } from './storage';
import { observability } from './observability';
import { videoGenWorkflow } from './workflows/video-gen.workflow';
import { wizardWorkflow } from './workflows/wizard.workflow';
import { directorAgent } from './agents/director.agent';
import { wizardAgent } from './agents/wizard.agent';
import { supervisorAgent } from './agents/supervisor.agent';
import { pluginOrchestratorAgent } from './agents/plugin-orchestrator.agent';
import { pluginPlannerAgent } from './agents/plugin-planner.agent';
import { pluginRemotionCoderAgent } from './agents/plugin-remotion-coder.agent';
import { storyAgent } from './agents/story.agent';
import { generatorAgent } from './agents/generator.agent';
import { plannerAgent } from './agents/planner.agent';

export const mastra = new Mastra({
  storage,
  ...(observability ? { observability } : {}),
  workflows: { videoGenWorkflow, wizardWorkflow },
  agents: {
    directorAgent, wizardAgent, supervisorAgent,
    pluginOrchestratorAgent, pluginPlannerAgent, pluginRemotionCoderAgent,
    storyAgent, generatorAgent, plannerAgent,
  },
});
