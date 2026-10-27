import { callAIWithTracking, parseJSON } from '../shared/utils';
import { searchWeb, searchNews } from '../../media-service';
import type { ArcPattern, MediaStrategy } from '../shared/types';

/**
 * Plan media strategy (web research vs AI generation for each block).
 * Owns its logic — no graph.ts dependency.
 */
export async function planMediaStrategy(params: {
  userStory: string;
  selectedArc: ArcPattern | null;
  preferredArc: string | null;
  templateBlocks: Array<{ type: string; [key: string]: any }>;
  apiKey: string;
  model: string;
}): Promise<{ mediaStrategy: MediaStrategy; researchContext: string }> {
  const arcName = params.selectedArc?.name ?? params.preferredArc ?? '';
  const blockSummary = params.templateBlocks
    .map((b, i) => `[${i}] ${b.type}`)
    .join(', ');

  console.log(`[planner] ▶ planning media strategy for arc="${arcName}", blocks: ${blockSummary}`);

  let strategy: MediaStrategy;
  try {
    const strategyRaw = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a video production planner. Given a topic, arc, and block layout, output a JSON media strategy.

Decide:
1. Whether the topic needs web research (current facts, real people, real products, how-to steps) or is purely creative/fictional
2. Whether news search is relevant (only for current events, recent happenings)
3. For EACH block, whether images should come from web search, AI generation, or auto (try web first, fall back to AI)
4. For web search blocks, what style of search queries work best (screenshot, photo, diagram)
5. Whether autoScreenshot should be enabled (only for software tutorials showing UI)

Output ONLY valid JSON matching this schema:
{
  "needsResearch": boolean,
  "needsNewsSearch": boolean,
  "researchQueries": ["specific search query 1", ...max 3],
  "topicType": "factual" | "creative" | "mixed",
  "blockStrategies": [
    {
      "blockIndex": 0,
      "blockType": "the block type",
      "imageSource": "web_search" | "ai_generation" | "auto",
      "searchQueryStyle": "screenshot" | "photo" | "diagram" | null,
      "autoScreenshot": false,
      "minWidth": 800,
      "reasoning": "one line why"
    }
  ]
}

Guidelines (WEB-FIRST POLICY):
- DEFAULT: imageSource = "auto" for every image block — try web search first, fall back to AI generation only on miss. Real photos almost always look better than AI-generated ones for any subject that exists in the real world.
- Use imageSource = "ai_generation" ONLY for: surreal/dreamlike visuals that explicitly cannot exist as a real photo, abstract data viz, fictional characters, or stylized mood backgrounds where photorealism would hurt. These are rare — when in doubt, pick "auto".
- searchQueryStyle (only affects search query phrasing, not whether to search):
  * "screenshot" → software tutorials, UI walkthroughs (also set autoScreenshot: true)
  * "diagram" → technical concepts, architecture visuals
  * "photo" → everything else (default)
- News/event_recap → needsNewsSearch: true
- Set needsResearch: true when the topic involves real facts, people, products, places, or events (which is most topics — be liberal here)
- "video" block type → ALWAYS use ai_generation (videos are generated, not searched)

Return valid JSON only, no markdown wrapping.`,
        },
        {
          role: 'user',
          content: `Topic: "${params.userStory}"
Arc: ${arcName || 'not yet selected'}
Blocks: ${blockSummary}

Produce the media strategy JSON.`,
        },
      ],
      apiKey: params.apiKey,
      maxTokens: 800,
      model: params.model,
    });

    strategy = parseJSON(strategyRaw) as MediaStrategy;
    console.log(`[planner] ✅ strategy: topicType=${strategy.topicType}, needsResearch=${strategy.needsResearch}, needsNews=${strategy.needsNewsSearch}`);
  } catch (e: any) {
    console.error(`[planner] ❌ strategy LLM failed: ${e.message}, using fallback`);
    strategy = {
      needsResearch: false,
      needsNewsSearch: false,
      researchQueries: [],
      topicType: 'creative',
      blockStrategies: params.templateBlocks.map((b, i) => ({
        blockIndex: i,
        blockType: b.type,
        // Web-first fallback: try search before AI generation. resolve-media
        // automatically falls back to AI if search returns nothing.
        imageSource: 'auto' as const,
        searchQueryStyle: 'photo' as const,
        autoScreenshot: false,
        minWidth: 800,
        reasoning: 'fallback — planner failed, defaulting to web-first',
      })),
    };
  }

  let researchContext = '';
  if (strategy.needsResearch) {
    try {
      const parts: string[] = [];

      if (strategy.needsNewsSearch) {
        const news = await searchNews(params.userStory);
        if (news.length > 0) {
          parts.push('RECENT NEWS:\n' + news.map(n => `- ${n.title}: ${n.snippet} (${n.date})`).join('\n'));
        }
      }

      const queries = strategy.researchQueries.length > 0
        ? strategy.researchQueries
        : [params.userStory];
      const results = await Promise.all(queries.map(q => searchWeb(q)));

      for (const research of results) {
        if (research.answerBox) parts.push(`ANSWER: ${research.answerBox}`);
        if (research.knowledgeGraph) parts.push(`OVERVIEW: ${research.knowledgeGraph}`);
        if (research.snippets.length > 0)
          parts.push('KEY FACTS:\n' + research.snippets.map(s => `- ${s}`).join('\n'));
      }

      researchContext = parts.join('\n\n');
      if (researchContext.length > 1500) researchContext = researchContext.slice(0, 1500) + '...';
      console.log(`[planner] ✅ ${researchContext.length} chars of research context`);
    } catch (e: any) {
      console.error(`[planner] ❌ research failed: ${e.message}`);
    }
  } else {
    console.log('[planner] ⏭ skipping research (creative/fictional topic)');
  }

  return { mediaStrategy: strategy, researchContext };
}

/**
 * Agent-backed planner. Runs the Mastra `plannerAgent`, which actively probes
 * the web (searchWeb / searchWebImage / searchNews) per block before deciding
 * imageSource. Falls back silently to `planMediaStrategy` (pure LLM) if the
 * agent errors out or returns unparseable output.
 *
 * Same input/output as planMediaStrategy so call sites can swap in place.
 */
export async function planMediaStrategyViaAgent(params: {
  userStory: string;
  selectedArc: ArcPattern | null;
  preferredArc: string | null;
  templateBlocks: Array<{ type: string; [key: string]: any }>;
  apiKey: string;
  model: string;
}): Promise<{ mediaStrategy: MediaStrategy; researchContext: string }> {
  const arcName = params.selectedArc?.name ?? params.preferredArc ?? '';
  const blockSummary = params.templateBlocks
    .map((b, i) => `[${i}] ${b.type}`)
    .join(', ');

  console.log(`[planner-agent] ▶ running agent for arc="${arcName}", blocks: ${blockSummary}`);

  try {
    const { plannerAgent } = await import('../agents/planner.agent');
    const result = await plannerAgent.generate(
      [{
        role: 'user',
        content: JSON.stringify({
          userStory: params.userStory,
          arc: arcName,
          blocks: params.templateBlocks.map((b, i) => ({ index: i, type: b.type })),
        }),
      }],
      { maxSteps: 10 },
    );

    const text = result.text?.trim();
    if (!text) throw new Error('planner agent emitted no text');

    const strategy = parseJSON(text) as MediaStrategy;
    if (!strategy || !Array.isArray(strategy.blockStrategies)) {
      throw new Error('planner agent output missing blockStrategies');
    }
    if (strategy.blockStrategies.length !== params.templateBlocks.length) {
      throw new Error(
        `planner agent returned ${strategy.blockStrategies.length} block strategies, expected ${params.templateBlocks.length}`,
      );
    }

    console.log(`[planner-agent] ✅ topicType=${strategy.topicType}, needsResearch=${strategy.needsResearch}, needsNews=${strategy.needsNewsSearch}`);

    // Research context: same post-processing as planMediaStrategy — fetch snippets
    // and news if the agent says we need them. The agent already probed the web
    // for its DECISION; this second pass gathers the full text for the story agent.
    let researchContext = '';
    if (strategy.needsResearch) {
      try {
        const parts: string[] = [];
        if (strategy.needsNewsSearch) {
          const news = await searchNews(params.userStory);
          if (news.length > 0) {
            parts.push('RECENT NEWS:\n' + news.map(n => `- ${n.title}: ${n.snippet} (${n.date})`).join('\n'));
          }
        }
        const queries = strategy.researchQueries.length > 0
          ? strategy.researchQueries
          : [params.userStory];
        const results = await Promise.all(queries.map(q => searchWeb(q)));
        for (const research of results) {
          if (research.answerBox) parts.push(`ANSWER: ${research.answerBox}`);
          if (research.knowledgeGraph) parts.push(`OVERVIEW: ${research.knowledgeGraph}`);
          if (research.snippets.length > 0)
            parts.push('KEY FACTS:\n' + research.snippets.map(s => `- ${s}`).join('\n'));
        }
        researchContext = parts.join('\n\n');
        if (researchContext.length > 1500) researchContext = researchContext.slice(0, 1500) + '...';
        console.log(`[planner-agent] ✅ ${researchContext.length} chars of research context`);
      } catch (e: any) {
        console.error(`[planner-agent] ❌ research gather failed: ${e.message}`);
      }
    }

    return { mediaStrategy: strategy, researchContext };
  } catch (e: any) {
    console.error(`[planner-agent] ❌ agent failed (${e?.message ?? e}) — falling back to LLM-only planner`);
    return planMediaStrategy(params);
  }
}
