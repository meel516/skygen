import { AsyncLocalStorage } from 'async_hooks';
import { StateGraph, Annotation, interrupt, Command } from '@langchain/langgraph';
import { db } from '@/lib/db';
import { generateImage, generateBgRemovedImage, generateAudio, generateVideo, searchWebImage, searchWeb, searchNews, proxyImageToS3, removeBackgroundFromUrl } from './media-service';
export { regenerateSingleImage, regenerateSingleVideo } from './media-service';
import { parseBuffer } from 'music-metadata';
import { TowerChart3DBlockSchema } from '../schemas';
import { getAspectRatioDimensions } from '../utils/theme';
import { generateText } from './providers';
import { fillCustomPluginBlock } from './fill-custom-plugin';
import { generateContent as generateContentTool } from './mastra/tools/generate-content.tool';
import { classifyMediaFields as classifyMediaFieldsTool } from './mastra/tools/classify-media-fields.tool';
import { resolveAudio as resolveAudioTool, resolveImages as resolveImagesTool, resolveVideo as resolveVideoTool } from './mastra/tools/resolve-media.tool';
import { mergeBlock as mergeBlockTool } from './mastra/tools/merge-block.tool';

// Per-request token accumulator — server-side only, never exposed to client
const tokenStore = new AsyncLocalStorage<{ total: number }>();

// ============================================================================
// CONFIG & HELPERS
// ============================================================================

const DEFAULT_AI_MODEL = process.env.DEFAULT_AI_MODEL || process.env.DEEPSEEK_MODEL || process.env.GEMINI_MODEL || process.env.XAI_MODEL || 'deepseek-chat';

// ── Language helper ──────────────────────────────────────────────────────────
const LANG_NAMES: Record<string, string> = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', pt: 'Portuguese',
  ar: 'Arabic', hi: 'Hindi', ja: 'Japanese', ko: 'Korean', zh: 'Chinese',
  it: 'Italian', nl: 'Dutch', tr: 'Turkish', ru: 'Russian', pl: 'Polish',
  sv: 'Swedish', no: 'Norwegian', da: 'Danish', fi: 'Finnish', cs: 'Czech',
  ro: 'Romanian', el: 'Greek', hu: 'Hungarian', th: 'Thai', vi: 'Vietnamese',
  id: 'Indonesian', ms: 'Malay', uk: 'Ukrainian',
};
function languageName(code: string): string {
  return LANG_NAMES[code] || code;
}

async function callAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  maxTokens = 1000,
  model: string = DEFAULT_AI_MODEL
): Promise<string> {
  console.log('[callAI] called', {
    model,
    maxTokens,
    apiKeyPresent:       !!apiKey,
    messageCount:        messages.length,
    firstMessageRole:    messages[0]?.role,
    firstMessagePreview: messages[0]?.content?.slice(0, 80),
  });

  const result = await generateText({
    messages,
    apiKey,
    maxTokens,
    model,
  });

  const content = result.text;
  const tokensUsed = result.usage.totalTokens ?? 0;
  const store = tokenStore.getStore();
  if (store) store.total += tokensUsed;
  console.log('[callAI] success provider:', result.provider, 'model:', result.model, 'length:', content.length, `tokens: ${tokensUsed}`, 'preview:', content.slice(0, 100));
  return content;
}

