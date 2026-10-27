import { setNestedValue } from '../shared/utils';
import { BLOCK_SCHEMAS } from '../shared/block-schemas';
import { TowerChart3DBlockSchema } from '../../../schemas';

/**
 * Merge generated content with resolved media URLs into a final block.
 * Owns its logic — no graph.ts dependency.
 */
export async function mergeBlock(params: {
  rawContent: Record<string, any>;
  resolvedUrls: Record<string, string>;
  resolvedAudio: Record<string, string>;
  originalBlock: Record<string, any>;
  blockType: string;
  blockIndex: number;
  narrativeBrief?: any;
}): Promise<{ finalBlock: Record<string, any> }> {
  console.log(`[merge_media] ▶ ${params.blockType}`);

  // Defensive: if a caller passed a JSON string, parse it — spreading a string
  // would add character-indexed keys to the final block.
  let origBlock: Record<string, any> = {};
  if (typeof params.originalBlock === 'string') {
    try {
      const parsed = JSON.parse(params.originalBlock);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) origBlock = parsed;
    } catch { /* leave as {} */ }
  } else if (params.originalBlock && typeof params.originalBlock === 'object' && !Array.isArray(params.originalBlock)) {
    origBlock = params.originalBlock;
  }

  const rawContentIsEmpty = !params.rawContent || Object.keys(params.rawContent).length === 0;
  if (rawContentIsEmpty) {
    console.error(
      `[merge_media] ❌ rawContent is EMPTY for block ${params.blockIndex + 1} (${params.blockType}). ` +
      `Proceeding with resolved media so generated images/audio aren't discarded.`
    );
  }

  let content: Record<string, any> = rawContentIsEmpty ? {} : { ...params.rawContent };

  if (rawContentIsEmpty) {
    const staleMediaKeys = ['src', 'imageSrc', 'image', 'url', 'audioSrc', 'videoSrc'];
    for (const k of staleMediaKeys) {
      if (k in origBlock) content[k] = '';
    }
    if (Array.isArray(origBlock.layers)) {
      content.layers = (origBlock.layers as any[]).map((l: any) => ({
        ...l,
        image: typeof l.image === 'string' && (l.image.startsWith('http') || l.image.startsWith('data:')) ? '' : l.image,
      }));
    }
    if (params.narrativeBrief?.spokenScript) {
      content.audioSrc = params.narrativeBrief.spokenScript;
    }
  }

  for (const [path, url] of Object.entries(params.resolvedUrls)) {
    content = setNestedValue(content, path, url);
  }

  for (const [path, audio] of Object.entries(params.resolvedAudio)) {
    if (audio) {
      content = setNestedValue(content, path, audio);
    }
  }

  const { type: _stripped, ...contentWithoutType } = content;

  if (params.blockType === 'tower-chart-3d') {
    try {
      const contentWithType = { ...contentWithoutType, type: params.blockType };
      const validated = TowerChart3DBlockSchema.parse(contentWithType);
      Object.assign(contentWithoutType, validated);
    } catch (e) {
      console.error('[merge_media] ❌ Schema validation failed for tower-chart-3d:', e);
    }
  }

  const schema = BLOCK_SCHEMAS[params.blockType as keyof typeof BLOCK_SCHEMAS];
  // Custom plugins have no fixed content-field list in BLOCK_SCHEMAS — their
  // shape comes from the plugin's own JSON Schema, so accept every key the
  // pipeline produced. Same fallback when a built-in omits contentFields.
  const useAllKeys =
    params.blockType === 'custom-plugin' ||
    !schema?.contentFields ||
    schema.contentFields.length === 0;
  const allowedFields = new Set(useAllKeys ? Object.keys(contentWithoutType) : schema!.contentFields);

  const pickedContent: Record<string, any> = {};
  for (const [key, val] of Object.entries(contentWithoutType)) {
    if (allowedFields.has(key)) {
      pickedContent[key] = val;
    }
  }

  let finalBlock: Record<string, any>;

  if (params.blockType === 'custom-plugin') {
    // Custom-plugin schema: plugin-specific fields live under `pluginData`;
    // top-level carries only block-customization fields (type, pluginId,
    // audioSrc, duration, audioLoop, title).
    const TOP_LEVEL = new Set(['audioSrc', 'duration', 'audioLoop', 'title']);
    const pluginData: Record<string, any> = { ...(origBlock.pluginData ?? {}) };
    const topLevelOverrides: Record<string, any> = {};
    for (const [key, val] of Object.entries(pickedContent)) {
      if (TOP_LEVEL.has(key)) topLevelOverrides[key] = val;
      else pluginData[key] = val;
    }
    finalBlock = {
      ...origBlock,
      type: 'custom-plugin',
      pluginId: origBlock.pluginId,
      ...topLevelOverrides,
      pluginData,
    };
  } else {
    finalBlock = {
      ...origBlock,
      type: params.blockType,
      ...pickedContent,
    };
    delete finalBlock.pluginData;
  }

  // Strip internal scaffolding — generated blocks must not carry these to the renderer
  delete finalBlock._skeleton;
  delete finalBlock.blockIndex;
  delete finalBlock.generationFields;

  return { finalBlock };
}
