import { callAIWithTracking, parseJSON, extractAudioFields, expandTemplatePaths, getNestedValue } from '../shared/utils';
import type { NormalizedMediaField } from '../shared/utils';
import { BLOCK_SCHEMAS } from '../shared/block-schemas';
import type { NarrativeBrief, MediaStrategy } from '../shared/types';

/**
 * Classify which fields in the raw content are images, audio, or video.
 * Unified path: uses normalizedFields from BLOCK_SCHEMAS (built-in) or
 * originalBlock.generationFields (custom plugins) for deterministic detection.
 * Falls back to LLM classification for block types not yet migrated.
 */
export async function classifyMediaFields(params: {
  rawContent: Record<string, any>;
  blockType: string;
  originalBlock: Record<string, any>;
  narrativeBrief: NarrativeBrief | null;
  mediaStrategy?: MediaStrategy | null;
  blockIndex?: number;
}): Promise<{
  imageFields: { path: string; description: string; searchQuery?: string; removeBackground?: boolean }[];
  audioFields: { path: string; text: string }[];
  videoFields: { path: string; prompt: string }[];
  rawContent?: Record<string, any>;
}> {
  console.log(`[classify_media_fields] ▶ ${params.blockType}`);

  function injectAudioFallback(content: Record<string, any>): Record<string, any> {
    const spokenScript = params.narrativeBrief?.spokenScript;
    if (!spokenScript) return content;
    const hasAudio = typeof content.audioSrc === 'string' && content.audioSrc.trim().length > 0;
    if (hasAudio) return content;
    return { ...content, audioSrc: spokenScript };
  }

  let effectiveRawContent = params.rawContent ?? {};

  // Parallax: seed from template if rawContent has no layers
  if (
    params.blockType === 'parallax-story' &&
    Array.isArray(params.originalBlock?.layers) &&
    params.originalBlock.layers.length > 0 &&
    (!Array.isArray(effectiveRawContent.layers) || effectiveRawContent.layers.length === 0)
  ) {
    const cleanedLayers = (params.originalBlock.layers as any[]).map((l: any) => {
      const img = l?.image;
      const isStaleUrl = typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'));
      return isStaleUrl ? { ...l, image: l.name ?? `layer visual for ${params.originalBlock.title ?? params.blockType}` } : l;
    });
    effectiveRawContent = { ...params.originalBlock, ...effectiveRawContent, layers: cleanedLayers };
  }

  effectiveRawContent = injectAudioFallback(effectiveRawContent);

  if (!effectiveRawContent || Object.keys(effectiveRawContent).length === 0) {
    return { imageFields: [], audioFields: [], videoFields: [] };
  }

  // ── Unified normalized path ──────────────────────────────────────────────────
  const schema = BLOCK_SCHEMAS[params.blockType];

  let normalizedFields: NormalizedMediaField[] | null = null;

  if (params.blockType !== 'custom-plugin' && schema?.normalizedFields) {
    normalizedFields = schema.normalizedFields;
  } else if (params.blockType === 'custom-plugin' && Array.isArray(params.originalBlock?.generationFields)) {
    normalizedFields = params.originalBlock.generationFields as NormalizedMediaField[];
  }

  if (normalizedFields) {
    const expanded = expandTemplatePaths(normalizedFields, effectiveRawContent);

    // Web-search-first policy: always attach a searchQuery to every image field.
    // resolve-media tries SerpAPI first; if it returns nothing usable, it falls
    // back to AI generation (Cloudflare/Runware). The planner's imageSource is
    // demoted to a hint that only influences searchQueryStyle (photo/screenshot/diagram).
    const imageFields = expanded
      .filter(f => f.type === 'image')
      .map(f => {
        // Use the raw content value at this path as the search query — the
        // generator writes visual descriptions there (e.g. "Lionel Messi portrait").
        // Fall back to the normalized field description if the value is empty or a URL.
        const rawVal = getNestedValue(effectiveRawContent, f.path);
        const searchQuery = typeof rawVal === 'string' && rawVal.trim() && !rawVal.startsWith('http')
          ? rawVal.trim()
          : f.description;
        return { path: f.path, description: f.description, removeBackground: f.removeBackground, searchQuery };
      });

    const audioFromNormalized = expanded
      .filter(f => f.type === 'audio')
      .map(f => ({ path: f.path, text: f.description }));

    // Merge with extractAudioFields to catch any audioSrc already set in content
    let rawContentForAudio = effectiveRawContent;
    if (
      (params.blockType === 'parallax-story' || params.blockType === 'motivational-image') &&
      params.rawContent?.text &&
      (params.rawContent?.textMode === 'overall' || params.blockType === 'motivational-image')
    ) {
      rawContentForAudio = { ...params.rawContent, audioSrc: params.rawContent.text };
    }
    const audioFields = [
      ...audioFromNormalized,
      ...extractAudioFields(rawContentForAudio).filter(
        (af) => !audioFromNormalized.some(e => e.path === af.path)
      ),
    ];

    const videoFields = expanded
      .filter(f => f.type === 'video')
      .map(f => ({ path: f.path, prompt: f.description }));

    console.log(`[classify_media_fields] ✅ normalized path — ${imageFields.length} images, ${audioFields.length} audio, ${videoFields.length} video`);
    return { imageFields, audioFields, videoFields, rawContent: effectiveRawContent };
  }

  // ── Fallback: LLM classification (for block types without normalizedFields) ──

  let rawContentForAudio = effectiveRawContent;
  if (
    (params.blockType === 'parallax-story' || params.blockType === 'motivational-image') &&
    params.rawContent?.text &&
    (params.rawContent?.textMode === 'overall' || params.blockType === 'motivational-image')
  ) {
    rawContentForAudio = { ...params.rawContent, audioSrc: params.rawContent.text };
  }

  const audioFields = extractAudioFields(rawContentForAudio);

  const videoFields: { path: string; prompt: string }[] = [];
  if (params.blockType === 'video') {
    const src = params.rawContent?.src as string;
    if (!src || (!src.startsWith('http') && !src.startsWith('data:'))) {
      const prompt = src || params.rawContent?.caption || params.rawContent?.text || '';
      if (prompt) {
        videoFields.push({ path: 'src', prompt });
      }
    }
  }

  if (!schema?.imageFields) {
    return { imageFields: [], audioFields, videoFields };
  }

  let contentForClassification = params.rawContent;
  if (params.blockType === 'video') {
    const { src, ...rest } = params.rawContent as any;
    contentForClassification = rest;
  }

  try {
    const blockStrategy = params.mediaStrategy?.blockStrategies
      ?.find(b => b.blockIndex === (params.blockIndex ?? 0));
    // Always include a searchQuery (web-first policy). The planner's imageSource
    // hint only influences phrasing via searchQueryStyle.
    const includeSearchQuery = params.blockType !== 'video';
    const queryStyleHint = blockStrategy?.searchQueryStyle ?? 'photo';

    const response = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a media field classifier for video blocks.

Given a block type, schema hints, and generated JSON content, identify:

IMAGE FIELDS — fields whose value is a visual description needing image generation.
   Defined image hints for this block: "${schema?.imageFields || 'none'}"
   Also detect any field whose value looks like a visual scene description
   (not a URL, not a sentence of prose, but a visual description).
${params.blockType === 'video' ? '\nIMPORTANT: Do NOT classify "src" as an image field — it is a video field handled separately.\n' : ''}
For nested array fields use dot notation: "avatars[0].image", "layers[1].image"

Return ONLY this JSON, no markdown:
{
  "imageFields": [{ "path": "dot.path", "description": "the visual description value"${includeSearchQuery ? ', "searchQuery": "specific web search query to find a real ' + queryStyleHint + '"' : ''} }]
}

Return empty array if nothing qualifies.${includeSearchQuery ? `\n\nFor every image field, also include a "searchQuery" — a specific web search query to find a real ${queryStyleHint}. Make queries very specific (include subject names, product names, year, location, etc.). The "description" is a fallback for AI generation only if web search returns nothing.` : ''}`,
        },
        {
          role: 'user',
          content: `Block type: "${params.blockType}"
Generated content:
${JSON.stringify(contentForClassification, null, 2)}`,
        },
      ],
      apiKey: '',
      maxTokens: 800,
      model: '',
    });

    const classified = parseJSON(response);
    const imageFields = (classified.imageFields ?? []).filter(
      (f: any) => !(params.blockType === 'video' && f.path === 'src')
    );

    return { imageFields, audioFields, videoFields };
  } catch (e: any) {
    console.warn('[classify_media_fields] ⚠️ image classification failed:', e.message);
    return { imageFields: [], audioFields, videoFields };
  }
}
