import { callAIWithTracking } from '../shared/utils';
import { parseJSON } from '../shared/utils';
import { ARC_PATTERNS } from '../shared/arc-patterns';
import type { ArcPattern } from '../shared/types';

/**
 * Select the best narrative arc for the given story.
 * Owns its logic — no graph.ts dependency.
 */
export async function selectArc(params: {
  userStory: string;
  templateBlocks: Array<{ type: string; [key: string]: any }>;
  preferredArc: string | null;
  arcPatternCatalog: Record<string, ArcPattern>;
  apiKey: string;
  model: string;
}): Promise<ArcPattern> {
  console.log('[select_arc] ▶ choosing narrative arc');

  const catalog: Record<string, ArcPattern> = { ...ARC_PATTERNS, ...params.arcPatternCatalog };

  if (params.preferredArc) {
    const forced = catalog[params.preferredArc];
    if (forced) {
      console.log(`[select_arc] ✅ using caller-forced arc: "${forced.name}"`);
      return forced;
    }
    console.warn(`[select_arc] ⚠️ preferredArc "${params.preferredArc}" not found in catalog — falling back to AI selection`);
  }

  const blockTypes = params.templateBlocks.map(b => b.type).join(', ');
  const arcList    = Object.values(catalog)
    .map(a => `- "${a.name}": ${a.description}`)
    .join('\n');

  try {
    const response = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a video narrative strategist.
Pick the best narrative arc for the given story and block types.

Available arcs:
${arcList}

Return ONLY this JSON, no markdown:
{
  "arc": "<arc_name>",
  "reason": "<one sentence why this arc fits best>"
}`,
        },
        {
          role: 'user',
          content: `Story: "${params.userStory}"
Block types in this video (${params.templateBlocks.length} blocks): ${blockTypes}

Which arc fits best?`,
        },
      ],
      apiKey: params.apiKey,
      maxTokens: 200,
      model: params.model,
    });

    const parsed   = parseJSON(response);
    const arcName  = parsed.arc as string;
    const selected = catalog[arcName] ?? catalog['documentary'] ?? ARC_PATTERNS['documentary'];

    console.log(`[select_arc] ✅ selected: "${arcName}" — ${parsed.reason}`);
    return selected;

  } catch (e: any) {
    console.warn('[select_arc] ⚠️ failed, defaulting to documentary:', e.message);
    return catalog['documentary'] ?? ARC_PATTERNS['documentary'];
  }
}