function parseJSON(raw: string): Record<string, any> {
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

function setNestedValue(obj: any, dotPath: string, value: any): any {
  const parts = dotPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  const result = JSON.parse(JSON.stringify(obj));
  let cursor = result;
  for (let i = 0; i < parts.length - 1; i++) cursor = cursor[parts[i]];
  cursor[parts[parts.length - 1]] = value;
  return result;
}

// ============================================================================
// NARRATIVE ARC PATTERNS
// ============================================================================

export interface ArcPattern {
  name:        string;
  description: string;
  roles:       string[];
  defaultTone: string;
}

export const ARC_PATTERNS: Record<string, ArcPattern> = {
  documentary: {
    name:        'documentary',
    description: 'Biographical, sports, or historical stories about a person, team, or event',
    roles:       ['hook', 'context', 'build-up', 'climax', 'proof', 'resolution'],
    defaultTone: 'cinematic, inspiring, emotionally building toward a peak moment',
  },
  listicle: {
    name:        'listicle',
    description: 'Rankings, top-N lists, countdowns, comparisons between multiple entities',
    roles:       ['intro', 'item', 'item', 'item', 'item', 'summary'],
    defaultTone: 'energetic, punchy, fast-paced — each item lands like a reveal',
  },
  tutorial: {
    name:        'tutorial',
    description: 'How-to guides, step-by-step instructions, educational or explainer content',
    roles:       ['intro', 'step', 'step', 'step', 'step', 'recap'],
    defaultTone: 'clear, instructional, reassuring — builds confidence step by step',
  },
  product_pitch: {
    name:        'product_pitch',
    description: 'Product launches, feature showcases, app demos, sales or marketing content',
    roles:       ['problem', 'solution', 'feature', 'feature', 'social_proof', 'cta'],
    defaultTone: 'confident, persuasive, building excitement toward a strong CTA',
  },
  biography: {
    name:        'biography',
    description: 'Individual life stories, career journeys, founder stories, personal narratives',
    roles:       ['origin', 'rise', 'challenge', 'triumph', 'legacy', 'inspiration'],
    defaultTone: 'personal, emotional, nostalgic — earns the emotion through specific detail',
  },
  news: {
    name:        'news',
    description: 'Current events, announcements, breaking news, press releases',
    roles:       ['headline', 'context', 'detail', 'detail', 'impact', 'conclusion'],
    defaultTone: 'authoritative, neutral, informative — facts first, then significance',
  },
  motivational: {
    name:        'motivational',
    description: 'Inspirational content, self-improvement, fitness journeys, mindset shifts',
    roles:       ['problem', 'struggle', 'turning_point', 'triumph', 'principle', 'cta'],
    defaultTone: 'intense, uplifting, urgent — creates a desire to act',
  },
  comparison: {
    name:        'comparison',
    description: 'Versus content, head-to-head reviews, side-by-side analysis of two+ things',
    roles:       ['intro', 'contender_a', 'contender_b', 'round', 'round', 'verdict'],
    defaultTone: 'analytical, balanced, building to a decisive verdict',
  },
  mini_doc: {
    name:        'mini_doc',
    description: 'Short-form documentary: single focused topic, tight emotional arc, social media format',
    roles:       ['hook', 'context', 'tension', 'resolution', 'cta'],
    defaultTone: 'cinematic, tight, every second earns its place',
  },
  explainer: {
    name:        'explainer',
    description: 'Concept explainers, "what is X", science or finance breakdowns, ELI5 content',
    roles:       ['hook_question', 'analogy', 'detail', 'detail', 'summary', 'insight'],
    defaultTone: 'curious, clear, surprising — makes complex things feel simple',
  },
  event_recap: {
    name:        'event_recap',
    description: 'Sports match recaps, event summaries, "what happened" recaps',
    roles:       ['teaser', 'setup', 'key_moment', 'key_moment', 'result', 'reaction'],
    defaultTone: 'exciting, play-by-play energy, relives the moment',
  },
  brand_story: {
    name:        'brand_story',
    description: 'Company or brand origin stories, "why we exist" narratives, mission-driven content',
    roles:       ['problem_in_world', 'founder_moment', 'mission', 'proof', 'values', 'cta'],
    defaultTone: 'purposeful, warm, authentic — values over hype',
  },
  reaction: {
    name:        'reaction',
    description: 'Commentary, reaction content, hot takes, opinion pieces, response videos',
    roles:       ['hook', 'claim', 'evidence', 'counter', 'verdict', 'takeaway'],
    defaultTone: 'bold, opinionated, conversational — like talking to a friend who knows their stuff',
  },
  transformation: {
    name:        'transformation',
    description: 'Before/after, glow-ups, makeover journeys, progress reveals',
    roles:       ['before', 'catalyst', 'process', 'struggle', 'reveal', 'impact'],
    defaultTone: 'dramatic, building anticipation — the reveal is everything',
  },
  mystery: {
    name:        'mystery',
    description: 'True crime, unsolved mysteries, conspiracy deep-dives, "what really happened"',
    roles:       ['hook_question', 'clue', 'clue', 'twist', 'reveal', 'aftermath'],
    defaultTone: 'suspenseful, eerie, slow-burn tension — keeps you guessing',
  },
  storytime: {
    name:        'storytime',
    description: 'Personal anecdotes, "story time" narratives, real experiences, viral moments',
    roles:       ['setup', 'inciting_incident', 'escalation', 'climax', 'fallout', 'lesson'],
    defaultTone: 'casual, gripping, conversational — like the best storyteller at a party',
  },
  review: {
    name:        'review',
    description: 'Product reviews, movie/game reviews, honest opinions, tier lists',
    roles:       ['intro', 'first_impression', 'deep_dive', 'pros', 'cons', 'verdict'],
    defaultTone: 'honest, analytical, entertaining — earns trust through detail',
  },
  day_in_life: {
    name:        'day_in_life',
    description: 'Day-in-the-life, routine breakdowns, behind-the-scenes, "what I do" content',
    roles:       ['morning', 'routine', 'highlight', 'challenge', 'wind_down', 'reflection'],
    defaultTone: 'intimate, relatable, authentic — makes viewers feel like they were there',
  },
  myth_busting: {
    name:        'myth_busting',
    description: 'Debunking myths, fact vs fiction, "things you didn\'t know", misconceptions',
    roles:       ['myth_intro', 'common_belief', 'evidence', 'truth', 'implications', 'takeaway'],
    defaultTone: 'confident, surprising, "actually..." energy — flips assumptions',
  },
  countdown: {
    name:        'countdown',
    description: 'Dramatic countdowns, tension-building reveals, best-of lists with buildup',
    roles:       ['teaser', 'entry', 'entry', 'entry', 'runner_up', 'winner'],
    defaultTone: 'escalating excitement, each entry bigger than the last — saves the best for last',
  },
};

// ============================================================================
// CONSISTENCY LENSES
// ============================================================================

export type ConsistencyLens = 'character' | 'concept' | 'event_history' | 'product' | 'motivational';

export interface ConsistencyLensConfig {
  description: string;
  whenToSelect: string;
  visualStyleDirective: string;
  storyBibleDirective: string;
  contentGeneratorHint: string;
}

export const CONSISTENCY_LENS_CONFIGS: Record<ConsistencyLens, ConsistencyLensConfig> = {
  character: {
    description: 'Ensures named people look consistent across all images — same face, clothing, and emotional arc.',
    whenToSelect: 'The video features one or more named people as recurring subjects (biography, founder story, athlete journey, etc.)',
    visualStyleDirective:
      'Include a CHARACTER SHEET for every named person: full name, age, physical traits (hair color/length, eye color, build), signature clothing that stays locked across ALL blocks, and their emotional baseline expression. Every image must feel like a frame from the same film about the same person.',
    storyBibleDirective:
      'Include: SUBJECT (full name + 1-sentence identity), TIMELINE (key dates/milestones referenced across blocks — keep numbers consistent), CHARACTER STATE PER BLOCK (brief emotional note per narrative stage), RECURRING MOTIFS (visual or verbal callbacks), TONE ANCHOR (the single emotional truth the video must leave viewers with).',
    contentGeneratorHint:
      `CHARACTER LENS — CRITICAL:
- IMAGE FIELDS: Always show the named subject using the character sheet from visualStyleGuide — same clothing, same build, same face. Depict their emotional state for this block's role (body language, posture, expression, environment lighting).
- For "origin/childhood" moments: use era-appropriate props but keep facial features consistent.
- NEVER show an anonymous silhouette or generic crowd when the subject should be present.
- TEXT FIELDS: Use the subject's actual name — no pronouns without clear antecedents.`,
  },

  concept: {
    description: 'Ensures diagrams, artifacts, and notation stay visually consistent — same colors, same style, same terminology.',
    whenToSelect: 'The video explains an idea, mechanism, process, or abstract concept (science, finance, engineering, how-things-work, etc.)',
    visualStyleDirective:
      'Include an ARTIFACT/DIAGRAM PALETTE: the core visual representation of the concept (diagram type, color coding for elements, annotation style — handwritten vs clean sans-serif vs code-comment). Specify whether visuals are diagrams/illustrations vs real-world photography — pick ONE and stay consistent. Define colors for recurring diagram elements (e.g. inputs = green, outputs = red).',
    storyBibleDirective:
      'Include: CORE CONCEPT (the idea in one plain-English sentence), KEY TERMS (3-5 domain terms used consistently — no synonyms mid-video), CONCEPT STEPS (ordered list with 2-word labels if tutorial/explainer), COMPLEXITY FLOOR (minimum assumed viewer knowledge — all content stays above this level).',
    contentGeneratorHint:
      `CONCEPT LENS — CRITICAL:
- IMAGE FIELDS: Show the ARTIFACT — diagram, equation, physical equipment, interface screenshot, or annotated illustration. If a diagram color palette was defined in visualStyleGuide, reference those exact colors in your description.
- For step-by-step blocks: show the specific sub-diagram or tool for THAT step — not the full concept re-drawn.
- Prefer diagrams and labeled illustrations over stock photos of people for abstract concepts.
- TEXT FIELDS: Use the exact key terms from the storyBible — no improvised synonyms.`,
  },

  event_history: {
    description: 'Anchors images in specific geography, era, and faction colors — maps, locations, and chronological flow.',
    whenToSelect: 'The video covers a historical event, geographic story, political/military situation, sports match, or any content where WHERE and WHEN are central.',
    visualStyleDirective:
      'Include an EVENT GEOGRAPHY PALETTE: primary location(s) with visual description (architecture, landscape, era), faction/side color assignments if multiple factions exist (e.g. "Team A = red and gold, Team B = navy and white"), map/geography visual style (satellite vs illustrated vs infographic — pick one), era/period visual cues (year or decade, confirming details like clothing/vehicles/technology).',
    storyBibleDirective:
      'Include: EVENT TIMELINE (key dates or sequence markers in order), FACTIONS/ACTORS (named entities with their one-sentence role), GEOGRAPHIC ANCHOR (primary and secondary locations referenced), CONFIRMED OUTCOME (the result — content must never contradict this), STAKES (what was at risk and for whom — used as the emotional through-line).',
    contentGeneratorHint:
      `EVENT/HISTORY LENS — CRITICAL:
- IMAGE FIELDS: Establish LOCATION first (recognizable geographic or architectural context). Apply faction color coding from visualStyleGuide to any uniforms, flags, banners, or team equipment. Make the era/date visually obvious (aged film grain for historical, breaking-news style for modern events).
- For key-moment blocks: depict the EXACT moment — not a generic crowd shot.
- TEXT FIELDS: Use exact faction names, dates, and location names from the storyBible.`,
  },

  product: {
    description: 'Locks product appearance, brand colors, and specs so they never drift across blocks.',
    whenToSelect: 'The video is about a product, service, app, or brand — features, launches, comparisons, reviews, or origin stories.',
    visualStyleDirective:
      'Include a PRODUCT VISUAL IDENTITY: product name and exact appearance (color, shape, material, key visual features), brand color palette (primary + accent), product photography style (clean studio background vs lifestyle vs UI screenshot — pick ONE), and for comparison arcs: the exact comparison axis and how it will be visualized (side-by-side, chart, table).',
    storyBibleDirective:
      'Include: PRODUCT NAME (exact spelling and capitalization), KEY SPECS (3-5 critical features/numbers that must stay consistent), PRICE/OFFER (exact terms if relevant), TARGET CUSTOMER (one sentence), UNIQUE SELLING POINT (the single differentiator), CALL TO ACTION (exact wording of the desired action).',
    contentGeneratorHint:
      `PRODUCT LENS — CRITICAL:
- IMAGE FIELDS: Show the PRODUCT using the exact description from visualStyleGuide — same color, same form factor, every time. Feature blocks: show the specific feature being described (not the whole product). Social proof blocks: product IN USE. CTA block: clean studio shot, logo visible.
- VIDEO FIELDS: NEVER write character-driven or emotional scenes (no "person looking stressed", no "man at desk reacting", no story expressions). ALWAYS describe what the PRODUCT or INTERFACE looks like in action — UI screens, dashboards, data visualizations, architecture flows, feature demos. Example: "Screen recording of the ${'{productName}'} dashboard displaying live metrics, smooth interface interactions, dark UI with accent highlights." The narrative role defines the MOOD of the product shot, not a human character's emotion.
- For comparison arcs: show both products at the same scale, same camera angle.
- TEXT FIELDS: Product name spelled exactly as in storyBible. All specs must match exactly — never approximate.`,
  },

  motivational: {
    description: 'Defines a visual intensity escalation map — energy, color temperature, and camera feeling must build block by block.',
    whenToSelect: 'The video is designed to inspire action, build energy, or drive emotional transformation (motivational speech, fitness journey, transformation story, countdown, etc.)',
    visualStyleDirective:
      'Include a VISUAL INTENSITY SCALE: opening block visual energy (dark, low-light, muted colors, tight composition), ending block visual energy (explosive brightness, wide open frame, golden light, triumph), color temperature arc (cold/blue-grey early → warming to gold/orange at climax), and camera energy progression (close/claustrophobic early → wide/epic at peak).',
    storyBibleDirective:
      'Include: CENTRAL STRUGGLE (the universal human challenge this video addresses), TRANSFORMATION MILESTONE (the exact turning point — every block leads toward or radiates from it), UNIVERSAL PRINCIPLE (the 1-sentence truth this video communicates), CALL TO ACTION (specific, actionable), ESCALATION MAP (block-by-block intensity labels: struggle → rock bottom → spark → rise → triumph → call).',
    contentGeneratorHint:
      `MOTIVATIONAL LENS — CRITICAL:
- IMAGE FIELDS: Visual intensity MUST match this block's escalation map position from storyBible. Early blocks: dark, tight, constraining compositions — shadows, small figure in large negative space. Mid blocks: dynamic, liminal — figure at threshold, motion blur, breaking through. Late blocks: wide, bright, open — expansive sky, peak/summit, explosive movement, golden light. CTA block: direct eye contact, bright, action-forward.
- NEVER use bland stock-looking images — every image should have emotional charge matching the escalation stage.
- spokenScript rhythm: early blocks use longer sentences; late blocks use 3-5 word punches.`,
  },
};

// ============================================================================
// VISUAL STYLE PRESETS
// ============================================================================

const VISUAL_STYLE_PRESETS: Record<string, { name: string; description: string; promptPrefix: string }> = {
  'photorealistic':  { name: 'Photorealistic',  description: 'Cinematic photography',       promptPrefix: 'Hyperrealistic cinematic photography, shallow depth of field, dramatic lighting, film grain, 8K detail' },
  'anime':           { name: 'Anime',           description: 'Japanese anime style',        promptPrefix: 'Anime art style, cel-shaded, vibrant saturated colors, dynamic composition, soft ambient lighting, Studio Ghibli meets modern anime' },
  '3d-cinematic':    { name: '3D Cinematic',    description: '3D rendered movie quality',    promptPrefix: '3D cinematic render, Pixar-quality, volumetric lighting, dramatic shadows, rich textures, depth of field' },
  'cartoon':         { name: 'Cartoon',         description: 'Bold cartoon illustration',    promptPrefix: 'Bold cartoon illustration style, thick outlines, flat vibrant colors, exaggerated expressions, clean vector art' },
  'watercolor':      { name: 'Watercolor',      description: 'Soft watercolor painting',     promptPrefix: 'Soft watercolor painting, flowing brushstrokes, muted pastel palette, organic textures, dreamy ethereal mood' },
  'comic-book':      { name: 'Comic Book',      description: 'Marvel/DC comic panels',       promptPrefix: 'Comic book art style, bold ink outlines, halftone dots, dramatic shading, dynamic action poses, vivid saturated colors' },
  'pixel-art':       { name: 'Pixel Art',       description: 'Retro pixel art',              promptPrefix: 'Retro pixel art, 16-bit style, limited color palette, crisp pixels, nostalgic game aesthetic' },
  'oil-painting':    { name: 'Oil Painting',    description: 'Classical oil painting',        promptPrefix: 'Classical oil painting, rich impasto brushwork, warm chiaroscuro lighting, Renaissance-inspired composition' },
  'neon-cyberpunk':  { name: 'Neon Cyberpunk',  description: 'Futuristic neon aesthetic',     promptPrefix: 'Cyberpunk neon aesthetic, glowing neon lights, dark moody atmosphere, rain-slicked surfaces, holographic accents, purple and cyan palette' },
  'vintage-film':    { name: 'Vintage Film',    description: 'Retro film photography',        promptPrefix: 'Vintage film photography, warm sepia undertones, light leaks, soft vignette, 1970s color grading, analog film grain' },
  'minimalist':      { name: 'Minimalist',      description: 'Clean minimal design',          promptPrefix: 'Minimalist design, clean lines, generous whitespace, limited color palette, geometric shapes, modern typography-driven' },
  'dark-moody':      { name: 'Dark & Moody',    description: 'Dark dramatic atmosphere',      promptPrefix: 'Dark moody atmosphere, deep shadows, rim lighting, desaturated tones with selective color, cinematic noir feeling' },
};

export const VISUAL_STYLES = Object.entries(VISUAL_STYLE_PRESETS).map(([id, v]) => ({ id, ...v }));

// ============================================================================
// RESPONSE FORMAT TEMPLATES
// ============================================================================

const RESPONSE_FORMAT_TEMPLATES: Record<string, string> = {
  'tower-chart-3d': `{
  "title": "string",
  "subtitle": "string | null",
  "items": [
    {
      "rank": 1,
      "name": "string",
      "value": 0,
      "valueFormatted": "string | null",
      "subtitle": "string | null",
      "image": "string | null"
    }
  ]
}`,
  'stat': `{
  "heading": "string",
  "value": "string",
  "subtext": "string"
}`,
  'text': `{
  "content": "string"
}`,
  'quote': `{
  "text": "string",
  "author": "string"
}`,
  'image': `{
  "src": "string",
  "alt": "string",
  "caption": "string"
}`,
  'motivational-image': `{
  "imageSrc": "string",
  "text": "string",
  "audioSrc": "string"
}`,
  'testimonial': `{
  "quote": "string",
  "author": "string",
  "role": "string",
  "company": "string"
}`,
  'list': `{
  "title": "string",
  "items": ["string"]
}`,
  'timeline': `{
  "title": "string",
  "events": [
    { "year": "string", "title": "string", "description": "string" }
  ]
}`,
  'callout': `{
  "title": "string",
  "content": "string",
  "variant": "info"
}`,
  'parallax-story': `{
  "title": "string",
  "subtitle": "string",
  "text": "string",
  "audioSrc": "string",
  "layers": [
    {
      "name": "background",
      "image": "vivid wide-scene description — the single backdrop layer",
      "depth": 90,
      "parallaxFactor": 0.3,
      "motionDirection": "right",
      "removeBackground": false
    },
    {
      "name": "midground",
      "image": "vivid description of mid-depth element (crowd, environment detail)",
      "depth": 50,
      "parallaxFactor": 0.7,
      "motionDirection": "left",
      "removeBackground": true
    },
    {
      "name": "subject",
      "image": "vivid description of the main foreground subject (person, object)",
      "depth": 15,
      "parallaxFactor": 1.2,
      "motionDirection": "zoom-in",
      "removeBackground": true
    }
  ]
}`,
  'video': `{
  "src": "",
  "caption": "string",
  "text": "string — narration displayed as subtitle overlay",
  "audioSrc": "string — MUST be identical to text"
}`,
  html: `{
  "htmlContent": "string — complete HTML document with inline <style> and <script>",
  "title": "string",
  "audioSrc": "string — REQUIRED narration text to be spoken aloud via TTS"
}`,
  diagram: `{
  "diagramType": "flowchart | hierarchy | sequence | mindmap | network",
  "title": "string",
  "nodes": [
    { "id": "string", "label": "string", "type": "default|decision|start|end|process", "color": "hex" }
  ],
  "edges": [
    { "from": "string", "to": "string", "label": "string", "style": "arrow|solid|dashed" }
  ],
  "layout": "vertical | horizontal | radial",
  "primaryColor": "hex",
  "audioSrc": "string — REQUIRED narration text to be spoken aloud via TTS"
}`,
};

function getResponseFormatTemplate(blockType: string): string {
  return RESPONSE_FORMAT_TEMPLATES[blockType] || '';
}

// ============================================================================
// BLOCK SCHEMAS
// ============================================================================

const BLOCK_SCHEMAS: Record<string, {
  textFields:  string;
  imageFields: string;
  audioFields: string;
  example:     string;
  contentFields: string[];
}> = {
  stat: {
    contentFields: ['heading', 'value', 'subtext', 'audioSrc'],
    textFields:  'heading (string - label), value (string - the metric), subtext (string - context)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the stat aloud)',
    example:     '{"heading":"Test Centuries","value":"27","subtext":"Most by an Indian batter","audioSrc":"Virat Kohli has scored 27 centuries in Test cricket, the most by any Indian batter."}',
  },
  text: {
    contentFields: ['content', 'audioSrc'],
    textFields:  'content (string - full paragraph)',
    imageFields: '',
    audioFields: 'audioSrc (string - content read aloud)',
    example:     '{"content":"Virat Kohli is widely regarded as one of the greatest batsmen of all time.","audioSrc":"Virat Kohli is widely regarded as one of the greatest batsmen of all time."}',
  },
  quote: {
    contentFields: ['text', 'author', 'audioSrc'],
    textFields:  'text (string - the quote), author (string)',
    imageFields: '',
    audioFields: 'audioSrc (string - read quote with attribution aloud)',
    example:     '{"text":"Self-belief and hard work will always earn you success.","author":"Virat Kohli","audioSrc":"Virat Kohli once said: Self-belief and hard work will always earn you success."}',
  },
  image: {
    contentFields: ['src', 'alt', 'caption', 'audioSrc'],
    textFields:  'alt (string), caption (string)',
    imageFields: 'src (string - vivid visual description of the image)',
    audioFields: 'audioSrc (string - narrate what is shown)',
    example:     '{"src":"Virat Kohli raising bat in celebration at packed Wankhede Stadium","alt":"Kohli century celebration","caption":"100th international century","audioSrc":"Virat Kohli celebrates yet another century, raising his bat to the roaring crowd."}',
  },
  'motivational-image': {
    contentFields: ['imageSrc', 'text', 'audioSrc'],
    textFields:  `text: REQUIRED string — the narration script spoken aloud AND displayed as subtitles (2-4 sentences, natural spoken language)
imageSrc: REQUIRED string (vivid visual description of background image)`,
    imageFields: 'imageSrc (string - vivid visual scene description)',
    audioFields: 'audioSrc: REQUIRED string — MUST be identical to the "text" field so subtitles match the audio exactly',
    example:     '{"imageSrc":"Athlete sprinting on track at golden hour, dramatic side lighting","text":"Champions are not born. They are forged in the moments when they want to quit but keep going.","audioSrc":"Champions are not born. They are forged in the moments when they want to quit but keep going."}',
  },
  testimonial: {
    contentFields: ['quote', 'author', 'role', 'company', 'avatar', 'audioSrc'],
    textFields:  `quote: REQUIRED string
author: REQUIRED string
role: optional string
company: optional string`,
    imageFields: 'avatar: optional string — describe person appearance',
    audioFields: 'audioSrc: optional string — read testimonial aloud',
    example:     '{"quote":"Changed the game.","author":"John Smith","role":"Coach","avatar":"Professional in blazer"}',
  },
  list: {
    contentFields: ['title', 'items', 'audioSrc'],
    textFields:  `title: REQUIRED string
items: REQUIRED array of strings (each item is a list bullet point)`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — read list aloud',
    example:     '{"title":"Kohli Records","items":["50+ ODI centuries","Fastest to 10000 ODI runs"],"audioSrc":"Here are some of Virat Kohli\'s greatest records."}',
  },
  timeline: {
    contentFields: ['title', 'events', 'audioSrc'],
    textFields:  `title: REQUIRED string
events: REQUIRED array of objects (chronological order), each with:
  - year: REQUIRED string or number
  - title: REQUIRED string
  - description: optional string`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — narrate timeline',
    example:     '{"title":"Kohli Journey","events":[{"year":"2008","title":"IPL Debut","description":"RCB"},{"year":"2011","title":"World Cup","description":"Winner"}]}',
  },
  callout: {
    contentFields: ['title', 'content', 'variant', 'audioSrc'],
    textFields:  `title: REQUIRED string
content: REQUIRED string
variant: REQUIRED string (one of: info, warning, success, error)`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — read callout aloud',
    example:     '{"title":"Did You Know?","content":"Only player to avg 50+ all formats","variant":"info"}',
  },
  'icon-list': {
    contentFields: ['title', 'items', 'audioSrc'],
    textFields:  'title (string), items (array of {icon, title, description})',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the list)',
    example:     '{"title":"Why Kohli is GOAT","items":[{"icon":"🏏","title":"Run Machine","description":"50+ centuries across formats"},{"icon":"💪","title":"Fitness Icon","description":"Transformed Indian cricket culture"}],"audioSrc":"Here is why Virat Kohli is considered the GOAT."}',
  },
  comparison: {
    contentFields: ['title', 'items', 'audioSrc'],
    textFields:  'title (string), items (array of {label, value, color})',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the comparison)',
    example:     '{"title":"Batting Averages","items":[{"label":"Kohli","value":57},{"label":"Root","value":50},{"label":"Smith","value":61}],"audioSrc":"Comparing batting averages of the top batsmen of this generation."}',
  },
  'line-chart': {
    contentFields: ['title', 'subtitle', 'data', 'labels', 'xAxisLabel', 'yAxisLabel', 'unit', 'showDataLabels', 'audioSrc'],
    textFields:  'title (string), subtitle (string — context for the chart), data (number[] — y-axis values), labels (string[] — x-axis labels, same length as data), xAxisLabel (string — x-axis title), yAxisLabel (string — y-axis title), unit (string — suffix like "$", "%", "K"), showDataLabels (boolean — show value at each point)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the trend)',
    example:     '{"title":"Revenue Growth","subtitle":"Quarterly performance 2024","data":[120,185,210,340],"labels":["Q1","Q2","Q3","Q4"],"xAxisLabel":"Quarter","yAxisLabel":"Revenue","unit":"K","showDataLabels":true,"audioSrc":"Revenue grew from 120K to 340K over four quarters."}',
  },
  'pie-chart': {
    contentFields: ['title', 'subtitle', 'segments', 'showPercentage', 'showLegend', 'audioSrc'],
    textFields:  'title (string), subtitle (string — context), segments (array of {label, value, color}), showPercentage (boolean, default true), showLegend (boolean, default true)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the distribution)',
    example:     '{"title":"Market Share","subtitle":"Global smartphone brands 2024","segments":[{"label":"Apple","value":28},{"label":"Samsung","value":20},{"label":"Xiaomi","value":13},{"label":"Others","value":39}],"audioSrc":"Apple leads with 28% market share."}',
  },
  'whatsapp-chat': {
    contentFields: ['person1', 'person2', 'messages', 'audioSrc'],
    textFields:  'person1 ({name}), person2 ({name}), messages (array of {from: person1|person2, text, time})',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the conversation context aloud)',
    example:     '{"person1":{"name":"Fan"},"person2":{"name":"Kohli Bot"},"messages":[{"from":"person1","text":"Kohli is the best ever!","time":"10:30"},{"from":"person2","text":"Thanks! Hard work always pays off 🏏","time":"10:31"}],"audioSrc":"A fan reaches out to Virat Kohli with a message of admiration."}',
  },
  counter: {
    contentFields: ['label', 'from', 'to', 'prefix', 'suffix', 'audioSrc'],
    textFields:  'label (string), from (number), to (number), prefix (string), suffix (string)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the counter)',
    example:     '{"label":"ODI Centuries","from":0,"to":50,"suffix":"+","audioSrc":"Virat Kohli has scored over fifty centuries in One Day Internationals."}',
  },
  'progress-bar': {
    contentFields: ['label', 'value', 'audioSrc'],
    textFields:  'label (string), value (number 0-100)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the stat)',
    example:     '{"label":"Win Rate as Captain","value":58,"audioSrc":"Virat Kohli won 58 percent of his matches as Indian captain."}',
  },
  'social-stats': {
    contentFields: ['platform', 'username', 'followers', 'posts', 'likes', 'audioSrc'],
    textFields:  'platform (instagram|twitter|youtube|tiktok|linkedin|facebook), username (string), followers (number), posts (number), likes (number)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the social stats aloud)',
    example:     '{"platform":"instagram","username":"virat.kohli","followers":260000000,"posts":1200,"audioSrc":"Virat Kohli has over two hundred and sixty million followers on Instagram, making him one of the most followed athletes in the world."}',
  },
  cta: {
    contentFields: ['text', 'description', 'audioSrc'],
    textFields:  'text (string - button label), description (string - supporting text)',
    imageFields: '',
    audioFields: 'audioSrc (string - read CTA aloud)',
    example:     '{"text":"Follow Kohli","description":"Join 260M fans following the king of cricket","audioSrc":"Follow Virat Kohli and join two hundred and sixty million fans following the king of cricket."}',
  },
  'gradient-text': {
    contentFields: ['text', 'gradient', 'audioSrc'],
    textFields:  'text (string - headline), gradient (array of 2-3 hex colors)',
    imageFields: '',
    audioFields: 'audioSrc (string - read text aloud)',
    example:     '{"text":"King Kohli","gradient":["#FF6B35","#F7C59F"],"audioSrc":"King Kohli."}',
  },
  'avatar-grid': {
    contentFields: ['title', 'subtitle', 'avatars', 'audioSrc'],
    textFields:  'title (string), subtitle (string), avatars (array of {name, role})',
    imageFields: 'avatars[N].image (describe each person visually)',
    audioFields: 'audioSrc (string - introduce the people shown)',
    example:     '{"title":"Kohli\'s Era","avatars":[{"name":"Virat Kohli","role":"Batsman","image":"Virat Kohli in Indian cricket whites smiling"},{"name":"MS Dhoni","role":"Wicketkeeper","image":"MS Dhoni in yellow CSK jersey"}],"audioSrc":"Meet the legends of Indian cricket\'s golden era."}',
  },
  countdown: {
    contentFields: ['title', 'days', 'hours', 'minutes', 'seconds', 'audioSrc'],
    textFields:  'title (string), days (number), hours (number), minutes (number), seconds (number)',
    imageFields: '',
    audioFields: 'audioSrc (string - narrate the countdown context)',
    example:     '{"title":"Next Kohli Test","days":5,"hours":12,"minutes":30,"seconds":0,"audioSrc":"Just five days until Virat Kohli takes the field again."}',
  },
  'animated-bg': {
    contentFields: ['style', 'primaryColor', 'secondaryColor', 'audioSrc'],
    textFields:  'style (particles|waves|gradient|noise|geometric|aurora), primaryColor (hex), secondaryColor (hex)',
    imageFields: '',
    audioFields: 'audioSrc (string - short atmospheric narration to accompany the visual)',
    example:     '{"style":"particles","primaryColor":"#1a73e8","secondaryColor":"#ff4500","audioSrc":"A legendary career, defined by fire and precision."}',
  },
  'parallax-story': {
    contentFields: ['title', 'subtitle', 'text', 'audioSrc', 'layers'],
    textFields:  `title (string), subtitle (string)
text: REQUIRED string — the narration script spoken aloud AND displayed as subtitles (2-4 sentences, natural spoken language). This MUST be identical to audioSrc so subtitles match the audio exactly.`,
    imageFields: `layers[N].image (describe each parallax layer visually).
Each layer MUST have a "removeBackground" boolean. Rules:
  • EXACTLY ONE layer must have "removeBackground": false — the single backdrop layer (wide scene, environment, landscape). This is the only layer that will use the normal image API.
  • ALL other layers must have "removeBackground": true — characters, people, objects, elements floating over the background. These will be generated as transparent cut-outs using the background-removal API.
You decide which layer is the backdrop based on the story context.`,
    audioFields: 'audioSrc: REQUIRED string — MUST be identical to the "text" field so subtitles match the audio exactly',
    example:     '{"title":"The Kohli Era","subtitle":"A legacy like no other","layers":[{"name":"background","image":"Cricket stadium aerial view at golden hour, full wide scene","depth":90,"parallaxFactor":0.3,"motionDirection":"right","removeBackground":false},{"name":"midground","image":"Cheering crowd at cricket stadium","depth":50,"parallaxFactor":0.7,"motionDirection":"left","removeBackground":true},{"name":"subject","image":"Virat Kohli in batting stance dramatic lighting full body","depth":15,"parallaxFactor":1.2,"motionDirection":"zoom-in","removeBackground":true}],"text":"From a Delhi boy to a global icon. Virat Kohli\'s journey is a story of relentless determination.","audioSrc":"From a Delhi boy to a global icon. Virat Kohli\'s journey is a story of relentless determination."}',
  },
  'top-players': {
    contentFields: ['title', 'subtitle', 'backgroundImage', 'players', 'audioSrc'],
    textFields:    `title (string), subtitle (string).
players[]: each MUST have rank (number, 1 = top), name (string), subtitle (string, e.g. "India • 13,000+ runs"), text (string narration script identical to audioSrc)`,
    imageFields:   `backgroundImage: REQUIRED — wide environmental backdrop (stadium/ground/arena), full scene, removeBackground=false.
players[N].image: REQUIRED — each player as a vivid full-body portrait cutout (removeBackground=true).`,
    audioFields:   `audioSrc: block-level narration (optional).
players[N].audioSrc: per-player narration line — MUST match players[N].text exactly.`,
    example:       '{"title":"Top 5 Batsmen","subtitle":"Greatest of All Time","backgroundImage":"Floodlit cricket stadium at night, packed stands, wide aerial view","revealOrder":"top-last","players":[{"rank":5,"name":"AB de Villiers","subtitle":"South Africa","image":"AB de Villiers in batting stance, full body, dynamic pose","text":"At number five, AB de Villiers.","audioSrc":"At number five, AB de Villiers."},{"rank":4,"name":"Kane Williamson","subtitle":"New Zealand","image":"Kane Williamson batting in whites, full body","text":"At number four, Kane Williamson.","audioSrc":"At number four, Kane Williamson."},{"rank":1,"name":"Virat Kohli","subtitle":"India","image":"Virat Kohli celebrating century, arms raised, full body","text":"And at number one, Virat Kohli.","audioSrc":"And at number one, Virat Kohli."}]}',
  },
  'tower-chart-3d': {
    contentFields: ['title', 'subtitle', 'items', 'audioSrc'],
    textFields:  `title: REQUIRED string (max 100 chars)
subtitle: optional string (max 200 chars)
items: REQUIRED array of objects (min 1, max 50), each item MUST have:
  - rank: REQUIRED integer (1 = top rank)
  - name: REQUIRED string (person/entity name)
  - value: REQUIRED number (numeric value, NOT string)
  - valueFormatted: optional string (e.g., "13,000+")
  - subtitle: optional string (e.g., country)
  - image: optional string (visual description)`,
    imageFields: 'items[N].image: optional string — vivid visual description',
    audioFields: 'audioSrc: optional string — narrate rankings',
    example:     '{"title":"Top Run Scorers","items":[{"rank":1,"name":"Virat Kohli","value":13000,"valueFormatted":"13,000+","subtitle":"India","image":"Cricket player holding bat"},{"rank":2,"name":"Rohit Sharma","value":11000,"valueFormatted":"11,000+","subtitle":"India","image":"Cricket player celebrating"}]}',
  },
  code: {
    contentFields: ['code', 'language', 'title', 'audioSrc'],
    textFields:  'code (string), language (string), title (string)',
    imageFields: '',
    audioFields: 'audioSrc (string - briefly explain what the code does aloud)',
    example:     '{"code":"const average = totalRuns / dismissals;","language":"javascript","title":"Batting Average","audioSrc":"This formula calculates the batting average by dividing total runs by the number of dismissals."}',
  },
  'qr-code': {
    contentFields: ['data', 'title', 'subtitle', 'audioSrc'],
    textFields:  'data (URL or text), title (string), subtitle (string)',
    imageFields: '',
    audioFields: 'audioSrc (string - tell viewers to scan the QR code)',
    example:     '{"data":"https://en.wikipedia.org/wiki/Virat_Kohli","title":"Learn More","subtitle":"Scan to read about Kohli","audioSrc":"Scan this QR code to learn more about Virat Kohli\'s incredible career."}',
  },
  video: {
    contentFields: ['src', 'caption', 'text', 'audioSrc'],
    textFields:  `src (string — a detailed cinematic scene description for AI video generation, e.g. "A young woman walks through a rain-soaked city street at night, neon reflections on wet pavement, slow motion, cinematic depth of field". NEVER put a filename or path here — always write a vivid scene description that Veo AI can generate)
caption (string — short description shown as subtitle under the video)
text (string — narration script spoken aloud, also displayed as subtitle overlay on the video)`,
    imageFields: '',
    audioFields: `audioSrc (string - narrate what the video shows)
When using enhanced mode (text is set): audioSrc MUST be identical to "text" so subtitles match the audio exactly`,
    example:     '{"src":"A determined young man studies late at night under a desk lamp, books scattered around him, warm golden light, cinematic close-up, shallow depth of field","caption":"Late night studying","text":"Every great achievement starts with a decision to try.","audioSrc":"Every great achievement starts with a decision to try."}',
  },
  'pricing-table': {
    contentFields: ['title', 'subtitle', 'plans', 'audioSrc'],
    textFields:  `title (string — section heading)
subtitle (string — tagline)
plans: REQUIRED array of objects:
  - name: REQUIRED string (plan tier name)
  - price: REQUIRED string (e.g. "$29", "Free")
  - period: optional string (e.g. "/month", "/year")
  - features: REQUIRED string[] (feature list, max 8)
  - highlighted: optional boolean (emphasize this plan)
  - ctaText: optional string (button text, default "Get Started")`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — narrate pricing overview',
    example:     '{"title":"Choose Your Plan","subtitle":"Start free, scale as you grow","plans":[{"name":"Starter","price":"Free","features":["5 projects","1GB storage"]},{"name":"Pro","price":"$29","period":"/month","features":["Unlimited projects","100GB storage","Priority support"],"highlighted":true,"ctaText":"Start Free Trial"}],"audioSrc":"Choose the plan that fits your needs."}',
  },
  'logo-wall': {
    contentFields: ['title', 'subtitle', 'logos', 'columns', 'audioSrc'],
    textFields:  `title (string — e.g. "Trusted by")
subtitle (string — e.g. "500+ companies worldwide")
logos: REQUIRED array of objects:
  - src: REQUIRED string (logo image description for AI image generation)
  - name: REQUIRED string (company name)
columns: optional number (2-5, default 4)`,
    imageFields: 'logos[].src (string — describe each company logo)',
    audioFields: 'audioSrc: optional string — narrate social proof',
    example:     '{"title":"Trusted by Industry Leaders","logos":[{"src":"Google logo on white background","name":"Google"},{"src":"Microsoft logo","name":"Microsoft"},{"src":"Amazon logo","name":"Amazon"},{"src":"Netflix logo","name":"Netflix"}],"columns":4,"audioSrc":"Trusted by the world\'s leading companies."}',
  },
  'process-steps': {
    contentFields: ['title', 'subtitle', 'steps', 'audioSrc'],
    textFields:  `title (string — e.g. "How It Works")
subtitle (string — context)
steps: REQUIRED array of objects (in order):
  - number: REQUIRED number (step number)
  - title: REQUIRED string
  - description: optional string
  - icon: optional string (single emoji)`,
    imageFields: '',
    audioFields: 'audioSrc: optional string — walk through the process',
    example:     '{"title":"How It Works","steps":[{"number":1,"title":"Sign Up","description":"Create your free account in 30 seconds","icon":"\ud83d\udcdd"},{"number":2,"title":"Configure","description":"Set up your workspace","icon":"\u2699\ufe0f"},{"number":3,"title":"Launch","description":"Go live in minutes","icon":"\ud83d\ude80"}],"audioSrc":"Getting started is easy. Just three simple steps."}',
  },
  html: {
    contentFields: ['htmlContent', 'title', 'audioSrc'],
    textFields:  `htmlContent: REQUIRED string — a complete HTML document string with inline <style> and <script> tags.
  - MUST be a self-contained HTML page (can include <!DOCTYPE html>, <html>, <head>, <body>)
  - Inline CSS for all styling (no external stylesheets)
  - Inline JS for animations — use window.__remotionFrame (current frame number) and window.__remotionTime (seconds) to sync with video timeline
  - Keep it visually striking and animated for video playback
title: optional string (block label)`,
    imageFields: '',
    audioFields: 'audioSrc: REQUIRED string — the narration text to be spoken aloud via TTS (copy from the spokenScript)',
    example:     '{"htmlContent":"<!DOCTYPE html><html><head><style>body{margin:0;padding:0;display:flex;align-items:center;justify-content:center;height:100vh;background:linear-gradient(135deg,#667eea,#764ba2);font-family:sans-serif;color:white;}h1{font-size:3em;margin:0;}p{opacity:0.8;font-size:1.2em;}</style></head><body><div style=\\"text-align:center\\"><h1>Hello World</h1><p>Custom HTML block</p></div></body></html>","title":"Custom HTML","audioSrc":"This is a custom HTML block demonstrating dynamic content."}',
  },
  diagram: {
    contentFields: ['diagramType', 'title', 'nodes', 'edges', 'layout', 'primaryColor', 'audioSrc'],
    textFields:  `diagramType: REQUIRED string (flowchart | hierarchy | sequence | mindmap | network)
title: optional string (diagram title)
nodes: REQUIRED array of objects, each with:
  - id: REQUIRED string (unique identifier, e.g. "n1")
  - label: REQUIRED string (display text)
  - type: optional string (default | decision | start | end | process | data)
  - color: optional string (hex color)
edges: REQUIRED array of objects, each with:
  - from: REQUIRED string (source node id)
  - to: REQUIRED string (target node id)
  - label: optional string (edge label, e.g. "Yes", "No")
  - style: optional string (solid | dashed | arrow)
layout: optional string (vertical | horizontal | radial) — use "radial" for mindmap, "horizontal" for sequence/network, "vertical" for flowchart/hierarchy
primaryColor: optional string (hex color for edges and markers)`,
    imageFields: '',
    audioFields: 'audioSrc: REQUIRED string — the narration text to be spoken aloud via TTS (copy from the spokenScript)',
    example:     '{"diagramType":"flowchart","title":"User Flow","nodes":[{"id":"start","label":"Start","type":"start","color":"#10B981"},{"id":"check","label":"Validate?","type":"decision","color":"#F59E0B"},{"id":"yes","label":"Process","type":"process","color":"#3B82F6"},{"id":"no","label":"Error","type":"end","color":"#EF4444"},{"id":"done","label":"Output","type":"end","color":"#10B981"}],"edges":[{"from":"start","to":"check"},{"from":"check","to":"yes","label":"Yes"},{"from":"check","to":"no","label":"No"},{"from":"yes","to":"done"}],"layout":"vertical","primaryColor":"#3B82F6","audioSrc":"This flowchart shows the validation process for user input."}',
  },
};

