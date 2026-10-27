import { AsyncLocalStorage } from 'async_hooks';
import { parseBuffer } from 'music-metadata';
import { generateText } from '../../providers';
import type { AIMessage } from '../../providers/types';

// ============================================================================
// SHARED UTILITIES — owned by the Mastra layer (no graph.ts dependency)
// ============================================================================

// ── Token tracking ──────────────────────────────────────────────────────────
const tokenStore = new AsyncLocalStorage<{ total: number }>();

/**
 * Reset the token tracker for the current async context.
 * Call at the start of a workflow run.
 */
export function resetTokenTracker(): void {
  const store = tokenStore.getStore();
  if (store) {
    store.total = 0;
  }
}

/**
 * Get the total tokens used in the current async context.
 */
export function getTokenTotal(): number {
  const store = tokenStore.getStore();
  return store?.total ?? 0;
}

/**
 * Run a callback with a fresh token tracking context.
 * Returns the result and the total tokens used.
 */
export async function withTokenTracking<T>(fn: () => Promise<T>): Promise<{ result: T; tokensUsed: number }> {
  return tokenStore.run({ total: 0 }, async () => {
    const result = await fn();
    return { result, tokensUsed: tokenStore.getStore()!.total };
  });
}

/**
 * Call the AI provider with automatic token tracking.
 * Uses the shared generateText from providers and accumulates
 * totalTokens into the current AsyncLocalStorage context.
 */
export async function callAIWithTracking(params: {
  messages: AIMessage[];
  apiKey?: string | null;
  model?: string | null;
  maxTokens?: number;
  temperature?: number;
}): Promise<string> {
  const result = await generateText({
    messages: params.messages,
    apiKey: params.apiKey,
    model: params.model,
    maxTokens: params.maxTokens,
    temperature: params.temperature,
  });

  const tokensUsed = result.usage.totalTokens ?? 0;
  const store = tokenStore.getStore();
  if (store) store.total += tokensUsed;

  console.log(
    '[callAIWithTracking] provider:', result.provider,
    'model:', result.model,
    'tokens:', tokensUsed,
    'total:', store?.total ?? 0,
  );

  return result.text;
}

// ── Language helper ──────────────────────────────────────────────────────────
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  ar: 'Arabic', hi: 'Hindi', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  it: 'Italian', nl: 'Dutch', tr: 'Turkish', ru: 'Russian', pl: 'Polish',
  sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', cs: 'Czech',
  ro: 'Romanian', el: 'Greek', hu: 'Hungarian', th: 'Thai', vi: 'Vietnamese',
  id: 'Indonesian', ms: 'Malay', uk: 'Ukrainian',
};

export function languageName(code: string): string {
  return LANG_NAMES[code] || code;
}

// ── JSON parser ──────────────────────────────────────────────────────────────
export function parseJSON(raw: string): Record<string, any> {
  let str = raw.trim();
  if (str.startsWith('```json')) str = str.slice(7);
  else if (str.startsWith('```')) str = str.slice(3);
  if (str.endsWith('```')) str = str.slice(0, -3);
  str = str.trim();

  const firstObject = str.indexOf('{');
  const firstArray = str.indexOf('[');
  const startCandidates = [firstObject, firstArray].filter((index) => index >= 0);
  const start = startCandidates.length > 0 ? Math.min(...startCandidates) : -1;

  if (start >= 0 && start < str.length) {
    const openChar = str[start];
    const closeChar = openChar === '{' ? '}' : ']';
    let depth = 0;
    let inString = false;
    let escaping = false;

    for (let i = start; i < str.length; i++) {
      const char = str[i];

      if (inString) {
        if (escaping) {
          escaping = false;
          continue;
        }
        if (char === '\\') {
          escaping = true;
          continue;
        }
        if (char === '"') {
          inString = false;
        }
        continue;
      }

      if (char === '"') {
        inString = true;
        continue;
      }
      if (char === openChar) {
        depth++;
        continue;
      }
      if (char === closeChar) {
        depth--;
        if (depth === 0) {
          str = str.slice(start, i + 1);
          break;
        }
      }
    }
  }

  return JSON.parse(str);
}

