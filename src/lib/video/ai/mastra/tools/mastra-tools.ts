import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { createHash } from 'crypto';
import { selectArc } from './select-arc.tool';
import { runDirector } from './director.tool';
import { evaluateEngagement, ENGAGEMENT_THRESHOLD, MAX_DIRECTOR_LOOPS } from './evaluate-engagement.tool';
import { generateContent } from './generate-content.tool';
import { enrichVideoMeta } from './enrich-video-meta.tool';
import { planMediaStrategyViaAgent } from './planner.tool';
import { classifyMediaFields } from './classify-media-fields.tool';
import { resolveImages, resolveAudio, resolveVideo } from './resolve-media.tool';
import { mergeBlock } from './merge-block.tool';
import { mergeParallaxLayers, extractAudioFields, applyBlockPostProcessors, getBlockNestedValue, setBlockNestedValue } from '../shared/utils';
import { callAIWithTracking, parseJSON } from '../shared/utils';
import { ARC_PATTERNS, VISUAL_STYLE_PRESETS } from '../shared/arc-patterns';
import { BLOCK_SCHEMAS } from '../shared/block-schemas';
import { pluginOrchestratorAgent } from '../agents/plugin-orchestrator.agent';
import { fillCustomPluginBlock } from '@/lib/video/ai/fill-custom-plugin';
import { db } from '@/lib/db';
import * as wizardJobs from '@/lib/mcp/wizard-jobs';
import { patchJobState } from '@/lib/mcp/wizard-jobs';
import { normalizePluginId } from '@/lib/plugins/utils';
import { createPluginFromSource } from '@/lib/plugins/create-plugin';
import { derivePluginTags, normalizeTags, parseTags } from '@/lib/plugins/tags';
import { formatDependencyPolicyChanges, normalizePluginDependencies } from '@/lib/plugins/dependency-policy';

// ============================================================================
// Server-controlled model — never accept from agent input to prevent the
// LLM from hallucinating invalid model IDs (e.g. 'gemini-1.5-flash').
// ============================================================================
const SERVER_MODEL = process.env.DEFAULT_AI_MODEL || 'google/gemini-2.5-flash';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
  return `{${entries.join(',')}}`;
}

function computePendingPluginSourceHash(pending: Record<string, any>): string {
  return createHash('sha256')
    .update(stableStringify({
      sceneCode: pending.sceneCode ?? '',
      modules: pending.modules ?? null,
      schemaJson: pending.schemaJson ?? '',
      dependencies: pending.dependencies ?? {},
    }))
    .digest('hex')
    .slice(0, 16);
}

async function getThreadUserId(threadId: string): Promise<string> {
  const job = await wizardJobs.getJob(threadId);
  const userId = job?.user_id;
  if (!userId) {
    throw new Error(`Cannot assemble video: no user found for thread ${threadId}`);
  }
  return userId;
}

// ============================================================================
// Block type descriptions — agent fuzzy-matches user words against these
// ("a graph" → line-chart, "tower" → tower-chart-3d).
// Builtins are derived from BLOCK_SCHEMAS keys at runtime — no separate list.
// ============================================================================

// Short descriptions so the agent can fuzzy-match user words ("a graph" → line-chart)
const BUILT_IN_BLOCK_DESCRIPTIONS: Record<string, string> = {
  'stat': 'Big single stat / number with label',
  'text': 'Plain text / paragraph block',
  'quote': 'Pull-quote with attribution',
  'image': 'Single image with optional caption',
  'motivational-image': 'Hero image with inspirational overlay text',
  'testimonial': 'User testimonial with avatar + quote',
  'list': 'Bulleted list of items',
  'timeline': 'Chronological timeline of events',
  'callout': 'Highlighted info box / tip / warning',
  'icon-list': 'List of items each with an icon',
  'comparison': 'Side-by-side comparison of two things',
  'line-chart': 'Line graph for trends over time',
  'pie-chart': 'Pie / donut chart for proportions',
  'whatsapp-chat': 'WhatsApp-style chat bubble conversation',
  'counter': 'Animated number counter',
  'progress-bar': 'Progress bar for a metric',
  'social-stats': 'Social media follower / engagement numbers',
  'cta': 'Call-to-action block (final slide)',
  'gradient-text': 'Large stylized gradient headline',
  'avatar-grid': 'Grid of profile avatars',
  'countdown': 'Countdown timer',
  'animated-bg': 'Animated background with text overlay',
  'parallax-story': 'Cinematic parallax scene — most visually impressive',
  'tower-chart-3d': '3D tower / ranking chart — ranked items (players, brands, scores) displayed as 3D bars',
  'top-players': 'Top players leaderboard — showcases ranked athletes or competitors with stats and images',
  'video': 'Embedded video clip',
  'html': 'Free-form HTML block',
  'diagram': 'Diagram / flowchart',
  'custom-plugin': 'User-installed custom plugin (requires pluginId from list-plugins)',
};

const BUILT_IN_BLOCK_TAGS: Record<string, string[]> = {
  'stat': ['data', 'metric', 'kpi', 'number', 'business'],
  'text': ['text', 'title', 'paragraph', 'simple', 'narration'],
  'quote': ['quote', 'testimonial', 'inspiration', 'speech'],
  'image': ['image', 'photo', 'visual', 'screenshot', 'media'],
  'motivational-image': ['image', 'hero', 'cinematic', 'motivation', 'overlay'],
  'testimonial': ['testimonial', 'review', 'customer', 'social-proof', 'quote'],
  'list': ['list', 'bullets', 'steps', 'features', 'summary'],
  'timeline': ['timeline', 'history', 'sequence', 'roadmap', 'events'],
  'callout': ['callout', 'tip', 'warning', 'highlight', 'info'],
  'icon-list': ['icons', 'features', 'benefits', 'list', 'ui'],
  'comparison': ['comparison', 'versus', 'vs', 'compare', 'business'],
  'line-chart': ['chart', 'graph', 'data', 'trend', 'analytics'],
  'pie-chart': ['chart', 'data', 'proportion', 'distribution', 'analytics'],
  'whatsapp-chat': ['chat', 'conversation', 'messages', 'social', 'dialogue'],
  'counter': ['counter', 'number', 'metric', 'score', 'stat'],
  'progress-bar': ['progress', 'metric', 'completion', 'status', 'bar'],
  'social-stats': ['social', 'followers', 'engagement', 'stats', 'platform'],
  'cta': ['cta', 'button', 'action', 'signup', 'conversion'],
  'gradient-text': ['text', 'headline', 'title', 'bold', 'typography'],
  'avatar-grid': ['people', 'team', 'avatars', 'profiles', 'community'],
  'countdown': ['countdown', 'timer', 'deadline', 'launch', 'event'],
  'animated-bg': ['background', 'abstract', 'motion', 'visual', 'ambient'],
  'parallax-story': ['cinematic', 'story', 'parallax', 'depth', 'visual'],
  'tower-chart-3d': ['3d', 'ranking', 'leaderboard', 'chart', 'competition'],
  'top-players': ['sports', 'ranking', 'leaderboard', 'players', 'countdown'],
  'video': ['video', 'clip', 'media', 'footage', 'screen-recording'],
  'html': ['html', 'custom', 'layout', 'embed', 'advanced'],
  'diagram': ['diagram', 'flowchart', 'architecture', 'process', 'network'],
};

type CatalogKind = 'builtin' | 'plugin';

type CatalogEntry = {
  id: string;
  kind: CatalogKind;
  name: string;
  description: string;
  category?: string;
  tags: string[];
  likesCount?: number;
  blockUsage: Record<string, any>;
};

function parseCatalogLimit(value: number | undefined, fallback: number): number {
  if (!Number.isFinite(value ?? NaN)) return fallback;
  return Math.max(1, Math.min(50, Math.floor(value as number)));
}

function getQueryTerms(query?: string | null): string[] {
  if (!query) return [];
  return normalizeTags(query.split(/[^a-zA-Z0-9]+/));
}

function scoreCatalogEntry(entry: CatalogEntry, params: {
  query?: string | null;
  tags?: string[];
  category?: string | null;
  kind?: CatalogKind | 'all' | null;
}): number {
  if (params.kind && params.kind !== 'all' && entry.kind !== params.kind) return -Infinity;

  const requestedCategory = params.category ? normalizeTags([params.category])[0] : '';
  if (requestedCategory && normalizeTags([entry.category ?? ''])[0] !== requestedCategory) {
    return -Infinity;
  }

  const requestedTags = normalizeTags(params.tags ?? []);
  const queryTerms = getQueryTerms(params.query);
  const haystack = normalizeTags([
    entry.id,
    entry.name,
    entry.description,
    entry.category,
    ...entry.tags,
  ]);
  const haystackText = `${entry.id} ${entry.name} ${entry.description} ${entry.category ?? ''}`.toLowerCase();

  let score = requestedCategory ? 6 : 0;

  for (const tag of requestedTags) {
    if (entry.tags.includes(tag)) score += 10;
    else if (haystack.includes(tag)) score += 5;
  }

  for (const term of queryTerms) {
    if (entry.id.toLowerCase() === term || entry.name.toLowerCase() === term) score += 20;
    else if (entry.id.toLowerCase().includes(term) || entry.name.toLowerCase().includes(term)) score += 8;
    if (entry.tags.includes(term)) score += 10;
    else if (haystack.includes(term)) score += 4;
    else if (haystackText.includes(term)) score += 2;
  }

  if (entry.kind === 'plugin') {
    score += Math.log10((entry.likesCount ?? 0) + 1);
  }

  return score;
}

function rankCatalogEntries(entries: CatalogEntry[], params: {
  query?: string | null;
  tags?: string[];
  category?: string | null;
  kind?: CatalogKind | 'all' | null;
  limit?: number;
  fallbackLimit: number;
}): CatalogEntry[] {
  const hasFilter = Boolean(params.query?.trim()) || (params.tags?.length ?? 0) > 0 || Boolean(params.category) || Boolean(params.kind && params.kind !== 'all');
  const limit = parseCatalogLimit(params.limit, params.fallbackLimit);
  return entries
    .map((entry) => ({ entry, score: scoreCatalogEntry(entry, params) }))
    .filter(({ score }) => Number.isFinite(score) && (!hasFilter || score > 0))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if ((b.entry.likesCount ?? 0) !== (a.entry.likesCount ?? 0)) {
        return (b.entry.likesCount ?? 0) - (a.entry.likesCount ?? 0);
      }
      if (a.entry.kind !== b.entry.kind) return a.entry.kind === 'builtin' ? -1 : 1;
      return a.entry.name.localeCompare(b.entry.name);
    })
    .slice(0, limit)
    .map(({ entry }) => entry);
}

function builtinCatalogEntries(): CatalogEntry[] {
  return Object.keys(BLOCK_SCHEMAS)
    .filter(t => t !== 'custom-plugin')
    .map(t => ({
      id: t,
      kind: 'builtin' as const,
      name: t,
      description: BUILT_IN_BLOCK_DESCRIPTIONS[t] ?? t,
      category: 'builtin',
      tags: normalizeTags([...(BUILT_IN_BLOCK_TAGS[t] ?? []), t, BUILT_IN_BLOCK_DESCRIPTIONS[t] ?? t]),
      blockUsage: { type: t },
    }));
}

// ============================================================================
// Progress event emission — `data-wizard-progress` custom chunks
// ============================================================================
// Mastra v1.24.1 does NOT forward nested tool-call/tool-result chunks through
// multi-level agent delegation (supervisor → wizard → story/generator). But
// it DOES forward `data-*` custom chunks via context.writer.custom() across
// every delegation layer (see node_modules/@mastra/core/dist/chunk-4TUIZXRS.js
// lines 22878-22879). Tools emit explicit start/complete/error events so the
// frontend can render skeletons, per-block fill progress, and final preview.

type ProgressStatus = 'start' | 'complete' | 'error';