// ============================================================================
// HELPERS — arc role fitting
// ============================================================================

function fitRolesToBlocks(roles: string[], blockCount: number): string[] {
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

// ============================================================================
// NARRATIVE BRIEF TYPE
// ============================================================================

interface NarrativeBrief {
  narrativeRole: string;
  angle:         string;
  tone:          string;
  keyMessage:    string;
  visualMood:    string;
  spokenScript:  string;
  transitionIn:  string;
  transitionOut: string;
}

// ============================================================================
// MEDIA STRATEGY
// ============================================================================

interface BlockStrategy {
  blockIndex: number;
  blockType: string;
  imageSource: 'web_search' | 'ai_generation' | 'auto';
  searchQueryStyle: 'screenshot' | 'photo' | 'diagram' | null;
  autoScreenshot: boolean;
  minWidth: number;
  reasoning: string;
}

interface MediaStrategy {
  needsResearch: boolean;
  needsNewsSearch: boolean;
  researchQueries: string[];
  topicType: 'factual' | 'creative' | 'mixed';
  blockStrategies: BlockStrategy[];
}

// ============================================================================
// INNER GRAPH STATE
// ============================================================================

const BlockFillState = Annotation.Root({
  blockType:      Annotation<string>(),
  blockIndex:     Annotation<number>(),
  userStory:      Annotation<string>(),
  originalBlock:  Annotation<Record<string, any>>(),
  apiKey:         Annotation<string>(),
  preferredVoice: Annotation<string | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),
  model:          Annotation<string>(),
  language:       Annotation<string>({ default: () => 'en', reducer: (_, v) => v }),

  narrativeBrief: Annotation<NarrativeBrief | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),
  visualStyleGuide: Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  storyBible:       Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  arcName:          Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  selectedLenses:   Annotation<ConsistencyLens[]>({ default: () => [], reducer: (_, v) => v }),
  researchContext:  Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  mediaStrategy:    Annotation<MediaStrategy | null>({ default: () => null, reducer: (_, v) => v }),
  aspectRatio:      Annotation<string>({ default: () => '9:16', reducer: (_, v) => v }),

  rawContent: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),
  imageFields: Annotation<{ path: string; description: string; searchQuery?: string }[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),
  audioFields: Annotation<{ path: string; text: string }[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),
  videoFields: Annotation<{ path: string; prompt: string }[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),
  resolvedUrls: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (existing, incoming) => ({ ...existing, ...incoming }),
  }),
  resolvedAudio: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (existing, incoming) => ({ ...existing, ...incoming }),
  }),
  finalBlock: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),
  error: Annotation<string | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),
});

type BlockFillStateType = typeof BlockFillState.State;

// ============================================================================
// INNER GRAPH NODES
// ============================================================================

