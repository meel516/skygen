import type { ArcPattern, ConsistencyLens, ConsistencyLensConfig } from './types';

// ============================================================================
// ARC PATTERNS — owned by the Mastra layer (no graph.ts dependency)
// ============================================================================

export const ARC_PATTERNS: Record<string, ArcPattern> = {
  documentary: {
    name: 'documentary',
    description: 'Biographical, sports, or historical stories about a person, team, or event',
    roles: ['hook', 'context', 'build-up', 'climax', 'proof', 'resolution'],
    defaultTone: 'cinematic, inspiring, emotionally building toward a peak moment',
  },
  listicle: {
    name: 'listicle',
    description: 'Rankings, top-N lists, countdowns, comparisons between multiple entities',
    roles: ['intro', 'item', 'item', 'item', 'item', 'summary'],
    defaultTone: 'energetic, punchy, fast-paced — each item lands like a reveal',
  },
  tutorial: {
    name: 'tutorial',
    description: 'How-to guides, step-by-step instructions, educational or explainer content',
    roles: ['intro', 'step', 'step', 'step', 'step', 'recap'],
    defaultTone: 'clear, instructional, reassuring — builds confidence step by step',
  },
  product_pitch: {
    name: 'product_pitch',
    description: 'Product launches, feature showcases, app demos, sales or marketing content',
    roles: ['problem', 'solution', 'feature', 'feature', 'social_proof', 'cta'],
    defaultTone: 'confident, persuasive, building excitement toward a strong CTA',
  },
  biography: {
    name: 'biography',
    description: 'Individual life stories, career journeys, founder stories, personal narratives',
    roles: ['origin', 'rise', 'challenge', 'triumph', 'legacy', 'inspiration'],
    defaultTone: 'personal, emotional, nostalgic — earns the emotion through specific detail',
  },
  news: {
    name: 'news',
    description: 'Current events, announcements, breaking news, press releases',
    roles: ['headline', 'context', 'detail', 'detail', 'impact', 'conclusion'],
    defaultTone: 'authoritative, neutral, informative — facts first, then significance',
  },
  motivational: {
    name: 'motivational',
    description: 'Inspirational content, self-improvement, fitness journeys, mindset shifts',
    roles: ['problem', 'struggle', 'turning_point', 'triumph', 'principle', 'cta'],
    defaultTone: 'intense, uplifting, urgent — creates a desire to act',
  },
  comparison: {
    name: 'comparison',
    description: 'Versus content, head-to-head reviews, side-by-side analysis of two+ things',
    roles: ['intro', 'contender_a', 'contender_b', 'round', 'round', 'verdict'],
    defaultTone: 'analytical, balanced, building to a decisive verdict',
  },
  mini_doc: {
    name: 'mini_doc',
    description: 'Short-form documentary: single focused topic, tight emotional arc, social media format',
    roles: ['hook', 'context', 'tension', 'resolution', 'cta'],
    defaultTone: 'cinematic, tight, every second earns its place',
  },
  explainer: {
    name: 'explainer',
    description: 'Concept explainers, "what is X", science or finance breakdowns, ELI5 content',
    roles: ['hook_question', 'analogy', 'detail', 'detail', 'summary', 'insight'],
    defaultTone: 'curious, clear, surprising — makes complex things feel simple',
  },
  event_recap: {
    name: 'event_recap',
    description: 'Sports match recaps, event summaries, "what happened" recaps',
    roles: ['teaser', 'setup', 'key_moment', 'key_moment', 'result', 'reaction'],
    defaultTone: 'exciting, play-by-play energy, relives the moment',
  },
  brand_story: {
    name: 'brand_story',
    description: 'Company or brand origin stories, "why we exist" narratives, mission-driven content',
    roles: ['problem_in_world', 'founder_moment', 'mission', 'proof', 'values', 'cta'],
    defaultTone: 'purposeful, warm, authentic — values over hype',
  },
  reaction: {
    name: 'reaction',
    description: 'Commentary, reaction content, hot takes, opinion pieces, response videos',
    roles: ['hook', 'claim', 'evidence', 'counter', 'verdict', 'takeaway'],
    defaultTone: 'bold, opinionated, conversational — like talking to a friend who knows their stuff',
  },
  transformation: {
    name: 'transformation',
    description: 'Before/after, glow-ups, makeover journeys, progress reveals',
    roles: ['before', 'catalyst', 'process', 'struggle', 'reveal', 'impact'],
    defaultTone: 'dramatic, building anticipation — the reveal is everything',
  },
  mystery: {
    name: 'mystery',
    description: 'True crime, unsolved mysteries, conspiracy deep-dives, "what really happened"',
    roles: ['hook_question', 'clue', 'clue', 'twist', 'reveal', 'aftermath'],
    defaultTone: 'suspenseful, eerie, slow-burn tension — keeps you guessing',
  },
  storytime: {
    name: 'storytime',
    description: 'Personal anecdotes, "story time" narratives, real experiences, viral moments',
    roles: ['setup', 'inciting_incident', 'escalation', 'climax', 'fallout', 'lesson'],
    defaultTone: 'casual, gripping, conversational — like the best storyteller at a party',
  },
  review: {
    name: 'review',
    description: 'Product reviews, movie/game reviews, honest opinions, tier lists',
    roles: ['intro', 'first_impression', 'deep_dive', 'pros', 'cons', 'verdict'],
    defaultTone: 'honest, analytical, entertaining — earns trust through detail',
  },
  day_in_life: {
    name: 'day_in_life',
    description: 'Day-in-the-life, routine breakdowns, behind-the-scenes, "what I do" content',
    roles: ['morning', 'routine', 'highlight', 'challenge', 'wind_down', 'reflection'],
    defaultTone: 'intimate, relatable, authentic — makes viewers feel like they were there',
  },
  myth_busting: {
    name: 'myth_busting',
    description: 'Debunking myths, fact vs fiction, "things you didn\'t know", misconceptions',
    roles: ['myth_intro', 'common_belief', 'evidence', 'truth', 'implications', 'takeaway'],
    defaultTone: 'confident, surprising, "actually..." energy — flips assumptions',
  },
  countdown: {
    name: 'countdown',
    description: 'Dramatic countdowns, tension-building reveals, best-of lists with buildup',
    roles: ['teaser', 'entry', 'entry', 'entry', 'runner_up', 'winner'],
    defaultTone: 'escalating excitement, each entry bigger than the last — saves the best for last',
  },
};

