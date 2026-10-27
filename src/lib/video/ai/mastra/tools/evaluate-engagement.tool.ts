import { callAIWithTracking, parseJSON, languageName, ENGAGEMENT_THRESHOLD, MAX_DIRECTOR_LOOPS } from '../shared/utils';
import type { NarrativeBrief } from '../shared/types';

export { ENGAGEMENT_THRESHOLD, MAX_DIRECTOR_LOOPS };

/**
 * Evaluate the narrative plan's engagement quality.
 * Owns its logic — no graph.ts dependency.
 */
export async function evaluateEngagement(params: {
  userStory: string;
  narrativePlan: NarrativeBrief[];
  directorLoopCount: number;
  language: string;
  apiKey: string;
  model: string;
}): Promise<{
  engagementScore: number;
  engagementFeedback: string;
}> {
  const plan = params.narrativePlan ?? [];
  if (plan.length === 0) {
    return { engagementScore: 0, engagementFeedback: 'No narrative plan to evaluate.' };
  }

  const blockCount = plan.length;

  // Context-aware rubric — dimensions that depend on structure are only
  // evaluated when the structure can actually express them.
  // - 1 block: no progression, no distinctness (nothing to compare)
  // - 2 blocks: lightweight contrast only
  // - 3+ blocks: full rubric
  const dimensions: Array<{ key: string; prompt: string }> = [
    { key: 'hookStrength', prompt: 'Does block 1 grab attention in 2 seconds? Is there a question, surprising fact, or emotional provocation?' },
    { key: 'specificity', prompt: 'Are scripts full of concrete details (names, numbers, moments) or vague platitudes like "he worked hard"?' },
    { key: 'scriptQuality', prompt: 'Do the spokenScripts sound natural spoken aloud? Are they punchy, conversational, with rhythm — or do they read like essays?' },
  ];
  if (blockCount >= 2) {
    dimensions.push({ key: 'emotionalProgression', prompt: 'Does the tone evolve across blocks? Is there tension, contrast, peaks and valleys — or is it flat?' });
  }
  if (blockCount >= 3) {
    dimensions.push({ key: 'distinctness', prompt: 'Does each block cover genuinely different ground, or do they repeat the same idea in different words?' });
  }

  const dimensionList = dimensions.map((d, i) => `${i + 1}. ${d.key}: ${d.prompt}`).join('\n');
  const scoresShape = `{ ${dimensions.map(d => `"${d.key}": N`).join(', ')} }`;

  const scripts = plan.map((p, i) =>
    `Block ${i + 1} [${p.narrativeRole}]: "${p.spokenScript}" (key: ${p.keyMessage})`
  ).join('\n');

  try {
    const response = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a ruthlessly honest video engagement consultant who has analyzed
thousands of viral short-form videos.

⚠️ HARD CONSTRAINT — THE BLOCK COUNT IS FIXED AT ${blockCount}.
You are evaluating quality WITHIN the given structure. You MUST NOT recommend
adding, removing, splitting, or merging blocks. The user chose this structure
deliberately. Score only what's achievable at this block count.

Score this narrative plan on ${dimensions.length} dimensions (0-10 each):

${dimensionList}

Calculate overallScore as the average of the dimensions above (do not penalize
for "missing" dimensions — they were intentionally excluded because this is a
${blockCount}-block video). Set pass=true if overallScore >= ${ENGAGEMENT_THRESHOLD}.
If pass=false, write specific, actionable feedback pointing to EXACT blocks and
what to fix WITHIN the existing ${blockCount}-block structure.

Return ONLY this JSON (no markdown):
{
  "scores": ${scoresShape},
  "overallScore": N,
  "pass": true/false,
  "feedback": "string — specific issues and which blocks to fix (empty if pass=true). Never suggest changing block count."
}${params.language !== 'en' ? `\n\nNOTE: The scripts are written in ${languageName(params.language)}. Evaluate engagement quality regardless of language. Write your feedback in English.` : ''}`,
        },
        {
          role: 'user',
          content: `Story: "${params.userStory}"

Narrative plan to evaluate:
${scripts}

Be honest. A 7 is good enough. Only fail if there are clear structural weaknesses.`,
        },
      ],
      apiKey: params.apiKey,
      maxTokens: 500,
      model: params.model,
    });

    const result = parseJSON(response);

    const score = Number(result.overallScore) || 0;
    const feedback = result.feedback || '';

    console.log(`[evaluateEngagement] score: ${score}/10 pass: ${result.pass} (attempt ${params.directorLoopCount}/${MAX_DIRECTOR_LOOPS})`);
    if (!result.pass && feedback) {
      console.log(`[evaluateEngagement] feedback: ${feedback.slice(0, 200)}`);
    }

    return { engagementScore: score, engagementFeedback: feedback };
  } catch (e: any) {
    console.warn('[evaluateEngagement] ⚠️ eval failed, passing by default:', e.message);
    return { engagementScore: ENGAGEMENT_THRESHOLD, engagementFeedback: '' };
  }
}