// ── Nested value setter ──────────────────────────────────────────────────────
export function setNestedValue(obj: any, dotPath: string, value: any): any {
  const parts = dotPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  const result = obj && typeof obj === 'object' ? JSON.parse(JSON.stringify(obj)) : {};
  let cursor = result;
  for (let i = 0; i < parts.length - 1; i++) {
    const key = parts[i];
    const nextKey = parts[i + 1];
    const nextIsIndex = /^\d+$/.test(nextKey);
    const existing = cursor[key];
    if (existing == null || typeof existing !== 'object') {
      cursor[key] = nextIsIndex ? [] : {};
    }
    cursor = cursor[key];
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
}

// ── Normalized media field contract ──────────────────────────────────────────

/**
 * A media field that needs AI generation (image, audio, or video).
 * Template paths use `[]` for array expansion: "players[].image"
 * `removeBackground`:
 *   - true/false → static schema declaration (used as-is)
 *   - undefined   → data-driven; expandTemplatePaths reads arr[i].removeBackground at runtime
 */
export interface NormalizedMediaField {
  path: string;
  description: string;
  type: 'image' | 'audio' | 'video';
  removeBackground?: boolean;
}

/** Read a value from a nested object using dot/bracket notation. */
export function getNestedValue(obj: any, dotPath: string): any {
  const parts = dotPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  let cursor = obj;
  for (const part of parts) {
    if (cursor == null) return undefined;
    cursor = cursor[part];
  }
  return cursor;
}

const CUSTOM_PLUGIN_TOP_LEVEL_FIELDS = new Set(['audioSrc', 'duration', 'audioLoop', 'title']);

/**
 * generationFields paths for custom plugins are relative to pluginData. Once a
 * block has been merged into final render shape, resolve those paths through
 * block.pluginData so generic validators/tools do not create poisoned top-level
 * plugin fields like block.scenes.
 */
export function resolveBlockDataPath(block: Record<string, any> | string | null | undefined, path: string): string {
  const blockType = typeof block === 'string' ? block : block?.type;
  if (blockType !== 'custom-plugin') return path;
  if (path.startsWith('pluginData.')) return path;

  const root = path.match(/^[^[.]+/)?.[0] ?? path;
  if (CUSTOM_PLUGIN_TOP_LEVEL_FIELDS.has(root)) return path;

  return `pluginData.${path}`;
}

export function getBlockNestedValue(block: Record<string, any>, path: string): any {
  return getNestedValue(block, resolveBlockDataPath(block, path));
}

export function setBlockNestedValue(block: Record<string, any>, path: string, value: any): any {
  return setNestedValue(block, resolveBlockDataPath(block, path), value);
}

/**
 * Expand template paths ("players[].image") into concrete indexed paths
 * ("players[0].image", "players[1].image", …) based on actual array length
 * in dataObject. For each expanded path:
 *   - description is read from dataObject at that path (runtime LLM value
 *     overrides the static schema hint when available)
 *   - removeBackground follows the two-tier rule:
 *       schema value !== undefined → use it
 *       schema value === undefined → read arr[i].removeBackground from data
 * Paths whose resolved value already starts with "http" or "data:" are skipped.
 */
/**
 * A resolved asset URL we should NOT regenerate. `data:` URIs and real http(s)
 * URLs count as resolved — EXCEPT obvious placeholders the LLM hallucinated
 * (example.com, `example_` in path, "placeholder", "your-domain", picsum
 * placeholder seed). Those fall through so the resolver generates a real asset.
 */
function isResolvedAssetUrl(value: string): boolean {
  if (value.startsWith('data:')) return true;
  if (!value.startsWith('http')) return false;
  const v = value.toLowerCase();
  if (
    v.includes('example.com') ||
    v.includes('example_') ||
    v.includes('/placeholder') ||
    v.includes('your-domain') ||
    v.includes('picsum.photos/seed/placeholder')
  ) {
    return false;
  }
  return true;
}

export function expandTemplatePaths(
  normalizedFields: NormalizedMediaField[],
  dataObject: Record<string, any>,
): { path: string; description: string; type: NormalizedMediaField['type']; removeBackground?: boolean }[] {
  const result: { path: string; description: string; type: NormalizedMediaField['type']; removeBackground?: boolean }[] = [];

  for (const field of normalizedFields) {
    // Template path pattern: "arrayName[].nestedField" (one level of array expansion)
    const templateMatch = field.path.match(/^([^[]+)\[\]\.(.+)$/);

    if (templateMatch) {
      const [, arrayName, nestedField] = templateMatch;
      const arr = dataObject?.[arrayName];
      if (!Array.isArray(arr)) continue;

      for (let i = 0; i < arr.length; i++) {
        const concretePath = `${arrayName}[${i}].${nestedField}`;
        // For single-key nestedField, read directly; otherwise use getNestedValue
        const leafValue = nestedField.includes('.')
          ? getNestedValue(arr[i], nestedField)
          : arr[i]?.[nestedField];
        const leafStr = typeof leafValue === 'string' ? leafValue.trim() : '';
        if (leafStr && isResolvedAssetUrl(leafStr)) continue;
        const desc = leafStr || field.description;

        // removeBackground: schema wins if set, otherwise read from array item
        const bgRemoval =
          field.removeBackground !== undefined
            ? field.removeBackground
            : ((arr[i]?.removeBackground as boolean | undefined) ?? false);

        result.push({ path: concretePath, description: desc, type: field.type, removeBackground: bgRemoval });
      }
    } else {
      // Non-array path
      const leafValue = getNestedValue(dataObject, field.path);
      const leafStr = typeof leafValue === 'string' ? leafValue.trim() : '';
      if (leafStr && isResolvedAssetUrl(leafStr)) continue;
      const desc = leafStr || field.description;

      const bgRemoval = field.removeBackground ?? false;
      result.push({ path: field.path, description: desc, type: field.type, removeBackground: bgRemoval });
    }
  }

  return result;
}

// ── Arc role fitting ─────────────────────────────────────────────────────────
export function fitRolesToBlocks(roles: string[], blockCount: number): string[] {
  if (blockCount === roles.length) return [...roles];

  if (blockCount < roles.length) {
    if (blockCount === 1) return [roles[0]];
    if (blockCount === 2) return [roles[0], roles[roles.length - 1]];
    const result: string[] = [roles[0]];
    const middleSlots = blockCount - 2;
    const middleRoles = roles.slice(1, -1);
    const step = middleRoles.length / middleSlots;
    for (let i = 0; i < middleSlots; i++) {
      result.push(middleRoles[Math.round(i * step)]);
    }
    result.push(roles[roles.length - 1]);
    return result;
  }

  const result = [...roles];
  const middleStart = 1;
  const middleEnd   = roles.length - 1;
  let i = middleStart;
  while (result.length < blockCount) {
    result.splice(result.length - 1, 0, roles[i]);
    i = i >= middleEnd - 1 ? middleStart : i + 1;
  }
  return result;
}

// ── Audio field extraction ───────────────────────────────────────────────────
export function extractAudioFields(obj: any, prefix = ''): { path: string; text: string }[] {
  const fields: { path: string; text: string }[] = [];
  if (!obj || typeof obj !== 'object') return fields;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => {
      fields.push(...extractAudioFields(item, `${prefix}[${i}]`));
    });
  } else {
    for (const [key, val] of Object.entries(obj)) {
      const path = prefix ? `${prefix}.${key}` : key;
      if (key === 'audioSrc' && typeof val === 'string' && val.trim()) {
        fields.push({ path, text: val.trim() });
      } else if (val && typeof val === 'object') {
        fields.push(...extractAudioFields(val, path));
      }
    }
  }
  return fields;
}

// ── Parallax layer merging ───────────────────────────────────────────────────
export function mergeParallaxLayers(filledBlock: Record<string, any>, originalBlock: Record<string, any>): Record<string, any> {
  if (filledBlock.type !== 'parallax-story') return filledBlock;
  if (!Array.isArray(originalBlock.layers)) return filledBlock;

  const aiLayers: any[] = Array.isArray(filledBlock.layers) ? filledBlock.layers : [];

  const mergedLayers = originalBlock.layers.map((templateLayer: any, i: number) => {
    const aiLayer = aiLayers[i] ?? {};
    return {
      ...templateLayer,
      ...aiLayer,
    };
  });

  return {
    ...filledBlock,
    layers: mergedLayers,
  };
}

// ── Audio duration helpers ───────────────────────────────────────────────────
export const WORDS_PER_SECOND = 2.1;
export const AUDIO_TAIL_SECS  = 2.0;

async function getAudioDurationSeconds(audioSrc: string): Promise<number> {
  try {
    let buf: Buffer;
    let mime = '';

    if (audioSrc.startsWith('data:audio')) {
      const [header, base64] = audioSrc.split(',');
      if (!base64) return 0;
      mime = header?.split(':')[1]?.split(';')[0] ?? '';
      buf = Buffer.from(base64, 'base64');
    }
    else if (audioSrc.startsWith('http')) {
      const response = await fetch(audioSrc, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) {
        console.warn(`[getAudioDurationSeconds] fetch failed: HTTP ${response.status}`);
        return 0;
      }
      buf = Buffer.from(await response.arrayBuffer());
      mime = response.headers.get('content-type') || 'audio/wav';
    } else {
      return 0;
    }

    const metadata = await parseBuffer(buf, { mimeType: mime || undefined });
    const duration = metadata.format.duration ?? 0;
    console.log(`[getAudioDurationSeconds] ${duration.toFixed(2)}s (${mime}, ${buf.length} bytes)`);
    return duration;
  } catch (e) {
    console.warn('[getAudioDurationSeconds] failed:', e);
    return 0;
  }
}

// ── Block post-processors ────────────────────────────────────────────────────
interface BlockPostProcessorCtx {
  originalBlock: any;
  videoMeta: any;
  index: number;
}
type BlockPostProcessor = (block: any, ctx: BlockPostProcessorCtx) => any | Promise<any>;

function postProcessParallaxLayers(block: any, { originalBlock }: BlockPostProcessorCtx): any {
  return mergeParallaxLayers(block, originalBlock);
}

async function postProcessAudioDuration(block: any, _ctx: BlockPostProcessorCtx): Promise<any> {
  const audioFields = extractAudioFields(block);
  if (audioFields.length === 0) return block;

  let maxSecs = 0;
  for (const { path, text } of audioFields) {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let val: any = block;
    for (const p of parts) val = val?.[p];

    let secs = 0;
    if (typeof val === 'string' && (val.startsWith('data:audio') || val.startsWith('http'))) {
      secs = await getAudioDurationSeconds(val);
    }
    if (secs === 0 && text && !text.startsWith('data:') && !text.startsWith('http')) {
      secs = text.trim().split(/\s+/).length / WORDS_PER_SECOND;
    }

    const secsWithTail = secs + AUDIO_TAIL_SECS;
    if (secsWithTail > maxSecs) maxSecs = secsWithTail;
  }

  const rounded = Math.ceil(maxSecs * 10) / 10;
  const blockDur  = block.duration ?? 0;
  const finalSecs = rounded > AUDIO_TAIL_SECS ? rounded : blockDur;

  const hasTtsAudio = audioFields.some(({ path }) => {
    const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    let val: any = block;
    for (const p of parts) val = val?.[p];
    return typeof val === 'string' && (val.startsWith('data:audio') || val.startsWith('http'));
  });

  const updates: Record<string, any> = {};
  if (finalSecs > 0 && finalSecs !== block.duration) {
    console.log(`[postProcessAudioDuration] ${block.type} duration ${block.duration}s → ${finalSecs}s`);
    updates.duration = finalSecs;
  }
  if (hasTtsAudio && block.audioLoop !== false) {
    updates.audioLoop = false;
  }

  return Object.keys(updates).length > 0 ? { ...block, ...updates } : block;
}

const BLOCK_POST_PROCESSORS: BlockPostProcessor[] = [
  postProcessParallaxLayers,
  postProcessAudioDuration,
];

export async function applyBlockPostProcessors(blocks: any[], templateBlocks: any[], videoMeta: any): Promise<any[]> {
  return Promise.all(blocks.map(async (block, i) => {
    const ctx: BlockPostProcessorCtx = { originalBlock: templateBlocks[i] ?? {}, videoMeta, index: i };
    let b = block;
    for (const fn of BLOCK_POST_PROCESSORS) b = await fn(b, ctx);
    return b;
  }));
}

// ── Constants ────────────────────────────────────────────────────────────────
export const ENGAGEMENT_THRESHOLD = 7.0;
export const MAX_DIRECTOR_LOOPS   = 3;