// ============================================================================
// CONSISTENCY LENSES
// ============================================================================

export const CONSISTENCY_LENS_CONFIGS: Record<ConsistencyLens, ConsistencyLensConfig> = {
  character: {
    description: 'Ensures named people look consistent across all images — same face, clothing, and emotional arc.',
    whenToSelect: 'The video features one or more named people as recurring subjects (biography, founder story, athlete journey, etc.)',
    visualStyleDirective:
      'Include a CHARACTER SHEET for every named person: full name, age, physical traits (hair color/length, eye color, build), signature clothing that stays locked across ALL blocks, and their emotional baseline expression. Every image must feel like a frame from the same film about the same person.',
    storyBibleDirective:
      'Include: SUBJECT (full name + 1-sentence identity), TIMELINE (key dates/milestones referenced across blocks — keep numbers consistent), CHARACTER STATE PER BLOCK (brief emotional note per narrative stage), RECURRING MOTIFS (visual or verbal callbacks), TONE ANCHOR (the single emotional truth the video must leave viewers with).',
    contentGeneratorHint:
      `CHARACTER LENS — CRITICAL:\n- IMAGE FIELDS: Always show the named subject using the character sheet from visualStyleGuide — same clothing, same build, same face. Depict their emotional state for this block's role (body language, posture, expression, environment lighting).\n- For "origin/childhood" moments: use era-appropriate props but keep facial features consistent.\n- NEVER show an anonymous silhouette or generic crowd when the subject should be present.\n- TEXT FIELDS: Use the subject's actual name — no pronouns without clear antecedents.`,
  },

  concept: {
    description: 'Ensures diagrams, artifacts, and notation stay visually consistent — same colors, same style, same terminology.',
    whenToSelect: 'The video explains an idea, mechanism, process, or abstract concept (science, finance, engineering, how-things-work, etc.)',
    visualStyleDirective:
      'Include an ARTIFACT/DIAGRAM PALETTE: the core visual representation of the concept (diagram type, color coding for elements, annotation style — handwritten vs clean sans-serif vs code-comment). Specify whether visuals are diagrams/illustrations vs real-world photography — pick ONE and stay consistent. Define colors for recurring diagram elements (e.g. inputs = green, outputs = red).',
    storyBibleDirective:
      'Include: CORE CONCEPT (the idea in one plain-English sentence), KEY TERMS (3-5 domain terms used consistently — no synonyms mid-video), CONCEPT STEPS (ordered list with 2-word labels if tutorial/explainer), COMPLEXITY FLOOR (minimum assumed viewer knowledge — all content stays above this level).',
    contentGeneratorHint:
      `CONCEPT LENS — CRITICAL:\n- IMAGE FIELDS: Show the ARTIFACT — diagram, equation, physical equipment, interface screenshot, or annotated illustration. If a diagram color palette was defined in visualStyleGuide, reference those exact colors in your description.\n- For step-by-step blocks: show the specific sub-diagram or tool for THAT step — not the full concept re-drawn.\n- Prefer diagrams and labeled illustrations over stock photos of people for abstract concepts.\n- TEXT FIELDS: Use the exact key terms from the storyBible — no improvised synonyms.`,
  },

  event_history: {
    description: 'Anchors images in specific geography, era, and faction colors — maps, locations, and chronological flow.',
    whenToSelect: 'The video covers a historical event, geographic story, political/military situation, sports match, or any content where WHERE and WHEN are central.',
    visualStyleDirective:
      'Include an EVENT GEOGRAPHY PALETTE: primary location(s) with visual description (architecture, landscape, era), faction/side color assignments if multiple factions exist (e.g. "Team A = red and gold, Team B = navy and white"), map/geography visual style (satellite vs illustrated vs infographic — pick one), era/period visual cues (year or decade, confirming details like clothing/vehicles/technology).',
    storyBibleDirective:
      'Include: EVENT TIMELINE (key dates or sequence markers in order), FACTIONS/ACTORS (named entities with their one-sentence role), GEOGRAPHIC ANCHOR (primary and secondary locations referenced), CONFIRMED OUTCOME (the result — content must never contradict this), STAKES (what was at risk and for whom — used as the emotional through-line).',
    contentGeneratorHint:
      `EVENT/HISTORY LENS — CRITICAL:\n- IMAGE FIELDS: Establish LOCATION first (recognizable geographic or architectural context). Apply faction color coding from visualStyleGuide to any uniforms, flags, banners, or team equipment. Make the era/date visually obvious (aged film grain for historical, breaking-news style for modern events).\n- For key-moment blocks: depict the EXACT moment — not a generic crowd shot.\n- TEXT FIELDS: Use exact faction names, dates, and location names from the storyBible.`,
  },

  product: {
    description: 'Locks product appearance, brand colors, and specs so they never drift across blocks.',
    whenToSelect: 'The video is about a product, service, app, or brand — features, launches, comparisons, reviews, or origin stories.',
    visualStyleDirective:
      'Include a PRODUCT VISUAL IDENTITY: product name and exact appearance (color, shape, material, key visual features), brand color palette (primary + accent), product photography style (clean studio background vs lifestyle vs UI screenshot — pick ONE), and for comparison arcs: the exact comparison axis and how it will be visualized (side-by-side, chart, table).',
    storyBibleDirective:
      'Include: PRODUCT NAME (exact spelling and capitalization), KEY SPECS (3-5 critical features/numbers that must stay consistent), PRICE/OFFER (exact terms if relevant), TARGET CUSTOMER (one sentence), UNIQUE SELLING POINT (the single differentiator), CALL TO ACTION (exact wording of the desired action).',
    contentGeneratorHint:
      `PRODUCT LENS — CRITICAL:\n- IMAGE FIELDS: Show the PRODUCT using the exact description from visualStyleGuide — same color, same form factor, every time. Feature blocks: show the specific feature being described (not the whole product). Social proof blocks: product IN USE. CTA block: clean studio shot, logo visible.\n- VIDEO FIELDS: NEVER write character-driven or emotional scenes (no "person looking stressed", no "man at desk reacting", no story expressions). ALWAYS describe what the PRODUCT or INTERFACE looks like in action — UI screens, dashboards, data visualizations, architecture flows, feature demos. The narrative role defines the MOOD of the product shot, not a human character's emotion.\n- For comparison arcs: show both products at the same scale, same camera angle.\n- TEXT FIELDS: Product name spelled exactly as in storyBible. All specs must match exactly — never approximate.`,
  },

  motivational: {
    description: 'Defines a visual intensity escalation map — energy, color temperature, and camera feeling must build block by block.',
    whenToSelect: 'The video is designed to inspire action, build energy, or drive emotional transformation (motivational speech, fitness journey, transformation story, countdown, etc.)',
    visualStyleDirective:
      'Include a VISUAL INTENSITY SCALE: opening block visual energy (dark, low-light, muted colors, tight composition), ending block visual energy (explosive brightness, wide open frame, golden light, triumph), color temperature arc (cold/blue-grey early → warming to gold/orange at climax), and camera energy progression (close/claustrophobic early → wide/epic at peak).',
    storyBibleDirective:
      'Include: CENTRAL STRUGGLE (the universal human challenge this video addresses), TRANSFORMATION MILESTONE (the exact turning point — every block leads toward or radiates from it), UNIVERSAL PRINCIPLE (the 1-sentence truth this video communicates), CALL TO ACTION (specific, actionable), ESCALATION MAP (block-by-block intensity labels: struggle → rock bottom → spark → rise → triumph → call).',
    contentGeneratorHint:
      `MOTIVATIONAL LENS — CRITICAL:\n- IMAGE FIELDS: Visual intensity MUST match this block's escalation map position from storyBible. Early blocks: dark, tight, constraining compositions — shadows, small figure in large negative space. Mid blocks: dynamic, liminal — figure at threshold, motion blur, breaking through. Late blocks: wide, bright, open — expansive sky, peak/summit, explosive movement, golden light. CTA block: direct eye contact, bright, action-forward.\n- NEVER use bland stock-looking images — every image should have emotional charge matching the escalation stage.\n- spokenScript rhythm: early blocks use longer sentences; late blocks use 3-5 word punches.`,
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

export { VISUAL_STYLE_PRESETS };