function makeProgressToolCallId(phase: string): string {
  return `${phase}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function emitProgress(
  ctx: any,
  phase: string,
  status: ProgressStatus,
  extra: Record<string, any> = {},
  toolCallId?: string,
): Promise<string> {
  const id = toolCallId ?? makeProgressToolCallId(phase);
  try {
    await ctx?.writer?.custom?.({
      type: 'data-wizard-progress',
      data: { phase, status, toolCallId: id, ...extra },
      transient: false,
    });
  } catch {
    // writer may be undefined outside a streaming context (e.g. MCP one-shot) — non-fatal
  }
  return id;
}

// ============================================================================
// Tool 1: selectArc — Choose the best narrative arc for a story
// ============================================================================

export const selectArcMastra = createTool({
  id: 'select-arc',
  description: 'Choose the best narrative arc pattern for a video story. Returns the arc name, roles, tone, and description.',
  inputSchema: z.object({
    userStory: z.string().describe('The story or topic the user wants to create a video about'),
    preferredArc: z.string().nullable().optional().describe('Preferred arc name if the user specified one, e.g. "documentary" or "listicle"'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData) => {
    const { userStory, preferredArc, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';
    const arc = await selectArc({
      userStory,
      templateBlocks: [{ type: 'text' }], // placeholder — agent doesn't know blocks yet
      preferredArc: preferredArc ?? null,
      arcPatternCatalog: ARC_PATTERNS,
      apiKey,
      model: SERVER_MODEL,
    });
    return {
      arcName: arc.name,
      description: arc.description,
      roles: arc.roles,
      defaultTone: arc.defaultTone,
    };
  },
});

// ============================================================================
// Tool 2: planNarrative — Plan the full narrative across blocks
// ============================================================================

export const planNarrativeMastra = createTool({
  id: 'plan-narrative',
  description: 'Plan a complete narrative for a video. Creates a narrative plan with one brief per block, a visual style guide, story bible, and consistency lenses. This is the core creative tool.',
  inputSchema: z.object({
    userStory: z.string().describe('The story or topic'),
    blockTypes: z.array(z.string()).describe('Array of block type names, one per block, e.g. ["parallax-story","stat","quote"]'),
    preferredArc: z.string().nullable().optional().describe('Preferred arc name'),
    preferredVisualStyle: z.string().nullable().optional().describe('Preferred visual style, e.g. "photorealistic" or "anime"'),
    customVisualPrompt: z.string().nullable().optional().describe('Custom visual style description'),
    language: z.string().optional().describe('Language code, e.g. "en" or "es"'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData) => {
    const { userStory, blockTypes, preferredArc, preferredVisualStyle, customVisualPrompt, language, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';

    const templateBlocks = blockTypes.map(type => ({ type }));
    const resolvedModel = SERVER_MODEL;

    const result = await runDirector({
      userStory,
      templateBlocks,
      selectedArc: null,
      preferredArc: preferredArc ?? null,
      customArc: null,
      arcPatternCatalog: ARC_PATTERNS,
      visualStyleCatalog: VISUAL_STYLE_PRESETS,
      preferredVisualStyle: preferredVisualStyle ?? null,
      customVisualPrompt: customVisualPrompt ?? null,
      engagementFeedback: '',
      engagementScore: 0,
      directorLoopCount: 0,
      researchContext: '',
      language: language ?? 'en',
      apiKey,
      model: resolvedModel,
    });

    return {
      selectedArc: result.selectedArc.name,
      narrativePlan: result.narrativePlan.map(b => ({
        narrativeRole: b.narrativeRole,
        angle: b.angle,
        tone: b.tone,
        keyMessage: b.keyMessage,
        visualMood: b.visualMood,
        spokenScript: b.spokenScript,
      })),
      visualStyleGuide: result.visualStyleGuide,
      storyBible: result.storyBible,
      selectedLenses: result.selectedLenses,
    };
  },
});

// ============================================================================
// Tool 3: evaluateEngagement — Score narrative quality
// ============================================================================

export const evaluateEngagementMastra = createTool({
  id: 'evaluate-engagement',
  description: 'Evaluate the quality and engagement potential of a narrative plan. Returns a score (1-10) and specific feedback for improvement.',
  inputSchema: z.object({
    userStory: z.string().describe('The original story/topic'),
    narrativePlan: z.array(z.any()).describe('The narrative plan to evaluate'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData) => {
    const { userStory, narrativePlan, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';
    const result = await evaluateEngagement({
      userStory,
      narrativePlan,
      directorLoopCount: 1,
      language: 'en',
      apiKey,
      model: SERVER_MODEL,
    });
    return {
      engagementScore: result.engagementScore,
      engagementFeedback: result.engagementFeedback,
    };
  },
});

// ============================================================================
// Tool 4: generateContent — Generate content for a single block
// ============================================================================

export const generateContentMastra = createTool({
  id: 'generate-content',
  description: 'Generate structured content for a single video block. Returns raw content that can be merged into a block.',
  inputSchema: z.object({
    blockType: z.string().describe('Type of block, e.g. "stat", "parallax-story", "quote"'),
    blockIndex: z.number().describe('0-based index of this block in the video'),
    userStory: z.string().describe('The story/topic'),
    narrativeBrief: z.any().describe('The narrative brief for this block from the plan'),
    visualStyleGuide: z.string().optional().describe('Visual style guide for consistency'),
    storyBible: z.string().optional().describe('Story bible for context'),
    arcName: z.string().optional().describe('Selected narrative arc name'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData) => {
    const { blockType, blockIndex, userStory, narrativeBrief, visualStyleGuide, storyBible, arcName, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';
    const result = await generateContent({
      blockType,
      blockIndex,
      userStory,
      originalBlock: { type: blockType },
      narrativeBrief,
      visualStyleGuide: visualStyleGuide ?? '',
      storyBible: storyBible ?? '',
      arcName: arcName ?? '',
      selectedLenses: [],
      researchContext: '',
      mediaStrategy: { needsResearch: false, needsNewsSearch: false, researchQueries: [], topicType: 'creative', blockStrategies: [] },
      aspectRatio: '9:16',
      language: 'en',
      apiKey,
      model: SERVER_MODEL,
    });
    return {
      rawContent: result.rawContent,
      error: result.error ?? null,
    };
  },
});

// ============================================================================
// Tool 5: selectTemplate — Choose the best block types for a story (NEW)
// ============================================================================

export const selectTemplateMastra = createTool({
  id: 'select-template',
  description: 'Choose the best template structure (block types) for a video based on the user story. The agent uses this to decide what visual elements to include — e.g. charts for data stories, parallax for emotional stories, diagrams for explainer content.',
  inputSchema: z.object({
    userStory: z.string().describe('The story or topic the user wants a video about'),
    blockCount: z.number().min(2).max(10).describe('Number of blocks/scenes in the video (2-10)'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData) => {
    const { userStory, blockCount, apiKey: _apiKey } = inputData;
    console.log(`[select-template] ▶ invoked — blockCount=${blockCount} userStory=${JSON.stringify(userStory).slice(0, 120)}`);
    const apiKey = _apiKey ?? '';
    const resolvedModel = SERVER_MODEL;

    const blockTypeList = Object.keys(BLOCK_SCHEMAS).filter(t => t !== 'custom-plugin').map(t => `- "${t}"`).join('\n');

    const response = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a video production designer. Choose the best block types for a short-form video.

Available block types:
${blockTypeList}

Guidelines:
- Always start with an engaging first block (gradient-text, motivational-image, or parallax-story for strong openers)
- Always end with a CTA or impactful closer (cta, gradient-text, or motivational-image)
- For data-heavy stories: use stat, counter, progress-bar, line-chart, pie-chart
- For emotional stories: use parallax-story, motivational-image, quote, testimonial
- For educational content: use diagram, timeline, list, callout, text
- For product content: use stat, comparison, testimonial, cta, progress-bar
- Mix visual variety — don't use the same block type more than twice
- parallax-story blocks are the most visually impressive — use at least one for impactful stories
- Each block type has specific strengths — leverage them

Return ONLY valid JSON (no markdown):
{
  "blocks": [ { "type": "block_type_name" }, ... exactly ${blockCount} blocks ... ],
  "reasoning": "one sentence explaining why this structure fits"
}`,
        },
        {
          role: 'user',
          content: `Story: "${userStory}"\n\nChoose ${blockCount} block types for this video.`,
        },
      ],
      apiKey,
      model: resolvedModel,
      maxTokens: 500,
    });

    try {
      const parsed = parseJSON(response);
      return {
        blocks: parsed.blocks ?? [],
        reasoning: parsed.reasoning ?? '',
      };
    } catch {
      // Fallback: generic template
      const fallbackBlocks = [
        { type: 'gradient-text' },
        ...Array(blockCount - 2).fill(null).map(() => ({ type: 'text' })),
        { type: 'cta' },
      ].slice(0, blockCount);
      return {
        blocks: fallbackBlocks,
        reasoning: 'Fallback template: simple text-based structure',
      };
    }
  },
});

// ============================================================================
// Tool 6: createPlugin — Create a custom plugin on-the-fly (auto-build path)
// ============================================================================

export const createPluginMastra = createTool({
  id: 'create-plugin',
  description: 'Create a custom visual plugin on-the-fly. Runs the plugin-creator sub-agent (schema → plan → code → review), saves the code, then auto-builds it. Returns { pluginId, blockUsage }.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID (used to resolve the owning user for the plugins table)'),
    pluginName: z.string().describe('A short kebab-case id for the plugin, e.g. "3d-globe" or "stock-ticker". Must be lowercase letters, numbers, and hyphens only.'),
    description: z.string().describe('What the plugin should look like and do, in detail'),
    userStory: z.string().describe('The story context so the plugin matches the video theme'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, pluginName, description, userStory } = inputData;

    const pluginId = normalizePluginId(pluginName);
    console.log(`[create-plugin-tool] Starting creation loop for: ${pluginName} (ID: ${pluginId})`);

    const progressId = await emitProgress(ctx, 'create-plugin', 'start', { pluginName, pluginId });

    if (!pluginId) {
      await emitProgress(ctx, 'create-plugin', 'error', { errorMessage: 'pluginName must contain at least one letter or digit' }, progressId);
      return { error: 'pluginName must contain at least one letter or digit' };
    }

    let userId: string | null = null;
    try {
      const job = await wizardJobs.getJob(threadId);
      const raw = job?.user_id ?? null;
      userId = raw && raw.length > 0 ? raw : null;
    } catch { /* best-effort */ }

    if (!userId) {
      await emitProgress(ctx, 'create-plugin', 'error', { errorMessage: 'No authenticated user attached to this thread' }, progressId);
      return { error: 'Cannot create plugin: no authenticated user attached to this thread.' };
    }

    // Run the plugin creator agent. It generates code, reviews it, then calls
    // savePendingPlugin which persists code to job state.
    let result: Awaited<ReturnType<typeof pluginOrchestratorAgent.generate>>;
    try {
      result = await pluginOrchestratorAgent.generate(
        [{
          role: 'user',
          content: JSON.stringify({ pluginId, pluginName, description, userStory, userId, threadId }),
        }],
        {
          maxSteps: 25,
          tracingOptions: {
            metadata: {
              userId,
              sessionId: threadId,
              route: 'create-plugin',
              pluginId,
            },
            tags: ['plugin-create'],
          },
        },
      );
    } catch (e: any) {
      console.error('[create-plugin-tool] sub-agent threw:', e?.message ?? e);
      await emitProgress(ctx, 'create-plugin', 'error', { errorMessage: e?.message ?? 'unknown error' }, progressId);
      return { error: `Plugin sub-agent failed: ${e?.message ?? 'unknown error'}` };
    }

    // Parse the agent's final output — agent returns { ok, pluginId, name }
    let out: Record<string, any> | null = null;
    if (result.text?.trim()) {
      try { out = parseJSON(result.text); } catch { out = null; }
    }

    // Fallback: extract from savePendingPlugin tool result in steps
    if (!out?.ok) {
      const steps = (result as any).steps ?? [];
      for (const step of [...steps].reverse()) {
        const tr = step?.toolResults ?? step?.toolCalls ?? [];
        for (const t of tr) {
          if (t?.toolName === 'savePendingPlugin' && t?.result?.ok) {
            out = t.result;
            break;
          }
        }
        if (out) break;
      }
    }

    if (!out?.ok) {
      await emitProgress(ctx, 'create-plugin', 'error', { errorMessage: out?.error ?? 'Plugin creation failed' }, progressId);
      return { error: out?.error ?? 'Plugin creation failed' };
    }

    // The agent saved pendingPlugin via savePendingPlugin tool. Now auto-build
    // for the workflow/director path (no user gate needed here).
    let pendingPlugin: Record<string, any> | null = null;
    try {
      const job = await wizardJobs.getJob(threadId);
      pendingPlugin = job?.state?.pendingPlugin ?? null;
    } catch { /* best-effort */ }

    if (!pendingPlugin || pendingPlugin.pluginId !== pluginId) {
      await emitProgress(ctx, 'create-plugin', 'error', { errorMessage: 'Plugin code was not saved — savePendingPlugin may have failed' }, progressId);
      return { error: 'Plugin code was not saved to job state.' };
    }

    const buildResult = await createPluginFromSource({
      id: pluginId,
      name: pluginName,
      description,
      category: 'custom',
      sceneCode: pendingPlugin.sceneCode,
      modules: pendingPlugin.modules,
      schemaJson: pendingPlugin.schemaJson,
      dependencies: pendingPlugin.dependencies,
      userId,
    });

    if (!buildResult.ok) {
      await emitProgress(ctx, 'create-plugin', 'error', { errorMessage: buildResult.error }, progressId);
      return { error: buildResult.error, errors: buildResult.errors };
    }

    // Clear pendingPlugin from job state
    try {
      await patchJobState(threadId, (current) => { const next = { ...current }; delete next.pendingPlugin; return next; });
    } catch { /* non-fatal */ }

    const blockUsage = { type: 'custom-plugin', pluginId: buildResult.pluginId };
    await emitProgress(ctx, 'create-plugin', 'complete', { pluginId: buildResult.pluginId, blockUsage }, progressId);
    return {
      pluginId: buildResult.pluginId,
      name: buildResult.name,
      builtInSandbox: buildResult.builtInSandbox,
      warnings: buildResult.warnings ?? [],
      blockUsage,
      nextSteps: [
        `1. Add { "type": "custom-plugin", "pluginId": "${buildResult.pluginId}" } to the template blocks.`,
        '2. Call generateBlock for the new block.',
        '3. Call assembleVideo.',
      ],
    };
  },
});

// ============================================================================
// Tool 7: buildAndSavePlugin — Build and save an approved pending plugin
// Called by wizard after user approves the preview.
// ============================================================================

