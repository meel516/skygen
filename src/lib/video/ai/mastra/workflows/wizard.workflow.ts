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
import { mergeParallaxLayers, extractAudioFields, getBlockNestedValue, setBlockNestedValue, applyBlockPostProcessors, withTokenTracking, getTokenTotal } from '../shared/utils';
import { RunContext, runContextStorage, getRunContext } from '../shared/run-context';
import { fillCustomPluginBlock } from '@/lib/video/ai/fill-custom-plugin';
import { db } from '@/lib/db';
import * as wizardJobs from '@/lib/mcp/wizard-jobs';
import { ARC_PATTERNS } from '../shared/arc-patterns';
import type { ArcPattern, NarrativeBrief, ConsistencyLens, MediaStrategy, WizardResult, WizardImageItem, WizardVideoItem } from '../shared/types';

// ============================================================================
// State persistence helpers
// ============================================================================

async function saveWizardState(threadId: string, state: Record<string, any>) {
  const job = await wizardJobs.getJob(threadId);
  if (job) {
    await wizardJobs.patchJobState(threadId, () => state);
  } else {
    await db.query(
      `INSERT INTO wizard_jobs (thread_id, user_id, status, state, updated_at) VALUES ($1, '', 'running', $2, NOW())
       ON CONFLICT (thread_id) DO UPDATE SET state = $2, updated_at = NOW()`,
      [threadId, JSON.stringify(state)]
    );
  }
}

async function loadWizardState(threadId: string): Promise<Record<string, any> | null> {
  const job = await wizardJobs.getJob(threadId);
  if (!job) return null;
  return job.state ?? null;
}

// ============================================================================
// Input / Output schemas
// ============================================================================

const wizardInputSchema = z.object({
  threadId: z.string(),
  userStory: z.string(),
  templateBlocks: z.array(z.object({ type: z.string() }).passthrough()),
  partialVideoMeta: z.record(z.string(), z.any()),
  preferredArc: z.string().nullable(),
  preferredVoice: z.string().nullable(),
  preferredVisualStyle: z.string().nullable(),
  customVisualPrompt: z.string().nullable(),
  customArc: z.object({ roles: z.array(z.string()), defaultTone: z.string() }).nullable(),
  language: z.string(),
  apiKey: z.string(),
  model: z.string(),
  /** Inline preview mode: chat stays open, previews appear inline.
   *  Paged mode (default): legacy separate review pages. */
  inlineMode: z.boolean().optional().default(false),
}).passthrough();

const wizardOutputSchema = z.object({
  status: z.enum(['interrupted', 'complete']),
  interrupt: z.record(z.string(), z.any()).optional(),
  payload: z.record(z.string(), z.any()).optional(),
  stateSnapshot: z.record(z.string(), z.any()).optional(),
  tokensUsed: z.number(),
  /** In inline mode, the preview data is attached here for immediate display */
  preview: z.record(z.string(), z.any()).optional(),
}).passthrough();

// ============================================================================
// Shared helper: fill all blocks with content + images + audio
// Used by both inline and paged workflows to avoid code duplication
// ============================================================================

/** A field identified by the classifier that should hold a media URL after fill. */
type ClassifiedField = { kind: 'image' | 'audio' | 'video'; path: string; description: string };

/** A block's classified fields tracked per-index so the post-fill validator can find them. */
type ClassifiedFieldsByBlock = Map<number, ClassifiedField[]>;

/** Result of the post-fill validation pass. */
export type UnresolvableField = { blockIndex: number; path: string; kind: 'image' | 'audio' | 'video'; reason: string };

/** A path is "filled" if its value at that path is a real URL or data URI. */
function isFilledUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  return value.startsWith('http://') || value.startsWith('https://') || value.startsWith('data:');
}