async function generateContent(state: BlockFillStateType) {
  console.log(`[generate_content] ▶ block ${state.blockIndex + 1}: ${state.blockType}`, {
    apiKeyPresent:    !!state.apiKey,
    hasBrief:         !!state.narrativeBrief,
    userStoryPreview: state.userStory?.slice(0, 60),
  });

  const { width, height } = getAspectRatioDimensions(state.aspectRatio ?? '9:16');
  const orientation = width > height ? 'landscape' : 'portrait';
  const dimLabel    = `${width}×${height} ${orientation}`;

  const schema = BLOCK_SCHEMAS[state.blockType];
  if (!schema) {
    console.warn(`[generate_content] No schema for: ${state.blockType}`);
    return { error: `Unknown block type: ${state.blockType}`, rawContent: {} };
  }

  const brief = state.narrativeBrief;

  const narrativeContext = brief ? `
NARRATIVE BRIEF FROM DIRECTOR:
- Role in story:        ${brief.narrativeRole}
- Specific angle:       ${brief.angle}
- Tone:                 ${brief.tone}
- Key message:          ${brief.keyMessage}
- Visual mood:          ${brief.visualMood}
- Connection from prev: ${brief.transitionIn}
- Lead into next:       ${brief.transitionOut}

SPOKEN SCRIPT (use this EXACT text for any audioSrc / TTS field — do NOT rewrite it):
"${brief.spokenScript}"

IMPORTANT: Stay on your assigned angle. Do NOT repeat content from other blocks.
Your ONE job: "${brief.keyMessage}"
For any audioSrc field, copy the SPOKEN SCRIPT above word-for-word.
` : '';

  const storyBibleContext = state.storyBible ? `
STORY BIBLE (shared facts — use these consistently, do NOT contradict):
${state.storyBible}
` : '';

  const lensHints = (state.selectedLenses ?? [])
    .map(lens => CONSISTENCY_LENS_CONFIGS[lens]?.contentGeneratorHint)
    .filter(Boolean)
    .join('\n\n');
  const lensHintSection = lensHints ? `\nCONSISTENCY RULES FOR THIS VIDEO:\n${lensHints}\n` : '';

  const blockStrategy = state.mediaStrategy?.blockStrategies
    ?.find(b => b.blockIndex === state.blockIndex);
  const useWebSearch = (blockStrategy && state.blockType !== 'video')
    ? blockStrategy.imageSource !== 'ai_generation'
    : false;
  const queryStyleHint = blockStrategy?.searchQueryStyle ?? 'photo';
  const imageFieldInstruction = useWebSearch
    ? `IMAGE FIELDS (write a SEARCH QUERY to find a real ${queryStyleHint} on the web — be specific, include product names, UI names, years):\n  ${schema.imageFields}`
    : `IMAGE FIELDS (write vivid visual description — NOT a URL. IMPORTANT: Ground your description in the ACTUAL CONTENT above — extract specific names, numbers, quotes, product names, dates, or key phrases from the Research Context, Story Bible, and Narrative Brief and include them as TEXT VISIBLY IN THE SCENE. Do not write generic aesthetic descriptions. Example: instead of "a product on dark background", write "the XYZ app dashboard on dark background with bold text '50K users' overlaid"):\n  ${schema.imageFields}`;

  const schemaDescription = [
    schema.textFields  && `TEXT FIELDS (fill with real content):\n  ${schema.textFields}`,
    schema.imageFields && imageFieldInstruction,
    schema.audioFields && `AUDIO/TTS FIELDS (write exact words to be spoken aloud):\n  ${schema.audioFields}`,
  ].filter(Boolean).join('\n\n');

  try {
    // ── HTML block: TWO-STEP generation to avoid JSON-escaping failures ──────
    // Step 1: Ask for raw HTML only (no JSON wrapper) — sidesteps the #1 failure
    //         mode where AI can't correctly escape multi-hundred-line HTML inside
    //         a JSON string value, causing parseJSON to throw and rawContent to
    //         be empty, which then lets the template block win silently.
    // Step 2: Build the result object in TypeScript — no JSON parsing needed.
    if (state.blockType === 'html') {
      console.log('[generate_content] 🎨 HTML block — using two-step raw-HTML generation');

      // ── Step 1a: optional concept plan (same as before) ──────────────────
      const conceptPrompt = brief
        ? `You are a creative director designing a HIGHLY GRAPHICAL animated slide (PowerPoint / product showcase style) for a short video.

STORY CONTEXT:
- Topic: "${state.userStory}"
- Role in story: ${brief.narrativeRole}
- Angle: ${brief.angle}
- Tone: ${brief.tone}
- Key message: ${brief.keyMessage}
- Visual mood: ${brief.visualMood}

Pick ONE concept that best communicates the key message as a visually rich slide:
- Product showcase (hero product + feature callouts + specs chips)
- App UI / dashboard showcase (charts + KPI tiles + sidebar)
- Before/After transformation (split screen with labels)
- Comparison showdown (2-column with animated bars)
- Timeline / roadmap (milestones + connecting line + pulsing nodes)
- Data story (big number + animated chart + annotations)
- Process slide (step cards + arrows + progress indicator)
- Social proof slide (logos wall + quote + rating badge)
- Pricing slide (tier columns + highlight + badge)
- Architecture diagram slide (nodes/edges but modern)
- "Keynote" quote slide (big type + kinetic background + accent shapes)

Return ONLY strict JSON (no markdown) with this schema:
{
  "concept": "one of the concepts above",
  "layout": "hero-left|hero-right|centered|split|grid|dashboard",
  "palette": { "bg": "#RRGGBB", "accent1": "#RRGGBB", "accent2": "#RRGGBB", "text": "#RRGGBB" },
  "headline": "6-10 words max",
  "subheadline": "short, optional",
  "bullets": ["3-5 short bullets max"],
  "badges": ["0-3 tiny label chips"],
  "heroGraphic": "describe the main graphic (e.g. phone mockup, product box, chart, etc.)",
  "motionPlan": ["3-6 short animation beats tied to time (0-5s)"],
  "avoid": ["things to avoid that could clutter/crop"]
}

RULES:
- Must be readable in 3–5 seconds.
- Use large typography (min 48px headline).
- Prefer bold shapes, gradients, glow, shadows, and inline SVG icons.
- Design for ${dimLabel}.
- Avoid content that requires scrolling.`
        : `You are a creative director. Return ONLY strict JSON with keys: concept, layout, palette, headline, subheadline, bullets, badges, heroGraphic, motionPlan, avoid. Topic: "${state.userStory}"`;

      let conceptPlan: Record<string, any> = {};
      try {
        const conceptRaw = await callAI(
          [
            { role: 'system', content: conceptPrompt },
            { role: 'user', content: 'Pick a strong concept and return the JSON plan now.' },
          ],
          state.apiKey, 900, state.model
        );
        conceptPlan = parseJSON(conceptRaw);
      } catch (e) {
        console.warn('[generate_content] ⚠️ concept planner failed (non-fatal):', e);
      }

      // Helper: detect if HTML is complete (has closing </html> tag)
      function isHtmlComplete(html: string): boolean {
        return html.trim().toLowerCase().endsWith('</html>');
      }

      // Helper: strip markdown fences
      function stripMarkdown(html: string): string {
        let result = html.trim();
        if (result.startsWith('```html')) result = result.slice(7);
        else if (result.startsWith('```')) result = result.slice(3);
        if (result.endsWith('```')) result = result.slice(0, -3);
        return result.trim();
      }

      // Helper: normalize HTML - ensure it starts with DOCTYPE and ends with </html>
      function normalizeHtml(html: string): string {
        let result = stripMarkdown(html);
        // Ensure DOCTYPE
        if (!result.toLowerCase().startsWith('<!doctype')) {
          // Find the <html> tag and prepend DOCTYPE if missing
          const htmlMatch = result.match(/<html[^>]*>/i);
          if (htmlMatch) {
            result = '<!DOCTYPE html>\n' + result;
          }
        }
        return result;
      }

      // Helper: ensure HTML ends with </html>
      function ensureHtmlClosingTag(html: string): string {
        if (!isHtmlComplete(html)) {
          // The HTML is truncated, find the last complete tag and append </html>
          // This is a fallback - ideally we should continue from where we left off
          console.warn('[generate_content] HTML missing closing </html>, attempting to fix...');
          return html + '\n</html>';
        }
        return html;
      }

      // ── Step 1b: Ask for ONLY the raw HTML document — no JSON wrapper ────
      // Use a loop to ensure complete HTML is generated
      const MAX_HTML_RETRIES = 3;
      let htmlContent = '';
      let htmlAttempts = 0;
      let isComplete = false;

      while (!isComplete && htmlAttempts < MAX_HTML_RETRIES) {
        htmlAttempts++;

        if (htmlAttempts === 1) {
          // First attempt - full generation
          const htmlOnlySystemPrompt = brief
            ? `You are an expert HTML/CSS/JS developer creating a single-file animated slide for a video frame.

STORY CONTEXT:
- Topic: "${state.userStory}"
- Role in story: ${brief.narrativeRole}
- Angle: ${brief.angle}
- Tone: ${brief.tone}
- Key message: ${brief.keyMessage}
- Visual mood: ${brief.visualMood}

CONCEPT PLAN (use for layout / palette guidance):
${JSON.stringify(conceptPlan, null, 2)}
${lensHintSection}
OUTPUT RULES — CRITICAL:
1. Output ONLY the raw HTML document. No JSON, no markdown fences, no explanation before or after.
2. Start your response with exactly: <!DOCTYPE html>
3. End your response with exactly: </html>
4. The document must be 100% self-contained (inline CSS + inline JS, no external resources).
5. Optimised for a ${dimLabel} video frame.
6. Use CSS animations driven by window.__remotionTime (seconds, 0-based) for timeline sync.
7. Dark gradient backgrounds preferred; minimum 48px headline; minimum 24px body text.
8. HARD REQUIREMENTS:
   - 3 visual layers: background shapes + hero graphic + foreground text/callouts
   - At least 2 inline SVG icons
   - One mini SVG data viz (sparkline, radial meter, or area chart)
   - Staged entrance animations: 0–0.6s bg, 0.6–1.6s headline, 1.6–3.0s callouts, 3.0–5s loop
9. No scrolling; use flex/grid, not fixed pixel positioning.
10. MANDATORY FULL-FRAME CSS — always include in <style>:
    html, body { margin: 0; padding: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    Never use auto height or partial-width containers on the outermost elements.`
            : `You are an expert HTML/CSS/JS developer. Create a single-file animated slide for a video about: "${state.userStory}".
OUTPUT RULES:
1. Output ONLY the raw HTML. Start with <!DOCTYPE html>, end with </html>. No JSON, no markdown.
2. Self-contained, ${dimLabel}, dark background, large readable text, CSS animations.
3. MANDATORY FULL-FRAME CSS: html, body { margin:0; padding:0; width:${width}px; height:${height}px; overflow:hidden; }`;

          const rawHtmlResponse = await callAI(
            [
              { role: 'system', content: htmlOnlySystemPrompt },
              { role: 'user', content: 'Generate the HTML document now. Output ONLY raw HTML starting with <!DOCTYPE html>.' },
            ],
            state.apiKey, 2500, state.model
          );

          htmlContent = stripMarkdown(rawHtmlResponse);
          console.log(`[generate_content] HTML attempt ${htmlAttempts}: ${htmlContent.length} chars, complete: ${isHtmlComplete(htmlContent)}`);
        } else if (htmlAttempts === 2 && !isHtmlComplete(htmlContent)) {
          // Second attempt - continuation from truncation point
          // If HTML is incomplete, try to continue from where it left off
          const lastOpenTag = htmlContent.lastIndexOf('<');
          const incompleteTag = lastOpenTag > 0 ? htmlContent.slice(lastOpenTag) : '';
          
          console.log(`[generate_content] HTML truncated, attempting continuation. Last ${Math.min(100, incompleteTag.length)} chars: "${incompleteTag.slice(0, 100)}"`);
          
          const continuationPrompt = `The previous HTML was cut off mid-generation. Continue from exactly where it stopped.

PREVIOUS HTML (incomplete):
${htmlContent}

CRITICAL INSTRUCTIONS:
1. Pick up the output from where it was cut off — do NOT repeat any content
2. If there was an unclosed HTML tag (like <div>, <style>, <script>), close it first
3. Then continue with the remaining content
4. MUST end with </html>
5. Output ONLY the continuation — no JSON, no markdown, no explanation
6. Start directly with whatever comes next (likely closing tags)`;

          const continuationResponse = await callAI(
            [
              { role: 'system', content: 'You are an HTML expert. Continue truncated HTML output exactly where it left off.' },
              { role: 'user', content: continuationPrompt },
            ],
            state.apiKey, 3000, state.model
          );

          const continuation = stripMarkdown(continuationResponse);
          htmlContent = htmlContent + continuation;
          console.log(`[generate_content] HTML continuation: +${continuation.length} chars, total: ${htmlContent.length}`);
        } else if (htmlAttempts === 3 && !isHtmlComplete(htmlContent)) {
          // Third attempt - full regeneration with stricter constraints
          console.warn(`[generate_content] HTML still incomplete after continuation, regenerating with shorter content...`);
          
          const regenerationPrompt = `Create a COMPLETE HTML slide for a video. You MUST output the ENTIRE document — it must be SHORT enough to fit in your response.

STORY: "${state.userStory}"
Key message: "${brief?.keyMessage ?? ''}"

RULES:
1. Output ONLY the raw HTML, starting with <!DOCTYPE html> and ending with </html>
2. Keep it concise — max 150 lines of code. Focus on quality, not quantity.
3. Must include: dark gradient background, large headline, at least 1 SVG icon, CSS animations using window.__remotionTime
4. No external resources. Self-contained.
5. ${dimLabel} format. MANDATORY CSS: html, body { margin:0; padding:0; width:${width}px; height:${height}px; overflow:hidden; }
6. Output the ENTIRE document in one response — do not leave it incomplete.`;

          const regenerationResponse = await callAI(
            [
              { role: 'system', content: 'You MUST output complete HTML. If you cannot fit everything, make it shorter but COMPLETE.' },
              { role: 'user', content: regenerationPrompt },
            ],
            state.apiKey, 3000, state.model
          );

          htmlContent = stripMarkdown(regenerationResponse);
          console.log(`[generate_content] HTML regeneration: ${htmlContent.length} chars`);
        }

        // Check completeness
        isComplete = isHtmlComplete(htmlContent);
        
        if (!isComplete && htmlAttempts < MAX_HTML_RETRIES) {
          console.warn(`[generate_content] HTML still incomplete (${htmlContent.length} chars), retrying...`);
        }
      }

      // Final validation and normalization
      if (!htmlContent.includes('<') || !htmlContent.toLowerCase().includes('<!doctype')) {
        console.warn('[generate_content] HTML response looks invalid after all retries — attempting final recovery');
        const retryResponse = await callAI(
          [
            {
              role: 'system',
              content: 'Output ONLY a complete HTML document starting with <!DOCTYPE html> and ending with </html>. No JSON, no markdown, no extra text. Just raw HTML.',
            },
            {
              role: 'user',
              content: `Create an animated HTML slide for a video about: "${state.userStory}". Key message: "${brief?.keyMessage ?? state.userStory}". Output raw HTML only. Make it COMPLETE — must end with </html>.`,
            },
          ],
          state.apiKey, 3000, state.model
        );
        htmlContent = stripMarkdown(retryResponse);
      }

      // Ensure closing tag as last resort
      htmlContent = ensureHtmlClosingTag(htmlContent);

      // ── Step 2: Build the rawContent object in TypeScript — zero JSON parsing ──
      const htmlRawContent: Record<string, any> = {
        htmlContent,
        title:    brief?.narrativeRole ?? 'HTML Block',
        audioSrc: brief?.spokenScript ?? '',
      };

      console.log('[generate_content] ✅ HTML two-step done. htmlContent length:', htmlContent.length, 'audioSrc:', htmlRawContent.audioSrc.slice(0, 80));
      return { rawContent: htmlRawContent };
    }

    // ── Diagram Director Agent ────────────────────────────────────────────────
    if (state.blockType === 'diagram') {
      console.log('[generate_content] 📊 Diagram block detected — running diagram director agent');

      const diagramDirectorPrompt = brief
        ? `You are a diagram content director for a video block. Design a visually rich diagram.

STORY: "${state.userStory}"
Role: ${brief.narrativeRole} | Angle: ${brief.angle} | Tone: ${brief.tone}
Key message: ${brief.keyMessage}
${lensHintSection}
DIAGRAM REQUIREMENTS:
- Pick diagramType: flowchart | hierarchy | sequence | mindmap | network
- Pick layout: vertical (flowchart/hierarchy) | horizontal (sequence) | radial (mindmap/network)
- 3–8 nodes, each with a SHORT label (1–4 words max)
- Use SEQUENTIAL IDs: "n1", "n2", "n3", etc. — NO other ID format
- All edge "from" and "to" values MUST exactly match an existing node "id"
- Use distinct high-contrast hex colors per node (dark bg: prefer purples, blues, greens, ambers)
- node "type": start | process | decision | data | end | default
- Include 2–6 edges connecting the nodes logically
- Each edge "style": solid | dashed | arrow

CRITICAL: Every edge's "from" and "to" must be an id that exists in the nodes array.

Return ONLY valid JSON. No markdown, no explanation.
Schema:
{
  "diagramType": "...",
  "title": "...",
  "layout": "...",
  "primaryColor": "#hex",
  "nodes": [{"id":"n1","label":"...","type":"start","color":"#hex"}, ...],
  "edges": [{"from":"n1","to":"n2","label":"optional","style":"arrow"}, ...],
  "audioSrc": "..."
}`
        : `You are a diagram content generator. Create a diagram for a video about: "${state.userStory}".
Use sequential node IDs: "n1", "n2", "n3", etc. All edge from/to values MUST match a node id exactly.
Return JSON: { diagramType, title, layout, primaryColor, nodes: [{id,label,type,color}], edges: [{from,to,label,style}], audioSrc }.`;

      const diagramDirectorResponse = await callAI([
        { role: 'system', content: diagramDirectorPrompt },
        { role: 'user', content: `Generate the diagram JSON now. The narration (audioSrc) must be exactly: "${brief?.spokenScript || ''}"` },
      ], state.apiKey, 1500, state.model);

      const diagramRawContent = parseJSON(diagramDirectorResponse);

      // Sanitize edges: remove any edge whose from/to doesn't reference a real node id
      if (Array.isArray(diagramRawContent.nodes) && Array.isArray(diagramRawContent.edges)) {
        const validIds = new Set<string>((diagramRawContent.nodes as any[]).map((n: any) => String(n.id)));
        const before = diagramRawContent.edges.length;
        diagramRawContent.edges = (diagramRawContent.edges as any[]).filter(
          (e: any) => validIds.has(String(e.from)) && validIds.has(String(e.to))
        );
        const dropped = before - diagramRawContent.edges.length;
        if (dropped > 0) console.warn(`[generate_content] ⚠️ Dropped ${dropped} edge(s) with unresolved node IDs`);
      }

      if (brief?.spokenScript) {
        diagramRawContent.audioSrc = brief.spokenScript;
      }

      console.log('[generate_content] ✅ Diagram director output:', JSON.stringify(diagramRawContent, null, 2).slice(0, 500));
      return { rawContent: diagramRawContent };
    }

    // ── Standard content generation for all other block types ────────────────

    // For parallax-story: show the actual template layers so the AI knows exactly
    // how many layers to fill and what role each one plays.
    let parallaxLayerHint = '';
    if (state.blockType === 'parallax-story' && Array.isArray(state.originalBlock?.layers) && state.originalBlock.layers.length > 0) {
      const layerSummary = (state.originalBlock.layers as any[]).map((l: any, i: number) =>
        `  Layer ${i} — name: "${l.name ?? `layer_${i}`}", depth: ${l.depth ?? i * 30}, parallaxFactor: ${l.parallaxFactor ?? 1}, motionDirection: "${l.motionDirection ?? 'right'}", removeBackground: ${l.removeBackground ?? (i > 0)}`
      ).join('\n');
      parallaxLayerHint = `\nPARALLAX LAYER STRUCTURE (MUST output exactly ${state.originalBlock.layers.length} layers in this order — only fill "image", keep all other fields as shown):\n${layerSummary}\n`;
    }

    const response = await callAI([
      {
        role: 'system',
        content: `You are a video content generator filling a "${state.blockType}" block.
${narrativeContext}${storyBibleContext}${lensHintSection}${state.researchContext ? `\nRESEARCH CONTEXT (use these current facts — prefer over training data):\n${state.researchContext}\n` : ''}${parallaxLayerHint}
FIELD DEFINITIONS:
${schemaDescription}

RULES:
1. TEXT fields  → specific, real, engaging content matching your narrative angle
2. IMAGE fields → ${useWebSearch ? `a specific web search query to find a real ${queryStyleHint} (NOT an artistic description)` : `vivid visual description matching the visual mood: "${brief?.visualMood ?? 'cinematic'}"`}
3. AUDIO fields → ${brief?.spokenScript ? 'use the EXACT spoken script from the narrative brief above — copy it word for word' : `natural spoken script matching tone: "${brief?.tone ?? 'engaging'}"`}
4. Return a single flat JSON object — no markdown, no extra keys
5. Be SPECIFIC — real names, real numbers, real facts${state.language !== 'en' ? `\n6. LANGUAGE: ALL viewer-facing text (text fields, audio/TTS fields, captions, quotes, list items) MUST be in ${languageName(state.language)}. JSON keys stay in English.` : ''}${state.blockType === 'video' ? `\n7. VIDEO src field → write a detailed cinematic scene description (lighting, mood, camera angle, subject, action) GROUNDED IN THE ACTUAL CONTENT above. Include specific names, places, products, or events from the Research Context, Story Bible, and Narrative Brief so the scene depicts the REAL subject. MATCH THE CONTENT TYPE: if the story is about a product/software/service → describe a UI, dashboard, or product-in-use scene (NOT a person reacting emotionally); if the story is about a person → describe that specific person; if the story is about a concept → describe the mechanism or visualization. NEVER write a generic mood shot or character emotional scene when the content is about a product or technical concept. NEVER write a filename, path, or URL. This description is sent to an AI video generator (Veo). Example for product: "Close-up of Helixr Arc dashboard on a widescreen monitor, documents streaming into organized folders, clean dark UI with blue accent lights, office environment." Example for person: "Virat Kohli raising his bat to a roaring crowd at Adelaide Oval, golden-hour stadium lights, slow-motion celebration."` : ''}

RESPONSE FORMAT (use this exact JSON structure):
${getResponseFormatTemplate(state.blockType)}

Example output format:
${schema.example}`,
      },
      {
        role: 'user',
        content: `Topic/Story: "${state.userStory}"
Block type: "${state.blockType}"
Block ${state.blockIndex + 1} of the video.
${brief ? `Your job this block: ${brief.keyMessage}` : ''}

Generate the JSON content object now.`,
      },
    ], state.apiKey, 1500, state.model);

    const rawContent = parseJSON(response);

    // Programmatically enforce: audioSrc must match director's spokenScript
    if (brief?.spokenScript) {
      if (rawContent.audioSrc !== undefined) {
        rawContent.audioSrc = brief.spokenScript;
      }
      if (state.blockType === 'html' || state.blockType === 'diagram') {
        rawContent.audioSrc = brief.spokenScript;
      }
    }
    if (brief?.spokenScript && rawContent.text !== undefined &&
        ['video', 'parallax-story', 'motivational-image'].includes(state.blockType)) {
      rawContent.text = brief.spokenScript;
    }

    console.log('[generate_content] ✅ rawContent:', JSON.stringify(rawContent, null, 2));
    return { rawContent };
  } catch (e: any) {
    return { error: `generate_content failed: ${e.message}`, rawContent: {} };
  }
}