export const buildAndSavePluginMastra = createTool({
  id: 'build-and-save-plugin',
  description: 'Build and save a plugin after the user has approved its preview. Reads pendingPlugin from job state, runs the real sandbox build (esbuild → S3 → DB), then clears pendingPlugin. Returns { pluginId, blockUsage } — same as create_plugin used to.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID — used to look up pendingPlugin in job state'),
    pluginId: z.string().optional().describe('The plugin ID from the earlier preview. If omitted, the pendingPlugin.pluginId from job state is used.'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, pluginId: inputPluginId } = inputData;

    let pendingPlugin: Record<string, any> | null = null;
    try {
      const job = await wizardJobs.getJob(threadId);
      pendingPlugin = job?.state?.pendingPlugin ?? null;
    } catch (e: any) {
      const progressId = await emitProgress(ctx, 'build-and-save-plugin', 'start', { pluginId: inputPluginId ?? '?' });
      await emitProgress(ctx, 'build-and-save-plugin', 'error', { errorMessage: `Could not read job state: ${e?.message}` }, progressId);
      return { error: `Could not read job state: ${e?.message}` };
    }

    if (!pendingPlugin) {
      const progressId = await emitProgress(ctx, 'build-and-save-plugin', 'start', { pluginId: inputPluginId ?? '?' });
      await emitProgress(ctx, 'build-and-save-plugin', 'error', { errorMessage: 'No pending plugin found in job state — was the preview step skipped?' }, progressId);
      return { error: 'No pending plugin found in job state.' };
    }

    const pluginId = inputPluginId ?? pendingPlugin.pluginId;
    if (pendingPlugin.pluginId !== pluginId) {
      const progressId = await emitProgress(ctx, 'build-and-save-plugin', 'start', { pluginId });
      await emitProgress(ctx, 'build-and-save-plugin', 'error', { errorMessage: `pendingPlugin.pluginId (${pendingPlugin.pluginId}) does not match provided pluginId (${pluginId}).` }, progressId);
      return { error: `pendingPlugin.pluginId (${pendingPlugin.pluginId}) does not match provided pluginId (${pluginId}).` };
    }

    const progressId = await emitProgress(ctx, 'build-and-save-plugin', 'start', { pluginId });

    const depPolicy = normalizePluginDependencies(pendingPlugin.dependencies);
    const depPolicyWarnings = formatDependencyPolicyChanges(depPolicy);
    if (depPolicyWarnings.length > 0) {
      const normalizedPendingPlugin = { ...pendingPlugin, dependencies: depPolicy.dependencies };
      const normalizedSourceHash = computePendingPluginSourceHash(normalizedPendingPlugin);
      try {
        await patchJobState(threadId, (current) => ({ ...current, pendingPlugin: normalizedPendingPlugin }));
      } catch { /* non-fatal; still stop the stale build */ }
      const error =
        `Plugin dependencies were normalized by Skygen policy before final build (${depPolicyWarnings.join('; ')}). ` +
        `current normalized sourceHash=${normalizedSourceHash}. Run compilePreview and savePendingPlugin again before final build.`;
      await emitProgress(ctx, 'build-and-save-plugin', 'error', { errorMessage: error }, progressId);
      return { error, sourceHash: normalizedSourceHash, dependencyPolicy: depPolicy };
    }

    const sourceHash = computePendingPluginSourceHash(pendingPlugin);
    if (pendingPlugin.previewSourceHash !== sourceHash) {
      const error =
        `Approved plugin source does not match the last preview. ` +
        `current sourceHash=${sourceHash}, previewSourceHash=${pendingPlugin.previewSourceHash ?? 'none'}. ` +
        'Ask the plugin orchestrator to run compilePreview and savePendingPlugin again before final build.';
      await emitProgress(ctx, 'build-and-save-plugin', 'error', { errorMessage: error }, progressId);
      return { error, sourceHash, previewSourceHash: pendingPlugin.previewSourceHash ?? null };
    }

    const { pluginName, description, sceneCode, modules, schemaJson, dependencies, userId } = pendingPlugin;

    const result = await createPluginFromSource({
      id: pluginId,
      name: pluginName,
      description: description ?? '',
      category: 'custom',
      sceneCode,
      modules,
      schemaJson,
      dependencies,
      userId: userId ?? null,
    });

    if (!result.ok) {
      await emitProgress(ctx, 'build-and-save-plugin', 'error', { errorMessage: result.error }, progressId);
      return { error: result.error, errors: result.errors };
    }

    // Clear pendingPlugin from job state
    try {
      await patchJobState(threadId, (current) => {
        const next = { ...current };
        delete next.pendingPlugin;
        return next;
      });
    } catch { /* non-fatal */ }

    const blockUsage = { type: 'custom-plugin', pluginId: result.pluginId };
    await emitProgress(ctx, 'build-and-save-plugin', 'complete', { pluginId: result.pluginId, blockUsage }, progressId);
    return {
      pluginId: result.pluginId,
      name: result.name,
      builtInSandbox: result.builtInSandbox,
      warnings: result.warnings ?? [],
      blockUsage,
      nextSteps: [
        `1. Call patchState to append { "type": "custom-plugin", "pluginId": "${result.pluginId}" } to filledBlocks.`,
        '2. Call generateBlock with the index of the new custom-plugin block.',
        '3. Call assembleVideo so the user can see the plugin in the preview.',
      ],
    };
  },
});

// ============================================================================
// Tool: requestCustomPlugin — Wizard signals it needs a new custom plugin
//
// The wizard calls this when the user asks for a block type that doesn't exist.
// It saves the request to job state as an interrupt so the supervisor can
// intercept, spin up pluginCreator, and hand back to wizard with the pluginId.
// ============================================================================

export const requestCustomPluginMastra = createTool({
  id: 'request_custom_plugin',
  description: 'Signal to the supervisor that a custom plugin needs to be built before video generation can continue. Call this when the user wants a block type that does not exist in listBlockTypes.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID from system context'),
    pluginName: z.string().describe('Human-readable plugin name, e.g. "Live Score Ticker"'),
    description: z.string().describe('What the plugin does visually'),
    userStory: z.string().describe("The user's original request verbatim"),
    forkPluginId: z.string().optional().describe('If the user is forking an existing plugin to modify it, provide its ID here.'),
  }),
  execute: async ({ context }) => {
    const { threadId, pluginName, description, userStory, forkPluginId } = context;
    await db.query(
      `UPDATE wizard_jobs SET status = 'interrupted', interrupt = $2, updated_at = NOW() WHERE thread_id = $1`,
      [threadId, JSON.stringify({ type: 'need_custom_plugin', pluginName, description, userStory, forkPluginId })],
    );
    return {
      status: 'plugin_requested',
      message: `Requested custom plugin "${pluginName}". Stop here — the supervisor will build it and call you again with the pluginId.`,
    };
  },
});

// ============================================================================
// Tool: clearPluginInterrupt — Supervisor clears job interrupt after plugin build
// ============================================================================

export const clearPluginInterruptMastra = createTool({
  id: 'clear_plugin_interrupt',
  description: 'Clear the need_custom_plugin interrupt from job state after the plugin has been built. Call this before re-delegating to wizard.',
  inputSchema: z.object({
    threadId: z.string(),
  }),
  execute: async ({ context }) => {
    await db.query(
      `UPDATE wizard_jobs SET interrupt = NULL, status = 'running', updated_at = NOW() WHERE thread_id = $1`,
      [context.threadId],
    );
    return { ok: true };
  },
});

// ============================================================================
// Tool 8: listTemplates — List available video templates
// Queries the Template DB table directly — no HTTP call needed.
// ============================================================================

export const listTemplatesMastra = createTool({
  id: 'list-templates',
  description: 'List all available video templates. Returns each template\'s ID, name, description, category, and block types. Use this when the user wants to browse templates or says "start from a template".',
  inputSchema: z.object({
    category: z.string().optional().describe('Optional category filter, e.g. "motivation", "business", "tutorial"'),
  }),
  execute: async (inputData) => {
    const { category } = inputData;
    console.log(`[list-templates] ▶ invoked — category=${category ?? 'any'}`);
    try {
      let query = `SELECT id, name, description, category, data, "isPublic", "isFreeTier" FROM "Template" WHERE "isPublic" = true`;
      const params: string[] = [];
      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }
      query += ` ORDER BY name`;

      const result = await db.query(query, params);
      const templates = result.rows.map((row: any) => {
        const blocks = Array.isArray(row.data?.blocks) ? row.data.blocks : [];
        return {
          id: row.id,
          name: row.name,
          description: row.description || '',
          category: row.category || 'general',
          blockTypes: blocks.map((b: any) => b.type || 'text'),
          blockCount: blocks.length,
          isFreeTier: row.isFreeTier ?? false,
        };
      });
      console.log(`[list-templates] returning ${templates.length} templates: ${templates.map((t: any) => `"${t.name}"`).join(', ') || '(none)'}`);
      return templates;
    } catch (e: any) {
      console.warn(`[list-templates] query failed: ${e.message}`);
      return [];
    }
  },
});

// ============================================================================
// Tool 8: getTemplate — Fetch a single template's full block structure
// ============================================================================

export const getTemplateMastra = createTool({
  id: 'get-template',
  description: 'Fetch the full block structure and video metadata for a specific template by ID. Use this when the user picks a template from the list and you need its blocks for start-generation.',
  inputSchema: z.object({
    templateId: z.string().describe('Template ID from list-templates'),
  }),
  execute: async (inputData) => {
    const { templateId } = inputData;
    console.log(`[get-template] ▶ invoked — templateId=${templateId}`);
    try {
      const result = await db.query('SELECT * FROM "Template" WHERE id = $1', [templateId]);
      if (result.rows.length === 0) {
        console.warn(`[get-template] NOT FOUND: ${templateId}`);
        return { error: 'Template not found', templateId };
      }
      const row = result.rows[0];
      const blocks = Array.isArray(row.data?.blocks) ? row.data.blocks : [];
      const videoMeta = row.data?.videoMeta ?? {};
      console.log(`[get-template] loaded "${row.name}" with ${blocks.length} blocks: ${blocks.map((b: any) => b.type).join(', ')}`);
      return {
        id: row.id,
        name: row.name,
        description: row.description || '',
        blocks,
        videoMeta,
        blockCount: blocks.length,
      };
    } catch (e: any) {
      console.warn(`[get-template] error: ${e.message}`);
      return { error: e.message, templateId };
    }
  },
});

// ============================================================================
// Tool 9: listPlugins — List available custom plugin block types
// Queries the plugins DB table so the agent knows about user-installed plugins
// (e.g. "quiz") — supplements the built-in block types from BLOCK_SCHEMAS.
// ============================================================================

export const listPluginsMastra = createTool({
  id: 'list-plugins',
  description: 'Search installed custom plugins the user can use as video blocks. Pass query/tags/category from the user intent and keep limit small. Returns a ranked shortlist with pluginId, tags, likesCount, and blockUsage { type: "custom-plugin", pluginId }. Use this instead of loading every plugin into context.',
  inputSchema: z.object({
    query: z.string().optional().describe('Natural language search, e.g. "sports ranking versus card"'),
    tags: z.array(z.string()).optional().describe('Intent tags, e.g. ["sports","ranking","comparison"]'),
    category: z.string().optional().describe('Optional plugin category filter'),
    limit: z.number().int().min(1).max(50).optional().describe('Max results; default 12'),
  }),
  execute: async (inputData) => {
    try {
      const result = await db.query(
        `SELECT id, name, description, category, status, tags, likes_count, schema_json
         FROM plugins
         WHERE status IS NULL OR status <> 'disabled'
         ORDER BY name`,
      );
      const catalog: CatalogEntry[] = result.rows.map((row: any) => {
        const storedTags = parseTags(row.tags);
        return {
          id: row.id,
          kind: 'plugin' as const,
          name: row.name,
          description: row.description || '',
          category: row.category || 'other',
          tags: storedTags.length > 0 ? storedTags : derivePluginTags(row),
          likesCount: row.likes_count ?? 0,
          blockUsage: { type: 'custom-plugin', pluginId: row.id },
        };
      });
      const ranked = rankCatalogEntries(catalog, {
        query: inputData.query,
        tags: inputData.tags,
        category: inputData.category,
        kind: 'plugin',
        limit: inputData.limit,
        fallbackLimit: 12,
      });
      const plugins = ranked.map((entry) => ({
        pluginId: entry.id,
        name: entry.name,
        description: entry.description,
        category: entry.category || 'other',
        tags: entry.tags,
        likesCount: entry.likesCount ?? 0,
        blockUsage: entry.blockUsage,
      }));
      console.log(`[list-plugins] returning ${plugins.length}/${catalog.length} plugins for query="${inputData.query ?? ''}" tags="${(inputData.tags ?? []).join(',')}"`);
      return {
        plugins,
        totalMatched: plugins.length,
        totalAvailable: catalog.length,
        note: 'If the shortlist is not relevant, call again with better query/tags before creating a new plugin.',
      };
    } catch (e: any) {
      console.warn(`[list-plugins] query failed: ${e.message}`);
      return { plugins: [] };
    }
  },
});

// ============================================================================
// Tool 10: listBlockTypes - Search built-in types + custom plugins
// One source of truth for the agent to fuzzy-match user words against.
// ============================================================================

