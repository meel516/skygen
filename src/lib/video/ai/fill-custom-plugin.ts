import { db } from '@/lib/db';
import type { NormalizedMediaField } from './mastra/shared/utils';
import { convertLegacyGenerationFields, extractNormalizedFields, isLegacyGenerationFields } from '@/lib/plugins/extract-normalized-fields';

interface NarrativeBrief {
  narrativeRole?: string;
  keyMessage?:    string;
  tone?:          string;
  spokenScript?:  string;
  [key: string]:  any;
}

/**
 * Fetch plugin metadata (generationFields + seed data) from DB so the shared
 * content-generation pipeline can treat custom-plugin blocks like any other
 * block. Content filling (text + image descriptions + audio) is done by
 * `generateContent` downstream — this function no longer calls the LLM itself.
 *
 * Returns `{ rawContent, generationFields }` where:
 *   - rawContent = template seed data (block.pluginData) — `generateContent`
 *     will replace/augment these with real values based on the story.
 *   - generationFields = NormalizedMediaField[] from the plugin DB record,
 *     used by `classifyMediaFields` to know which paths need media.
 */
export async function fillCustomPluginBlock(
  block: any,
  _brief: NarrativeBrief | null,
  _userStory: string,
  _apiKey: string,
  _model: string,
): Promise<{
  rawContent: Record<string, any>;
  generationFields: NormalizedMediaField[];
  schemaDescriptions?: Record<string, string>;
}> {
  if (!block.pluginId) {
    return { rawContent: block.pluginData ?? {}, generationFields: [] };
  }

  const result = await db.query(
    `SELECT schema_json, generation_fields FROM plugins WHERE id = $1`,
    [block.pluginId],
  );
  if (!result.rows[0]) {
    console.warn(`[fillCustomPlugin] Plugin not found: ${block.pluginId}`);
    return { rawContent: block.pluginData ?? {}, generationFields: [] };
  }

  // Seed rawContent with ALL schema property keys (default values if present,
  // empty string otherwise) so generateContent's custom-plugin branch has the
  // full field list to instruct the LLM. Without this seed, block.pluginData
  // might be empty and the LLM would have nothing to fill.
  let schema: Record<string, any> = {};
  try { schema = JSON.parse(result.rows[0].schema_json); } catch { /* use empty */ }
  const schemaProperties = (schema.properties ?? {}) as Record<string, any>;
  const pluginDataWrapper = schemaProperties.pluginData;
  const contentSchema =
    pluginDataWrapper?.type === 'object' &&
    pluginDataWrapper.properties &&
    Object.keys(schemaProperties).length === 1
      ? { ...pluginDataWrapper, properties: pluginDataWrapper.properties }
      : schema;

  let generationFields: NormalizedMediaField[];
  const rawFields = result.rows[0].generation_fields;
  if (isLegacyGenerationFields(rawFields as any)) {
    generationFields = convertLegacyGenerationFields(rawFields);
  } else if (Array.isArray(rawFields)) {
    generationFields = rawFields as NormalizedMediaField[];
  } else {
    generationFields = [];
  }
  if (generationFields.length === 0) {
    generationFields = extractNormalizedFields(contentSchema, '');
  }

  // Max [N] index referenced per top-level array in generationFields.
  // Drives how many empty entries to seed, so setNestedValue has the right
  // array slots to write into (e.g. questions[0..3] → seed 4 entries).
  const arraySize: Record<string, number> = {};
  for (const f of generationFields) {
    const m = (f.path ?? '').match(/^([^[.]+)\[(\d+)\]/);
    if (!m) continue;
    const [, name, idxStr] = m;
    const need = parseInt(idxStr, 10) + 1;
    if (need > (arraySize[name] ?? 0)) arraySize[name] = need;
  }

  const seedForProp = (key: string, prop: any): any => {
    if (prop?.default !== undefined) return prop.default;
    const t = prop?.type;
    if (t === 'array') return Array.from({ length: arraySize[key] ?? 0 }, () => ({}));
    if (t === 'object') return {};
    if (t === 'number' || t === 'integer') return 0;
    if (t === 'boolean') return false;
    return '';
  };

  const schemaSeed: Record<string, any> = {};
  for (const [key, prop] of Object.entries((contentSchema.properties ?? {}) as Record<string, any>)) {
    schemaSeed[key] = seedForProp(key, prop);
  }

  // Build a flat path→description map from schema properties so generateContent
  // can tell the LLM what each field drives in the animation (e.g. "fades in
  // during enter phase", "counts up from 0 to value over enter phase").
  const schemaDescriptions: Record<string, string> = {};
  for (const [key, prop] of Object.entries((contentSchema.properties ?? {}) as Record<string, any>)) {
    if (prop?.description) schemaDescriptions[key] = prop.description;
  }

  const blockPluginData =
    block.pluginData?.pluginData &&
    typeof block.pluginData.pluginData === 'object' &&
    !Array.isArray(block.pluginData.pluginData)
      ? block.pluginData.pluginData
      : block.pluginData;

  const rawContent = { ...schemaSeed, ...(blockPluginData ?? {}) };
  return { rawContent, generationFields, schemaDescriptions };
}