async function fillAllBlocks(params: {
  threadId?: string;
  templateBlocks: any[];
  narrativePlan: NarrativeBrief[];
  userStory: string;
  visualStyleGuide: string;
  storyBible: string;
  selectedArc: ArcPattern;
  selectedLenses: ConsistencyLens[];
  mediaStrategy: MediaStrategy;
  researchContext: string;
  videoMeta: any;
  preferredVoice: string | null;
  language: string;
  apiKey: string;
  model: string;
}): Promise<{
  blocksWithContent: any[];
  allImageItems: WizardImageItem[];
  allVideoItems: WizardVideoItem[];
  filledBlocks: any[];
  audioItems: any[];
  unresolvable: UnresolvableField[];
}> {
  const { threadId, templateBlocks, narrativePlan, userStory, visualStyleGuide, storyBible, selectedArc, selectedLenses, mediaStrategy, researchContext, videoMeta, preferredVoice, language, apiKey, model } = params;

  const allImageItems: WizardImageItem[] = [];
  const allVideoItems: WizardVideoItem[] = [];
  // Per-block classified fields. Captured during the per-block fill so the
  // post-fill validator can check whether every classified path actually got
  // a real URL — and retry the ones that didn't.
  const classifiedByBlock: ClassifiedFieldsByBlock = new Map();

  // Step 0: Initialize filledBlocks in state if threadId is provided (for real-time progress)
  if (threadId) {
    try {
      await wizardJobs.patchJobState(threadId, (current) => ({
        ...current,
        filledBlocks: templateBlocks.map((b, i) => ({ ...b, blockIndex: i })),
        imageItems: [],
        audioItems: [],
      }));
    } catch (e: any) {
      console.warn(`[wizard-workflow] Initial state patch failed: ${e.message}`);
    }
  }

  // Step 1: Generate content + resolve images for each block
  const blocksWithContent = await Promise.all(
    templateBlocks.map(async (block: any, i: number) => {
      const brief = narrativePlan[i] ?? null;
      try {
        // Custom-plugin: fetch generationFields from DB and seed block with plugin defaults,
        // then fall through to generateContent (which handles custom-plugin natively) and
        // the shared classify → resolve → merge pipeline.
        let schemaDescriptions: Record<string, string> | undefined;
        if (block.type === 'custom-plugin') {
          const pluginMeta = await fillCustomPluginBlock(block, brief, userStory, apiKey, model);
          block = { ...block, ...pluginMeta.rawContent, generationFields: pluginMeta.generationFields };
          schemaDescriptions = pluginMeta.schemaDescriptions;
        }

        const { rawContent, error } = await generateContent({
          blockType: block.type, blockIndex: i, userStory, originalBlock: block,
          narrativeBrief: brief, visualStyleGuide, storyBible, arcName: selectedArc?.name ?? '',
          selectedLenses, researchContext, mediaStrategy, aspectRatio: videoMeta.aspectRatio ?? '9:16',
          language, apiKey, model, schemaDescriptions,
        });
        if (error) return block;

        const { imageFields, audioFields, videoFields, rawContent: updatedRawContent } = await classifyMediaFields({
          rawContent, blockType: block.type, originalBlock: block, narrativeBrief: brief,
          mediaStrategy, blockIndex: i,
        });

        const effectiveRawContent = updatedRawContent ?? rawContent;

        // Record what fields the classifier expected — used by the post-fill validator
        // to detect missing URLs and trigger targeted retries. Plugin-agnostic: works
        // identically for built-ins (whose fields come from BLOCK_SCHEMAS) and custom
        // plugins (whose fields come from generationFields).
        const classified: ClassifiedField[] = [
          ...imageFields.map(f => ({ kind: 'image' as const, path: f.path, description: f.description })),
          ...audioFields.map(f => ({ kind: 'audio' as const, path: f.path, description: f.text })),
          ...videoFields.map(f => ({ kind: 'video' as const, path: f.path, description: f.prompt })),
        ];
        classifiedByBlock.set(i, classified);

        const [imgResult, videoResult] = await Promise.all([
          resolveImages({ imageFields, rawContent: effectiveRawContent, blockIndex: i, blockType: block.type, mediaStrategy, visualStyleGuide, apiKey }),
          resolveVideo({ videoFields, rawContent: effectiveRawContent, blockIndex: i }),
        ]);

        const combinedUrls = { ...imgResult.resolvedUrls, ...videoResult.resolvedUrls };

        for (const [path, url] of Object.entries(imgResult.resolvedUrls)) {
          const desc = imageFields.find((f: any) => f.path === path)?.description ?? '';
          const match = path.match(/^layers\[(\d+)]/);
          const playerImgMatch = path.match(/^players\[(\d+)]\.image$/);
          const removeBg = match ? !!(effectiveRawContent?.layers?.[parseInt(match[1], 10)]?.removeBackground) : !!playerImgMatch;
          allImageItems.push({ blockIdx: i, fieldPath: path, url, description: desc, removeBackground: removeBg });
        }
        for (const { path, prompt } of videoFields) {
          allVideoItems.push({ blockIdx: i, fieldPath: path, url: '', description: prompt });
        }

        const { finalBlock } = await mergeBlock({
          rawContent: effectiveRawContent, resolvedUrls: combinedUrls, resolvedAudio: {},
          originalBlock: block, blockType: block.type, blockIndex: i, narrativeBrief: brief,
        });
        const mergedBlock = mergeParallaxLayers(finalBlock, block);

        // Incremental update: saved resolved images to state (ATOMIC)
        if (threadId) {
          try {
            await wizardJobs.patchJobStateBlock(threadId, i, mergedBlock);
            for (const [path, url] of Object.entries(imgResult.resolvedUrls)) {
              const desc = imageFields.find((f: any) => f.path === path)?.description ?? '';
              const match = path.match(/^layers\[(\d+)]/);
              const playerImgMatch = path.match(/^players\[(\d+)]\.image$/);
              const removeBg = match ? !!(effectiveRawContent?.layers?.[parseInt(match[1], 10)]?.removeBackground) : !!playerImgMatch;
              
              await wizardJobs.patchJobStateImageItem(threadId, { 
                blockIdx: i, 
                fieldPath: path, 
                url, 
                description: desc, 
                removeBackground: removeBg 
              });
            }
          } catch (e: any) {
            console.warn(`[wizard-workflow] Image state patch failed for block ${i}: ${e.message}`);
          }
        }

        return mergedBlock;
      } catch (e: any) {
        return block;
      }
    })
  );

  // Step 2: Generate audio for all blocks
  const filledBlocks = await Promise.all(
    blocksWithContent.map(async (block: any, i: number) => {
      try {
        const audioFields = extractAudioFields(block);
        if (audioFields.length === 0) return block;

        let updated = { ...block };
        for (const { path, text } of audioFields) {
          if (text && !text.startsWith('data:') && !text.startsWith('http')) {
            try {
              const audioResult = await resolveAudio({
                audioFields: [{ path, text }],
                preferredVoice,
                blockIndex: i,
              });
              if (audioResult.resolvedAudio[path]) {
                updated = setBlockNestedValue(updated, path, audioResult.resolvedAudio[path]);

                // Incremental update: save resolved audio to state (ATOMIC)
                if (threadId) {
                  try {
                    await wizardJobs.patchJobStateBlock(threadId, i, updated);
                  } catch (e: any) {
                    console.warn(`[wizard-workflow] Audio state patch failed for block ${i}: ${e.message}`);
                  }
                }
              }
            } catch (e: any) {
              console.warn(`[wizard-workflow] Audio failed for block ${i} path ${path}: ${e.message}`);
            }
          }
        }
        return updated;
      } catch (e: any) {
        return block;
      }
    })
  );

  // Step 3: Validate + retry missing fields. Mechanical, no LLM. The classifier
  // already told us which paths SHOULD have URLs; we scan the filled state and
  // retry any path that's empty. After one retry, anything still empty is
  // surfaced as `unresolvable` so the caller (and ultimately the wizard agent)
  // sees the truth and can decide what to do — instead of guessing.
  const unresolvable: UnresolvableField[] = [];
  for (let i = 0; i < filledBlocks.length; i++) {
    const block = filledBlocks[i];
    const classified = classifiedByBlock.get(i) ?? [];
    if (classified.length === 0) continue;

    for (const field of classified) {
      const current = getBlockNestedValue(block, field.path);
      if (isFilledUrl(current)) continue;

      // Retry exactly once per missing field.
      try {
        if (field.kind === 'image') {
          const r = await resolveImages({
            imageFields: [{ path: field.path, description: field.description }],
            rawContent: block, blockIndex: i, blockType: block.type ?? 'unknown',
            mediaStrategy, visualStyleGuide, apiKey,
          });
          const url = r.resolvedUrls[field.path];
          if (isFilledUrl(url)) {
            const updated = setBlockNestedValue(block, field.path, url);
            filledBlocks[i] = updated;
            if (threadId) {
              try { await wizardJobs.patchJobStateBlock(threadId, i, updated); } catch { /* best-effort */ }
            }
            continue;
          }
        } else if (field.kind === 'video') {
          const r = await resolveVideo({
            videoFields: [{ path: field.path, prompt: field.description }],
            rawContent: block, blockIndex: i,
          });
          const url = r.resolvedUrls[field.path];
          if (isFilledUrl(url)) {
            const updated = setBlockNestedValue(block, field.path, url);
            filledBlocks[i] = updated;
            if (threadId) {
              try { await wizardJobs.patchJobStateBlock(threadId, i, updated); } catch { /* best-effort */ }
            }
            continue;
          }
        } else if (field.kind === 'audio') {
          const text = field.description;
          if (text && !text.startsWith('http') && !text.startsWith('data:')) {
            const r = await resolveAudio({
              audioFields: [{ path: field.path, text }],
              preferredVoice, blockIndex: i,
            });
            const url = r.resolvedAudio[field.path];
            if (isFilledUrl(url)) {
              const updated = setBlockNestedValue(block, field.path, url);
              filledBlocks[i] = updated;
              if (threadId) {
                try { await wizardJobs.patchJobStateBlock(threadId, i, updated); } catch { /* best-effort */ }
              }
              continue;
            }
          }
        }
      } catch (e: any) {
        console.warn(`[wizard-workflow] Retry failed for block ${i} path ${field.path}: ${e?.message ?? e}`);
      }

      unresolvable.push({
        blockIndex: i, path: field.path, kind: field.kind,
        reason: 'still empty after one retry',
      });
    }
  }

  // Step 4: Build audio items for review
  const audioItems = filledBlocks.map((block: any, idx: number) => {
    const audioSrc = block.audioSrc ?? '';
    const hasAudio = audioSrc.startsWith('data:') || audioSrc.startsWith('http');
    return {
      blockIdx: idx,
      narrativeRole: block.narrativeRole ?? block.role ?? `block_${idx}`,
      hasAudio,
      audioUrl: hasAudio ? audioSrc : '',
      script: block.spokenScript ?? (!hasAudio ? audioSrc : '') ?? '',
    };
  });

  return { blocksWithContent, allImageItems, allVideoItems, filledBlocks, audioItems, unresolvable };
}

