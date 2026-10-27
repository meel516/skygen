import { callAIWithTracking, parseJSON, languageName, fitRolesToBlocks } from '../shared/utils';
import { getRunContext } from '../shared/run-context';
import { ARC_PATTERNS, CONSISTENCY_LENS_CONFIGS, VISUAL_STYLE_PRESETS } from '../shared/arc-patterns';
import type { ArcPattern, ConsistencyLens, NarrativeBrief } from '../shared/types';

/**
 * Run the director agent to plan the narrative across all blocks.
 * Owns its logic — no graph.ts dependency.
 */
export async function runDirector(params: {
  userStory: string;
  templateBlocks: Array<{ type: string; [key: string]: any }>;
  selectedArc: ArcPattern | null;
  preferredArc: string | null;
  customArc: { roles: string[]; defaultTone: string } | null;
  arcPatternCatalog: Record<string, ArcPattern>;
  visualStyleCatalog: Record<string, { name: string; promptPrefix: string }>;
  preferredVisualStyle: string | null;
  customVisualPrompt: string | null;
  engagementFeedback: string;
  engagementScore: number;
  directorLoopCount: number;
  researchContext: string;
  language: string;
  apiKey: string;
  model: string;
}): Promise<{
  selectedArc: ArcPattern;
  narrativePlan: NarrativeBrief[];
  visualStyleGuide: string;
  storyBible: string;
  selectedLenses: ConsistencyLens[];
  directorLoopCount: number;
}> {
  const loopCount = params.directorLoopCount + 1;
  console.log(`[director_agent] ▶ attempt ${loopCount}`);

  const arcCatalogMerged: Record<string, ArcPattern> = { ...ARC_PATTERNS, ...params.arcPatternCatalog };
  const styleCatalogMerged = { ...VISUAL_STYLE_PRESETS, ...params.visualStyleCatalog };

  let arc: ArcPattern | null = params.selectedArc ?? null;

  if (!arc && params.preferredArc) {
    arc = arcCatalogMerged[params.preferredArc] ?? null;
    if (arc) console.log(`[director_agent] using preferred arc: "${arc.name}"`);
  }

  // Custom arc from MCP
  if (params.customArc?.roles?.length) {
    arc = { name: 'custom', description: 'Claude-defined custom arc', roles: params.customArc.roles, defaultTone: params.customArc.defaultTone };
    console.log(`[director_agent] 🎨 using custom arc from MCP: ${arc.roles.join(' → ')}`);
  }

  const blockTypes = params.templateBlocks.map(b => b.type).join(', ');

  let arcInstruction: string;
  if (arc) {
    const roles = fitRolesToBlocks(arc.roles, params.templateBlocks.length);
    const blockList = params.templateBlocks
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
  "narrativePlan": [ ...exactly ${params.templateBlocks.length} brief objects... ]
}`;
  } else {
    const arcCatalog = Object.values(arcCatalogMerged)
      .map(a => `- "${a.name}": ${a.description} (tone: ${a.defaultTone})`)
      .join('\n');
    arcInstruction = `AVAILABLE ARCS (pick the best one for this story):
${arcCatalog}

Block types in this video (${params.templateBlocks.length} blocks): ${blockTypes}

First choose the best arc, then assign its roles to blocks using the arc's role sequence.

Return a JSON object with:
{
  "selectedArc": "<arc_name you chose>",
  "reason": "<one sentence why>",
  "narrativePlan": [ ...exactly ${params.templateBlocks.length} brief objects... ]
}`;
  }

  const iterationLog = getRunContext()?.read('iteration-log.md');
  const feedbackSection = iterationLog
    ? `\n\nITERATION HISTORY (all previous attempts — address ALL unresolved issues):\n${iterationLog}\n\nDo NOT simply add more adjectives — rewrite angles, key messages, and scripts to fix the structural issues. Make it GRIPPING.`
    : params.engagementFeedback
      ? `\n\nPREVIOUS ATTEMPT FEEDBACK (you MUST address these issues):\n${params.engagementFeedback}\n\nYour previous scripts were scored ${params.engagementScore}/10. Fix the specific issues above.\nDo NOT simply add more adjectives — rewrite the angles, key messages, and scripts\nto address the structural feedback. Make it GRIPPING.`
      : '';

  const researchSection = params.researchContext
    ? `\n\nWEB RESEARCH (current facts — prefer these over your training data):\n${params.researchContext}`
    : '';

  const presetStyle = params.preferredVisualStyle && params.preferredVisualStyle !== 'custom'
    ? styleCatalogMerged[params.preferredVisualStyle]
    : null;

  const visualStyleInstruction = presetStyle
    ? `The user selected visual style: "${presetStyle.name}". Base prompt: "${presetStyle.promptPrefix}".\nYour visualStyleGuide MUST start with this base prompt, then ADD character/setting descriptions specific to this story.`
    : params.customVisualPrompt
      ? `The user described their desired visual style: "${params.customVisualPrompt}".\nYour visualStyleGuide MUST incorporate this description as the foundation, then ADD character/setting descriptions specific to this story.`
      : `Choose a visual style that best fits this story.`;

  const lensMenu = (Object.entries(CONSISTENCY_LENS_CONFIGS) as [ConsistencyLens, typeof CONSISTENCY_LENS_CONFIGS[ConsistencyLens]][])
    .map(([key, cfg]) => `- "${key}": ${cfg.description} Use when: ${cfg.whenToSelect}`)
    .join('\n');

  const lensConditionals = (Object.entries(CONSISTENCY_LENS_CONFIGS) as [ConsistencyLens, typeof CONSISTENCY_LENS_CONFIGS[ConsistencyLens]][])
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
    const response = await callAIWithTracking({
      messages: [
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
- "visualStyleGuide": A reusable visual prompt prefix (under 100 words) prepended to EVERY image description for visual consistency. Follow the IF-you-select directives above for your chosen lenses.
- "storyBible": A shared context doc (under 150 words) that every block's content generator will see. Follow the IF-you-select directives above for your chosen lenses.
- "selectedLenses": Array of the consistency lens names you chose (e.g. ["character", "concept"]). Can be empty [].${feedbackSection}${researchSection}
${params.language !== 'en' ? `\nLANGUAGE: ALL spokenScript, keyMessage, and angle fields MUST be written in ${languageName(params.language)}. Internal fields (narrativeRole, transitionIn, transitionOut, visualMood) stay in English.` : ''}
No markdown wrapping. Return valid JSON only.`,
        },
        {
          role: 'user',
          content: `Story/Topic: "${params.userStory}"

${arc ? `Arc tone: ${arc.defaultTone}` : 'Pick the best arc and plan the narrative.'}

Plan ${params.templateBlocks.length} blocks. Make every second count — this needs to GRIP the viewer.`,
        },
      ],
      apiKey: params.apiKey,
      maxTokens: 3000,
      model: params.model,
    });

    const parsed = parseJSON(response);

    let resolvedArc = arc;
    if (!resolvedArc && parsed.selectedArc) {
      resolvedArc = arcCatalogMerged[parsed.selectedArc] ?? arcCatalogMerged['documentary'] ?? ARC_PATTERNS['documentary'];
      console.log(`[director_agent] AI selected arc: "${resolvedArc.name}" — ${parsed.reason || ''}`);
    }
    if (!resolvedArc) resolvedArc = arcCatalogMerged['documentary'] ?? ARC_PATTERNS['documentary'];

    let plan: NarrativeBrief[] = parsed.narrativePlan ?? parsed;

    // Defensive guard: director must return exactly one brief per template block.
    // If the LLM hallucinated extra entries (e.g. under engagement-score pressure)
    // or returned too few, clamp to templateBlocks.length here — the downstream
    // generator indexes narrativePlan[i] by templateBlocks[i] and will crash on
    // mismatch.
    if (!Array.isArray(plan)) plan = [];
    if (plan.length > params.templateBlocks.length) {
      console.warn(`[director_agent] ⚠️ plan length ${plan.length} > templateBlocks ${params.templateBlocks.length} — truncating`);
      plan = plan.slice(0, params.templateBlocks.length);
    }
    if (plan.length < params.templateBlocks.length) {
      console.warn(`[director_agent] ⚠️ plan length ${plan.length} < templateBlocks ${params.templateBlocks.length} — padding with fallbacks`);
      const padRoles = fitRolesToBlocks(resolvedArc.roles, params.templateBlocks.length);
      while (plan.length < params.templateBlocks.length) {
        const i = plan.length;
        plan.push({
          narrativeRole: padRoles[i],
          angle: `Aspect ${i + 1} of ${params.userStory}`,
          tone: 'engaging',
          keyMessage: `Block ${i + 1}: cover a unique angle of ${params.userStory}`,
          visualMood: 'cinematic, high contrast, dramatic lighting',
          spokenScript: 'natural, engaging narration that builds on the previous block',
          transitionIn: i === 0 ? 'opening shot' : 'continues from previous block',
          transitionOut: i === params.templateBlocks.length - 1 ? 'closing call to action' : 'leads into next block',
        });
      }
    }

    console.log(`[director_agent] ✅ arc="${resolvedArc.name}" attempt=${loopCount}`);
    plan.forEach((p, i) => {
      console.log(`  Block ${i + 1} (${params.templateBlocks[i]?.type}): [${p.narrativeRole}] ${p.keyMessage}`);
    });

    console.log(`[director_agent] 🎨 visualStyleGuide: ${String(parsed.visualStyleGuide || '').slice(0, 100)}`);
    console.log(`[director_agent] 📖 storyBible: ${String(parsed.storyBible || '').slice(0, 100)}`);

    const parsedLenses = ((parsed.selectedLenses ?? []) as string[])
      .filter((l): l is ConsistencyLens => l in CONSISTENCY_LENS_CONFIGS);
    console.log(`[director_agent] 🔍 selectedLenses: ${parsedLenses.join(', ') || '(none)'}`);

    return {
      selectedArc: resolvedArc,
      narrativePlan: plan,
      directorLoopCount: loopCount,
      visualStyleGuide: parsed.visualStyleGuide || '',
      storyBible: parsed.storyBible || '',
      selectedLenses: parsedLenses,
    };
  } catch (e: any) {
    console.warn('[director_agent] ⚠️ failed, using fallback plan:', e.message);
    const fallbackArc = arc ?? arcCatalogMerged['documentary'] ?? ARC_PATTERNS['documentary'];
    const roles = fitRolesToBlocks(fallbackArc.roles, params.templateBlocks.length);

    const fallback: NarrativeBrief[] = params.templateBlocks.map((b, i) => ({
      narrativeRole: roles[i],
      angle:         `Aspect ${i + 1} of ${params.userStory}`,
      tone:          i === 0 ? 'hook' : i === params.templateBlocks.length - 1 ? 'urgent' : 'engaging',
      keyMessage:    `Block ${i + 1} [${roles[i]}]: Cover a unique angle of ${params.userStory}`,
      visualMood:    'cinematic, high contrast, dramatic lighting',
      spokenScript:  'natural, engaging narration that builds on the previous block',
      transitionIn:  i === 0 ? 'opening shot' : 'continues from previous block',
      transitionOut: i === params.templateBlocks.length - 1 ? 'closing call to action' : 'leads into next block',
    }));

    return {
      selectedArc: fallbackArc,
      narrativePlan: fallback,
      visualStyleGuide: 'cinematic, high contrast, dramatic lighting, film grain, 8K detail',
      storyBible: `Topic: ${params.userStory}. General cinematic storytelling approach.`,
      directorLoopCount: loopCount,
      selectedLenses: [],
    };
  }
}
