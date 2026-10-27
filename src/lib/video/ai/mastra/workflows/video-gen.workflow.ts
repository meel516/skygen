import { createWorkflow, createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { enrichVideoMeta } from '../tools/enrich-video-meta.tool';
import { selectArc } from '../tools/select-arc.tool';
import { planMediaStrategyViaAgent } from '../tools/planner.tool';
import { runDirector } from '../tools/director.tool';
import { evaluateEngagement, ENGAGEMENT_THRESHOLD, MAX_DIRECTOR_LOOPS } from '../tools/evaluate-engagement.tool';
import { generateContent } from '../tools/generate-content.tool';
import { classifyMediaFields } from '../tools/classify-media-fields.tool';
import { resolveImages, resolveAudio, resolveVideo } from '../tools/resolve-media.tool';
import { mergeBlock } from '../tools/merge-block.tool';
import { mergeParallaxLayers, applyBlockPostProcessors, withTokenTracking, resetTokenTracker, getTokenTotal } from '../shared/utils';
import { RunContext, runContextStorage, getRunContext } from '../shared/run-context';
import { fillCustomPluginBlock } from '@/lib/video/ai/fill-custom-plugin';
import { db } from '@/lib/db';
import { ARC_PATTERNS } from '../shared/arc-patterns';
import type { ArcPattern, NarrativeBrief, ConsistencyLens, MediaStrategy, GenerateVideoPayloadResult } from '../shared/types';

// ============================================================================
// Input / Output schemas for the workflow
// ============================================================================

const videoGenInputSchema = z.object({
  userStory: z.string(),
  templateBlocks: z.array(z.object({ type: z.string() }).passthrough()),
  partialVideoMeta: z.record(z.string(), z.any()),
  apiKey: z.string(),
  model: z.string().optional().default('google/gemini-2.5-flash'),
  preferredArc: z.string().nullable().optional(),
  preferredVoice: z.string().nullable().optional(),
  preferredVisualStyle: z.string().nullable().optional(),
  customVisualPrompt: z.string().nullable().optional(),
  customArc: z.object({ roles: z.array(z.string()), defaultTone: z.string() }).nullable().optional(),
  language: z.string().optional().default('en'),
}).passthrough();

const videoGenOutputSchema = z.object({
  success: z.boolean(),
  selectedArc: z.string(),
  payload: z.object({
    videoMeta: z.record(z.string(), z.any()),
    contentBlocks: z.array(z.record(z.string(), z.any())),
  }),
  errors: z.array(z.string()),
  tokensUsed: z.number(),
}).passthrough();

// ============================================================================
// Step 1: Enrich video meta + load catalogs
// ============================================================================

const enrichVideoMetaStep = createStep({
  id: 'enrich-video-meta',
  inputSchema: videoGenInputSchema,
  outputSchema: z.object({}).passthrough(),
  execute: async ({ inputData }) => {
    const input = inputData as z.infer<typeof videoGenInputSchema>;
    const language = input.language ?? 'en';

    // Load arc/style catalogs from DB
    let arcPatternCatalog: Record<string, ArcPattern> = {};
    let visualStyleCatalog: Record<string, { name: string; promptPrefix: string }> = {};
    try {
      const [arcRows, styleRows] = await Promise.all([
        db.query('SELECT id, label, description, arc_pattern FROM story_arcs WHERE is_active = true'),
        db.query('SELECT id, label, prompt_prefix FROM visual_styles WHERE is_active = true'),
      ]);
      for (const row of arcRows.rows) {
        if (row.arc_pattern?.roles && row.arc_pattern?.defaultTone) {
          arcPatternCatalog[row.id] = {
            name: row.id,
            description: row.description,
            roles: row.arc_pattern.roles,
            defaultTone: row.arc_pattern.defaultTone,
          };
        }
      }
      for (const row of styleRows.rows) {
        if (row.prompt_prefix) {
          visualStyleCatalog[row.id] = { name: row.label, promptPrefix: row.prompt_prefix };
        }
      }
    } catch { /* tables may not exist yet */ }

    // Enrich video meta
    const videoMeta = await enrichVideoMeta({
      userStory: input.userStory,
      partialVideoMeta: input.partialVideoMeta,
      language,
      apiKey: input.apiKey,
      model: input.model,
    });

    // Write run plan to RunContext so downstream agents have orientation
    getRunContext()?.write('plan.md', [
      `# Run Plan`,
      `Story: ${input.userStory}`,
      `Language: ${language}`,
      `Blocks (${input.templateBlocks.length}): ${input.templateBlocks.map((b: any) => b.type).join(', ')}`,
    ].join('\n'));

    return {
      input,
      videoMeta,
      arcPatternCatalog,
      visualStyleCatalog,
      language,
      errors: [] as string[],
    };
  },
});

// ============================================================================
// Step 2: Select arc + plan media strategy
// ============================================================================

const selectArcStep = createStep({
  id: 'select-arc',
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({}).passthrough(),
  execute: async ({ inputData }) => {
    const data = inputData as any;
    const { input, videoMeta, arcPatternCatalog, language, errors } = data;

    const selectedArc = await selectArc({
      userStory: input.userStory,
      templateBlocks: input.templateBlocks,
      preferredArc: input.preferredArc ?? null,
      arcPatternCatalog,
      apiKey: input.apiKey,
      model: input.model,
    });

    const { mediaStrategy, researchContext } = await planMediaStrategyViaAgent({
      userStory: input.userStory,
      selectedArc,
      preferredArc: input.preferredArc ?? null,
      templateBlocks: input.templateBlocks,
      apiKey: input.apiKey,
      model: input.model,
    });

    // Snapshot media strategy decisions so the director can read them
    const ctx = getRunContext();
    if (mediaStrategy?.blockStrategies?.length) {
      ctx?.write('media-strategy.md', [
        `# Media Strategy`,
        `Arc: ${selectedArc?.name ?? 'unknown'}`,
        ...(mediaStrategy.blockStrategies as any[]).map((s: any, i: number) =>
          `Block ${i + 1}: imageSource=${s.imageSource}${s.searchQueryStyle ? `, style=${s.searchQueryStyle}` : ''}`
        ),
      ].join('\n'));
    }

    return {
      ...data,
      selectedArc,
      mediaStrategy,
      researchContext,
    };
  },
});

// ============================================================================
// Step 3: Director with engagement loop
// ============================================================================

const directorEvaluateStep = createStep({
  id: 'director-evaluate',
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({}).passthrough(),
  execute: async ({ inputData }) => {
    const data = inputData as any;
    const { input, videoMeta, arcPatternCatalog, visualStyleCatalog, selectedArc, mediaStrategy, researchContext, language } = data;

    let directorResult: any;
    let engagementScore = 0;
    let engagementFeedback = '';
    let loopCount = 0;

    for (let attempt = 0; attempt < MAX_DIRECTOR_LOOPS; attempt++) {
      loopCount = attempt + 1;
      directorResult = await runDirector({
        userStory: input.userStory,
        templateBlocks: input.templateBlocks,
        selectedArc,
        preferredArc: input.preferredArc ?? null,
        customArc: input.customArc ?? null,
        arcPatternCatalog,
        visualStyleCatalog,
        preferredVisualStyle: input.preferredVisualStyle ?? null,
        customVisualPrompt: input.customVisualPrompt ?? null,
        engagementFeedback,
        engagementScore,
        directorLoopCount: loopCount,
        researchContext,
        language,
        apiKey: input.apiKey,
        model: input.model,
      });

      const evalResult = await evaluateEngagement({
        userStory: input.userStory,
        narrativePlan: directorResult.narrativePlan,
        directorLoopCount: loopCount,
        language,
        apiKey: input.apiKey,
        model: input.model,
      });

      engagementScore = evalResult.engagementScore;
      engagementFeedback = evalResult.engagementFeedback;

      // Keep a living narrative snapshot and iteration history for the director
      const ctx = getRunContext();
      ctx?.write('narrative.md', [
        `# Narrative Plan (Attempt ${loopCount})`,
        ...(directorResult.narrativePlan ?? []).map((b: any, i: number) =>
          `## Block ${i + 1} [${b.narrativeRole}]\nKey message: ${b.keyMessage}\nScript: ${b.spokenScript}`
        ),
      ].join('\n\n'));
      ctx?.append('iteration-log.md', [
        `## Attempt ${loopCount}`,
        `Score: ${engagementScore}/10`,
        `Pass: ${engagementScore >= ENGAGEMENT_THRESHOLD ? 'YES ✓' : 'NO'}`,
        engagementFeedback ? `Feedback: ${engagementFeedback}` : '',
      ].filter(Boolean).join('\n'));

      if (engagementScore >= ENGAGEMENT_THRESHOLD) break;
    }

    return {
      ...data,
      directorResult,
      engagementScore,
    };
  },
});

// ============================================================================
// Step 4: Fill blocks (parallel per block)
// ============================================================================

const fillBlocksStep = createStep({
  id: 'fill-blocks',
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({}).passthrough(),
  execute: async ({ inputData }) => {
    const data = inputData as any;
    const { input, videoMeta, directorResult, mediaStrategy, researchContext, language, errors: prevErrors } = data;
    const errors = [...(prevErrors || [])];

    const filledBlocks = await Promise.all(
      input.templateBlocks.map(async (block: any, i: number) => {
        const narrativeBrief = directorResult.narrativePlan[i] ?? null;
        try {
          // Custom plugin blocks
          if (block.type === 'custom-plugin') {
            return fillCustomPluginBlock(block, narrativeBrief, input.userStory, input.apiKey, input.model);
          }

          // Generate content
          const { rawContent, error: contentError } = await generateContent({
            blockType: block.type,
            blockIndex: i,
            userStory: input.userStory,
            originalBlock: block,
            narrativeBrief,
            visualStyleGuide: directorResult.visualStyleGuide,
            storyBible: directorResult.storyBible,
            arcName: directorResult.selectedArc.name,
            selectedLenses: directorResult.selectedLenses,
            researchContext,
            mediaStrategy,
            aspectRatio: videoMeta.aspectRatio ?? '9:16',
            language,
            apiKey: input.apiKey,
            model: input.model,
          });
          if (contentError) {
            errors.push(`Block ${i + 1} (${block.type}): ${contentError}`);
            return block;
          }

          // Classify media fields
          const { imageFields, audioFields, videoFields, rawContent: updatedRawContent } = await classifyMediaFields({
            rawContent,
            blockType: block.type,
            originalBlock: block,
            narrativeBrief,
            mediaStrategy,
            blockIndex: i,
          });

          const effectiveRawContent = updatedRawContent ?? rawContent;

          // Resolve media in parallel
          const [imgResult, audioResult, videoResult] = await Promise.all([
            resolveImages({ imageFields, rawContent: effectiveRawContent, blockIndex: i, blockType: block.type, mediaStrategy, visualStyleGuide: directorResult.visualStyleGuide, apiKey: input.apiKey }),
            resolveAudio({ audioFields, preferredVoice: input.preferredVoice ?? null, blockIndex: i }),
            resolveVideo({ videoFields, rawContent: effectiveRawContent, blockIndex: i }),
          ]);

          const resolvedUrls = { ...imgResult.resolvedUrls, ...videoResult.resolvedUrls };

          // Merge into final block
          const { finalBlock } = await mergeBlock({
            rawContent: effectiveRawContent,
            resolvedUrls,
            resolvedAudio: audioResult.resolvedAudio,
            originalBlock: block,
            blockType: block.type,
            blockIndex: i,
            narrativeBrief,
          });

          return mergeParallaxLayers(finalBlock, block);
        } catch (e: any) {
          errors.push(`Block ${i + 1} (${block.type}): ${e.message}`);
          return block;
        }
      })
    );

    return {
      ...data,
      filledBlocks,
      errors,
    };
  },
});

// ============================================================================
// Step 5: Assemble payload
// ============================================================================

const assembleStep = createStep({
  id: 'assemble',
  inputSchema: z.object({}).passthrough(),
  outputSchema: videoGenOutputSchema,
  execute: async ({ inputData }) => {
    const data = inputData as any;
    const { input, videoMeta, directorResult, filledBlocks, errors } = data;

    const contentBlocks = await applyBlockPostProcessors(filledBlocks, input.templateBlocks, videoMeta);
    const payload = { videoMeta, contentBlocks };

    return {
      success: true,
      selectedArc: directorResult.selectedArc.name,
      payload,
      errors: errors || [],
      tokensUsed: getTokenTotal(),
    };
  },
});

// ============================================================================
// Workflow definition
// ============================================================================

export const videoGenWorkflow = createWorkflow({
  id: 'video-gen',
  inputSchema: videoGenInputSchema,
  outputSchema: videoGenOutputSchema,
})
  .then(enrichVideoMetaStep)
  .then(selectArcStep)
  .then(directorEvaluateStep)
  .then(fillBlocksStep)
  .then(assembleStep)
  .commit();

// ============================================================================
// Convenience wrapper — handles token tracking & error recovery
// ============================================================================

interface VideoGenInput {
  userStory: string;
  templateBlocks: Array<{ type: string; [key: string]: any }>;
  partialVideoMeta: Record<string, any>;
  apiKey: string;
  model: string;
  preferredArc?: string | null;
  preferredVoice?: string | null;
  preferredVisualStyle?: string | null;
  customVisualPrompt?: string | null;
  customArc?: { roles: string[]; defaultTone: string } | null;
  language?: string;
}

export async function runVideoGenWorkflow(input: VideoGenInput): Promise<GenerateVideoPayloadResult> {
  console.log('[Mastra video-gen-workflow] Starting...');

  if (input.templateBlocks.length === 0) {
    return {
      success: false,
      selectedArc: 'none',
      payload: { videoMeta: input.partialVideoMeta, contentBlocks: [] },
      errors: ['No template blocks provided'],
      tokensUsed: 0,
    };
  }

  try {
    const { result, tokensUsed } = await runContextStorage.run(new RunContext(), () =>
      withTokenTracking(async () => {
        const run = await videoGenWorkflow.createRun();
        const workflowResult = await run.start({ inputData: input as any });
        if (workflowResult.status === 'success') {
          return workflowResult.result as GenerateVideoPayloadResult;
        }
        throw new Error('Workflow failed: ' + ((workflowResult as any).error?.message ?? 'unknown'));
      })
    );

    return { ...result, tokensUsed };
  } catch (e: any) {
    console.error('[Mastra video-gen-workflow] Failed:', e.message);
    return {
      success: false,
      selectedArc: 'none',
      payload: { videoMeta: input.partialVideoMeta, contentBlocks: [] },
      errors: [e.message],
      tokensUsed: getTokenTotal(),
    };
  }
}