export const listBlockTypesMastra = createTool({
  id: 'list-block-types',
  description: 'Search available block types by user intent. Includes built-ins plus a ranked shortlist of custom plugins. Pass query/tags/category/kind and keep limit small so planning does not load every plugin into context. Returns entries with id, kind ("builtin" | "plugin"), tags, likesCount for plugins, and blockUsage.',
  inputSchema: z.object({
    query: z.string().optional().describe('Natural language search, e.g. "sports ranking chart" or "chat conversation"'),
    tags: z.array(z.string()).optional().describe('Intent tags, e.g. ["sports","ranking"]'),
    category: z.string().optional().describe('Optional category filter. Mostly useful for plugins.'),
    kind: z.enum(['builtin', 'plugin', 'all']).optional().describe('Restrict results to builtins, plugins, or all'),
    limit: z.number().int().min(1).max(50).optional().describe('Max total results; default 24'),
  }),
  execute: async (inputData) => {
    const builtins = builtinCatalogEntries();

    let plugins: CatalogEntry[] = [];
    try {
      const result = await db.query(
        `SELECT id, name, description, category, status, tags, likes_count, schema_json
         FROM plugins
         WHERE status IS NULL OR status <> 'disabled'
         ORDER BY name`,
      );
      plugins = result.rows.map((row: any) => {
        const storedTags = parseTags(row.tags);
        return {
          id: row.id,
          kind: 'plugin' as const,
          name: row.name,
          description: row.description || '',
          category: row.category || 'other',
          tags: storedTags.length > 0 ? storedTags : derivePluginTags(row),
          likesCount: row.likes_count ?? 0,
          blockUsage: { type: 'custom-plugin', pluginId: row.id },
        };
      });
    } catch (e: any) {
      console.warn(`[list-block-types] plugin query failed: ${e.message}`);
    }

    const catalog = [...builtins, ...plugins];
    const blockTypes = rankCatalogEntries(catalog, {
      query: inputData.query,
      tags: inputData.tags,
      category: inputData.category,
      kind: inputData.kind ?? 'all',
      limit: inputData.limit,
      fallbackLimit: 24,
    });
    console.log(`[list-block-types] returning ${blockTypes.length}/${catalog.length} entries (${builtins.length} builtins, ${plugins.length} plugins) query="${inputData.query ?? ''}" tags="${(inputData.tags ?? []).join(',')}"`);
    if (plugins.length) console.log(`[list-block-types] plugin candidates: ${blockTypes.filter(p => p.kind === 'plugin').map(p => `${p.id}="${p.name}"`).join(' | ') || '(none)'}`);
    return {
      blockTypes,
      totalMatched: blockTypes.length,
      totalAvailable: catalog.length,
      note: 'Call again with more specific query/tags if the shortlist is not relevant. Use custom-plugin only when a returned plugin is a good fit.',
    };
  },
});
// ============================================================================
// Tool: plan-video — Plan the narrative, arc, and visual style
// Replaces the first half of the workflow's initStep.
// The agent calls this after selecting a template, before generating blocks.
// ============================================================================