function extractAudioFields(obj: any, prefix = ''): { path: string; text: string }[] {
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

async function classifyMediaFields(state: BlockFillStateType) {
  console.log(`[classify_media_fields] ▶ ${state.blockType}`);
  console.log('[classify_media_fields] rawContent:', JSON.stringify(state.rawContent, null, 2));

  // Helper: inject spokenScript as audioSrc when rawContent has no audio text.
  // This ensures audio is generated even when callAI fails.
  function injectAudioFallback(content: Record<string, any>): Record<string, any> {
    const spokenScript = state.narrativeBrief?.spokenScript;
    if (!spokenScript) return content;
    const hasAudio = typeof content.audioSrc === 'string' && content.audioSrc.trim().length > 0;
    if (hasAudio) return content;
    return { ...content, audioSrc: spokenScript };
  }

  // For parallax-story: if generateContent failed (rawContent empty or has no layers),
  // seed from the original template block so image generation still runs.
  let effectiveRawContent = state.rawContent ?? {};
  if (
    state.blockType === 'parallax-story' &&
    Array.isArray(state.originalBlock?.layers) &&
    state.originalBlock.layers.length > 0 &&
    (!Array.isArray(effectiveRawContent.layers) || effectiveRawContent.layers.length === 0)
  ) {
    console.warn('[classify_media_fields] ⚠️ parallax rawContent has no layers — seeding from template block');
    // Strip stale image URLs from template layers so they get freshly regenerated.
    const cleanedLayers = (state.originalBlock.layers as any[]).map((l: any) => {
      const img = l?.image;
      const isStaleUrl = typeof img === 'string' && (img.startsWith('http') || img.startsWith('data:'));
      return isStaleUrl ? { ...l, image: l.name ?? `layer visual for ${state.originalBlock.title ?? state.blockType}` } : l;
    });
    effectiveRawContent = { ...state.originalBlock, ...effectiveRawContent, layers: cleanedLayers };
  }

  // Inject audio fallback for ALL block types when rawContent is empty or missing audioSrc.
  effectiveRawContent = injectAudioFallback(effectiveRawContent);

  if (!effectiveRawContent || Object.keys(effectiveRawContent).length === 0) {
    console.warn('[classify_media_fields] ⚠️ empty rawContent — skipping');
    return { imageFields: [], audioFields: [], videoFields: [] };
  }

  // For parallax-story: extract layer image fields deterministically — no AI classifier needed.
  // This ensures all layers are found even if the AI classifier misses nested array entries,
  // and avoids spending tokens on a classifier call for a known structure.
  if (state.blockType === 'parallax-story' && Array.isArray(effectiveRawContent.layers)) {
    const imageFields: { path: string; description: string }[] = [];
    for (let i = 0; i < effectiveRawContent.layers.length; i++) {
      const layer = effectiveRawContent.layers[i];
      const desc = layer?.image;
      if (desc && typeof desc === 'string' && !desc.startsWith('http') && !desc.startsWith('data:')) {
        imageFields.push({ path: `layers[${i}].image`, description: desc });
      }
    }
    const audioFields = extractAudioFields(effectiveRawContent);
    console.log(`[classify_media_fields] 🖼️ parallax deterministic imageFields (${imageFields.length} layers):`, JSON.stringify(imageFields));
    return { imageFields, audioFields, videoFields: [], rawContent: effectiveRawContent };
  }

  // For top-players: extract backgroundImage + players[N].image deterministically.
  if (state.blockType === 'top-players' && Array.isArray(effectiveRawContent.players)) {
    const imageFields: { path: string; description: string }[] = [];
    // Background image (no background removal)
    const bgDesc = effectiveRawContent.backgroundImage;
    if (bgDesc && typeof bgDesc === 'string' && !bgDesc.startsWith('http') && !bgDesc.startsWith('data:')) {
      imageFields.push({ path: 'backgroundImage', description: bgDesc });
    }
    // Per-player cutout images (background removal)
    for (let i = 0; i < effectiveRawContent.players.length; i++) {
      const player = effectiveRawContent.players[i];
      const desc = player?.image;
      if (desc && typeof desc === 'string' && !desc.startsWith('http') && !desc.startsWith('data:')) {
        imageFields.push({ path: `players[${i}].image`, description: desc });
      }
    }
    // Per-player audio
    const audioFields = extractAudioFields(effectiveRawContent);
    // Also extract per-player audioSrc entries
    for (let i = 0; i < effectiveRawContent.players.length; i++) {
      const player = effectiveRawContent.players[i];
      if (player?.audioSrc && typeof player.audioSrc === 'string' && !player.audioSrc.startsWith('http')) {
        audioFields.push({ path: `players[${i}].audioSrc`, text: player.audioSrc });
      }
    }
    console.log(`[classify_media_fields] 🖼️ top-players deterministic imageFields (${imageFields.length}):`, JSON.stringify(imageFields));
    return { imageFields, audioFields, videoFields: [], rawContent: effectiveRawContent };
  }

  let rawContentForAudio = effectiveRawContent;
  if (
    (state.blockType === 'parallax-story' || state.blockType === 'motivational-image') &&
    state.rawContent?.text &&
    (state.rawContent?.textMode === 'overall' || state.blockType === 'motivational-image')
  ) {
    rawContentForAudio = { ...state.rawContent, audioSrc: state.rawContent.text };
    console.log('[classify_media_fields] 🔄 Forcing audioSrc = text for subtitle sync');
  }

  const audioFields = extractAudioFields(rawContentForAudio);
  console.log('[classify_media_fields] 🎙️ audioFields (deterministic):', JSON.stringify(audioFields));

  const videoFields: { path: string; prompt: string }[] = [];
  if (state.blockType === 'video') {
    const src = state.rawContent?.src as string;
    if (!src || (!src.startsWith('http') && !src.startsWith('data:'))) {
      const prompt = src || state.rawContent?.caption || state.rawContent?.text || '';
      if (prompt) {
        videoFields.push({ path: 'src', prompt });
        console.log('[classify_media_fields] 🎬 videoField detected — will generate video for src');
      }
    }
  }
  console.log('[classify_media_fields] 🎬 videoFields:', JSON.stringify(videoFields));

  const schema = BLOCK_SCHEMAS[state.blockType];

  if (!schema?.imageFields) {
    return { imageFields: [], audioFields, videoFields };
  }

  let contentForClassification = state.rawContent;
  if (state.blockType === 'video') {
    const { src, ...rest } = state.rawContent as any;
    contentForClassification = rest;
    console.log('[classify_media_fields] 🎬 stripped src from classification content (handled by resolveVideo)');
  }

  try {
    const blockStrategy = state.mediaStrategy?.blockStrategies
      ?.find(b => b.blockIndex === state.blockIndex);
    const includeSearchQuery = (blockStrategy && state.blockType !== 'video')
      ? blockStrategy.imageSource !== 'ai_generation'
      : false;
    const queryStyleHint = blockStrategy?.searchQueryStyle ?? 'photo';
    const response = await callAI([
      {
        role: 'system',
        content: `You are a media field classifier for video blocks.

Given a block type, schema hints, and generated JSON content, identify:

IMAGE FIELDS — fields whose value is a visual description needing image generation.
   Defined image hints for this block: "${schema?.imageFields || 'none'}"
   Also detect any field whose value looks like a visual scene description
   (not a URL, not a sentence of prose, but a visual description like
   "Virat Kohli raising bat at stadium").
${state.blockType === 'video' ? '\nIMPORTANT: Do NOT classify "src" as an image field — it is a video field handled separately.\n' : ''}
For nested array fields use dot notation: "avatars[0].image", "layers[1].image"

Return ONLY this JSON, no markdown:
{
  "imageFields": [{ "path": "dot.path", "description": "the visual description value"${includeSearchQuery ? ', "searchQuery": "specific web search query to find a real ' + queryStyleHint + '"' : ''} }]
}

Return empty array if nothing qualifies.${includeSearchQuery ? `\n\nIMPORTANT: The planner decided this block should use REAL images from the web. For each image field, also include a "searchQuery" — a specific web search query to find a real ${queryStyleHint}. Make queries very specific (include product names, UI names, years). The "description" is a fallback for AI generation if search fails.` : ''}`,
      },
      {
        role: 'user',
        content: `Block type: "${state.blockType}"
Generated content:
${JSON.stringify(contentForClassification, null, 2)}`,
      },
    ], state.apiKey, 800, state.model);

    const classified = parseJSON(response);
    const imageFields = (classified.imageFields ?? []).filter(
      (f: any) => !(state.blockType === 'video' && f.path === 'src')
    );
    console.log('[classify_media_fields] ✅ imageFields:', JSON.stringify(imageFields));

    return { imageFields, audioFields, videoFields };
  } catch (e: any) {
    console.warn('[classify_media_fields] ⚠️ image classification failed:', e.message);
    return { imageFields: [], audioFields, videoFields };
  }
}

async function resolveImages(state: BlockFillStateType) {
  console.log(`[resolve_images] ▶ ENTERED — imageFields:`, JSON.stringify(state.imageFields));

  if (state.imageFields.length === 0) {
    console.warn('[resolve_images] ⚠️ no imageFields to resolve');
    return { resolvedUrls: {} };
  }

  const blockStrategy = state.mediaStrategy?.blockStrategies
    ?.find(b => b.blockIndex === state.blockIndex);

  const results = await Promise.all(
    state.imageFields.map(async ({ path, description, searchQuery }) => {
      if (searchQuery) {
        const webUrl = await searchWebImage(searchQuery, {
          minWidth: blockStrategy?.minWidth ?? 800,
          autoScreenshot: blockStrategy?.autoScreenshot ?? false,
        });
        if (webUrl) {
          console.log(`[resolve_images] 🔍 web hit "${path}": ${webUrl.slice(0, 80)}`);
          const layerMatch = path.match(/^layers\[(\d+)\]/);
          const playerMatch = path.match(/^players\[(\d+)\]\.image$/);
          const needsBgRemoval = layerMatch
            ? !!(state.rawContent?.layers?.[parseInt(layerMatch[1], 10)]?.removeBackground)
            : !!playerMatch; // top-players: all player images need bg removal
          if (needsBgRemoval) {
            console.log(`[resolve_images] 🔍 web image needs bg removal — sending to rmbg API`);
            const bgRemoved = await removeBackgroundFromUrl(webUrl);
            return [path, bgRemoved] as const;
          }
          const proxied = await proxyImageToS3(webUrl);
          return [path, proxied] as const;
        }
        console.log(`[resolve_images] 🔍 web miss "${path}", falling back to AI generation`);
      }

      const match = path.match(/^layers\[(\d+)\]/);
      const playerImgMatch = path.match(/^players\[(\d+)\]\.image$/);
      const needsBgRemoval = match
        ? !!(state.rawContent?.layers?.[parseInt(match[1], 10)]?.removeBackground)
        : !!playerImgMatch; // top-players: all player images need bg removal

      const styledDescription = state.visualStyleGuide
        ? `${state.visualStyleGuide}. ${description}`
        : description;

      console.log(`[resolve_images] → generating "${path}" (bgRemoval=${needsBgRemoval}): ${styledDescription.slice(0, 120)}`);
      const url = needsBgRemoval
        ? await generateBgRemovedImage(styledDescription)
        : await generateImage(styledDescription);
      console.log(`[resolve_images] ✅ "${path}": ${url.slice(0, 80)}`);
      return [path, url] as const;
    })
  );

  return { resolvedUrls: Object.fromEntries(results) };
}

async function resolveAudio(state: BlockFillStateType) {
  console.log(`[resolve_audio] ▶ ENTERED — audioFields:`, JSON.stringify(state.audioFields));

  if (state.audioFields.length === 0) {
    console.warn('[resolve_audio] ⚠️ no audioFields to resolve');
    return { resolvedAudio: {} };
  }

  const results = await Promise.all(
    state.audioFields.map(async ({ path, text }) => {
      console.log(`[resolve_audio] → TTS for "${path}": ${text.slice(0, 80)}`);
      const audio = await generateAudio(text, state.preferredVoice ?? undefined);
      console.log(`[resolve_audio] ✅ "${path}": audio length ${audio?.length ?? 0}`);
      return [path, audio] as const;
    })
  );

  return { resolvedAudio: Object.fromEntries(results) };
}

async function resolveVideo(state: BlockFillStateType) {
  console.log(`[resolve_video] ▶ ENTERED — videoFields:`, JSON.stringify(state.videoFields));

  if (state.videoFields.length === 0) {
    console.warn('[resolve_video] ⚠️ no videoFields to resolve');
    return { resolvedUrls: {} };
  }

  console.log('[resolve_video] ⏭️ deferring video generation to review step');
  return { resolvedUrls: {} };
}

async function mergeMedia(state: BlockFillStateType) {
  console.log(`[merge_media] ▶ ${state.blockType}`);

  // ── Guard: if rawContent is empty, the content generation step failed.
  // Strip known stale media URL fields from the original block so they don't
  // get shown as placeholders — better to show empty than a stale/wrong image.
  if (!state.rawContent || Object.keys(state.rawContent).length === 0) {
    console.error(
      `[merge_media] ❌ rawContent is EMPTY for block ${state.blockIndex + 1} (${state.blockType}). ` +
      `generate_content failed. Returning template block with stale media URLs cleared.`
    );
    const staleMediaKeys = ['src', 'imageSrc', 'image', 'url', 'audioSrc', 'videoSrc'];
    const fallback: Record<string, any> = { ...state.originalBlock };
    for (const k of staleMediaKeys) {
      if (k in fallback) fallback[k] = '';
    }
    // Clear stale layer image/audio URLs but keep structural fields
    if (Array.isArray(fallback.layers)) {
      fallback.layers = (fallback.layers as any[]).map((l: any) => ({
        ...l,
        image: typeof l.image === 'string' && (l.image.startsWith('http') || l.image.startsWith('data:')) ? '' : l.image,
      }));
    }
    // Inject audioSrc from spokenScript if available so TTS still runs downstream
    if (state.narrativeBrief?.spokenScript) {
      fallback.audioSrc = state.narrativeBrief.spokenScript;
    }
    return { finalBlock: fallback };
  }

  let content = { ...state.rawContent };

  for (const [path, url] of Object.entries(state.resolvedUrls)) {
    content = setNestedValue(content, path, url);
  }

  for (const [path, audio] of Object.entries(state.resolvedAudio)) {
    if (audio) {
      content = setNestedValue(content, path, audio);
    }
  }

  const { type: _stripped, ...contentWithoutType } = content;

  if (state.blockType === 'tower-chart-3d') {
    try {
      const contentWithType = { ...contentWithoutType, type: state.blockType };
      const validated = TowerChart3DBlockSchema.parse(contentWithType);
      Object.assign(contentWithoutType, validated);
      console.log('[merge_media] ✅ Schema validation passed for tower-chart-3d');
    } catch (e) {
      console.error('[merge_media] ❌ Schema validation failed for tower-chart-3d:', e);
    }
  }

  const orig = state.originalBlock ?? {};
  const schema = BLOCK_SCHEMAS[state.blockType as keyof typeof BLOCK_SCHEMAS];
  const allowedFields = new Set(schema?.contentFields ?? Object.keys(contentWithoutType));

  const pickedContent: Record<string, any> = {};
  for (const [key, val] of Object.entries(contentWithoutType)) {
    if (allowedFields.has(key)) {
      pickedContent[key] = val;
    }
  }

  const finalBlock: Record<string, any> = {
    ...orig,
    type: state.blockType,
    ...pickedContent,
  };

  console.log(`[merge_media] ✅ finalBlock keys: ${Object.keys(finalBlock).join(', ')}`);
  return { finalBlock };
}

function routeAfterClassify(state: BlockFillStateType): string[] {
  const next: string[] = [];
  if (state.imageFields.length > 0) next.push('resolve_images');
  if (state.audioFields.length > 0) next.push('resolve_audio');
  if (state.videoFields.length > 0) next.push('resolve_video');
  if (next.length === 0) next.push('merge_media');
  console.log(`[routeAfterClassify] routing to: ${next.join(', ')}`);
  return next;
}

// ============================================================================
// INNER GRAPH — compiled once, reused as subgraph for every block
// ============================================================================

const blockFillGraph = new StateGraph(BlockFillState)
  .addNode('generate_content',      generateContent)
  .addNode('classify_media_fields', classifyMediaFields)
  .addNode('resolve_images',        resolveImages)
  .addNode('resolve_audio',         resolveAudio)
  .addNode('resolve_video',         resolveVideo)
  .addNode('merge_media',           mergeMedia)
  .addEdge('__start__',             'generate_content')
  .addEdge('generate_content',      'classify_media_fields')
  .addConditionalEdges('classify_media_fields', routeAfterClassify, {
    resolve_images: 'resolve_images',
    resolve_audio:  'resolve_audio',
    resolve_video:  'resolve_video',
    merge_media:    'merge_media',
  })
  .addEdge('resolve_images', 'merge_media')
  .addEdge('resolve_audio',  'merge_media')
  .addEdge('resolve_video',  'merge_media')
  .addEdge('merge_media',    '__end__')
  .compile();

// ============================================================================
// OUTER GRAPH STATE
// ============================================================================

const VideoGenState = Annotation.Root({
  userStory:        Annotation<string>(),
  apiKey:           Annotation<string>(),
  model:            Annotation<string>(),
  preferredArc:     Annotation<string | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),
  preferredVoice:   Annotation<string | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),
  language:         Annotation<string>({ default: () => 'en', reducer: (_, v) => v }),
  templateBlocks:   Annotation<Array<{ type: string; [key: string]: any }>>({
    default: () => [],
    reducer: (_, v) => v,
  }),
  partialVideoMeta: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),

  videoMeta: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),

  preferredVisualStyle: Annotation<string | null>({ default: () => null, reducer: (_, v) => v }),
  customVisualPrompt:   Annotation<string | null>({ default: () => null, reducer: (_, v) => v }),
  customArc:            Annotation<{ roles: string[]; defaultTone: string } | null>({ default: () => null, reducer: (_, v) => v }),

  arcPatternCatalog:    Annotation<Record<string, ArcPattern>>({ default: () => ({}), reducer: (_, v) => v }),
  visualStyleCatalog:   Annotation<Record<string, { name: string; promptPrefix: string }>>({ default: () => ({}), reducer: (_, v) => v }),

  selectedArc: Annotation<ArcPattern | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),

  narrativePlan: Annotation<NarrativeBrief[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),
  visualStyleGuide:  Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  storyBible:        Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  selectedLenses:    Annotation<ConsistencyLens[]>({ default: () => [], reducer: (_, v) => v }),
  researchContext:   Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  mediaStrategy:     Annotation<MediaStrategy | null>({ default: () => null, reducer: (_, v) => v }),

  filledBlocks: Annotation<Record<string, any>[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),

  finalPayload: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),

  errors: Annotation<string[]>({
    default: () => [],
    reducer: (existing, incoming) => [...existing, ...incoming],
  }),
});

