import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { searchWeb, searchNews, searchWebImage } from '../../media-service';

// ============================================================================
// PLANNER AGENT TOOLS
//
// Small probes the planner agent uses to *verify feasibility* before deciding
// imageSource per block. This is how we stop guessing: instead of hardcoded
// rules ("bios use web_search"), the agent actually checks whether the web has
// usable material for this specific topic.
// ============================================================================

export const probeWebSearchTool = createTool({
  id: 'probe-web-search',
  description: 'Run a Google search for a query and return up to 5 result snippets plus an answer box / knowledge graph summary. Use this to check whether a topic has real-world coverage (news, products, people, places) before deciding imageSource. Empty snippets = purely creative/fictional topic.',
  inputSchema: z.object({
    query: z.string().describe('A focused search query — the actual topic or a disambiguating term.'),
  }),
  outputSchema: z.object({
    snippets: z.array(z.string()),
    answerBox: z.string().optional(),
    knowledgeGraph: z.string().optional(),
    hitCount: z.number(),
  }),
  execute: async (rawInput: any) => {
    const context = (rawInput?.context ?? rawInput) as { query: string };
    const { query } = context;
    const r = await searchWeb(query);
    return {
      snippets: r.snippets,
      answerBox: r.answerBox,
      knowledgeGraph: r.knowledgeGraph,
      hitCount: r.snippets.length + (r.answerBox ? 1 : 0) + (r.knowledgeGraph ? 1 : 0),
    };
  },
});

export const probeImageSearchTool = createTool({
  id: 'probe-image-search',
  description: 'Check whether a Google Images search returns a usable real image for a query (meeting minWidth). Use this per-block to verify web_search is actually viable — if probeImageSearch returns none, that block should be ai_generation or auto instead of web_search.',
  inputSchema: z.object({
    query: z.string().describe('A specific image-search query — include proper names, years, product names.'),
    minWidth: z.number().default(800).describe('Minimum acceptable image width in pixels.'),
  }),
  outputSchema: z.object({
    found: z.boolean(),
    url: z.string().nullable(),
  }),
  execute: async (rawInput: any) => {
    const context = (rawInput?.context ?? rawInput) as { query: string; minWidth: number };
    const { query, minWidth } = context;
    const url = await searchWebImage(query, { minWidth });
    return { found: !!url, url: url ?? null };
  },
});

export const probeNewsSearchTool = createTool({
  id: 'probe-news-search',
  description: 'Check for recent news coverage of a topic via Google News. Use this to decide needsNewsSearch — if the user story is about a recent happening or current event.',
  inputSchema: z.object({
    query: z.string(),
  }),
  outputSchema: z.object({
    items: z.array(z.object({ title: z.string(), snippet: z.string(), date: z.string() })),
    hitCount: z.number(),
  }),
  execute: async (rawInput: any) => {
    const context = (rawInput?.context ?? rawInput) as { query: string };
    const { query } = context;
    const items = await searchNews(query);
    return { items, hitCount: items.length };
  },
});

export const plannerAgentTools = {
  probeWebSearch: probeWebSearchTool,
  probeImageSearch: probeImageSearchTool,
  probeNewsSearch: probeNewsSearchTool,
};