export const planVideoMastra = createTool({
  id: 'plan-video',
  description: 'Plan the full video narrative: enrich metadata, select narrative arc, run the director to create a narrative plan with scripts, visual style guide, and consistency lenses. Call this AFTER select-template and BEFORE generate-block. Returns the narrative plan, visual style guide, story bible, and all planning artifacts needed for block generation.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID for state persistence'),
    userStory: z.string().describe('The story/topic for the video'),
    templateBlocks: z.array(z.object({ type: z.string() }).passthrough()).describe('Block structure from select-template'),
    preferredArc: z.string().nullable().optional().describe('Preferred arc name'),
    preferredVisualStyle: z.string().nullable().optional().describe('Preferred visual style'),
    customVisualPrompt: z.string().nullable().optional().describe('Custom visual style description'),
    customArc: z.union([
      z.object({ roles: z.array(z.string()), defaultTone: z.string() }),
      z.string(),
      z.null(),
    ]).optional().describe('Custom arc definition — pass an object { roles, defaultTone } or null. String arc names are ignored (use preferredArc for those).'),
    language: z.string().optional().describe('Language code'),
    apiKey: z.string().optional().describe('API key'),
    requiredBlockTypes: z.array(z.string()).optional().describe('Block types the user explicitly requested — director must include all of them'),
    requiredPluginIds: z.array(z.string()).optional().describe('Plugin IDs the user explicitly requested — each must appear as a custom-plugin block'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, userStory, templateBlocks, preferredArc, preferredVisualStyle, customVisualPrompt, customArc, language, apiKey: _apiKey, requiredBlockTypes, requiredPluginIds } = inputData;
    const apiKey = _apiKey ?? '';
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[plan-video] ▶ invoked`);
    console.log(`[plan-video] threadId=${threadId}`);
    console.log(`[plan-video] userStory=${JSON.stringify(userStory)}`);
    console.log(`[plan-video] templateBlocks IN=${JSON.stringify(templateBlocks)}`);
    console.log(`[plan-video] requiredBlockTypes=${JSON.stringify(requiredBlockTypes ?? [])}`);
    console.log(`[plan-video] requiredPluginIds=${JSON.stringify(requiredPluginIds ?? [])}`);
    console.log(`[plan-video] preferredArc=${preferredArc ?? 'null'} preferredVisualStyle=${preferredVisualStyle ?? 'null'}`);
    const progressId = await emitProgress(ctx, 'plan-video', 'start', { blockCount: templateBlocks.length });
    try {

    // Validate every templateBlock — reject fabricated type ids and
    // custom-plugin blocks missing pluginId. Prompts alone can't stop an
    // LLM from guessing; this is the hard gate.
    const BUILTINS = new Set(Object.keys(BLOCK_SCHEMAS));

    // Load installed plugins (id + name) for validation + auto-repair.
    let installedPlugins: Array<{ id: string; name: string }> = [];
    try {
      const r = await db.query(`SELECT id, name FROM plugins`);
      installedPlugins = r.rows.map((x: any) => ({ id: String(x.id), name: String(x.name ?? '') }));
    } catch (e: any) {
      console.warn(`[plan-video] failed to load installed plugins: ${e.message}`);
    }
    const installedPluginIds = new Set(installedPlugins.map(p => p.id));
    console.log(`[plan-video] installed plugins (${installedPlugins.length}): ${installedPlugins.map(p => `${p.id}="${p.name}"`).join(' | ') || '(none)'}`);

    // Auto-repair: if a custom-plugin block is missing pluginId, try to
    // infer it from requiredPluginIds (in order) or by matching plugin
    // name keywords against userStory. Cheap forgiveness for Flash.
    const usedRequired = new Set<string>();
    const storyLower = String(userStory).toLowerCase();
    templateBlocks.forEach((b) => {
      if (b.type !== 'custom-plugin') return;
      const pid = String((b as any).pluginId ?? '').trim();
      if (pid) return;
      const fromRequired = (requiredPluginIds ?? []).find(id => !usedRequired.has(id) && installedPluginIds.has(id));
      if (fromRequired) {
        (b as any).pluginId = fromRequired;
        usedRequired.add(fromRequired);
        console.warn(`[plan-video] auto-filled pluginId "${fromRequired}" from requiredPluginIds`);
        return;
      }
      const matched = installedPlugins.find(p => p.name && storyLower.includes(p.name.toLowerCase()));
      if (matched) {
        (b as any).pluginId = matched.id;
        console.warn(`[plan-video] auto-filled pluginId "${matched.id}" by name match against userStory`);
      }
    });

    const inputTypes = templateBlocks.map(b => String(b.type));
    console.log(`[plan-video] templateBlocks AFTER auto-repair=${JSON.stringify(templateBlocks)}`);

    const invalidBlocks: string[] = [];
    templateBlocks.forEach((b, i) => {
      const t = String(b.type);
      if (t === 'custom-plugin') {
        const pid = String((b as any).pluginId ?? '').trim();
        if (!pid) {
          invalidBlocks.push(`block ${i}: type="custom-plugin" missing pluginId — call list-block-types to find the exact pluginId`);
        } else if (!installedPluginIds.has(pid)) {
          invalidBlocks.push(`block ${i}: pluginId "${pid}" is not installed — valid pluginIds: ${[...installedPluginIds].join(', ') || '(none)'}`);
        }
      } else if (!BUILTINS.has(t)) {
        invalidBlocks.push(`block ${i}: type "${t}" is not a valid built-in. For installed plugins use { type: "custom-plugin", pluginId: "<id from list-block-types>" }. Valid built-ins: ${[...BUILTINS].join(', ')}`);
      }
    });
    if (invalidBlocks.length) {
      const msg = `templateBlocks has invalid entries:\n- ${invalidBlocks.join('\n- ')}`;
      console.warn(`[plan-video] ❌ validation failed:\n${msg}`);
      throw new Error(msg);
    }
    console.log(`[plan-video] ✅ validation passed — ${templateBlocks.length} blocks`);

    // Enforce user-directed block types BEFORE planning. Director narrates the
    // given templateBlocks — it cannot add new ones — so missing required types
    // must be caught here and surfaced to the caller (storyAgent) to fix.
    const missingTypes = (requiredBlockTypes ?? []).filter(t => !inputTypes.includes(t));
    const inputPluginIds = templateBlocks
      .filter(b => b.type === 'custom-plugin')
      .map(b => String((b as any).pluginId ?? ''));
    const missingPluginIds = (requiredPluginIds ?? []).filter(id => !inputPluginIds.includes(id));
    if (missingTypes.length || missingPluginIds.length) {
      const parts: string[] = [];
      if (missingTypes.length) parts.push(`missing required block types: ${missingTypes.join(', ')}`);
      if (missingPluginIds.length) parts.push(`missing required plugin IDs: ${missingPluginIds.join(', ')}`);
      const msg = `templateBlocks violates user directive — ${parts.join('; ')}. Append these blocks to templateBlocks before calling plan-video.`;
      console.warn(`[plan-video] ${msg}`);
      throw new Error(msg);
    }

    // Load arc + style catalogs from DB
    let arcPatternCatalog: Record<string, any> = {};
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
    } catch { /* tables may not exist */ }

    // 1. Enrich video metadata
    const videoMeta = await enrichVideoMeta({
      userStory,
      partialVideoMeta: {},
      language: language ?? 'en',
      apiKey,
      model: SERVER_MODEL,
    });

    // 2. Plan media strategy
    const { mediaStrategy, researchContext } = await planMediaStrategyViaAgent({
      userStory,
      selectedArc: null,
      preferredArc: preferredArc ?? null,
      templateBlocks,
      apiKey,
      model: SERVER_MODEL,
    });

    // 3. Select arc
    const selectedArc = await selectArc({
      userStory,
      templateBlocks,
      preferredArc: preferredArc ?? null,
      arcPatternCatalog,
      apiKey,
      model: SERVER_MODEL,
    });

    // 4. Director with engagement loop
    let directorResult: any;
    let engagementScore = 0;
    let engagementFeedback = '';
    for (let attempt = 0; attempt < MAX_DIRECTOR_LOOPS; attempt++) {
      directorResult = await runDirector({
        userStory,
        templateBlocks,
        selectedArc,
        preferredArc: preferredArc ?? null,
        customArc: (customArc && typeof customArc === 'object' && 'roles' in customArc) ? customArc : null,
        arcPatternCatalog,
        visualStyleCatalog,
        preferredVisualStyle: preferredVisualStyle ?? null,
        customVisualPrompt: customVisualPrompt ?? null,
        engagementFeedback,
        engagementScore,
        directorLoopCount: attempt + 1,
        researchContext,
        language: language ?? 'en',
        apiKey,
        model: SERVER_MODEL,
      });

      const evalResult = await evaluateEngagement({
        userStory,
        narrativePlan: directorResult.narrativePlan,
        directorLoopCount: attempt + 1,
        language: language ?? 'en',
        apiKey,
        model: SERVER_MODEL,
      });
      engagementScore = evalResult.engagementScore;
      engagementFeedback = evalResult.engagementFeedback;
      if (engagementScore >= ENGAGEMENT_THRESHOLD) break;
    }

    // 5. Ensure job exists BEFORE patching state — patchJobState is a no-op if job is missing
    const existing = await wizardJobs.getJob(threadId);
    if (!existing) await wizardJobs.createJob(threadId, '');
    await wizardJobs.updateJob(threadId, { status: 'running' });

    // 6. Save planning state to DB for frontend preview (job now guaranteed to exist)
    await patchJobState(threadId, (current) => ({
      ...current,
      videoMeta,
      selectedArc: directorResult.selectedArc,
      narrativePlan: directorResult.narrativePlan,
      visualStyleGuide: directorResult.visualStyleGuide,
      storyBible: directorResult.storyBible,
      selectedLenses: directorResult.selectedLenses,
      mediaStrategy,
      researchContext,
      filledBlocks: templateBlocks.map((b, i) => ({ ...b, blockIndex: i })),
      phase: 'planned',
    }));

    const skeletonBlocks = templateBlocks.map((b, i) => ({ ...b, blockIndex: i, _skeleton: true }));
    const result = {
      narrativePlan: directorResult.narrativePlan.map((b: any) => ({
        narrativeRole: b.narrativeRole,
        angle: b.angle,
        tone: b.tone,
        keyMessage: b.keyMessage,
        visualMood: b.visualMood,
        spokenScript: b.spokenScript,
      })),
      visualStyleGuide: directorResult.visualStyleGuide,
      storyBible: directorResult.storyBible,
      selectedArc: directorResult.selectedArc?.name ?? 'documentary',
      engagementScore,
      blockCount: templateBlocks.length,
      videoMeta,
      // Skeleton blocks so the frontend can render placeholders immediately,
      // before generate-block starts filling them in.
      templateBlocks: skeletonBlocks,
    };
    await emitProgress(ctx, 'plan-video', 'complete', {
      templateBlocks: skeletonBlocks,
      videoMeta,
      blockCount: templateBlocks.length,
    }, progressId);
    return result;
    } catch (err: any) {
      await emitProgress(ctx, 'plan-video', 'error', { errorMessage: err?.message ?? String(err) }, progressId);
      throw err;
    }
  },
});

// ============================================================================
// Tool: generate-block — Generate content + images + audio for ONE block
// Replaces the per-block logic from the workflow's fillAllBlocks.
// The agent calls this once per block after plan-video.
// ============================================================================

export const generateBlockMastra = createTool({
  id: 'generate-block',
  description: 'Generate complete content for a single video block: AI content generation, image resolution, audio/TTS generation, and merging. Call this once per block after plan-video. Pass the narrative brief for this specific block from the plan-video result. Each call saves progress to the DB so the frontend preview updates incrementally.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID'),
    blockIndex: z.number().describe('0-based block index'),
    blockType: z.string().describe('Block type, e.g. "stat", "parallax-story"'),
    originalBlock: z.object({}).passthrough().optional().describe('Original block data from template (OBJECT, not a JSON string). Usually you do not need to pass this — omit unless the block has a specific structure like parallax layers.'),
    narrativeBrief: z.any().describe('Narrative brief for this block from plan-video result (OBJECT, not a JSON string).'),
    userStory: z.string().describe('The story/topic'),
    visualStyleGuide: z.string().optional().describe('Visual style guide from plan-video'),
    storyBible: z.string().optional().describe('Story bible from plan-video'),
    arcName: z.string().optional().describe('Selected arc name'),
    aspectRatio: z.string().optional().describe('Video aspect ratio, e.g. "9:16"'),
    preferredVoice: z.string().nullable().optional().describe('Voice ID for TTS'),
    language: z.string().optional().describe('Language code'),
    apiKey: z.string().optional().describe('API key'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, blockIndex, blockType, originalBlock, narrativeBrief, userStory, visualStyleGuide, storyBible, arcName, aspectRatio, preferredVoice, language, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';
    const progressId = await emitProgress(ctx, 'generate-block', 'start', { blockIndex, blockType });

    // LLMs sometimes stringify nested object args. If originalBlock arrived as
    // a JSON string, parse it — otherwise spreading it later would produce
    // character-indexed keys (0:"{", 1:"\"", ...) alongside real properties.
    let block: Record<string, any>;
    if (typeof originalBlock === 'string') {
      try {
        const parsed = JSON.parse(originalBlock);
        block = (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) ? parsed : { type: blockType };
      } catch {
        block = { type: blockType };
      }
    } else if (originalBlock && typeof originalBlock === 'object' && !Array.isArray(originalBlock)) {
      block = originalBlock as Record<string, any>;
    } else {
      block = { type: blockType };
    }

    // Load media strategy from job state so SERP web search can be used
    // when the planner decided imageSource === 'web_search' for this block.
    let mediaStrategy: Record<string, any> | null = null;
    try {
      const job = await wizardJobs.getJob(threadId);
      mediaStrategy = job?.state?.mediaStrategy ?? null;
    } catch { /* best-effort */ }

    try {
      let rawContent: Record<string, any>;

      // 1. Generate content (custom-plugin gets generationFields fetched from DB first,
      //    then falls through to generateContent which handles custom-plugin natively).
      {
        let schemaDescriptions: Record<string, string> | undefined;
        if (blockType === 'custom-plugin') {
          const pluginMeta = await fillCustomPluginBlock(block, narrativeBrief, userStory, apiKey, SERVER_MODEL);
          block = { ...block, ...pluginMeta.rawContent, generationFields: pluginMeta.generationFields };
          schemaDescriptions = pluginMeta.schemaDescriptions;
        }
        const generation = await generateContent({
          blockType, blockIndex, userStory, originalBlock: block,
          narrativeBrief, visualStyleGuide: visualStyleGuide ?? '', storyBible: storyBible ?? '',
          arcName: arcName ?? '', selectedLenses: [], researchContext: '',
          mediaStrategy, aspectRatio: aspectRatio ?? '9:16',
          language: language ?? 'en', apiKey, model: SERVER_MODEL, schemaDescriptions,
        });
        if (generation.error) {
          await emitProgress(ctx, 'generate-block', 'error', { blockIndex, errorMessage: generation.error }, progressId);
          return { blockIndex, type: blockType, status: 'error', error: generation.error };
        }
        rawContent = generation.rawContent;
      }

      // Ensure spokenScript is set on narrativeBrief so audio injection fallback works.
      // classifyMediaFields auto-injects audioSrc from narrativeBrief.spokenScript, but only
      // if it exists. Fall back to the most likely text field in rawContent.
      let effectiveBrief = narrativeBrief ?? {};
      if (!effectiveBrief.spokenScript) {
        const fallback = rawContent?.script ?? rawContent?.narration ?? rawContent?.title ?? rawContent?.headline ?? '';
        if (fallback) effectiveBrief = { ...effectiveBrief, spokenScript: String(fallback) };
      }

      // 2. Classify media fields (images, audio, video)
      const { imageFields, audioFields, videoFields, rawContent: updatedRawContent } = await classifyMediaFields({
        rawContent, blockType, originalBlock: block, narrativeBrief: effectiveBrief,
        mediaStrategy, blockIndex,
      });
      const effectiveRawContent = updatedRawContent ?? rawContent;

      // 3. Resolve images + video in parallel
      const [imgResult, videoResult] = await Promise.all([
        resolveImages({ imageFields, rawContent: effectiveRawContent, blockIndex, blockType, mediaStrategy, visualStyleGuide: visualStyleGuide ?? '', apiKey }),
        resolveVideo({ videoFields, rawContent: effectiveRawContent, blockIndex }),
      ]);
      const combinedUrls = { ...imgResult.resolvedUrls, ...videoResult.resolvedUrls };

      // 4. Merge content with resolved URLs
      const { finalBlock } = await mergeBlock({
        rawContent: effectiveRawContent, resolvedUrls: combinedUrls, resolvedAudio: {},
        originalBlock: block, blockType, blockIndex, narrativeBrief,
      });
      let mergedBlock = mergeParallaxLayers(finalBlock, block);

      // 5. Resolve audio (TTS)
      const audioFieldsList = extractAudioFields(mergedBlock);
      for (const { path, text } of audioFieldsList) {
        if (text && !text.startsWith('data:') && !text.startsWith('http')) {
          try {
            const audioResult = await resolveAudio({
              audioFields: [{ path, text }],
              preferredVoice: preferredVoice ?? null,
              blockIndex,
            });
            if (audioResult.resolvedAudio[path]) {
              const parts = path.split('.');
              let target: any = mergedBlock;
              for (let i = 0; i < parts.length - 1; i++) {
                if (target[parts[i]] === undefined) target[parts[i]] = {};
                target = target[parts[i]];
              }
              target[parts[parts.length - 1]] = audioResult.resolvedAudio[path];
            }
          } catch (e: any) {
            console.warn(`[generate-block] Audio failed for block ${blockIndex}: ${e.message}`);
          }
        }
      }

      // 6. Apply post-processors (duration from actual audio length, parallax
      // layer merge, etc.). The workflow path does this; the agent-loop path
      // was skipping it, leaving every block at its template-default duration.
      const [postProcessed] = await applyBlockPostProcessors([mergedBlock], [block], { aspectRatio: aspectRatio ?? '9:16' });
      mergedBlock = postProcessed ?? mergedBlock;

      // 7. Save to DB — frontend picks up via SSE tool-result.
      await wizardJobs.patchJobStateBlock(threadId, blockIndex, mergedBlock);

      const resolvedImageCount = Object.keys(imgResult.resolvedUrls).length;
      const result = {
        blockIndex,
        type: blockType,
        status: 'complete',
        hasImages: resolvedImageCount > 0,
        hasAudio: audioFieldsList.some(({ path }) => {
          const v = getBlockNestedValue(mergedBlock, path) ?? '';
          return String(v).startsWith('http') || String(v).startsWith('data:');
        }),
        hasText: Object.keys(rawContent ?? {}).length > 0,
        expectedImages: imageFields.length,
        resolvedImages: resolvedImageCount,
        duration: mergedBlock.duration,
        block: mergedBlock,
      };
      await emitProgress(ctx, 'generate-block', 'complete', {
        blockIndex,
        block: mergedBlock,
      }, progressId);
      return result;
    } catch (e: any) {
      await emitProgress(ctx, 'generate-block', 'error', { blockIndex, errorMessage: e?.message ?? String(e) }, progressId);
      return { blockIndex, type: blockType, status: 'error', error: e.message, hasImages: false, hasAudio: false, hasText: false, expectedImages: 0, resolvedImages: 0 };
    }
  },
});

export const startGenerationMastra = createTool({
  id: 'start-generation',
  description: 'Start the full video generation pipeline in the background. Call this after planning the narrative (select-template + select-arc + plan-narrative). You can either pass templateBlocks directly, or pass a templateId to use an existing template from the library. Returns a threadId for polling status.',
  inputSchema: z.object({
    threadId: z.string().describe('Existing thread ID for the conversation'),
    userStory: z.string().describe('The story/topic for the video'),
    templateBlocks: z.array(z.object({ type: z.string() }).passthrough()).optional().describe('Block structure from select-template. Omit if using templateId.'),
    templateId: z.string().optional().describe('Template ID from list-templates. If provided, fetches blocks from DB (overrides templateBlocks).'),
    preferredArc: z.string().nullable().optional().describe('Arc name from select-arc'),
    preferredVoice: z.string().nullable().optional().describe('Voice ID'),
    preferredVisualStyle: z.string().nullable().optional().describe('Visual style ID'),
    customVisualPrompt: z.string().nullable().optional().describe('Custom visual style description'),
    customArc: z.union([
      z.object({ roles: z.array(z.string()), defaultTone: z.string() }),
      z.string(),
      z.null(),
    ]).optional().describe('Custom arc definition — pass an object { roles, defaultTone } or null. If a string arc name is passed, it will be ignored (use preferredArc for arc names).'),
    language: z.string().optional().describe('Language code, e.g. "en"'),
    apiKey: z.string().optional().describe('OpenRouter API key (optional — uses server env if omitted)'),
  }),
  execute: async (inputData) => {
    const { threadId, userStory, templateBlocks: inputBlocks, templateId, preferredArc, preferredVoice, preferredVisualStyle, customVisualPrompt, customArc, language, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';

    // Resolve blocks: either from templateId (DB) or from input
    let templateBlocks = inputBlocks;
    let partialVideoMeta: Record<string, any> = {};

    if (templateId && !inputBlocks?.length) {
      try {
        const result = await db.query('SELECT * FROM "Template" WHERE id = $1', [templateId]);
        if (result.rows.length > 0) {
          const row = result.rows[0];
          templateBlocks = Array.isArray(row.data?.blocks) ? row.data.blocks : [];
          partialVideoMeta = row.data?.videoMeta ?? {};
        }
      } catch {
        // Fall through to input blocks or empty
      }
    }

    if (!templateBlocks?.length) {
      return { threadId, status: 'error', error: 'No blocks provided. Pass templateBlocks or templateId.' };
    }

    // Ensure job record exists and mark as running
    const existing = await wizardJobs.getJob(threadId);
    if (!existing) {
      await wizardJobs.createJob(threadId, '');
    }
    await wizardJobs.updateJob(threadId, { status: 'running' });

    // ── FIRE AND FORGET ────────────────────────────────────────────────────
    // Do NOT await startWizard here. The full pipeline (director loop +
    // parallel block fill + image generation + TTS audio) takes 1-5 minutes.
    // Awaiting it inside the agent tool's execute() blocks the SSE stream and
    // causes the frontend to see the tool call hang indefinitely.
    //
    // The frontend already polls /api/mcp/jobs/${threadId} every 3 seconds
    // from the moment it detects the start-generation tool call, so it will
    // pick up the completed state automatically.
    void (async () => {
      try {
        const result = await startWizard(threadId, {
          userStory,
          templateBlocks: templateBlocks!,
          partialVideoMeta,
          preferredArc: preferredArc ?? null,
          preferredVoice: preferredVoice ?? null,
          preferredVisualStyle: preferredVisualStyle ?? null,
          customVisualPrompt: customVisualPrompt ?? null,
          customArc: (customArc && typeof customArc === 'object' && 'roles' in customArc) ? customArc : null,
          language: language ?? 'en',
          apiKey,
          model: SERVER_MODEL,
        }, { inlineMode: true });

        const editableState = result.stateSnapshot ? {
          narrativePlan:    (result.stateSnapshot as any).narrativePlan    ?? [],
          blocksWithImages: (result.stateSnapshot as any).blocksWithImages ?? [],
          imageItems:       (result.stateSnapshot as any).imageItems       ?? [],
          filledBlocks:     (result.stateSnapshot as any).filledBlocks     ?? [],
          templateBlocks:   (result.stateSnapshot as any).templateBlocks   ?? [],
          videoMeta:        (result.stateSnapshot as any).videoMeta        ?? {},
          visualStyleGuide: (result.stateSnapshot as any).visualStyleGuide ?? '',
        } : null;

        // In inline mode the wizard returns status:'interrupted' with type:'preview_ready'
        // and filledBlocks in stateSnapshot. Save as 'complete' so the frontend shows preview.
        const payload = result.payload ?? {};
        try {
          const userId = await getThreadUserId(threadId);
          const insertResult = await db.query(
            `INSERT INTO "Video" (id, name, data, "userId", "createdAt")
             VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id`,
            ['Wizard Video', JSON.stringify(payload), userId],
          );
          const videoId = insertResult.rows[0]?.id ?? '';
          await wizardJobs.updateJob(threadId, {
            status: 'complete',
            payload: { ...payload, videoId },
            state: editableState,
          });
        } catch {
          await wizardJobs.updateJob(threadId, { status: 'complete', payload, state: editableState });
        }
      } catch (e: any) {
        console.error('[start-generation] Background pipeline failed:', e.message);
        await wizardJobs.updateJob(threadId, { status: 'error', error: e.message });
      }
    })();

    // Return immediately — the SSE stream continues, frontend polls for result
    return {
      threadId,
      status: 'started',
      message: 'Video generation started in the background. Your preview will appear in 1–3 minutes.',
    };
  },
});

// ============================================================================
// Tool 8: getVideoState — Read current generation state
// ============================================================================

export const getVideoStateMastra = createTool({
  id: 'get-video-state',
  description: 'Read the current generation state for a thread. Returns all blocks with their images, audio, scripts, and video metadata. Use this before making modifications to see what currently exists.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID from start-generation'),
  }),
  execute: async (inputData) => {
    const { threadId } = inputData;
    const job = await wizardJobs.getJob(threadId);
    if (!job) {
      return { error: 'Job not found', threadId };
    }
    return {
      status: job.status,
      error: job.error,
      state: job.state ?? {},
      payload: job.payload ?? null,
    };
  },
});

// ============================================================================
// Tool 8b: listBlockMediaFields — Enumerate a block's image/audio/video paths
// Use BEFORE update-block-image / update-block-audio on custom-plugin blocks
// (or when you don't know the block's exact field names) so you can target the
// real path instead of guessing "imageUrl" and writing to a field that doesn't
// exist. Returns each path with its current filled status — empty means it
// needs filling.
// ============================================================================

export const listBlockMediaFieldsMastra = createTool({
  id: 'list-block-media-fields',
  description: `List every image / audio / video field path on a specific block, with whether each is currently filled (has a real URL) or empty.

Use this BEFORE update-block-image or update-block-audio when:
- The block is a custom-plugin (field names vary per plugin)
- The user reports "missing images" and you don't know which paths
- You want to target a nested field path you don't already know

Returns: { blockIndex, blockType, fields: [{ kind: 'image'|'audio'|'video', path: 'players[0].portraitImage', description: '...', filled: false }] }

After calling this, pass the exact \`path\` string to update-block-image's \`fieldPath\` parameter — do NOT default to "imageUrl" for plugin blocks.`,
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID'),
    blockIndex: z.number().describe('0-based block index'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, blockIndex } = inputData;
    const progressId = await emitProgress(ctx, 'list-block-media-fields', 'start', { blockIndex });

    try {
      const job = await wizardJobs.getJob(threadId);
      const filledBlocks = job?.state?.filledBlocks ?? [];
      const block = filledBlocks[blockIndex];
      if (!block) {
        await emitProgress(ctx, 'list-block-media-fields', 'error', { blockIndex, errorMessage: 'Block not found' }, progressId);
        return { error: `Block ${blockIndex} not found`, blockIndex, fields: [] };
      }

      const blockType = block.type ?? 'unknown';
      const narrativeBrief = job?.state?.narrativePlan?.[blockIndex] ?? null;

      // Reuse classifyMediaFields — same logic the workflow uses, so the paths
      // returned here are exactly the ones the workflow tries to fill.
      const classified = await classifyMediaFields({
        rawContent: block,
        blockType,
        originalBlock: block,
        narrativeBrief,
        mediaStrategy: null,
        blockIndex,
      });

      const isFilled = (v: unknown): boolean =>
        typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('data:'));

      const fields = [
        ...classified.imageFields.map((f) => ({
          kind: 'image' as const,
          path: f.path,
          description: f.description,
          filled: isFilled(getBlockNestedValue(block, f.path)),
        })),
        ...classified.audioFields.map((f) => ({
          kind: 'audio' as const,
          path: f.path,
          description: f.text,
          filled: isFilled(getBlockNestedValue(block, f.path)),
        })),
        ...classified.videoFields.map((f) => ({
          kind: 'video' as const,
          path: f.path,
          description: f.prompt,
          filled: isFilled(getBlockNestedValue(block, f.path)),
        })),
      ];

      const empty = fields.filter((f) => !f.filled);
      await emitProgress(ctx, 'list-block-media-fields', 'complete', {
        blockIndex, total: fields.length, empty: empty.length,
      }, progressId);

      return { blockIndex, blockType, fields };
    } catch (e: any) {
      await emitProgress(ctx, 'list-block-media-fields', 'error', { blockIndex, errorMessage: e?.message ?? String(e) }, progressId);
      return { error: e.message, blockIndex, fields: [] };
    }
  },
});