type VideoGenStateType = typeof VideoGenState.State;

// ============================================================================
// OUTER GRAPH NODES
// ============================================================================

async function enrichVideoMeta(state: VideoGenStateType) {
  console.log('[enrich_video_meta] ▶ filling missing videoMeta fields');

  const provided   = state.partialVideoMeta ?? {};
  const alreadySet = Object.keys(provided).filter(k => provided[k] !== undefined);

  try {
    const response = await callAI([
      {
        role: 'system',
        content: `You are a video metadata generator. Fill in any missing videoMeta fields.

Valid values:
- aspectRatio: "16:9" | "9:16" | "1:1" | "4:5"  (default "9:16" for social/mobile)
- theme: "dark_modern" | "light_clean" | "gradient_vibrant" | "minimal_bw"
- fps: 24 | 30 | 60  (default 30)
- intro: { title (string), subtitle (string), duration (1-5) }
- outro: { title (string), subtitle (string), duration (1-5) }
- audioTracks: [] (leave empty unless story explicitly mentions background music)
- subtitleTrack: optional object { entries: [{startTime, endTime, text}], style: {textStyle, fontSize, ...}, enabled } — leave out unless user requests subtitles
- textOverlayTracks: [] optional array of persistent text overlays (watermarks, lower thirds). Each: { id, text, textStyle, fontSize, textPosition, textColor, opacity, startTime, endTime (null=forever), enabled }

DO NOT change already-provided fields: ${alreadySet.join(', ') || 'none'}
Pick theme and aspectRatio that best fit the story's tone and platform.
${state.language !== 'en' ? `LANGUAGE: All viewer-facing text (intro title/subtitle, outro title/subtitle) MUST be in ${languageName(state.language)}.` : ''}
Return complete JSON only, no markdown.`,
      },
      {
        role: 'user',
        content: `Story: "${state.userStory}"
Already provided: ${JSON.stringify(provided, null, 2)}
Return complete videoMeta JSON.`,
      },
    ], state.apiKey, 600, state.model);

    const aiMeta   = parseJSON(response);
    const videoMeta = { ...aiMeta, ...provided };
    console.log('[enrich_video_meta] ✅ videoMeta:', JSON.stringify(videoMeta));
    return { videoMeta };
  } catch (e: any) {
    console.warn('[enrich_video_meta] ⚠️ failed, using defaults:', e.message);
    return {
      videoMeta: {
        aspectRatio: '9:16',
        theme:       'dark_modern',
        fps:         30,
        audioTracks: [],
        textOverlayTracks: [],
        intro:       { title: '', subtitle: '', duration: 2 },
        outro:       { title: '', subtitle: '', duration: 2 },
        ...provided,
      },
    };
  }
}

async function selectArc(state: VideoGenStateType) {
  console.log('[select_arc] ▶ choosing narrative arc');

  const catalog: Record<string, ArcPattern> = { ...ARC_PATTERNS, ...state.arcPatternCatalog };

  if (state.preferredArc) {
    const forced = catalog[state.preferredArc];
    if (forced) {
      console.log(`[select_arc] ✅ using caller-forced arc: "${forced.name}"`);
      return { selectedArc: forced };
    }
    console.warn(`[select_arc] ⚠️ preferredArc "${state.preferredArc}" not found in catalog — falling back to AI selection`);
  }

  const blockTypes = state.templateBlocks.map(b => b.type).join(', ');
  const arcList    = Object.values(catalog)
    .map(a => `- "${a.name}": ${a.description}`)
    .join('\n');

  try {
    const response = await callAI([
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
        content: `Story: "${state.userStory}"
Block types in this video (${state.templateBlocks.length} blocks): ${blockTypes}

Which arc fits best?`,
      },
    ], state.apiKey, 200, state.model);

    const parsed   = parseJSON(response);
    const arcName  = parsed.arc as string;
    const selected = catalog[arcName] ?? catalog['documentary'] ?? ARC_PATTERNS['documentary'];

    console.log(`[select_arc] ✅ selected: "${arcName}" — ${parsed.reason}`);
    return { selectedArc: selected };

  } catch (e: any) {
    console.warn('[select_arc] ⚠️ failed, defaulting to documentary:', e.message);
    return { selectedArc: catalog['documentary'] ?? ARC_PATTERNS['documentary'] };
  }
}

