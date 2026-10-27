import type { NormalizedMediaField } from '../video/ai/mastra/shared/utils';

/**
 * Extract normalized media fields from a plugin's schema.json + Scene.tsx source.
 * Replaces the local `extractGenerationFields` functions in all 3 plugin API routes.
 *
 * Handles:
 *   - Top-level schema properties with `editor: 'image' | 'audio' | 'video'`
 *   - Nested array properties: `type: 'array'` → `items.properties` with media editor types
 *     produces template paths like "players[].image"
 *   - Scene.tsx `data-ai-type` annotations for fields not covered by the schema
 *
 * Returns a flat, deduplicated `NormalizedMediaField[]` stored as `generation_fields` in DB.
 */
export function extractNormalizedFields(
  schemaObj: Record<string, any>,
  sceneCode: string,
): NormalizedMediaField[] {
  const fields: NormalizedMediaField[] = [];
  const seen = new Set<string>();

  function add(field: NormalizedMediaField) {
    if (!seen.has(field.path)) {
      seen.add(field.path);
      fields.push(field);
    }
  }

  const mediaEditors = new Set(['image', 'audio', 'video']);

  function collectSchemaFields(properties: Record<string, any>, prefix = '') {
    for (const [key, prop] of Object.entries(properties)) {
      const path = prefix ? `${prefix}.${key}` : key;

      if (mediaEditors.has(prop.editor)) {
        add({
          path,
          description: prop.description ?? prop.title ?? '',
          type: prop.editor as 'image' | 'audio' | 'video',
          removeBackground: !!prop.removeBackground,
        });
      }

      if (prop.type === 'array' && prop.items?.properties) {
        for (const [nestedKey, nestedProp] of Object.entries(prop.items.properties as Record<string, any>)) {
          const nestedPath = `${path}[].${nestedKey}`;
          if (mediaEditors.has((nestedProp as any).editor)) {
            add({
              path: nestedPath,
              description: (nestedProp as any).description ?? (nestedProp as any).title ?? '',
              type: (nestedProp as any).editor as 'image' | 'audio' | 'video',
              removeBackground: !!(nestedProp as any).removeBackground,
            });
          }

          if ((nestedProp as any).type === 'object' && (nestedProp as any).properties) {
            collectSchemaFields((nestedProp as any).properties as Record<string, any>, nestedPath);
          }
        }
      }

      if (prop.type === 'object' && prop.properties) {
        collectSchemaFields(prop.properties as Record<string, any>, path);
      }
    }
  }

  const schemaProperties = (schemaObj.properties ?? {}) as Record<string, any>;
  const pluginDataWrapper = schemaProperties.pluginData;
  if (
    pluginDataWrapper?.type === 'object' &&
    pluginDataWrapper.properties &&
    Object.keys(schemaProperties).length === 1
  ) {
    collectSchemaFields(pluginDataWrapper.properties as Record<string, any>);
  } else {
    collectSchemaFields(schemaProperties);
  }

  // ── Source 1: schema.json properties ────────────────────────────────────────
  if (!(pluginDataWrapper?.type === 'object' && pluginDataWrapper.properties && Object.keys(schemaProperties).length === 1)) {
  for (const [key, prop] of Object.entries((schemaObj.properties ?? {}) as Record<string, any>)) {
    if (mediaEditors.has(prop.editor)) {
      add({
        path: key,
        description: prop.description ?? prop.title ?? '',
        type: prop.editor as 'image' | 'audio' | 'video',
        removeBackground: !!prop.removeBackground,
      });
    }

    // Recurse one level into array-type properties
    if (prop.type === 'array' && prop.items?.properties) {
      for (const [nestedKey, nestedProp] of Object.entries(prop.items.properties as Record<string, any>)) {
        if (mediaEditors.has(nestedProp.editor)) {
          add({
            path: `${key}[].${nestedKey}`,
            description: nestedProp.description ?? nestedProp.title ?? '',
            type: nestedProp.editor as 'image' | 'audio' | 'video',
            removeBackground: !!nestedProp.removeBackground,
          });
        }
      }
    }

    // Recurse one level into object-type properties
    if (prop.type === 'object' && prop.properties) {
      for (const [nestedKey, nestedProp] of Object.entries(prop.properties as Record<string, any>)) {
        if (mediaEditors.has((nestedProp as any).editor)) {
          add({
            path: `${key}.${nestedKey}`,
            description: (nestedProp as any).description ?? (nestedProp as any).title ?? '',
            type: (nestedProp as any).editor as 'image' | 'audio' | 'video',
            removeBackground: !!(nestedProp as any).removeBackground,
          });
        }
      }
    }
  }
  }

  // ── Source 2: data-ai-type annotations in Scene.tsx ──────────────────────────
  // Matches elements with data-ai-type="image|audio|video" and finds their src={data.path}
  // This is robust against attribute order and nesting (e.g. data.item.imageUrl).
  const elementRegex = /<[^>]+data-ai-type="(image|audio|video)"[^>]*>/g;
  let elementMatch: RegExpExecArray | null;
  while ((elementMatch = elementRegex.exec(sceneCode)) !== null) {
    const fullElement = elementMatch[0];
    const type = elementMatch[1] as 'image' | 'audio' | 'video';

    // Extract the path from src={data.path} or src={path} (if inside a map)
    const srcMatch = fullElement.match(/src=\{(?:data\.)?([\w.]+)\}/);
    const promptMatch = fullElement.match(/data-ai-prompt="([^"]*)"/);
    const removeBgMatch = fullElement.match(/data-ai-remove-bg="true"/);

    if (srcMatch) {
      add({
        path: srcMatch[1],
        description: promptMatch ? promptMatch[1] : '',
        type,
        removeBackground: !!removeBgMatch,
      });
    }
  }

  return fields;
}

/**
 * Convert old `generation_fields` format `{image:[{path,prompt}], audio:[], video:[]}`
 * to the new flat `NormalizedMediaField[]` format.
 * Used for backward compat during DB migration transition.
 */
export function convertLegacyGenerationFields(
  legacy: { image?: { path: string; prompt: string }[]; audio?: { path: string; prompt: string }[]; video?: { path: string; prompt: string }[] },
): NormalizedMediaField[] {
  const fields: NormalizedMediaField[] = [];
  for (const f of legacy.image ?? []) fields.push({ path: f.path, description: f.prompt, type: 'image' });
  for (const f of legacy.audio ?? []) fields.push({ path: f.path, description: f.prompt, type: 'audio' });
  for (const f of legacy.video ?? []) fields.push({ path: f.path, description: f.prompt, type: 'video' });
  return fields;
}

/** True if the stored `generation_fields` value is in the old object format. */
export function isLegacyGenerationFields(val: unknown): val is { image: unknown[]; audio: unknown[]; video: unknown[] } {
  return (
    val !== null &&
    typeof val === 'object' &&
    !Array.isArray(val) &&
    'image' in (val as object)
  );
}