// ============================================================================
// Tool 9: updateBlockImage — Regenerate a specific block's image
// ============================================================================

export const updateBlockImageMastra = createTool({
  id: 'update-block-image',
  description: `Regenerate the image at a specific block and persist it to state. After calling this, call assemble-video to rebuild the preview.

For built-in blocks: pass no fieldPath (defaults to "imageUrl").
For custom-plugin blocks: pass no fieldPath to auto-update ALL image fields (each gets its own generated image). Pass a specific path to update just one field.
For parallax blocks: pass the specific layer path, e.g. fieldPath: "layers[1].image".`,
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID'),
    blockIndex: z.number().describe('0-based block index'),
    description: z.string().describe('New image description / prompt'),
    fieldPath: z.string().optional().describe('Specific field path. Omit to auto-resolve for custom-plugin blocks.'),
    removeBackground: z.boolean().optional().describe('Whether to remove image background'),
    visualStyleGuide: z.string().optional().describe('Visual style guide for consistency'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, blockIndex, description, fieldPath, removeBackground, visualStyleGuide } = inputData;
    const progressId = await emitProgress(ctx, 'update-block-image', 'start', { blockIndex, fieldPath: fieldPath ?? 'auto' });

    try {
      // Read current block to resolve correct field paths
      const job = await wizardJobs.getJob(threadId);
      const block = job?.state?.filledBlocks?.[blockIndex];
      if (!block) {
        await emitProgress(ctx, 'update-block-image', 'error', { blockIndex, errorMessage: 'Block not found' }, progressId);
        return { ok: false, error: `Block ${blockIndex} not found` };
      }

      // Resolve which image fields to update using the same expandTemplatePaths
      // logic that the generateVideo workflow uses
      type FieldTarget = { path: string; description: string; removeBackground: boolean };
      let targets: FieldTarget[];

      if (fieldPath && fieldPath !== 'imageUrl') {
        // Explicit non-default path — trust it
        targets = [{ path: fieldPath, description, removeBackground: removeBackground ?? false }];
      } else if (block.type === 'custom-plugin' && Array.isArray(block.generationFields)) {
        // Custom plugin: use expandTemplatePaths (same as the workflow) to get
        // concrete paths with per-field descriptions
        const { expandTemplatePaths } = await import('../shared/utils');
        const expanded = expandTemplatePaths(block.generationFields, block.pluginData ?? block);
        targets = expanded
          .filter(f => f.type === 'image')
          .map(f => ({ path: f.path, description: f.description || description, removeBackground: f.removeBackground ?? false }));
        if (targets.length === 0) {
          await emitProgress(ctx, 'update-block-image', 'error', { blockIndex, errorMessage: 'No image fields found on plugin' }, progressId);
          return { ok: false, error: 'No image fields found on this custom-plugin block.' };
        }
      } else {
        targets = [{ path: 'imageUrl', description, removeBackground: removeBackground ?? false }];
      }

      // Generate a separate image for each field target
      const { regenerateSingleImage } = await import('@/lib/video/ai');
      const results: { path: string; url: string }[] = [];

      for (const target of targets) {
        const fullPrompt = `${visualStyleGuide ? visualStyleGuide + '. ' : ''}${target.description}`;
        const { url } = await regenerateSingleImage(fullPrompt, target.removeBackground);
        results.push({ path: target.path, url });
      }

      // Persist all images to state
      await patchJobState(threadId, (current) => {
        const next = { ...current };
        const filledBlocks = [...(next.filledBlocks ?? [])];
        if (filledBlocks[blockIndex]) {
          let updatedBlock = { ...filledBlocks[blockIndex] };
          for (const { path: fp, url } of results) {
            updatedBlock = setBlockNestedValue(updatedBlock, fp, url);
          }
          filledBlocks[blockIndex] = updatedBlock;
        }
        next.filledBlocks = filledBlocks;
        return next;
      });

      const primaryUrl = results[0].url;
      const allPaths = results.map(r => r.path);
      await emitProgress(ctx, 'update-block-image', 'complete', { blockIndex, newImageUrl: primaryUrl, fieldPaths: allPaths }, progressId);
      return { ok: true, blockIndex, fieldPaths: allPaths, newImageUrl: primaryUrl, allImages: results };
    } catch (e: any) {
      await emitProgress(ctx, 'update-block-image', 'error', { blockIndex, errorMessage: e?.message ?? String(e) }, progressId);
      throw e;
    }
  },
});

// ============================================================================
// Tool 10: updateBlockAudio — Regenerate a specific block's audio
// ============================================================================

export const updateBlockAudioMastra = createTool({
  id: 'update-block-audio',
  description: 'Regenerate audio for a specific block and persist it to the generation state. Use this when the user wants to change the narration voice or script for a block. After calling this, call assemble-video to rebuild the preview.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID'),
    blockIndex: z.number().describe('0-based block index'),
    script: z.string().describe('Text to speak for this block'),
    voice: z.string().optional().describe('Voice ID. Omit to use default.'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, blockIndex, script, voice } = inputData;
    const progressId = await emitProgress(ctx, 'update-block-audio', 'start', { blockIndex });

    try {
      // Generate audio via TTS and upload to S3 (falls back to base64 if no bucket)
      const { generateAudio } = await import('@/lib/video/ai/media-service');
      const url = await generateAudio(script, voice ?? undefined);

      // Persist to state — also re-run the duration post-processor so block
      // length matches the new audio.
      const existing = await wizardJobs.getJob(threadId);
      const currentBlock = existing?.state?.filledBlocks?.[blockIndex] ?? {};
      const withNewAudio = { ...currentBlock, audioSrc: url };
      const [postProcessed] = await applyBlockPostProcessors([withNewAudio], [currentBlock], { aspectRatio: '9:16' });
      const finalBlock = postProcessed ?? withNewAudio;

      await patchJobState(threadId, (current) => {
        const next = { ...current };
        const filledBlocks = [...(next.filledBlocks ?? [])];
        filledBlocks[blockIndex] = finalBlock;
        return { ...next, filledBlocks };
      });

      await emitProgress(ctx, 'update-block-audio', 'complete', { blockIndex, newAudioUrl: url }, progressId);
      return { ok: true, blockIndex, newAudioUrl: url, duration: finalBlock.duration };
    } catch (e: any) {
      await emitProgress(ctx, 'update-block-audio', 'error', { blockIndex, errorMessage: e?.message ?? String(e) }, progressId);
      throw e;
    }
  },
});

// ============================================================================
// Tool 11: patchState — Edit any field in generation state
// ============================================================================

export const patchStateMastra = createTool({
  id: 'patch-state',
  description: `Edit any field in the generation state using a dot-notation path. Use this for changes not covered by update-block-image or update-block-audio.

Examples:
  path "visualStyleGuide"  value "Use warm earthy tones"  → change visual style
  path "narrativePlan[0].spokenScript"  value "New script" → edit narration
  path "filledBlocks[2].headline"  value "New headline"    → edit text
  path "videoMeta.theme"  value "light_minimal"            → change theme

After patching, call assemble-video to rebuild the preview.`,
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID'),
    path: z.string().describe('Dot/bracket-notation path, e.g. "filledBlocks[2].headline"'),
    value: z.any().describe('The value to set'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, path, value } = inputData;
    const progressId = await emitProgress(ctx, 'patch-state', 'start', { path });

    try {
      await patchJobState(threadId, (current) => {
        const next = { ...current };
        const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
        let target: any = next;
        for (let i = 0; i < parts.length - 1; i++) {
          if (target[parts[i]] === undefined || target[parts[i]] === null) {
            target[parts[i]] = /^\d+$/.test(parts[i + 1]) ? [] : {};
          }
          target = target[parts[i]];
        }
        target[parts[parts.length - 1]] = value;
        return next;
      });

      await emitProgress(ctx, 'patch-state', 'complete', { ok: true, patched: path, path, value }, progressId);
      return { ok: true, patched: path };
    } catch (e: any) {
      await emitProgress(ctx, 'patch-state', 'error', { path, errorMessage: e?.message ?? String(e) }, progressId);
      throw e;
    }
  },
});