// ============================================================================
// Step 1: Init — enrich + arc + plan + director
// In inline mode: continues to fill all blocks and returns preview immediately
// In paged mode: suspends at review_story for user review
// ============================================================================

const initStep = createStep({
  id: 'init',
  inputSchema: wizardInputSchema,
  outputSchema: z.object({}).passthrough(),
  suspendSchema: z.object({
    type: z.string(),
    narrativePlan: z.array(z.any()),
    videoMeta: z.record(z.string(), z.any()),
    selectedArc: z.string(),
    engagementScore: z.number(),
    visualStyleGuide: z.string(),
    storyBible: z.string(),
  }).passthrough(),
  execute: async ({ inputData, suspend }) => {
    const input = inputData as z.infer<typeof wizardInputSchema>;
    const threadId = input.threadId;
    const inlineMode = input.inlineMode ?? false;

    let arcPatternCatalog: Record<string, ArcPattern> = {};
    let visualStyleCatalog: Record<string, { name: string; promptPrefix: string }> = {};
    try {
      const [arcRows, styleRows] = await Promise.all([
        db.query('SELECT id, label, description, arc_pattern FROM story_arcs WHERE is_active = true'),
        db.query('SELECT id, label, prompt_prefix FROM visual_styles WHERE is_active = true'),
      ]);
      for (const row of arcRows.rows) {
        if (row.arc_pattern?.roles && row.arc_pattern?.defaultTone) {
          arcPatternCatalog[row.id] = { name: row.id, description: row.description, roles: row.arc_pattern.roles, defaultTone: row.arc_pattern.defaultTone };
        }
      }
      for (const row of styleRows.rows) {
        if (row.prompt_prefix) visualStyleCatalog[row.id] = { name: row.label, promptPrefix: row.prompt_prefix };
      }
    } catch { /* tables may not exist yet */ }

    // Enrich video meta
    const videoMeta = await enrichVideoMeta({
      userStory: input.userStory,
      partialVideoMeta: input.partialVideoMeta,
      language: input.language,
      apiKey: input.apiKey,
      model: input.model,
    });

    // Write run plan so tools have orientation context
    getRunContext()?.write('plan.md', [
      `# Run Plan`,
      `Story: ${input.userStory}`,
      `Language: ${input.language ?? 'en'}`,
      `Blocks (${input.templateBlocks.length}): ${input.templateBlocks.map((b: any) => b.type).join(', ')}`,
    ].join('\n'));

    // Plan media strategy
    const { mediaStrategy, researchContext } = await planMediaStrategyViaAgent({
      userStory: input.userStory,
      selectedArc: null,
      preferredArc: input.preferredArc,
      templateBlocks: input.templateBlocks,
      apiKey: input.apiKey,
      model: input.model,
    });

    // Select arc
    const selectedArc = await selectArc({
      userStory: input.userStory,
      templateBlocks: input.templateBlocks,
      preferredArc: input.preferredArc,
      arcPatternCatalog,
      apiKey: input.apiKey,
      model: input.model,
    });

    // Director with engagement loop
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
        preferredArc: input.preferredArc,
        customArc: input.customArc,
        arcPatternCatalog,
        visualStyleCatalog,
        preferredVisualStyle: input.preferredVisualStyle,
        customVisualPrompt: input.customVisualPrompt,
        engagementFeedback,
        engagementScore,
        directorLoopCount: loopCount,
        researchContext,
        language: input.language,
        apiKey: input.apiKey,
        model: input.model,
      });

      const evalResult = await evaluateEngagement({
        userStory: input.userStory,
        narrativePlan: directorResult.narrativePlan,
        directorLoopCount: loopCount,
        language: input.language,
        apiKey: input.apiKey,
        model: input.model,
      });

      engagementScore = evalResult.engagementScore;
      engagementFeedback = evalResult.engagementFeedback;

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

    // ========================================================================
    // INLINE MODE: Fill all blocks immediately and return preview
    // Chat stays open — user can request changes via the wizard agent
    // ========================================================================
    if (inlineMode) {
      const fillResult = await fillAllBlocks({
        threadId,
        templateBlocks: input.templateBlocks,
        narrativePlan: directorResult.narrativePlan,
        userStory: input.userStory,
        visualStyleGuide: directorResult.visualStyleGuide ?? '',
        storyBible: directorResult.storyBible ?? '',
        selectedArc: directorResult.selectedArc,
        selectedLenses: directorResult.selectedLenses,
        mediaStrategy,
        researchContext,
        videoMeta,
        preferredVoice: input.preferredVoice,
        language: input.language,
        apiKey: input.apiKey,
        model: input.model,
      });

      // Apply post-processors (duration from audio, parallax layer merge, etc.)
      // In paged mode this happens in finalizeStep, but inline mode skips that step.
      const postProcessedBlocks = await applyBlockPostProcessors(
        fillResult.filledBlocks, input.templateBlocks, videoMeta,
      );

      const wizardState = {
        input,
        videoMeta,
        selectedArc: directorResult.selectedArc,
        narrativePlan: directorResult.narrativePlan,
        visualStyleGuide: directorResult.visualStyleGuide,
        storyBible: directorResult.storyBible,
        selectedLenses: directorResult.selectedLenses,
        mediaStrategy,
        researchContext,
        blocksWithImages: fillResult.blocksWithContent,
        imageItems: fillResult.allImageItems,
        videoItems: fillResult.allVideoItems,
        filledBlocks: postProcessedBlocks,
        audioItems: fillResult.audioItems,
        unresolvable: fillResult.unresolvable,
        phase: 'preview',  // New phase: preview is ready, waiting for user feedback
        inlineMode: true,
      };
      await saveWizardState(threadId, wizardState);

      // Patch DB state with post-processed blocks (duration from audio, etc.)
      if (threadId) {
        try {
          for (let i = 0; i < postProcessedBlocks.length; i++) {
            await wizardJobs.patchJobStateBlock(threadId, i, postProcessedBlocks[i]);
          }
        } catch (e: any) {
          console.warn(`[wizard-workflow] Post-processor state patch failed: ${e.message}`);
        }
      }

      // Return preview data inline — no suspension, chat stays open
      return {
        input,
        videoMeta,
        directorResult,
        mediaStrategy,
        researchContext,
        fillResult: { ...fillResult, filledBlocks: postProcessedBlocks },
        phase: 'preview',
        inlineMode: true,
      };
    }

    // ========================================================================
    // PAGED MODE (legacy): Suspend at review_story for separate page review
    // ========================================================================
    const storyInterrupt = {
      type: 'review_story',
      narrativePlan: directorResult.narrativePlan,
      videoMeta,
      selectedArc: directorResult.selectedArc?.name ?? 'documentary',
      engagementScore,
      visualStyleGuide: directorResult.visualStyleGuide ?? '',
      storyBible: directorResult.storyBible ?? '',
    };

    const wizardState = {
      input,
      videoMeta,
      selectedArc: directorResult.selectedArc,
      narrativePlan: directorResult.narrativePlan,
      visualStyleGuide: directorResult.visualStyleGuide,
      storyBible: directorResult.storyBible,
      selectedLenses: directorResult.selectedLenses,
      mediaStrategy,
      researchContext,
      phase: 'review_story',
      inlineMode: false,
    };
    await saveWizardState(threadId, wizardState);

    await suspend(storyInterrupt);
    return { input, videoMeta, directorResult, mediaStrategy, researchContext, phase: 'review_story_done' };
  },
});

