
// Re-export all the types and constants from the Mastra-owned shared files
export type { ArcPattern, ConsistencyLens, ConsistencyLensConfig } from './mastra/shared/types';
export { ARC_PATTERNS, VISUAL_STYLES, CONSISTENCY_LENS_CONFIGS } from './mastra/shared/arc-patterns';
export type { NarrativeBrief, WizardImageItem, WizardVideoItem } from './mastra/shared/types';
export type { GenerateVideoPayloadResult, WizardResult } from './mastra/shared/types';
export { regenerateSingleImage, regenerateSingleVideo } from './media-service';
export { applyBlockPostProcessors } from './mastra/shared/utils';

// Export the Mastra instance for dashboard / programmatic access
export { mastra } from './mastra/index';

// Export agents for direct access (e.g. conversational wizard)
export { directorAgent } from './mastra/agents/director.agent';
export { wizardAgent } from './mastra/agents/wizard.agent';
// supervisorAgent is intentionally NOT re-exported here — eagerly loading it
// registers wizardAgent inside a Mastra agent network, which changes its stream
// chunk format from tool-result to network-execution-event-step-finish and
// breaks the frontend's SSE event handling. Import supervisor directly when needed.

// Export agent tools for programmatic use
export { agentTools } from './mastra/tools/mastra-tools';

// Export token tracking utilities
export { callAIWithTracking, withTokenTracking, getTokenTotal, resetTokenTracker } from './mastra/shared/utils';

// Export workflow instances for direct access
export { videoGenWorkflow } from './mastra/workflows/video-gen.workflow';
export { wizardWorkflow } from './mastra/workflows/wizard.workflow';

// Feature flags for Mastra migration
const USE_MASTRA_GENERATION = process.env.USE_MASTRA_GENERATION === 'true';
const USE_MASTRA_WIZARD     = process.env.USE_MASTRA_WIZARD === 'true';
/** When true, wizard runs in inline preview mode — chat stays open, no page navigation */
const USE_INLINE_WIZARD     = process.env.USE_INLINE_WIZARD === 'true';

// Mastra-backed implementations
import { runVideoGenWorkflow } from './mastra/workflows/video-gen.workflow';
import { runWizardWorkflow, resumeWizardWorkflow } from './mastra/workflows/wizard.workflow';

// Legacy graph.ts implementations (fallback)
import {
  generateVideoPayload as legacyGenerateVideoPayload,
  startWizard as legacyStartWizard,
  resumeWizard as legacyResumeWizard,
} from './graph';

import type { GenerateVideoPayloadResult, WizardResult } from './mastra/shared/types';

export async function generateVideoPayload(
  userStory: string,
  templateBlocks: Array<{ type: string; [key: string]: any }>,
  partialVideoMeta: Record<string, any>,
  apiKey: string,
  model: string = process.env.DEFAULT_AI_MODEL || 'google/gemini-2.5-flash',
  preferredArc: string | null = null,
  preferredVoice: string | null = null,
  preferredVisualStyle: string | null = null,
  customVisualPrompt: string | null = null,
): Promise<GenerateVideoPayloadResult> {
  if (USE_MASTRA_GENERATION) {
    console.log('[index] USE_MASTRA_GENERATION=true → routing to Mastra workflow');
    return runVideoGenWorkflow({
      userStory,
      templateBlocks,
      partialVideoMeta,
      apiKey,
      model,
      preferredArc,
      preferredVoice,
      preferredVisualStyle,
      customVisualPrompt,
      customArc: null,
      language: 'en',
    });
  }

  // Legacy path
  return legacyGenerateVideoPayload(
    userStory,
    templateBlocks,
    partialVideoMeta,
    apiKey,
    model,
    preferredArc,
    preferredVoice,
    preferredVisualStyle,
    customVisualPrompt,
  );
}

export async function startWizard(
  threadId: string,
  input: {
    userStory: string;
    templateBlocks: Array<{ type: string; [key: string]: any }>;
    partialVideoMeta: Record<string, any>;
    preferredArc: string | null;
    preferredVoice: string | null;
    preferredVisualStyle: string | null;
    customVisualPrompt: string | null;
    customArc: { roles: string[]; defaultTone: string } | null;
    language: string;
    apiKey: string;
    model: string;
  },
  options?: { inlineMode?: boolean },
): Promise<WizardResult> {
  if (USE_MASTRA_WIZARD) {
    const inlineMode = options?.inlineMode ?? USE_INLINE_WIZARD;
    console.log(`[index] USE_MASTRA_WIZARD=true → routing to Mastra wizard (inlineMode=${inlineMode})`);
    return runWizardWorkflow(threadId, input, { inlineMode });
  }

  return legacyStartWizard(threadId, input);
}

export async function resumeWizard(
  threadId: string,
  value: any,
  freshApiKey?: string,
): Promise<WizardResult> {
  if (USE_MASTRA_WIZARD) {
    console.log('[index] USE_MASTRA_WIZARD=true → routing to Mastra resume workflow');
    return resumeWizardWorkflow(threadId, value, freshApiKey);
  }

  return legacyResumeWizard(threadId, value, freshApiKey);
}