// ============================================================================
// Tool 11a: addBlock — Insert a NEW block at an index and auto-fill it
// Splices into filledBlocks + narrativePlan, then runs the same generation
// pipeline generateBlock uses (content + images + audio) for the new index.
// After this, the wizard MUST call assembleVideo to refresh the preview.
// ============================================================================

export const addBlockMastra = createTool({
  id: 'add-block',
  description: `Insert a NEW block at a specific index in the existing video and auto-fill it with content, images and audio. Use this when the user wants to ADD a block to an already-generated video — never call generateVideo for that, it would regenerate everything from scratch.

Inputs:
  - threadId: from system context.
  - blockType: a block id from listBlockTypes (e.g. "stat", "quote-card", "custom-plugin").
  - pluginId: REQUIRED only when blockType === "custom-plugin". The plugin id from listBlockTypes.
  - index: 0-based position where the new block should land. Existing blocks at that index and after shift right by one.
  - brief: a short description of what this new block should say or show (1-3 sentences). The pipeline turns this into spokenScript + visuals.

Returns the inserted block. After it returns, call assembleVideo once.`,
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID from system context'),
    blockType: z.string().describe('Block id from listBlockTypes'),
    pluginId: z.string().nullable().optional().describe('Required when blockType is "custom-plugin"'),
    index: z.number().int().min(0).describe('0-based position to insert at; existing blocks shift right'),
    brief: z.string().describe('1-3 sentence brief describing what this new block should cover'),
    apiKey: z.string().optional(),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, blockType, pluginId, index, brief, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';
    const progressId = await emitProgress(ctx, 'add-block', 'start', { index, blockType });

    try {
      const job = await wizardJobs.getJob(threadId);
      const state = job?.state ?? {};
      const filledBlocks: any[] = Array.isArray(state.filledBlocks) ? [...state.filledBlocks] : [];
      const narrativePlan: any[] = Array.isArray(state.narrativePlan) ? [...state.narrativePlan] : [];

      const insertAt = Math.max(0, Math.min(index, filledBlocks.length));

      // Build the stub block. For custom-plugin both type AND pluginId must travel together.
      const stub: Record<string, any> = blockType === 'custom-plugin'
        ? { type: 'custom-plugin', pluginId: pluginId ?? '' }
        : { type: blockType };

      if (blockType === 'custom-plugin' && !pluginId) {
        await emitProgress(ctx, 'add-block', 'error', { errorMessage: 'pluginId is required for custom-plugin blocks' }, progressId);
        return { ok: false as const, error: 'pluginId is required when blockType is "custom-plugin"' };
      }

      // Splice into both arrays at the same index so narrativePlan[i] aligns with filledBlocks[i].
      filledBlocks.splice(insertAt, 0, stub);
      const newBrief = { spokenScript: brief, summary: brief };
      narrativePlan.splice(insertAt, 0, newBrief);

      await patchJobState(threadId, (current) => ({
        ...current,
        filledBlocks,
        narrativePlan,
      }));

      // Reuse generateBlock's tool execute() for the new index — that path already
      // handles content + media + audio + post-processors + persist.
      const generated = await generateBlockMastra.execute!({
        threadId,
        blockIndex: insertAt,
        blockType,
        originalBlock: stub,
        narrativeBrief: newBrief,
        userStory: state.userStory ?? '',
        visualStyleGuide: state.visualStyleGuide ?? '',
        storyBible: state.storyBible ?? '',
        arcName: state.arcName ?? '',
        aspectRatio: state.aspectRatio ?? '9:16',
        preferredVoice: state.preferredVoice ?? null,
        language: state.language ?? 'en',
        apiKey,
      } as any, undefined as any);

      await emitProgress(ctx, 'add-block', 'complete', { index: insertAt, blockType }, progressId);
      return {
        ok: true as const,
        index: insertAt,
        blockCount: filledBlocks.length,
        block: (generated as any)?.block,
        message: `Block inserted at index ${insertAt}. Call assembleVideo to refresh the preview.`,
      };
    } catch (e: any) {
      await emitProgress(ctx, 'add-block', 'error', { errorMessage: e?.message ?? String(e) }, progressId);
      return { ok: false as const, error: e.message };
    }
  },
});

// ============================================================================
// Tool 11c: removeBlock — Delete a block from the video
// Pure state mutation. After this, call assembleVideo to refresh preview.
// ============================================================================

export const removeBlockMastra = createTool({
  id: 'remove-block',
  description: `Remove the block at a given index from the existing video. Pure state mutation — no LLM, no media regeneration. Existing blocks after the removed index shift left by one. After it returns, call assembleVideo once to refresh the preview.`,
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID from system context'),
    index: z.number().int().min(0).describe('0-based index of the block to remove'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, index } = inputData;
    const progressId = await emitProgress(ctx, 'remove-block', 'start', { index });

    try {
      const job = await wizardJobs.getJob(threadId);
      const state = job?.state ?? {};
      const filledBlocks: any[] = Array.isArray(state.filledBlocks) ? [...state.filledBlocks] : [];
      const narrativePlan: any[] = Array.isArray(state.narrativePlan) ? [...state.narrativePlan] : [];

      if (index < 0 || index >= filledBlocks.length) {
        await emitProgress(ctx, 'remove-block', 'error', { errorMessage: `Index ${index} out of range (0..${filledBlocks.length - 1})` }, progressId);
        return { ok: false as const, error: `Index ${index} out of range (video has ${filledBlocks.length} blocks)` };
      }

      const removed = filledBlocks.splice(index, 1)[0];
      if (index < narrativePlan.length) narrativePlan.splice(index, 1);

      await patchJobState(threadId, (current) => ({
        ...current,
        filledBlocks,
        narrativePlan,
      }));

      await emitProgress(ctx, 'remove-block', 'complete', { index, removedType: removed?.type }, progressId);
      return {
        ok: true as const,
        index,
        removedType: removed?.type,
        blockCount: filledBlocks.length,
        message: `Block removed. Call assembleVideo to refresh the preview.`,
      };
    } catch (e: any) {
      await emitProgress(ctx, 'remove-block', 'error', { errorMessage: e?.message ?? String(e) }, progressId);
      return { ok: false as const, error: e.message };
    }
  },
});

// ============================================================================
// Tool 11d: getBlockSchemaOptions — Introspect a built-in block's Zod schema
// Returns the tunable fields (enums, numbers, booleans, colors) so the wizard
// can answer "change the text animation" without guessing field names or
// valid enum values. Fixes the "I don't know how, regenerate everything" path.
// ============================================================================

export const getBlockSchemaOptionsMastra = createTool({
  id: 'get-block-schema-options',
  description: `Inspect a built-in block's schema and return the TUNABLE fields (animation, color, size, position, layout enums and numeric ranges) along with valid values, defaults, and the block's current value (if threadId+blockIndex are passed).

Use this when the user asks to change something about HOW a block looks/animates rather than its content — "change the text animation on block 2", "make the title bigger", "change the entrance to slide-up", "make it bounce", "change the overlay style". Without this tool, the wizard has to guess field names + enum values and falls back to regenerating the whole block.

Workflow:
  1. user: "change the text animation on block 2 to typewriter"
  2. you: getBlockSchemaOptions({ blockType: "<the block's type>", threadId, blockIndex: 2 })
  3. observe the returned animationFields — find the one that matches "text animation" with values including "typing"
  4. patchState("filledBlocks[2].<path>", "typing") → assembleVideo

Does NOT work for custom-plugin blocks — their schemas come from the plugin record. For custom-plugin, use listBlockMediaFields and patchState on plugin-defined fields.`,
  inputSchema: z.object({
    blockType: z.string().describe('Block type id (e.g. "stat", "motivational-image"). Get from listBlockTypes or getVideoState.'),
    threadId: z.string().optional().describe('Optional — if passed with blockIndex, returns current values for the specific block.'),
    blockIndex: z.number().int().min(0).optional().describe('Optional — block index in filledBlocks. Pair with threadId.'),
  }),
  execute: async (inputData, ctx) => {
    const { blockType, threadId, blockIndex } = inputData;
    const progressId = await emitProgress(ctx, 'get-block-schema-options', 'start', { blockType });

    try {
      const { ContentBlockSchema } = await import('@/lib/video/schemas');
      const unionDef: any = (ContentBlockSchema as any)._zod?.def ?? (ContentBlockSchema as any)._def;
      const options: any[] = unionDef?.options ?? [];

      const matching = options.find((opt: any) => {
        const shape = (opt._zod?.def ?? opt._def)?.shape;
        const typeField = shape?.type;
        const tdef = typeField?._zod?.def ?? typeField?._def;
        const literals = tdef?.values ?? [tdef?.value];
        return Array.isArray(literals) ? literals.includes(blockType) : literals === blockType;
      });

      if (!matching) {
        await emitProgress(ctx, 'get-block-schema-options', 'error', { errorMessage: `No built-in schema for blockType "${blockType}"` }, progressId);
        return {
          ok: false as const,
          error: `No built-in schema for blockType "${blockType}". For custom-plugin blocks use listBlockMediaFields + patchState on plugin fields.`,
        };
      }

      // Optional: load current block values
      let currentBlock: Record<string, any> | null = null;
      if (threadId && typeof blockIndex === 'number') {
        try {
          const job = await wizardJobs.getJob(threadId);
          currentBlock = job?.state?.filledBlocks?.[blockIndex] ?? null;
        } catch { /* ignore */ }
      }

      // Walk each field — unwrap default/optional/nullable to reach the leaf type.
      const unwrap = (node: any): { def: any; defaultValue?: any; optional: boolean } => {
        let cur = node;
        let defaultValue: any = undefined;
        let optional = false;
        for (let i = 0; i < 10; i++) {
          const d = cur._zod?.def ?? cur._def;
          if (!d) break;
          if (d.type === 'default') {
            defaultValue = typeof d.defaultValue === 'function' ? d.defaultValue() : d.defaultValue;
            cur = d.innerType;
            continue;
          }
          if (d.type === 'optional' || d.type === 'nullable') {
            optional = true;
            cur = d.innerType;
            continue;
          }
          return { def: d, defaultValue, optional };
        }
        return { def: cur._zod?.def ?? cur._def, defaultValue, optional };
      };

      const shape = (matching._zod?.def ?? matching._def).shape;
      const animationFields: any[] = [];
      const styleFields: any[] = [];
      const otherTunable: any[] = [];

      const animationKeywords = /anim|effect|enter|exit|transition|intro|outro|motion|speed|delay|duration|ease|bounce/i;
      const styleKeywords = /color|background|overlay|font|size|weight|align|position|fit|shadow|radius|opacity|variant|theme|highlight|border|gradient/i;
      const skipFields = new Set(['type', 'pluginId']);

      for (const [key, child] of Object.entries(shape)) {
        if (skipFields.has(key)) continue;
        const { def, defaultValue } = unwrap(child as any);
        if (!def) continue;

        let entry: any = { path: key, default: defaultValue };
        if (currentBlock && Object.prototype.hasOwnProperty.call(currentBlock, key)) {
          entry.current = currentBlock[key];
        }

        if (def.type === 'enum') {
          const values = def.entries ? Object.keys(def.entries) : (def.values ?? []);
          entry.kind = 'enum';
          entry.values = values;
        } else if (def.type === 'number') {
          let min: number | undefined, max: number | undefined;
          for (const c of def.checks ?? []) {
            const cd = c._zod?.def ?? c._def ?? c;
            if (cd.check === 'greater_than' || cd.kind === 'min') min = cd.value;
            if (cd.check === 'less_than' || cd.kind === 'max') max = cd.value;
          }
          entry.kind = 'number';
          if (min !== undefined) entry.min = min;
          if (max !== undefined) entry.max = max;
        } else if (def.type === 'boolean') {
          entry.kind = 'boolean';
        } else if (def.type === 'string') {
          // Only surface strings that look like color/style fields (color, fontFamily etc.).
          // Plain text content (heading, value, text) is edited via patchState directly.
          if (!styleKeywords.test(key)) continue;
          entry.kind = 'string';
        } else {
          continue; // skip arrays/objects/literals
        }

        if (animationKeywords.test(key)) animationFields.push(entry);
        else if (styleKeywords.test(key)) styleFields.push(entry);
        else otherTunable.push(entry);
      }

      await emitProgress(ctx, 'get-block-schema-options', 'complete', {
        blockType,
        animationCount: animationFields.length,
        styleCount: styleFields.length,
      }, progressId);

      return {
        ok: true as const,
        blockType,
        blockIndex: typeof blockIndex === 'number' ? blockIndex : undefined,
        animationFields,
        styleFields,
        otherTunable,
        hint: 'For each field, patchState("filledBlocks[<index>].<path>", <value>) then assembleVideo.',
      };
    } catch (e: any) {
      await emitProgress(ctx, 'get-block-schema-options', 'error', { errorMessage: e?.message ?? String(e) }, progressId);
      return { ok: false as const, error: e.message };
    }
  },
});

// ============================================================================
// Tool 11b: generateVideo — Full pipeline in one deterministic tool call
// story → director → fillAllBlocks (content + images + audio) → assembled
// The wizard calls this ONCE instead of chaining story→generator→assemble.
// This removes the multi-step LLM chaining that Flash consistently fails.
// ============================================================================