async function plannerNode(state: VideoGenStateType) {
  const arcName = (state.selectedArc as ArcPattern | null)?.name
    ?? (state as any).preferredArc ?? '';
  const blockSummary = state.templateBlocks
    .map((b, i) => `[${i}] ${b.type}`)
    .join(', ');

  console.log(`[planner] ▶ planning media strategy for arc="${arcName}", blocks: ${blockSummary}`);

  let strategy: MediaStrategy;
  try {
    const strategyRaw = await callAI([
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

Guidelines:
- Real people, real products, real places, news events → web_search or auto
- Abstract concepts, mood shots, artistic visuals, fictional scenes → ai_generation
- Software tutorials with UI → autoScreenshot: true, searchQueryStyle: "screenshot"
- Biographies: portrait/photo shots = web_search, mood/artistic = ai_generation
- Mixed topics (e.g. documentary): some blocks web_search, some ai_generation
- News/event_recap → needsNewsSearch: true
- Creative fiction, motivational quotes, hypothetical scenarios → needsResearch: false, all blocks ai_generation
- "auto" means: try web search first, if nothing good found, fall back to AI generation
- "video" block type → ALWAYS use ai_generation (videos are generated by AI, not searched)
- imageSource only affects IMAGE fields — video blocks have no image fields, so set ai_generation for them

Return valid JSON only, no markdown wrapping.`,
      },
      {
        role: 'user',
        content: `Topic: "${state.userStory}"
Arc: ${arcName || 'not yet selected'}
Blocks: ${blockSummary}

Produce the media strategy JSON.`,
      },
    ], state.apiKey, 800, state.model);

    strategy = parseJSON(strategyRaw) as MediaStrategy;
    console.log(`[planner] ✅ strategy: topicType=${strategy.topicType}, needsResearch=${strategy.needsResearch}, needsNews=${strategy.needsNewsSearch}`);
    strategy.blockStrategies.forEach(bs => {
      console.log(`  [${bs.blockIndex}] ${bs.blockType}: ${bs.imageSource} (${bs.searchQueryStyle ?? 'n/a'}) — ${bs.reasoning}`);
    });
  } catch (e: any) {
    console.error(`[planner] ❌ strategy LLM failed: ${e.message}, using fallback`);
    strategy = {
      needsResearch: false,
      needsNewsSearch: false,
      researchQueries: [],
      topicType: 'creative',
      blockStrategies: state.templateBlocks.map((b, i) => ({
        blockIndex: i,
        blockType: b.type,
        imageSource: 'ai_generation' as const,
        searchQueryStyle: null,
        autoScreenshot: false,
        minWidth: 800,
        reasoning: 'fallback — planner failed',
      })),
    };
  }

  let researchContext = '';
  if (strategy.needsResearch) {
    try {
      const parts: string[] = [];

      if (strategy.needsNewsSearch) {
        const news = await searchNews(state.userStory);
        if (news.length > 0) {
          parts.push('RECENT NEWS:\n' + news.map(n => `- ${n.title}: ${n.snippet} (${n.date})`).join('\n'));
        }
      }

      const queries = strategy.researchQueries.length > 0
        ? strategy.researchQueries
        : [state.userStory];
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

async function directorAgent(state: VideoGenStateType) {
  const loopCount = ((state as any).directorLoopCount ?? 0) + 1;
  console.log(`[director_agent] ▶ attempt ${loopCount}`);

  const arcCatalogMerged: Record<string, ArcPattern> = { ...ARC_PATTERNS, ...state.arcPatternCatalog };
  const styleCatalogMerged = { ...VISUAL_STYLE_PRESETS, ...state.visualStyleCatalog };

  let arc: ArcPattern | null = state.selectedArc ?? null;

  if (!arc && (state as any).preferredArc) {
    arc = arcCatalogMerged[(state as any).preferredArc] ?? null;
    if (arc) console.log(`[director_agent] using preferred arc: "${arc.name}"`);
  }

  // Custom arc from MCP: Claude defines roles + tone directly, bypassing the preset catalog
  const customArc = (state as any).customArc as { roles: string[]; defaultTone: string } | null;
  if (customArc?.roles?.length) {
    arc = { name: 'custom', description: 'Claude-defined custom arc', roles: customArc.roles, defaultTone: customArc.defaultTone };
    console.log(`[director_agent] 🎨 using custom arc from MCP: ${arc.roles.join(' → ')}`);
  }

  const blockTypes = state.templateBlocks.map(b => b.type).join(', ');

  let arcInstruction: string;
  if (arc) {
    const roles = fitRolesToBlocks(arc.roles, state.templateBlocks.length);
    const blockList = state.templateBlocks
      .map((b, i) => `  Block ${i + 1} (${b.type}): role = "${roles[i]}"`)
      .join('\n');
    arcInstruction = `SELECTED ARC: "${arc.name}"
ARC DESCRIPTION: ${arc.description}
OVERALL TONE: ${arc.defaultTone}

Block sequence with assigned roles:
${blockList}

Return a JSON object with:
{
  "selectedArc": "${arc.name}",
  "narrativePlan": [ ...exactly ${state.templateBlocks.length} brief objects... ]
}`;
  } else {
    const arcCatalog = Object.values(arcCatalogMerged)
      .map(a => `- "${a.name}": ${a.description} (tone: ${a.defaultTone})`)
      .join('\n');
    arcInstruction = `AVAILABLE ARCS (pick the best one for this story):
${arcCatalog}

Block types in this video (${state.templateBlocks.length} blocks): ${blockTypes}

First choose the best arc, then assign its roles to blocks using the arc's role sequence.

Return a JSON object with:
{
  "selectedArc": "<arc_name you chose>",
  "reason": "<one sentence why>",
  "narrativePlan": [ ...exactly ${state.templateBlocks.length} brief objects... ]
}`;
  }

  const feedback = (state as any).engagementFeedback;
  const feedbackSection = feedback
    ? `\n\nPREVIOUS ATTEMPT FEEDBACK (you MUST address these issues):
${feedback}

Your previous scripts were scored ${(state as any).engagementScore}/10. Fix the specific issues above.
Do NOT simply add more adjectives — rewrite the angles, key messages, and scripts
to address the structural feedback. Make it GRIPPING.`
    : '';

  const researchSection = (state as any).researchContext
    ? `\n\nWEB RESEARCH (current facts — prefer these over your training data):\n${(state as any).researchContext}`
    : '';

  const presetStyle = (state as any).preferredVisualStyle && (state as any).preferredVisualStyle !== 'custom'
    ? styleCatalogMerged[(state as any).preferredVisualStyle]
    : null;
  const customPrompt = (state as any).customVisualPrompt;

  const visualStyleInstruction = presetStyle
    ? `The user selected visual style: "${presetStyle.name}". Base prompt: "${presetStyle.promptPrefix}".
Your visualStyleGuide MUST start with this base prompt, then ADD character/setting descriptions specific to this story.`
    : customPrompt
      ? `The user described their desired visual style: "${customPrompt}".
Your visualStyleGuide MUST incorporate this description as the foundation, then ADD character/setting descriptions specific to this story.`
      : `Choose a visual style that best fits this story.`;

  const lensMenu = (Object.entries(CONSISTENCY_LENS_CONFIGS) as [ConsistencyLens, ConsistencyLensConfig][])
    .map(([key, cfg]) => `- "${key}": ${cfg.description} Use when: ${cfg.whenToSelect}`)
    .join('\n');

  const lensConditionals = (Object.entries(CONSISTENCY_LENS_CONFIGS) as [ConsistencyLens, ConsistencyLensConfig][])
    .map(([key, cfg]) =>
      `IF you select "${key}":\n  visualStyleGuide must include: ${cfg.visualStyleDirective}\n  storyBible must include: ${cfg.storyBibleDirective}`
    )
    .join('\n\n');

  const lensSection = `
CONSISTENCY LENSES — pick 1-3 that apply to THIS specific topic (not just the arc name):
${lensMenu}

${lensConditionals}

Return your chosen lenses as: "selectedLenses": ["lens1", ...]
`;

  try {
    const response = await callAI([
      {
        role: 'system',
        content: `You are a world-class video director and storyteller. Plan a coherent, emotionally
GRIPPING narrative arc across all blocks — like a director planning each shot in a film
that will go viral.

IMPORTANT — CHECK FOR EXPLICIT USER SCENES FIRST:
Read the Story/Topic below carefully. If it contains scene-by-scene descriptions (e.g. "Scene 1: ..., Scene 2: ...", "Block 1: ...", numbered scenes like "1. ..., 2. ...", or clearly distinct per-block instructions separated by line breaks or markers), then:
- You are in FAITHFUL EXECUTION MODE, not creative mode
- Your job is to MAP each user scene to exactly one block, preserving the user's exact intent
- Use the user's exact scene text as the \`spokenScript\` for that block — do NOT rewrite or rephrase it
- Use the user's scene description as the \`angle\` and \`keyMessage\`
- Use the user's visual description as \`visualMood\` — do not override with your own mood
- DO NOT add dramatic hooks, storytelling tension, or cinematic techniques that contradict or replace the user's scenes
- The user's words are the final authority — your role is faithful execution, not creative interpretation
If the story does NOT contain explicit per-block scene descriptions (it reads like a general topic, concept, or narrative idea), proceed with full creative direction below.

${arcInstruction}

Each narrativePlan entry must have:
- narrativeRole: the role from the arc
- angle: the SPECIFIC, CONCRETE aspect of the story THIS block covers (names, numbers, moments — NOT vague)
- tone: emotional tone (inspiring | intense | factual | emotional | humorous | dramatic | calm | urgent)
- keyMessage: the ONE powerful sentence this block must communicate
- visualMood: visual direction (lighting, setting, color palette, mood)
- spokenScript: the ACTUAL narration text to be spoken aloud via TTS (write it as if you're speaking directly to the viewer — conversational, punchy, emotional. NOT essay prose.)
- transitionIn: how this connects FROM the previous block (first block: "opening shot")
- transitionOut: how this leads INTO the next (last block: "closing call to action")

CRITICAL RULES:
- spokenScript must be the REAL narration — written for the ear, not the eye
- Each block covers a UNIQUE angle — zero repetition
- The emotional arc must EVOLVE (not stay flat)
- Start with a HOOK that grabs in 2 seconds
- End with a STRONG call to action or memorable closer

STORYTELLING TECHNIQUES for spokenScript:
- HOOK: Open with a question, a shocking stat, or a "what if" — never a bland topic statement
- SPECIFICITY: Replace "he succeeded" with "he scored 183 off 148 balls in 43°C heat"
- SENSORY LANGUAGE: Include what you see, hear, feel — not abstractions
- TENSION: Every block needs a micro-conflict or unanswered question pulling to the next
- CONVERSATIONAL: Write like telling a friend. Use "you", contractions, fragments.
- PACING: Short sentences for drama. Longer ones to build. Then punch.
${lensSection}
${visualStyleInstruction}

Also return these three fields alongside narrativePlan:
- "visualStyleGuide": A reusable visual prompt prefix (under 100 words) prepended to EVERY image description for visual consistency. Follow the IF-you-select directives above for your chosen lenses — they specify exactly what this guide must include.
- "storyBible": A shared context doc (under 150 words) that every block's content generator will see. Follow the IF-you-select directives above for your chosen lenses — they specify exactly what to capture here.
- "selectedLenses": Array of the consistency lens names you chose (e.g. ["character", "concept"]). Can be empty [] if none apply.${feedbackSection}${researchSection}
${state.language !== 'en' ? `\nLANGUAGE: ALL spokenScript, keyMessage, and angle fields MUST be written in ${languageName(state.language)}. Internal fields (narrativeRole, transitionIn, transitionOut, visualMood) stay in English.` : ''}
No markdown wrapping. Return valid JSON only.`,
      },
      {
        role: 'user',
        content: `Story/Topic: "${state.userStory}"

${arc ? `Arc tone: ${arc.defaultTone}` : 'Pick the best arc and plan the narrative.'}

Plan ${state.templateBlocks.length} blocks. Make every second count — this needs to GRIP the viewer.`,
      },
    ], state.apiKey, 3000, state.model);

    const parsed = parseJSON(response);

    let resolvedArc = arc;
    if (!resolvedArc && parsed.selectedArc) {
      resolvedArc = arcCatalogMerged[parsed.selectedArc] ?? arcCatalogMerged['documentary'] ?? ARC_PATTERNS['documentary'];
      console.log(`[director_agent] AI selected arc: "${resolvedArc.name}" — ${parsed.reason || ''}`);
    }
    if (!resolvedArc) resolvedArc = arcCatalogMerged['documentary'] ?? ARC_PATTERNS['documentary'];

    let plan: NarrativeBrief[] = parsed.narrativePlan ?? parsed;
    if (!Array.isArray(plan)) plan = [];
    if (plan.length > state.templateBlocks.length) {
      console.warn(`[director_agent] ⚠️ plan length ${plan.length} > templateBlocks ${state.templateBlocks.length} — truncating`);
      plan = plan.slice(0, state.templateBlocks.length);
    }
    if (plan.length < state.templateBlocks.length) {
      console.warn(`[director_agent] ⚠️ plan length ${plan.length} < templateBlocks ${state.templateBlocks.length} — padding with fallbacks`);
      const padRoles = fitRolesToBlocks(resolvedArc.roles, state.templateBlocks.length);
      while (plan.length < state.templateBlocks.length) {
        const i = plan.length;
        plan.push({
          narrativeRole: padRoles[i],
          angle: `Aspect ${i + 1} of ${state.userStory}`,
          tone: i === 0 ? 'hook' : i === state.templateBlocks.length - 1 ? 'urgent' : 'engaging',
          keyMessage: `Block ${i + 1} [${padRoles[i]}]: Cover a unique angle of ${state.userStory}`,
          visualMood: 'cinematic, high contrast, dramatic lighting',
          spokenScript: `This is the moment ${state.userStory} becomes impossible to ignore. Watch closely, because every detail is building toward the point.`,
          transitionIn: i === 0 ? 'opening shot' : 'continues from previous block',
          transitionOut: i === state.templateBlocks.length - 1 ? 'closing call to action' : 'leads into next block',
        });
      }
    }

    const visualStyleGuide = typeof parsed.visualStyleGuide === 'string'
      ? parsed.visualStyleGuide
      : parsed.visualStyleGuide
        ? JSON.stringify(parsed.visualStyleGuide)
        : '';
    const storyBible = typeof parsed.storyBible === 'string'
      ? parsed.storyBible
      : parsed.storyBible
        ? JSON.stringify(parsed.storyBible)
        : '';

    console.log(`[director_agent] ✅ arc="${resolvedArc.name}" attempt=${loopCount}`);
    plan.forEach((p, i) => {
      console.log(`  Block ${i + 1} (${state.templateBlocks[i]?.type}): [${p.narrativeRole}] ${p.keyMessage}`);
    });

    console.log(`[director_agent] 🎨 visualStyleGuide: ${visualStyleGuide.slice(0, 100)}`);
    console.log(`[director_agent] 📖 storyBible: ${storyBible.slice(0, 100)}`);

    const parsedLenses = ((parsed.selectedLenses ?? []) as string[])
      .filter((l): l is ConsistencyLens => l in CONSISTENCY_LENS_CONFIGS);
    console.log(`[director_agent] 🔍 selectedLenses: ${parsedLenses.join(', ') || '(none)'}`);

    return {
      selectedArc: resolvedArc,
      narrativePlan: plan,
      directorLoopCount: loopCount,
      visualStyleGuide,
      storyBible,
      selectedLenses: parsedLenses,
    };
  } catch (e: any) {
    console.warn('[director_agent] ⚠️ failed, using fallback plan:', e.message);
    const fallbackArc = arc ?? arcCatalogMerged['documentary'] ?? ARC_PATTERNS['documentary'];
    const roles = fitRolesToBlocks(fallbackArc.roles, state.templateBlocks.length);

    const fallback: NarrativeBrief[] = state.templateBlocks.map((b, i) => ({
      narrativeRole: roles[i],
      angle:         `Aspect ${i + 1} of ${state.userStory}`,
      tone:          i === 0 ? 'hook' : i === state.templateBlocks.length - 1 ? 'urgent' : 'engaging',
      keyMessage:    `Block ${i + 1} [${roles[i]}]: Cover a unique angle of ${state.userStory}`,
      visualMood:    'cinematic, high contrast, dramatic lighting',
      spokenScript:  'natural, engaging narration that builds on the previous block',
      transitionIn:  i === 0 ? 'opening shot' : 'continues from previous block',
      transitionOut: i === state.templateBlocks.length - 1 ? 'closing call to action' : 'leads into next block',
    }));

    return {
      selectedArc: fallbackArc,
      narrativePlan: fallback,
      directorLoopCount: loopCount,
      selectedLenses: [],
    };
  }
}

const ENGAGEMENT_THRESHOLD = 7.0;
const MAX_DIRECTOR_LOOPS   = 3;

async function evaluateEngagement(state: VideoGenStateType) {
  // Skip engagement evaluation — always pass to avoid burning tokens.
  // The director already produces good output; re-running based on a second
  // AI evaluation rarely improves quality and wastes 3x tokens per loop.
  console.log('[evaluateEngagement] skipped (always pass)');
  return { engagementScore: ENGAGEMENT_THRESHOLD, engagementFeedback: '' };
}

function routeAfterEngagement(state: VideoGenStateType): string {
  // Always pass — skip the engagement evaluation loop to avoid burning tokens.
  // The director already produces good output; re-running it based on a second
  // AI evaluation rarely improves quality and wastes 3x tokens per loop.
  return 'review_story';
}

function mergeParallaxLayers(filledBlock: Record<string, any>, originalBlock: Record<string, any>): Record<string, any> {
  if (filledBlock.type !== 'parallax-story') return filledBlock;
  if (!Array.isArray(originalBlock.layers)) return filledBlock;

  const aiLayers: any[] = Array.isArray(filledBlock.layers) ? filledBlock.layers : [];

  // Always iterate over template layers to preserve the full layer count.
  // If the AI returned fewer layers than the template, the remaining template
  // layers are kept as-is (the image description will be reused from the template
  // or left blank — better than silently dropping layers).
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

async function fillBlockWithCurrentTools(params: {
  block: Record<string, any>;
  blockIndex: number;
  userStory: string;
  apiKey: string;
  model: string;
  narrativeBrief: NarrativeBrief | null;
  preferredVoice: string | null;
  language: string;
  visualStyleGuide: string;
  storyBible: string;
  arcName: string;
  selectedLenses: ConsistencyLens[];
  researchContext: string;
  mediaStrategy: MediaStrategy | null;
  aspectRatio: string;
  resolveAudioNow: boolean;
}): Promise<{
  finalBlock: Record<string, any>;
  imageItems: WizardImageItem[];
  videoItems: WizardVideoItem[];
  error: string | null;
}> {
  const {
    block,
    blockIndex,
    userStory,
    apiKey,
    model,
    narrativeBrief,
    preferredVoice,
    language,
    visualStyleGuide,
    storyBible,
    arcName,
    selectedLenses,
    researchContext,
    mediaStrategy,
    aspectRatio,
    resolveAudioNow,
  } = params;

  let workingBlock = block;
  let schemaDescriptions: Record<string, string> | undefined;

  if (workingBlock.type === 'custom-plugin') {
    const pluginMeta = await fillCustomPluginBlock(workingBlock, narrativeBrief, userStory, apiKey, model);
    workingBlock = { ...workingBlock, ...pluginMeta.rawContent, generationFields: pluginMeta.generationFields };
    schemaDescriptions = pluginMeta.schemaDescriptions;
  }

  const generation = await generateContentTool({
    blockType: workingBlock.type,
    blockIndex,
    userStory,
    originalBlock: workingBlock,
    narrativeBrief,
    visualStyleGuide,
    storyBible,
    arcName,
    selectedLenses,
    researchContext,
    mediaStrategy,
    aspectRatio,
    language,
    apiKey,
    model,
    preferredVoice,
    schemaDescriptions,
  });

  if (generation.error) {
    return { finalBlock: block, imageItems: [], videoItems: [], error: generation.error };
  }

  const classified = await classifyMediaFieldsTool({
    rawContent: generation.rawContent,
    blockType: workingBlock.type,
    originalBlock: workingBlock,
    narrativeBrief,
    mediaStrategy,
    blockIndex,
  });

  const effectiveRawContent = classified.rawContent ?? generation.rawContent;
  const [imageResult, audioResult, videoResult] = await Promise.all([
    resolveImagesTool({
      imageFields: classified.imageFields,
      rawContent: effectiveRawContent,
      blockIndex,
      blockType: workingBlock.type,
      mediaStrategy,
      visualStyleGuide,
      apiKey,
    }),
    resolveAudioNow
      ? resolveAudioTool({ audioFields: classified.audioFields, preferredVoice, blockIndex })
      : Promise.resolve({ resolvedAudio: {} as Record<string, string> }),
    resolveVideoTool({ videoFields: classified.videoFields, rawContent: effectiveRawContent, blockIndex }),
  ]);

  const resolvedUrls = { ...imageResult.resolvedUrls, ...videoResult.resolvedUrls };
  const { finalBlock } = await mergeBlockTool({
    rawContent: effectiveRawContent,
    resolvedUrls,
    resolvedAudio: audioResult.resolvedAudio,
    originalBlock: workingBlock,
    blockType: workingBlock.type,
    blockIndex,
    narrativeBrief,
  });

  const imageItems: WizardImageItem[] = Object.entries(imageResult.resolvedUrls).map(([path, url]) => {
    const imageField = classified.imageFields.find((field) => field.path === path);
    return {
      blockIdx: blockIndex,
      fieldPath: path,
      url,
      description: imageField?.description ?? '',
      removeBackground: imageField?.removeBackground ?? false,
    };
  });

  const videoItems: WizardVideoItem[] = classified.videoFields.map(({ path, prompt }) => ({
    blockIdx: blockIndex,
    fieldPath: path,
    url: '',
    description: prompt,
  }));

  return {
    finalBlock: mergeParallaxLayers(finalBlock, block),
    imageItems,
    videoItems,
    error: null,
  };
}

async function fillBlocksParallel(state: VideoGenStateType) {
  console.log(`[fill_blocks_parallel] ▶ processing ${state.templateBlocks.length} blocks in parallel`);

  const errors: string[] = [];

  const filledBlocks = await Promise.all(
    state.templateBlocks.map(async (block, i) => {
      const narrativeBrief = state.narrativePlan?.[i] ?? null;

      console.log(`[fill_blocks_parallel] block ${i + 1} (${block.type}) role: ${narrativeBrief?.narrativeRole} — ${narrativeBrief?.keyMessage}`);

      try {
        const result = await fillBlockWithCurrentTools({
          block,
          blockIndex: i,
          userStory: state.userStory,
          apiKey: state.apiKey,
          model: state.model,
          narrativeBrief,
          preferredVoice: state.preferredVoice,
          language: state.language,
          visualStyleGuide: state.visualStyleGuide,
          storyBible: state.storyBible,
          arcName: state.selectedArc?.name ?? '',
          selectedLenses: state.selectedLenses ?? [],
          researchContext: state.researchContext ?? '',
          mediaStrategy: state.mediaStrategy ?? null,
          aspectRatio: state.videoMeta?.aspectRatio ?? '9:16',
          resolveAudioNow: true,
        });

        if (result.error) {
          errors.push(`Block ${i + 1} (${block.type}): ${result.error}`);
          return block;
        }

        return result.finalBlock;
      } catch (e: any) {
        errors.push(`Block ${i + 1} (${block.type}): ${e.message}`);
        return block;
      }
    })
  );

  return { filledBlocks, errors };
}

async function assemblePayload(state: VideoGenStateType) {
  console.log('[assemble_payload] ▶ building final payload');

  const finalPayload = {
    videoMeta:     state.videoMeta,
    contentBlocks: await applyBlockPostProcessors(state.filledBlocks, state.templateBlocks, state.videoMeta),
  };

  console.log('✅ Payload assembled:');
  console.log(`   arc         : ${state.selectedArc?.name ?? 'unknown'}`);
  console.log(`   aspectRatio : ${state.videoMeta.aspectRatio}`);
  console.log(`   theme       : ${state.videoMeta.theme}`);
  console.log(`   fps         : ${state.videoMeta.fps}`);
  console.log(`   blocks      : ${state.filledBlocks.length}`);
  console.log('📦 Generated blocks:');
  state.filledBlocks.forEach((block, i) => {
    const role = state.narrativePlan?.[i]?.narrativeRole ?? '?';
    console.log(`   Block ${i + 1} [${block.type}] (${role}):`, JSON.stringify(block, null, 2));
  });

  return { finalPayload };
}

// ============================================================================
// OUTER GRAPH ASSEMBLY
// ============================================================================

const videoGenGraph = new StateGraph(VideoGenState)
  .addNode('enrich_video_meta',    enrichVideoMeta)
  .addNode('select_arc',           selectArc)
  .addNode('director_agent',       directorAgent)
  .addNode('fill_blocks_parallel', fillBlocksParallel)
  .addNode('assemble_payload',     assemblePayload)

  .addEdge('__start__',            'enrich_video_meta')
  .addEdge('enrich_video_meta',    'select_arc')
  .addNode('planner',              plannerNode)
  .addEdge('select_arc',           'planner')
  .addEdge('planner',              'director_agent')
  .addEdge('director_agent',       'fill_blocks_parallel')
  .addEdge('fill_blocks_parallel', 'assemble_payload')
  .addEdge('assemble_payload',     '__end__')
  .compile();

// ============================================================================
// WIZARD — shared types
// ============================================================================

export interface WizardNarrativeBrief {
  narrativeRole: string;
  angle:         string;
  tone:          string;
  keyMessage:    string;
  visualMood:    string;
  spokenScript:  string;
  transitionIn:  string;
  transitionOut: string;
}

export interface WizardImageItem {
  blockIdx:         number;
  fieldPath:        string;
  url:              string;
  description:      string;
  removeBackground: boolean;
}

export interface WizardVideoItem {
  blockIdx:    number;
  fieldPath:   string;
  url:         string;
  description: string;
}

// ============================================================================
// WIZARD GRAPH
// ============================================================================

const WizardState = Annotation.Root({
  userStory:        Annotation<string>(),
  apiKey:           Annotation<string>(),
  model:            Annotation<string>(),
  preferredArc:          Annotation<string | null>({ default: () => null,  reducer: (_, v) => v }),
  preferredVoice:        Annotation<string | null>({ default: () => null,  reducer: (_, v) => v }),
  preferredVisualStyle:  Annotation<string | null>({ default: () => null,  reducer: (_, v) => v }),
  customVisualPrompt:    Annotation<string | null>({ default: () => null,  reducer: (_, v) => v }),
  customArc:             Annotation<{ roles: string[]; defaultTone: string } | null>({ default: () => null, reducer: (_, v) => v }),
  language:              Annotation<string>({ default: () => 'en', reducer: (_, v) => v }),
  templateBlocks:        Annotation<Array<{ type: string; [key: string]: any }>>({ default: () => [], reducer: (_, v) => v }),
  partialVideoMeta:      Annotation<Record<string, any>>({ default: () => ({}), reducer: (_, v) => v }),

  videoMeta:         Annotation<Record<string, any>>({ default: () => ({}), reducer: (_, v) => v }),
  selectedArc:       Annotation<ArcPattern | null>({ default: () => null,  reducer: (_, v) => v }),
  narrativePlan:     Annotation<NarrativeBrief[]>({ default: () => [],  reducer: (_, v) => v }),
  visualStyleGuide:  Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  storyBible:        Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  selectedLenses:    Annotation<ConsistencyLens[]>({ default: () => [], reducer: (_, v) => v }),
  researchContext:   Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  mediaStrategy:     Annotation<MediaStrategy | null>({ default: () => null, reducer: (_, v) => v }),

  blocksWithImages: Annotation<Record<string, any>[]>({ default: () => [], reducer: (_, v) => v }),
  imageItems:       Annotation<WizardImageItem[]>({ default: () => [],     reducer: (_, v) => v }),
  videoItems:       Annotation<WizardVideoItem[]>({ default: () => [],     reducer: (_, v) => v }),

  filledBlocks: Annotation<Record<string, any>[]>({ default: () => [], reducer: (_, v) => v }),
  finalPayload: Annotation<Record<string, any>>({ default: () => ({}), reducer: (_, v) => v }),

  errors: Annotation<string[]>({ default: () => [], reducer: (existing, incoming) => [...existing, ...incoming] }),

  engagementScore:    Annotation<number>({ default: () => 0, reducer: (_, v) => v }),
  engagementFeedback: Annotation<string>({ default: () => '', reducer: (_, v) => v }),
  directorLoopCount:  Annotation<number>({ default: () => 0, reducer: (_, v) => v }),
});

type WizardStateType = typeof WizardState.State;

async function reviewStoryNode(state: WizardStateType) {
  const humanInput = interrupt({
    type:             'review_story',
    narrativePlan:    state.narrativePlan,
    videoMeta:        state.videoMeta,
    selectedArc:      (state.selectedArc as ArcPattern | null)?.name ?? 'documentary',
    engagementScore:  (state as any).engagementScore ?? 0,
    visualStyleGuide: state.visualStyleGuide ?? '',
    storyBible:       state.storyBible ?? '',
  });

  const editedScripts: Record<number, string> = (humanInput as any)?.editedScripts ?? {};
  const updatedPlan = state.narrativePlan.map((brief, i) =>
    editedScripts[i] !== undefined ? { ...brief, spokenScript: editedScripts[i] } : brief
  );
  return { narrativePlan: updatedPlan };
}

async function fillBlocksImagesNode(state: WizardStateType) {
  const errors: string[] = [];
  const allImageItems: WizardImageItem[] = [];
  const allVideoItems: WizardVideoItem[] = [];

  const blocksWithImages = await Promise.all(
    state.templateBlocks.map(async (block, i) => {
      const brief = (state.narrativePlan[i] ?? null) as NarrativeBrief | null;
      try {
        const result = await fillBlockWithCurrentTools({
          block,
          blockIndex: i,
          userStory: state.userStory,
          apiKey: state.apiKey,
          model: state.model,
          narrativeBrief: brief,
          preferredVoice: state.preferredVoice,
          language: state.language,
          visualStyleGuide: state.visualStyleGuide ?? '',
          storyBible: state.storyBible ?? '',
          arcName: (state.selectedArc as ArcPattern | null)?.name ?? '',
          selectedLenses: state.selectedLenses ?? [],
          researchContext: state.researchContext ?? '',
          mediaStrategy: state.mediaStrategy ?? null,
          aspectRatio: state.videoMeta?.aspectRatio ?? '9:16',
          resolveAudioNow: false,
        });

        if (result.error) {
          errors.push(`Block ${i + 1} (${block.type}): ${result.error}`);
          return block;
        }

        allImageItems.push(...result.imageItems);
        allVideoItems.push(...result.videoItems);
        return result.finalBlock;
      } catch (e: any) {
        errors.push(`Block ${i + 1} (${block.type}): ${e.message}`);
        return block;
      }
    })
  );

  return { blocksWithImages, imageItems: allImageItems, videoItems: allVideoItems, errors };
}

async function reviewImagesNode(state: WizardStateType) {
  const humanInput = interrupt({
    type:             'review_images',
    imageItems:       state.imageItems,
    videoItems:       state.videoItems,
    blocks:           state.blocksWithImages,
    visualStyleGuide: state.visualStyleGuide ?? '',
  });

  const updatedBlocks = (humanInput as any)?.updatedBlocks ?? state.blocksWithImages;
  return { blocksWithImages: updatedBlocks };
}

async function generateAudioNode(state: WizardStateType) {
  const errors: string[] = [];

  const filledBlocks = await Promise.all(
    state.blocksWithImages.map(async (block) => {
      const audioFields = extractAudioFields(block);

      if (audioFields.length === 0) return block;

      let updated = { ...block };
      for (const { path, text } of audioFields) {
        if (text && !text.startsWith('data:') && !text.startsWith('http')) {
          try {
            const audio = await generateAudio(text, state.preferredVoice ?? undefined);
            if (audio) updated = setNestedValue(updated, path, audio);
          } catch (e: any) {
            errors.push(`Block audio (${path}): ${e.message}`);
          }
        }
      }
      return updated;
    })
  );

  return { filledBlocks, errors };
}

async function reviewAudioNode(state: WizardStateType) {
  const audioItems = (state.filledBlocks ?? []).map((block: any, idx: number) => {
    const audioSrc = block.audioSrc ?? '';
    const hasAudio = audioSrc.startsWith('data:') || audioSrc.startsWith('http');
    return {
      blockIdx:      idx,
      narrativeRole: block.narrativeRole ?? block.role ?? `block_${idx}`,
      hasAudio,
      audioUrl:      hasAudio ? audioSrc : '',
      script:        block.spokenScript ?? (!hasAudio ? audioSrc : '') ?? '',
    };
  });

  const humanInput = interrupt({
    type:       'review_audio',
    audioItems,
    blocks:     state.filledBlocks,
  });

  const updatedBlocks = (humanInput as any)?.updatedBlocks ?? state.filledBlocks;
  return { filledBlocks: updatedBlocks };
}

// ============================================================================
// WIZARD POST-PROCESSING PIPELINE
// ============================================================================

interface BlockPostProcessorCtx {
  originalBlock: any;
  videoMeta:     any;
  index:         number;
}
type BlockPostProcessor = (block: any, ctx: BlockPostProcessorCtx) => any | Promise<any>;

function postProcessParallaxLayers(block: any, { originalBlock }: BlockPostProcessorCtx): any {
  return mergeParallaxLayers(block, originalBlock);
}

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

const WORDS_PER_SECOND = 2.1;
const AUDIO_TAIL_SECS  = 2.0;

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

async function assembleWizardPayload(state: WizardStateType) {
  const contentBlocks = await applyBlockPostProcessors(state.filledBlocks, state.templateBlocks, state.videoMeta);
  return {
    finalPayload: {
      videoMeta:     state.videoMeta,
      contentBlocks,
    },
  };
}

let _wizardGraph: any = null;

async function getWizardGraph(): Promise<any> {
  if (_wizardGraph) return _wizardGraph;

  const { PostgresSaver } = await import('@langchain/langgraph-checkpoint-postgres');
  const { Pool } = await import('pg');
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  const checkpointer = new PostgresSaver(pool);
  await checkpointer.setup();

  _wizardGraph = new StateGraph(WizardState)
    .addNode('enrich_video_meta',    (s: WizardStateType) => enrichVideoMeta(s as any))
    .addNode('director_agent',       (s: WizardStateType) => directorAgent(s as any))
    .addNode('evaluate_engagement',  (s: WizardStateType) => evaluateEngagement(s as any))
    .addNode('review_story',         reviewStoryNode)
    .addNode('fill_blocks_images',   fillBlocksImagesNode)
    .addNode('review_images',        reviewImagesNode)
    .addNode('generate_audio',       generateAudioNode)
    .addNode('review_audio',         reviewAudioNode)
    .addNode('assemble_payload',     assembleWizardPayload)
    .addNode('planner',              (s: WizardStateType) => plannerNode(s as any))
    .addEdge('__start__',            'enrich_video_meta')
    .addEdge('enrich_video_meta',    'planner')
    .addEdge('planner',       'director_agent')
    .addEdge('director_agent',       'evaluate_engagement')
    .addConditionalEdges('evaluate_engagement', (s: WizardStateType) => routeAfterEngagement(s as any), {
      review_story:   'review_story',
      director_agent: 'director_agent',
    })
    .addEdge('review_story',         'fill_blocks_images')
    .addEdge('fill_blocks_images',   'review_images')
    .addEdge('review_images',        'generate_audio')
    .addEdge('generate_audio',       'review_audio')
    .addEdge('review_audio',         'assemble_payload')
    .addEdge('assemble_payload',     '__end__')
    .compile({ checkpointer });

  return _wizardGraph;
}

export type WizardResult = {
  status:          'interrupted' | 'complete';
  interrupt?:      Record<string, any>;
  payload?:        Record<string, any>;
  stateSnapshot?:  Record<string, any>;
  tokensUsed:      number;
};

async function runWizardStep(invokeArg: any, threadId: string): Promise<WizardResult> {
  const tokenAccumulator = { total: 0 };
  const graph  = await getWizardGraph();
  const config = { configurable: { thread_id: threadId } };

  await tokenStore.run(tokenAccumulator, () => graph.invoke(invokeArg, config));

  const snapshot    = await graph.getState(config);
  const interrupted = (snapshot.next ?? []).length > 0;

  if (interrupted) {
    const allInterrupts: any[] = [];
    for (const task of (snapshot.tasks ?? [])) {
      for (const ir of ((task as any).interrupts ?? [])) {
        allInterrupts.push(ir.value);
      }
    }
    return { status: 'interrupted', interrupt: allInterrupts[0], stateSnapshot: snapshot.values as any, tokensUsed: tokenAccumulator.total };
  }

  return {
    status:        'complete',
    payload:       snapshot.values.finalPayload as any,
    stateSnapshot: snapshot.values as any,
    tokensUsed:    tokenAccumulator.total,
  };
}

export async function startWizard(
  threadId: string,
  input: {
    userStory:        string;
    templateBlocks:   Array<{ type: string; [key: string]: any }>;
    partialVideoMeta: Record<string, any>;
    preferredArc:          string | null;
    preferredVoice:        string | null;
    preferredVisualStyle:  string | null;
    customVisualPrompt:    string | null;
    customArc:             { roles: string[]; defaultTone: string } | null;
    language:              string;
    apiKey:                string;
    model:                 string;
  },
): Promise<WizardResult> {
  return runWizardStep(input, threadId);
}

export async function resumeWizard(
  threadId:     string,
  value:        any,
  freshApiKey?: string,
): Promise<WizardResult> {
  if (freshApiKey) {
    const graph  = await getWizardGraph();
    const config = { configurable: { thread_id: threadId } };
    await graph.updateState(config, { apiKey: freshApiKey });
  }
  return runWizardStep(new Command({ resume: value }), threadId);
}

// ============================================================================
// PUBLIC API
// ============================================================================

export interface GenerateVideoPayloadResult {
  success:     boolean;
  selectedArc: string;
  payload: {
    videoMeta:     Record<string, any>;
    contentBlocks: Record<string, any>[];
  };
  errors:      string[];
  tokensUsed:  number;
}

export async function generateVideoPayload(
  userStory:        string,
  templateBlocks:   Array<{ type: string; [key: string]: any }>,
  partialVideoMeta: Record<string, any>,
  apiKey:           string,
  model:            string = DEFAULT_AI_MODEL,
  preferredArc:          string | null = null,
  preferredVoice:        string | null = null,
  preferredVisualStyle:  string | null = null,
  customVisualPrompt:    string | null = null,
): Promise<GenerateVideoPayloadResult> {
  console.log('🎬 Starting video payload generation...');
  console.log(`   Story        : "${userStory.slice(0, 60)}..."`);
  console.log(`   Blocks       : ${templateBlocks.length} (${templateBlocks.map(b => b.type).join(', ')})`);
  console.log(`   Meta         : ${JSON.stringify(partialVideoMeta)}`);
  console.log(`   Model        : ${model}`);
  console.log(`   API Key      : ${apiKey?.slice(0, 10)}... (length: ${apiKey?.length})`);
  console.log(`   Preferred arc: ${preferredArc ?? 'auto-select'}`);

  if (templateBlocks.length === 0) {
    return {
      success:     false,
      selectedArc: 'none',
      payload:     { videoMeta: partialVideoMeta, contentBlocks: [] },
      errors:      ['No template blocks provided'],
      tokensUsed:  0,
    };
  }

  let arcPatternCatalog: Record<string, ArcPattern> = {};
  let visualStyleCatalog: Record<string, { name: string; promptPrefix: string }> = {};
  try {
    const [arcRows, styleRows] = await Promise.all([
      db.query('SELECT id, label, description, arc_pattern FROM story_arcs WHERE is_active = true'),
      db.query('SELECT id, label, prompt_prefix FROM visual_styles WHERE is_active = true'),
    ]);
    for (const row of arcRows.rows) {
      if (row.arc_pattern?.roles && row.arc_pattern?.defaultTone) {
        arcPatternCatalog[row.id] = {
          name:        row.id,
          description: row.description,
          roles:       row.arc_pattern.roles,
          defaultTone: row.arc_pattern.defaultTone,
        };
      }
    }
    for (const row of styleRows.rows) {
      if (row.prompt_prefix) {
        visualStyleCatalog[row.id] = { name: row.label, promptPrefix: row.prompt_prefix };
      }
    }
    console.log(`[generateVideoPayload] loaded ${Object.keys(arcPatternCatalog).length} arc patterns + ${Object.keys(visualStyleCatalog).length} visual styles from DB`);
  } catch (e: any) {
    console.warn('[generateVideoPayload] DB catalog fetch failed, using hardcoded fallbacks:', e.message);
  }

  const tokenAccumulator = { total: 0 };

  const result = await tokenStore.run(tokenAccumulator, () =>
    videoGenGraph.invoke({
      userStory,
      templateBlocks,
      partialVideoMeta,
      apiKey,
      model,
      preferredArc,
      preferredVoice,
      preferredVisualStyle,
      customVisualPrompt,
      arcPatternCatalog,
      visualStyleCatalog,
    })
  );

  console.log(`🎬 Generation complete — total tokens used: ${tokenAccumulator.total}`);

  return {
    success:     result.errors.length === 0,
    selectedArc: result.selectedArc?.name ?? 'unknown',
    payload:     result.finalPayload as GenerateVideoPayloadResult['payload'],
    errors:      result.errors,
    tokensUsed:  tokenAccumulator.total,
  };
}