// ============================================================================
// Step 2: Review story — handles resume from review_story, generates images
// Only used in PAGED mode
// ============================================================================

const reviewStoryStep = createStep({
  id: 'review-story',
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({}).passthrough(),
  resumeSchema: z.object({
    editedScripts: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
  suspendSchema: z.object({
    type: z.string(),
    imageItems: z.array(z.any()),
    videoItems: z.array(z.any()),
    blocksWithImages: z.array(z.any()),
  }).passthrough(),
  execute: async ({ inputData, resumeData, suspend }) => {
    const data = inputData as any;

    if (resumeData) {
      const threadId = data.input?.threadId ?? data.threadId;
      const state = await loadWizardState(threadId);
      if (!state) throw new Error('No wizard state found for thread: ' + threadId);

      const { input, videoMeta, selectedArc, narrativePlan, visualStyleGuide, storyBible, selectedLenses, mediaStrategy, researchContext } = state;

      const editedScripts: Record<string, string> = resumeData.editedScripts ?? {};
      const updatedPlan = narrativePlan.map((brief: NarrativeBrief, i: number) =>
        editedScripts[i] !== undefined ? { ...brief, spokenScript: editedScripts[i] } : brief
      );

      const fillResult = await fillAllBlocks({
        threadId,
        templateBlocks: input.templateBlocks,
        narrativePlan: updatedPlan,
        userStory: input.userStory,
        visualStyleGuide,
        storyBible,
        selectedArc,
        selectedLenses,
        mediaStrategy,
        researchContext,
        videoMeta,
        preferredVoice: input.preferredVoice,
        language: input.language,
        apiKey: input.apiKey,
        model: input.model,
      });

      const imageInterrupt = {
        type: 'review_images',
        imageItems: fillResult.allImageItems,
        videoItems: fillResult.allVideoItems,
        blocksWithImages: fillResult.blocksWithContent,
      };

      const wizardState = {
        ...state,
        narrativePlan: updatedPlan,
        blocksWithImages: fillResult.blocksWithContent,
        imageItems: fillResult.allImageItems,
        videoItems: fillResult.allVideoItems,
        filledBlocks: fillResult.filledBlocks,
        audioItems: fillResult.audioItems,
        phase: 'review_audio',  // Skip review_images page in paged mode — go straight to audio review
      };
      await saveWizardState(threadId, wizardState);

      await suspend(imageInterrupt);
      return { phase: 'review_images_done' };
    }

    return { ...data, phase: 'init_done' };
  },
});

// ============================================================================
// Step 3: Generate audio after images reviewed
// Only used in PAGED mode
// ============================================================================

const generateAudioStep = createStep({
  id: 'generate-audio',
  inputSchema: z.object({}).passthrough(),
  outputSchema: z.object({}).passthrough(),
  resumeSchema: z.object({
    imageOverrides: z.record(z.string(), z.any()).optional(),
  }).passthrough(),
  suspendSchema: z.object({
    type: z.string(),
    audioItems: z.array(z.any()),
    filledBlocks: z.array(z.any()),
  }).passthrough(),
  execute: async ({ inputData, resumeData, suspend }) => {
    const data = inputData as any;
    const threadId = data.input?.threadId ?? data.threadId;

    const state = await loadWizardState(threadId);
    if (!state) throw new Error('No wizard state found for thread: ' + threadId);

    const { input, videoMeta, narrativePlan, filledBlocks } = state;
    const editedScripts: Record<string, string> = (resumeData?.editedScripts ?? {}) as Record<string, string>;
    const updatedPlan = narrativePlan.map((brief: NarrativeBrief, i: number) =>
      editedScripts[i] !== undefined ? { ...brief, spokenScript: editedScripts[i] } : brief
    );

    // Apply image overrides if any
    let blocks = [...(filledBlocks || [])];
    const imageOverrides = resumeData?.imageOverrides ?? {};
    for (const [idx, override] of Object.entries(imageOverrides)) {
      const blockIdx = parseInt(idx, 10);
      if (blockIdx >= 0 && blockIdx < blocks.length && override) {
        const o = override as any;
        if (o.imageSrc) blocks[blockIdx] = { ...blocks[blockIdx], imageSrc: o.imageSrc };
        if (o.src) blocks[blockIdx] = { ...blocks[blockIdx], src: o.src };
      }
    }

    // Audio is already generated in fillAllBlocks — just build the review data
    const audioItems = blocks.map((block: any, idx: number) => {
      const audioSrc = block.audioSrc ?? '';
      const hasAudio = audioSrc.startsWith('data:') || audioSrc.startsWith('http');
      return {
        blockIdx: idx,
        narrativeRole: block.narrativeRole ?? block.role ?? `block_${idx}`,
        hasAudio,
        audioUrl: hasAudio ? audioSrc : '',
        script: block.spokenScript ?? (!hasAudio ? audioSrc : '') ?? '',
      };
    });

    const audioInterrupt = {
      type: 'review_audio',
      audioItems,
      filledBlocks: blocks,
    };

    const wizardState = {
      ...state,
      narrativePlan: updatedPlan,
      filledBlocks: blocks,
      phase: 'review_audio',
    };
    await saveWizardState(threadId, wizardState);

    await suspend(audioInterrupt);
    return { phase: 'review_audio_done' };
  },
});

// ============================================================================
// Step 4: Finalize — applies overrides and post-processors
// Used in BOTH modes
// ============================================================================

const finalizeStep = createStep({
  id: 'finalize',
  inputSchema: z.object({}).passthrough(),
  outputSchema: wizardOutputSchema,
  resumeSchema: z.object({
    audioOverrides: z.record(z.string(), z.any()).optional(),
    editedScripts: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
  execute: async ({ inputData, resumeData }) => {
    const data = inputData as any;
    const threadId = data.input?.threadId ?? data.threadId;

    const state = await loadWizardState(threadId);
    if (!state) throw new Error('No wizard state found for thread: ' + threadId);

    const { input, videoMeta, narrativePlan } = state;
    const editedScripts: Record<string, string> = (resumeData?.editedScripts ?? {}) as Record<string, string>;
    const updatedPlan = narrativePlan.map((brief: NarrativeBrief, i: number) =>
      editedScripts[i] !== undefined ? { ...brief, spokenScript: editedScripts[i] } : brief
    );

    let blocks = [...state.filledBlocks];

    // Apply user audio overrides — FIX: now also reads from value parameter
    // (previously only read from resumeData, which was empty in the convenience wrapper path)
    const audioOverrides = resumeData?.audioOverrides ?? {};
    for (const [idx, override] of Object.entries(audioOverrides)) {
      const blockIdx = parseInt(idx, 10);
      if (blockIdx >= 0 && blockIdx < blocks.length && override) {
        const o = override as any;
        if (o.audioSrc) blocks[blockIdx] = { ...blocks[blockIdx], audioSrc: o.audioSrc };
        if (o.spokenScript) blocks[blockIdx] = { ...blocks[blockIdx], spokenScript: o.spokenScript };
      }
    }

    const contentBlocks = await applyBlockPostProcessors(blocks, input.templateBlocks, videoMeta);
    const payload = { videoMeta, contentBlocks };

    try {
      await wizardJobs.updateJob(threadId, { status: 'complete', payload });
    } catch { /* ignore */ }

    return {
      status: 'complete' as const,
      payload,
      stateSnapshot: { ...state, narrativePlan: updatedPlan },
      tokensUsed: getTokenTotal(),
    };
  },
});

// ============================================================================
// Workflow definition
// ============================================================================

export const wizardWorkflow = createWorkflow({
  id: 'wizard',
  inputSchema: wizardInputSchema,
  outputSchema: wizardOutputSchema,
})
  .then(initStep)
  .then(reviewStoryStep)
  .then(generateAudioStep)
  .then(finalizeStep)
  .commit();

// ============================================================================
// Convenience wrappers — maintain backward-compatible API for ai/index.ts
// ============================================================================

export async function runWizardWorkflow(
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
  const inlineMode = options?.inlineMode ?? false;
  console.log(`[Mastra wizard-workflow] Starting... (inlineMode=${inlineMode})`);

  try {
    if (inlineMode) {
      // ====================================================================
      // INLINE MODE: Run everything in one pass, return preview immediately
      // Chat stays open — user can request changes via wizardAgent
      // ====================================================================
      const result = await runContextStorage.run(new RunContext(), () =>
        withTokenTracking(async () => {
          const run = await wizardWorkflow.createRun();
          const workflowResult = await run.start({
            inputData: { ...input, threadId, inlineMode: true } as any,
          });
          if (workflowResult.status === 'success') {
            return (workflowResult as any).result as any;
          }
          return null;
        })
      );

      // Load the saved state with all preview data
      const state = await loadWizardState(threadId);
      if (!state) throw new Error('No wizard state found after inline init');

      // Build preview data for the frontend
      const preview = {
        narrativePlan: state.narrativePlan,
        selectedArc: state.selectedArc?.name ?? 'documentary',
        visualStyleGuide: state.visualStyleGuide ?? '',
        storyBible: state.storyBible ?? '',
        blocksWithImages: state.blocksWithImages,
        imageItems: state.imageItems,
        videoItems: state.videoItems,
        filledBlocks: state.filledBlocks,
        audioItems: state.audioItems,
        videoMeta: state.videoMeta,
        unresolvable: state.unresolvable ?? [],
      };

      return {
        status: 'interrupted',
        interrupt: {
          type: 'preview_ready',
          message: 'Your video preview is ready! You can request changes in the chat.',
          selectedArc: state.selectedArc?.name ?? 'documentary',
          engagementScore: state.engagementScore,
        },
        payload: preview,
        stateSnapshot: state as any,
        tokensUsed: getTokenTotal(),
        preview,
      };
    }

    // ====================================================================
    // PAGED MODE (legacy): Suspend at review_story for separate page review
    // ====================================================================
    const { tokensUsed } = await runContextStorage.run(new RunContext(), () =>
      withTokenTracking(async () => {
        const run = await wizardWorkflow.createRun();
        try {
          const result = await run.start({ inputData: { ...input, threadId, inlineMode: false } as any });
          if (result.status === 'success') return (result as any).result as WizardResult;
          return null;
        } catch (e: any) {
          console.log('[Mastra wizard-workflow] Workflow suspended, loading state...');
        }
        return null;
      })
    );

    const state = await loadWizardState(threadId);
    if (!state) throw new Error('No wizard state found after init');

    const interruptData: any = {
      type: 'review_story',
      narrativePlan: state.narrativePlan,
      videoMeta: state.videoMeta,
      selectedArc: state.selectedArc?.name ?? 'documentary',
      engagementScore: state.engagementScore,
      visualStyleGuide: state.visualStyleGuide ?? '',
      storyBible: state.storyBible ?? '',
    };

    return {
      status: 'interrupted',
      interrupt: interruptData,
      stateSnapshot: state as any,
      tokensUsed: getTokenTotal(),
    };
  } catch (e: any) {
    console.error('[Mastra wizard-workflow] Failed:', e.message);
    return {
      status: 'complete',
      payload: { videoMeta: input.partialVideoMeta, contentBlocks: [] },
      stateSnapshot: {},
      tokensUsed: getTokenTotal(),
    };
  }
}

export async function resumeWizardWorkflow(
  threadId: string,
  value: any,
  freshApiKey?: string,
): Promise<WizardResult> {
  console.log('[Mastra wizard-workflow] Resuming...');

  const state = await loadWizardState(threadId);
  if (!state) throw new Error('No wizard state found for thread: ' + threadId);

  if (freshApiKey) state.input.apiKey = freshApiKey;

  const phase = state.phase;
  const inlineMode = state.inlineMode ?? false;
  const { input, videoMeta, selectedArc, narrativePlan, visualStyleGuide, storyBible, selectedLenses, mediaStrategy, researchContext } = state;

  const editedScripts: Record<string, string> = value?.editedScripts ?? {};
  const updatedPlan = narrativePlan.map((brief: NarrativeBrief, i: number) =>
    editedScripts[i] !== undefined ? { ...brief, spokenScript: editedScripts[i] } : brief
  );

  try {
    // ====================================================================
    // INLINE MODE: Handle user changes from chat
    // User can request: re-plan, change arc, change blocks, finalize
    // ====================================================================
    if (inlineMode) {
      const action = value?.action ?? 'finalize';

      if (action === 'finalize' || phase === 'preview') {
        // Apply any overrides from the user's chat feedback
        let blocks = [...state.filledBlocks];

        // Apply audio overrides from value parameter
        const audioOverrides = value?.audioOverrides ?? {};
        for (const [idx, override] of Object.entries(audioOverrides)) {
          const blockIdx = parseInt(idx, 10);
          if (blockIdx >= 0 && blockIdx < blocks.length && override) {
            const o = override as any;
            if (o.audioSrc) blocks[blockIdx] = { ...blocks[blockIdx], audioSrc: o.audioSrc };
            if (o.spokenScript) blocks[blockIdx] = { ...blocks[blockIdx], spokenScript: o.spokenScript };
          }
        }

        // Apply script edits
        for (let i = 0; i < blocks.length; i++) {
          if (editedScripts[i] !== undefined) {
            blocks[i] = { ...blocks[i], spokenScript: editedScripts[i] };
          }
        }

        // Apply image overrides
        const imageOverrides = value?.imageOverrides ?? {};
        for (const [idx, override] of Object.entries(imageOverrides)) {
          const blockIdx = parseInt(idx, 10);
          if (blockIdx >= 0 && blockIdx < blocks.length && override) {
            const o = override as any;
            if (o.imageSrc) blocks[blockIdx] = { ...blocks[blockIdx], imageSrc: o.imageSrc };
            if (o.src) blocks[blockIdx] = { ...blocks[blockIdx], src: o.src };
          }
        }

        if (action === 'finalize') {
          // Finalize the video
          const contentBlocks = await applyBlockPostProcessors(blocks, input.templateBlocks, videoMeta);
          const payload = { videoMeta, contentBlocks };

          try {
            await wizardJobs.updateJob(threadId, { status: 'complete', payload });
          } catch { /* ignore */ }

          return {
            status: 'complete',
            payload,
            stateSnapshot: { ...state, narrativePlan: updatedPlan } as any,
            tokensUsed: getTokenTotal(),
          };
        }

        // action === 'regenerate' or any other — regenerate all blocks with new params
        const regenResult = await withTokenTracking(async () => {
          return fillAllBlocks({
            templateBlocks: input.templateBlocks,
            narrativePlan: updatedPlan,
            userStory: input.userStory,
            visualStyleGuide: value?.visualStyleGuide ?? visualStyleGuide ?? '',
            storyBible: value?.storyBible ?? storyBible ?? '',
            selectedArc,
            selectedLenses,
            mediaStrategy,
            researchContext,
            videoMeta,
            preferredVoice: value?.preferredVoice ?? input.preferredVoice,
            language: input.language,
            apiKey: input.apiKey,
            model: input.model,
          });
        });

        const wizardState = {
          ...state,
          narrativePlan: updatedPlan,
          blocksWithImages: regenResult.result.blocksWithContent,
          imageItems: regenResult.result.allImageItems,
          videoItems: regenResult.result.allVideoItems,
          filledBlocks: regenResult.result.filledBlocks,
          audioItems: regenResult.result.audioItems,
          phase: 'preview',
        };
        await saveWizardState(threadId, wizardState);

        const preview = {
          narrativePlan: updatedPlan,
          selectedArc: selectedArc?.name ?? 'documentary',
          visualStyleGuide: value?.visualStyleGuide ?? visualStyleGuide ?? '',
          storyBible: value?.storyBible ?? storyBible ?? '',
          blocksWithImages: regenResult.result.blocksWithContent,
          imageItems: regenResult.result.allImageItems,
          videoItems: regenResult.result.allVideoItems,
          filledBlocks: regenResult.result.filledBlocks,
          audioItems: regenResult.result.audioItems,
          videoMeta,
        };

        return {
          status: 'interrupted',
          interrupt: {
            type: 'preview_ready',
            message: 'Updated preview is ready! Continue chatting or type "finalize" to finish.',
          },
          payload: preview,
          stateSnapshot: wizardState as any,
          tokensUsed: getTokenTotal(),
          preview,
        };
      }
    }

    // ====================================================================
    // PAGED MODE (legacy): Phase-based resume
    // ====================================================================
    if (phase === 'review_story') {
      const allImageItems: WizardImageItem[] = [];
      const allVideoItems: WizardVideoItem[] = [];

      const blocksWithImages = await Promise.all(
        input.templateBlocks.map(async (block: any, i: number) => {
          const brief = updatedPlan[i] ?? null;
          try {
            let schemaDescriptions: Record<string, string> | undefined;
            if (block.type === 'custom-plugin') {
              const pluginMeta = await fillCustomPluginBlock(block, brief, input.userStory, input.apiKey, input.model);
              block = { ...block, ...pluginMeta.rawContent, generationFields: pluginMeta.generationFields };
              schemaDescriptions = pluginMeta.schemaDescriptions;
            }

            const { rawContent, error } = await generateContent({
              blockType: block.type, blockIndex: i, userStory: input.userStory, originalBlock: block,
              narrativeBrief: brief, visualStyleGuide, storyBible, arcName: selectedArc?.name ?? '',
              selectedLenses, researchContext, mediaStrategy, aspectRatio: videoMeta.aspectRatio ?? '9:16',
              language: input.language, apiKey: input.apiKey, model: input.model, schemaDescriptions,
            });
            if (error) return block;

            const { imageFields, audioFields, videoFields, rawContent: updatedRawContent } = await classifyMediaFields({
              rawContent, blockType: block.type, originalBlock: block, narrativeBrief: brief,
              mediaStrategy, blockIndex: i,
            });

            const effectiveRawContent = updatedRawContent ?? rawContent;

            const [imgResult, videoResult] = await Promise.all([
              resolveImages({ imageFields, rawContent: effectiveRawContent, blockIndex: i, blockType: block.type, mediaStrategy, visualStyleGuide, apiKey: input.apiKey }),
              resolveVideo({ videoFields, rawContent: effectiveRawContent, blockIndex: i }),
            ]);

            const combinedUrls = { ...imgResult.resolvedUrls, ...videoResult.resolvedUrls };

            for (const [path, url] of Object.entries(imgResult.resolvedUrls)) {
              const desc = imageFields.find((f: any) => f.path === path)?.description ?? '';
              const match = path.match(/^layers\[(\d+)]/);
              const playerImgMatch = path.match(/^players\[(\d+)]\.image$/);
              const removeBg = match ? !!(effectiveRawContent?.layers?.[parseInt(match[1], 10)]?.removeBackground) : !!playerImgMatch;
              allImageItems.push({ blockIdx: i, fieldPath: path, url, description: desc, removeBackground: removeBg });
            }
            for (const { path, prompt } of videoFields) {
              allVideoItems.push({ blockIdx: i, fieldPath: path, url: '', description: prompt });
            }

            const { finalBlock } = await mergeBlock({
              rawContent: effectiveRawContent, resolvedUrls: combinedUrls, resolvedAudio: {},
              originalBlock: block, blockType: block.type, blockIndex: i, narrativeBrief: brief,
            });
            return mergeParallaxLayers(finalBlock, block);
          } catch (e: any) {
            return block;
          }
        })
      );

      const imageInterrupt = {
        type: 'review_images',
        imageItems: allImageItems,
        videoItems: allVideoItems,
        blocksWithImages,
      };

      const wizardState = {
        ...state,
        narrativePlan: updatedPlan,
        blocksWithImages,
        imageItems: allImageItems,
        videoItems: allVideoItems,
        phase: 'review_images',
      };
      await saveWizardState(threadId, wizardState);

      return {
        status: 'interrupted',
        interrupt: imageInterrupt,
        stateSnapshot: wizardState as any,
        tokensUsed: getTokenTotal(),
      };
    }

    if (phase === 'review_images') {
      const filledBlocks = await Promise.all(
        (state.blocksWithImages as any[]).map(async (block: any, i: number) => {
          try {
            const audioFields = extractAudioFields(block);
            if (audioFields.length === 0) return block;

            let updated = { ...block };
            for (const { path, text } of audioFields) {
              if (text && !text.startsWith('data:') && !text.startsWith('http')) {
                try {
                  const audioResult = await resolveAudio({
                    audioFields: [{ path, text }],
                    preferredVoice: input.preferredVoice,
                    blockIndex: i,
                  });
                  if (audioResult.resolvedAudio[path]) {
                    updated = setBlockNestedValue(updated, path, audioResult.resolvedAudio[path]);
                  }
                } catch (e: any) {
                  console.warn(`[Mastra wizard-workflow] Audio failed for block ${i} path ${path}: ${e.message}`);
                }
              }
            }
            return updated;
          } catch (e: any) {
            return block;
          }
        })
      );

      const audioItems = filledBlocks.map((block: any, idx: number) => {
        const audioSrc = block.audioSrc ?? '';
        const hasAudio = audioSrc.startsWith('data:') || audioSrc.startsWith('http');
        return {
          blockIdx: idx,
          narrativeRole: block.narrativeRole ?? block.role ?? `block_${idx}`,
          hasAudio,
          audioUrl: hasAudio ? audioSrc : '',
          script: block.spokenScript ?? (!hasAudio ? audioSrc : '') ?? '',
        };
      });

      const audioInterrupt = {
        type: 'review_audio',
        audioItems,
        filledBlocks,
      };

      const wizardState = {
        ...state,
        narrativePlan: updatedPlan,
        filledBlocks,
        phase: 'review_audio',
      };
      await saveWizardState(threadId, wizardState);

      return {
        status: 'interrupted',
        interrupt: audioInterrupt,
        stateSnapshot: wizardState as any,
        tokensUsed: getTokenTotal(),
      };
    }

    if (phase === 'review_audio') {
      let blocks = [...state.filledBlocks];

      // FIX: Apply user audio overrides from value parameter
      // (previously only read from resumeData which was empty in convenience wrapper path)
      const audioOverrides = value?.audioOverrides ?? {};
      for (const [idx, override] of Object.entries(audioOverrides)) {
        const blockIdx = parseInt(idx, 10);
        if (blockIdx >= 0 && blockIdx < blocks.length && override) {
          const o = override as any;
          if (o.audioSrc) blocks[blockIdx] = { ...blocks[blockIdx], audioSrc: o.audioSrc };
          if (o.spokenScript) blocks[blockIdx] = { ...blocks[blockIdx], spokenScript: o.spokenScript };
        }
      }

      const contentBlocks = await applyBlockPostProcessors(blocks, input.templateBlocks, videoMeta);
      const payload = { videoMeta, contentBlocks };

      try {
        await wizardJobs.updateJob(threadId, { status: 'complete', payload });
      } catch { /* ignore */ }

      return {
        status: 'complete',
        payload,
        stateSnapshot: { ...state, narrativePlan: updatedPlan } as any,
        tokensUsed: getTokenTotal(),
      };
    }

    throw new Error(`Unknown wizard phase: ${phase}`);
  } catch (e: any) {
    console.error('[Mastra wizard-workflow] Resume failed:', e.message);
    return {
      status: 'complete',
      payload: { videoMeta: input.partialVideoMeta, contentBlocks: [] },
      stateSnapshot: {},
      tokensUsed: getTokenTotal(),
    };
  }
}