export const generateVideoMastra = createTool({
  id: 'generate-video',
  description: 'Run the full video generation pipeline AND assemble the final preview in one call: resolve blocks, plan narrative, generate all content+images+audio, save the Video record, and return the preview. This is a TERMINAL tool — after it returns, report the result to the user and STOP. Do NOT call any other tool after this. Do NOT use for modifications — use update-block-image / update-block-audio / patch-state + assemble-video instead.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID from system context'),
    userStory: z.string().describe('The user\'s video idea'),
    templateId: z.string().nullable().optional().describe('Pre-selected template ID from system context (pass null if none)'),
    requiredPluginIds: z.array(z.string()).optional().describe('Plugin IDs the user explicitly requested (from list-block-types)'),
    requiredBlockTypes: z.array(z.string()).optional().describe('Built-in block type names the user explicitly requested'),
    preferredVoice: z.string().nullable().optional(),
    preferredVisualStyle: z.string().nullable().optional(),
    language: z.string().optional(),
    apiKey: z.string().optional(),
  }),
  execute: async (inputData, ctx) => {
    const { threadId, userStory, templateId, requiredPluginIds, requiredBlockTypes, preferredVoice, preferredVisualStyle, language, apiKey: _apiKey } = inputData;
    const apiKey = _apiKey ?? '';

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`[generate-video] ▶ invoked threadId=${threadId}`);
    console.log(`[generate-video] userStory=${JSON.stringify(userStory)}`);
    console.log(`[generate-video] templateId=${templateId ?? 'null'} requiredPluginIds=${JSON.stringify(requiredPluginIds ?? [])} requiredBlockTypes=${JSON.stringify(requiredBlockTypes ?? [])}`);

    await emitProgress(ctx, 'generate-video', 'start', {});

    // Step 1: Resolve templateBlocks deterministically — no LLM needed for this decision
    let templateBlocks: Array<{ type: string; [key: string]: any }> = [];

    if (templateId) {
      console.log(`[generate-video] Branch A: loading template ${templateId}`);
      try {
        const r = await db.query('SELECT data FROM "Template" WHERE id = $1', [templateId]);
        const blocks = r.rows[0]?.data?.blocks ?? [];
        templateBlocks = blocks.map((b: any) => ({ ...b }));
      } catch (e: any) {
        console.warn(`[generate-video] template load failed: ${e.message}`);
      }
    }

    if (templateBlocks.length === 0 && ((requiredPluginIds ?? []).length > 0 || (requiredBlockTypes ?? []).length > 0)) {
      console.log(`[generate-video] Branch B: building templateBlocks from directive`);
      for (const pid of (requiredPluginIds ?? [])) {
        templateBlocks.push({ type: 'custom-plugin', pluginId: pid });
      }
      for (const t of (requiredBlockTypes ?? [])) {
        if (t !== 'custom-plugin') templateBlocks.push({ type: t });
      }
    }

    if (templateBlocks.length === 0) {
      console.log(`[generate-video] Branch D: calling selectTemplate`);
      try {
        const sel = await selectTemplateMastra.execute!({ userStory, blockCount: 5, apiKey }, undefined as any);
        templateBlocks = (sel as any).blocks ?? [];
      } catch (e: any) {
        console.warn(`[generate-video] selectTemplate failed: ${e.message}`);
        templateBlocks = [{ type: 'text' }, { type: 'stat' }, { type: 'cta' }];
      }
    }

    console.log(`[generate-video] templateBlocks resolved: ${JSON.stringify(templateBlocks)}`);

    // Pre-warm bg-removal Lambda while the pipeline runs (story → content → images)
    try {
      const { prewarmBgRemoval } = await import('@/lib/video/ai/media-service');
      prewarmBgRemoval();
    } catch { /* non-critical */ }

    // Step 2: Run the full generation pipeline via runWizardWorkflow (inlineMode)
    const { runWizardWorkflow } = await import('../workflows/wizard.workflow');
    const result = await runWizardWorkflow(threadId, {
      userStory,
      templateBlocks,
      partialVideoMeta: {},
      preferredArc: null,
      preferredVoice: preferredVoice ?? null,
      preferredVisualStyle: preferredVisualStyle ?? null,
      customVisualPrompt: null,
      customArc: null,
      language: language ?? 'en',
      apiKey,
      model: SERVER_MODEL,
    }, { inlineMode: true });

    const contentBlocks = (result.payload as any)?.contentBlocks ?? (result.payload as any)?.filledBlocks ?? [];
    const unresolvable = ((result.payload as any)?.unresolvable ?? []) as Array<{ blockIndex: number; path: string; kind: string; reason: string }>;
    const complete = unresolvable.length === 0;
    console.log(`[generate-video] ✅ pipeline complete — ${contentBlocks.length} blocks, ${unresolvable.length} unresolvable field(s)`);
    await emitProgress(ctx, 'generate-video', 'complete', { blockCount: contentBlocks.length, unresolvable });

    // Step 3: Assemble the video (previously a separate tool call — now atomic)
    await emitProgress(ctx, 'assemble-video', 'start');
    let videoId = '';
    try {
      const job = await wizardJobs.getJob(threadId);
      const state = job?.state;
      const filledBlocks = state?.filledBlocks ?? [];
      const videoMeta = state?.videoMeta ?? {};
      const payload = { videoMeta, contentBlocks: filledBlocks };
      const existing = job?.payload?.videoId;

      if (existing) {
        await db.query(
          `UPDATE "Video" SET data = $1, "createdAt" = NOW() WHERE id = $2`,
          [JSON.stringify(payload), existing],
        );
        videoId = existing;
      } else {
        const userId = await getThreadUserId(threadId);
        const insertResult = await db.query(
          `INSERT INTO "Video" (id, name, data, "userId", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id`,
          ['Wizard Video', JSON.stringify(payload), userId],
        );
        videoId = insertResult.rows[0]?.id ?? '';
      }

      await wizardJobs.updateJob(threadId, {
        status: 'complete',
        payload: { ...payload, videoId },
      });

      const videoInput = { videoMeta, contentBlocks: filledBlocks };
      await emitProgress(ctx, 'assemble-video', 'complete', { videoInput, videoId });
      console.log(`[generate-video] ✅ assembled videoId=${videoId}`);
    } catch (e: any) {
      console.warn(`[generate-video] assemble failed: ${e.message}`);
      await emitProgress(ctx, 'assemble-video', 'error', { errorMessage: e.message });
    }

    return {
      ok: true,
      threadId,
      videoId,
      blockCount: contentBlocks.length,
      complete,
      unresolvable,
      summary: complete
        ? `Video generated and assembled successfully. ${contentBlocks.length} block(s), preview ready (videoId: ${videoId}). NO further action needed — report to user and STOP.`
        : `Video generated with ${unresolvable.length} unfilled field(s). Fix them with update-block-image / update-block-audio, then call assemble-video.`,
    };
  },
});

// ============================================================================
// Tool 12: assembleVideo — Rebuild video from current state
// ============================================================================

export const assembleVideoMastra = createTool({
  id: 'assemble-video',
  description: 'Rebuild the final video preview from the current generation state. Call this ONCE after surgical edits (update-block-image, update-block-audio, patch-state, generate-block) to refresh the preview. This is a TERMINAL step — after it returns, report the result to the user and STOP. Do NOT call any other tool after this.',
  inputSchema: z.object({
    threadId: z.string().describe('Thread ID'),
  }),
  execute: async (inputData, ctx) => {
    const { threadId } = inputData;
    const progressId = await emitProgress(ctx, 'assemble-video', 'start');
    try {
      const job = await wizardJobs.getJob(threadId);
      if (!job || !job.state) {
        await emitProgress(ctx, 'assemble-video', 'error', { errorMessage: 'No generation state found for this thread' }, progressId);
        return { error: 'No generation state found for this thread' };
      }

      const state = job.state;
      const filledBlocks = state.filledBlocks ?? [];
      const videoMeta = state.videoMeta ?? {};

      // Create or update Video record
      const payload = {
        videoMeta,
        contentBlocks: filledBlocks,
      };

      // Check if a Video record already exists for this thread
      const existing = job.payload?.videoId;
      let videoId: string;

      if (existing) {
        await db.query(
          `UPDATE "Video" SET data = $1, "createdAt" = NOW() WHERE id = $2`,
          [JSON.stringify(payload), existing],
        );
        videoId = existing;
      } else {
        const userId = await getThreadUserId(threadId);
        const insertResult = await db.query(
          `INSERT INTO "Video" (id, name, data, "userId", "createdAt")
           VALUES (gen_random_uuid()::text, $1, $2, $3, NOW()) RETURNING id`,
          ['Wizard Video', JSON.stringify(payload), userId],
        );
        videoId = insertResult.rows[0]?.id ?? '';
      }

      await wizardJobs.updateJob(threadId, {
        status: 'complete',
        payload: { ...payload, videoId },
      });

      const videoInput = { videoMeta, contentBlocks: filledBlocks };
      await emitProgress(ctx, 'assemble-video', 'complete', { videoInput, videoId }, progressId);

      return {
        videoId,
        blockCount: filledBlocks.length,
        ok: true,
        // Canonical final video for the frontend — matches VideoInput shape.
        videoInput,
      };
    } catch (e: any) {
      await emitProgress(ctx, 'assemble-video', 'error', { errorMessage: e?.message ?? String(e) }, progressId);
      return { error: e.message, ok: false };
    }
  },
});

// ============================================================================
// Tool 15: listVoices — List available Deepgram TTS voices
// ============================================================================

export const listVoicesMastra = createTool({
  id: 'list-voices',
  description: 'List available Deepgram text-to-speech voices with name, gender, accent, and language. Show these to the user so they can pick a narration voice.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const { fetchAllVoices } = await import('@/lib/video/ai/deepgram-tts');
      const allVoices = await fetchAllVoices();
      // Filter to Deepgram voices only
      return allVoices
        .filter((v) => v.provider === 'deepgram')
        .map((v) => ({
          id: v.id,
          name: v.name,
          gender: v.gender,
          style: v.style,
          accent: v.accent ?? '',
          language: v.language ?? 'en',
        }));
    } catch {
      return [];
    }
  },
});

// ============================================================================
// Tool 16: listVisualStyles — List available visual styles
// ============================================================================

export const listVisualStylesMastra = createTool({
  id: 'list-visual-styles',
  description: 'List available visual styles for image generation (e.g. photorealistic, anime, minimalist, cinematic). Show these to the user so they can choose a look.',
  inputSchema: z.object({}),
  execute: async () => {
    try {
      const result = await db.query(
        'SELECT id, label, emoji, description, is_premium FROM visual_styles WHERE is_active = true ORDER BY sort_order ASC',
      );
      return result.rows.map((row: any) => ({
        id: row.id,
        label: row.label,
        emoji: row.emoji || '',
        description: row.description || '',
        isPremium: row.is_premium ?? false,
      }));
    } catch {
      return [];
    }
  },
});

// ============================================================================
// Aggregate tools for agent registration
// ============================================================================

// Full tool set — used by directorAgent (legacy) and as a reference
export const agentTools = {
  selectArc: selectArcMastra,
  planNarrative: planNarrativeMastra,
  generateContent: generateContentMastra,
  selectTemplate: selectTemplateMastra,
  createPlugin: createPluginMastra,
  listTemplates: listTemplatesMastra,
  getTemplate: getTemplateMastra,
  planVideo: planVideoMastra,
  generateBlock: generateBlockMastra,
  getVideoState: getVideoStateMastra,
  updateBlockImage: updateBlockImageMastra,
  updateBlockAudio: updateBlockAudioMastra,
  patchState: patchStateMastra,
  assembleVideo: assembleVideoMastra,
  listVoices: listVoicesMastra,
  listVisualStyles: listVisualStylesMastra,
};

// ── Per-agent tool sets for multi-agent architecture ──────────────────────────

// wizardAgent: conversation coordinator + surgical modifications
export const wizardAgentTools = {
  generateVideo: generateVideoMastra,   // full pipeline — one call for new videos
  assembleVideo: assembleVideoMastra,
  getVideoState: getVideoStateMastra,
  buildAndSavePlugin: buildAndSavePluginMastra, // persist an approved pendingPlugin to S3 + DB
  listBlockMediaFields: listBlockMediaFieldsMastra, // discover image/audio/video paths on any block
  updateBlockImage: updateBlockImageMastra,
  updateBlockAudio: updateBlockAudioMastra,
  patchState: patchStateMastra,
  listVoices: listVoicesMastra,
  listVisualStyles: listVisualStylesMastra,
  listTemplates: listTemplatesMastra,
  listBlockTypes: listBlockTypesMastra,
  generateBlock: generateBlockMastra,   // surgical "redo this block" only
  addBlock: addBlockMastra,             // insert + auto-fill a new block at an index
  removeBlock: removeBlockMastra,       // splice a block out of the video
  getBlockSchemaOptions: getBlockSchemaOptionsMastra, // animation/style enum + range introspection
  requestCustomPlugin: requestCustomPluginMastra, // signal supervisor to build a missing plugin
};

// storyAgent: template selection + narrative planning
export const storyAgentTools = {
  selectTemplate: selectTemplateMastra,
  listTemplates: listTemplatesMastra,
  getTemplate: getTemplateMastra,
  listPlugins: listPluginsMastra,
  listBlockTypes: listBlockTypesMastra,
  planVideo: planVideoMastra,
};

// generatorAgent: block-by-block execution
export const generatorAgentTools = {
  generateBlock: generateBlockMastra,
};
