const STOP_WORDS = new Set([
  'and',
  'for',
  'from',
  'into',
  'the',
  'this',
  'that',
  'with',
  'your',
  'block',
  'plugin',
  'video',
  'slide',
  'scene',
  'animation',
  'animated',
]);

const SYNONYM_TAGS: Record<string, string[]> = {
  graph: ['chart', 'data'],
  graphs: ['chart', 'data'],
  leaderboard: ['ranking', 'competition'],
  leaders: ['ranking'],
  player: ['sports', 'person'],
  players: ['sports', 'people'],
  athlete: ['sports', 'person'],
  athletes: ['sports', 'people'],
  versus: ['comparison', 'competition'],
  vs: ['comparison', 'competition'],
  battle: ['comparison', 'competition'],
  brand: ['business'],
  brands: ['business'],
  product: ['business'],
  products: ['business'],
  code: ['developer', 'technical'],
  tutorial: ['education', 'how-to'],
  explainer: ['education'],
  timeline: ['sequence', 'history'],
};

export function normalizeTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function normalizeTags(values: Array<string | null | undefined>): string[] {
  const tags = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    const normalized = normalizeTag(value);
    if (!normalized || normalized.length < 2 || STOP_WORDS.has(normalized)) continue;
    tags.add(normalized);
    for (const synonym of SYNONYM_TAGS[normalized] ?? []) {
      tags.add(synonym);
    }
  }
  return [...tags].slice(0, 16);
}

function wordsFromText(value: string): string[] {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .map(normalizeTag)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

export function derivePluginTags(input: {
  id?: string | null;
  name?: string | null;
  description?: string | null;
  category?: string | null;
  schemaJson?: string | Record<string, unknown> | null;
}): string[] {
  const words = [
    ...(input.category ? [input.category] : []),
    ...wordsFromText(input.id ?? ''),
    ...wordsFromText(input.name ?? ''),
    ...wordsFromText(input.description ?? ''),
  ];

  let schemaObj: any = input.schemaJson;
  if (typeof schemaObj === 'string') {
    try {
      schemaObj = JSON.parse(schemaObj);
    } catch {
      schemaObj = null;
    }
  }

  if (schemaObj?.properties && typeof schemaObj.properties === 'object') {
    for (const [key, property] of Object.entries<any>(schemaObj.properties)) {
      words.push(...wordsFromText(key));
      words.push(...wordsFromText(property?.title ?? ''));
      words.push(...wordsFromText(property?.editor ?? ''));
    }
  }

  return normalizeTags(words);
}

export function parseTags(value: unknown): string[] {
  if (Array.isArray(value)) return normalizeTags(value.map((item) => String(item)));
  if (typeof value === 'string') {
    if (!value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return normalizeTags(parsed.map((item) => String(item)));
    } catch {
      return normalizeTags(value.split(','));
    }
  }
  return [];
}

