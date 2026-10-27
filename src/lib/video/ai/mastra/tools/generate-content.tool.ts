import { callAIWithTracking, parseJSON, languageName } from '../shared/utils';
import { getRunContext } from '../shared/run-context';
import { BLOCK_SCHEMAS, getResponseFormatTemplate } from '../shared/block-schemas';
import { CONSISTENCY_LENS_CONFIGS } from '../shared/arc-patterns';
import { getAspectRatioDimensions } from '../../../utils/theme';
import type { NarrativeBrief, ConsistencyLens, MediaStrategy } from '../shared/types';

/**
 * Generate content for a single block via AI.
 * Owns its logic — no graph.ts dependency.
 */
export async function generateContent(params: {
  blockType: string;
  blockIndex: number;
  userStory: string;
  originalBlock: Record<string, any>;
  narrativeBrief: NarrativeBrief | null;
  visualStyleGuide: string;
  storyBible: string;
  arcName: string;
  selectedLenses: ConsistencyLens[];
  researchContext: string;
  mediaStrategy: MediaStrategy | null;
  aspectRatio: string;
  language: string;
  apiKey: string;
  model: string;
  preferredVoice?: string | null;
  /** path→description map from the plugin's schema — tells LLM how each field is used in animation */
  schemaDescriptions?: Record<string, string>;
}): Promise<{ rawContent: Record<string, any>; error: string | null }> {
  console.log(`[generate_content] ▶ block ${params.blockIndex + 1}: ${params.blockType}`);

  const { width, height } = getAspectRatioDimensions(params.aspectRatio ?? '9:16');
  const orientation = width > height ? 'landscape' : 'portrait';
  const dimLabel    = `${width}×${height} ${orientation}`;

  const brief = params.narrativeBrief;

  // ── Custom plugin: build field instructions from block.generationFields ──
  // Custom plugins don't have an entry in BLOCK_SCHEMAS. Instead, their shape
  // comes from the plugin's DB record (schema.json + generation_fields),
  // already attached to the template block upstream.
  if (params.blockType === 'custom-plugin') {
    const genFields = (params.originalBlock?.generationFields ?? []) as Array<{
      path: string; type: 'image' | 'audio' | 'video'; description?: string;
    }>;
    const imagePaths = genFields.filter(f => f.type === 'image').map(f => f.path);
    const audioPaths = genFields.filter(f => f.type === 'audio').map(f => f.path);
    const mediaPathSet = new Set([...imagePaths, ...audioPaths]);

    const META_KEYS = new Set([
      'type',
      'generationFields',
      'pluginId',
      'blockIndex',
      'duration',
      'id',
      'pluginData',
      'margin',
      'enterAnimation',
      'exitAnimation',
      'animationDuration',
      'backgroundBlur',
      'borderWidth',
      'borderRadius',
      'shadowEnabled',
      'shadowColor',
      'shadowBlur',
    ]);
    const allContentKeys = Object.keys(params.originalBlock ?? {}).filter(k => !META_KEYS.has(k));
    const textKeys = allContentKeys.filter(k => !mediaPathSet.has(k));

    const storyContext = brief ? `
NARRATIVE BRIEF:
- Role:         ${brief.narrativeRole}
- Angle:        ${brief.angle}
- Tone:         ${brief.tone}
- Key message:  ${brief.keyMessage}
- Visual mood:  ${brief.visualMood}
${brief.spokenScript ? `\nSPOKEN SCRIPT (use verbatim for any audio field):\n"${brief.spokenScript}"` : ''}
` : '';

    const schemaDesc = params.schemaDescriptions ?? {};
    const descNote = (path: string) => schemaDesc[path] ? ` [${schemaDesc[path]}]` : '';

    const fieldInstructions = [
      textKeys.length > 0 && `TEXT FIELDS (fill with real, specific content grounded in the topic):\n${textKeys.map(k => `  ${k}${descNote(k)}`).join('\n')}`,
      imagePaths.length > 0 && `IMAGE FIELDS — write a vivid, CONTEXT-SPECIFIC visual description (NOT a URL). Derive the subject from the text fields you just filled — include real names, titles, products, people:\n${imagePaths.map(p => `  ${p}${descNote(p)}`).join('\n')}`,
      audioPaths.length > 0 && `AUDIO FIELDS (exact words to be spoken aloud${brief?.spokenScript ? ' — copy the spoken script above word-for-word' : ''}):\n${audioPaths.map(p => `  ${p}${descNote(p)}`).join('\n')}`,
    ].filter(Boolean).join('\n\n');

    const structureRef = Object.fromEntries(
      allContentKeys.map(k => [
        k,
        mediaPathSet.has(k) ? '<descriptive text here — NOT a URL>' : (params.originalBlock[k] ?? ''),
      ])
    );

    try {
      const response = await callAIWithTracking({
        messages: [
          {
            role: 'system',
            content: `You are a video content generator filling a custom plugin block.
${storyContext}
FIELD DEFINITIONS:
${fieldInstructions}

RULES:
1. Return a single flat JSON object with ALL fields filled. No markdown, no extra keys.
2. Image fields MUST be descriptive text, never URLs.
3. Be SPECIFIC — real names, numbers, facts.${params.language !== 'en' ? `\n4. LANGUAGE: viewer-facing text MUST be in ${languageName(params.language)}. JSON keys stay English.` : ''}

Structure reference (template defaults — replace with real content):
${JSON.stringify(structureRef, null, 2)}`,
          },
          {
            role: 'user',
            content: `Topic: "${params.userStory}"
${brief ? `Your job this block: ${brief.keyMessage}` : ''}

Generate the JSON content now.`,
          },
        ],
        apiKey: params.apiKey,
        maxTokens: 1500,
        model: params.model,
      });

      const rawContent = parseJSON(response);
      if (brief?.spokenScript) {
        for (const p of audioPaths) {
          if (rawContent[p] !== undefined) rawContent[p] = brief.spokenScript;
        }
        if (rawContent.audioSrc !== undefined) rawContent.audioSrc = brief.spokenScript;
      }
      console.log('[generate_content] ✅ custom-plugin rawContent keys:', Object.keys(rawContent).join(', '));
      return { rawContent, error: null };
    } catch (e: any) {
      return { error: `generate_content (custom-plugin) failed: ${e.message}`, rawContent: {} };
    }
  }

  const schema = BLOCK_SCHEMAS[params.blockType];
  if (!schema) {
    console.warn(`[generate_content] No schema for: ${params.blockType}`);
    return { error: `Unknown block type: ${params.blockType}`, rawContent: {} };
  }

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

  const storyBibleContext = params.storyBible ? `
STORY BIBLE (shared facts — use these consistently, do NOT contradict):
${params.storyBible}
` : '';

  const runPlan = getRunContext()?.read('plan.md');
  const runPlanContext = runPlan ? `\nRUN PLAN:\n${runPlan}\n` : '';

  const lensHints = (params.selectedLenses ?? [])
    .map(lens => CONSISTENCY_LENS_CONFIGS[lens]?.contentGeneratorHint)
    .filter(Boolean)
    .join('\n\n');
  const lensHintSection = lensHints ? `\nCONSISTENCY RULES FOR THIS VIDEO:\n${lensHints}\n` : '';

  const blockStrategy = params.mediaStrategy?.blockStrategies
    ?.find(b => b.blockIndex === params.blockIndex);
  const useWebSearch = (blockStrategy && params.blockType !== 'video')
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
    // ── HTML block: TWO-STEP generation ──
    if (params.blockType === 'html') {
      console.log('[generate_content] 🎨 HTML block — using two-step raw-HTML generation');

      const conceptPrompt = brief
        ? `You are a creative director designing a HIGHLY GRAPHICAL animated slide for a short video.

STORY CONTEXT:
- Topic: "${params.userStory}"
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
  "heroGraphic": "describe the main graphic",
  "motionPlan": ["3-6 short animation beats tied to time (0-5s)"],
  "avoid": ["things to avoid that could clutter/crop"]
}

RULES:
- Must be readable in 3–5 seconds.
- Use large typography (min 48px headline).
- Prefer bold shapes, gradients, glow, shadows, and inline SVG icons.
- Design for ${dimLabel}.
- Avoid content that requires scrolling.`
        : `You are a creative director. Return ONLY strict JSON with keys: concept, layout, palette, headline, subheadline, bullets, badges, heroGraphic, motionPlan, avoid. Topic: "${params.userStory}"`;

      let conceptPlan: Record<string, any> = {};
      try {
        const conceptRaw = await callAIWithTracking({
          messages: [
            { role: 'system', content: conceptPrompt },
            { role: 'user', content: 'Pick a strong concept and return the JSON plan now.' },
          ],
          apiKey: params.apiKey, maxTokens: 900, model: params.model,
        });
        conceptPlan = parseJSON(conceptRaw);
      } catch (e) {
        console.warn('[generate_content] ⚠️ concept planner failed (non-fatal):', e);
      }

      function stripMarkdown(html: string): string {
        let result = html.trim();
        if (result.startsWith('```html')) result = result.slice(7);
        else if (result.startsWith('```')) result = result.slice(3);
        if (result.endsWith('```')) result = result.slice(0, -3);
        return result.trim();
      }

      function isHtmlComplete(html: string): boolean {
        return html.trim().toLowerCase().endsWith('</html>');
      }

      const MAX_HTML_RETRIES = 3;
      let htmlContent = '';
      let htmlAttempts = 0;
      let isComplete = false;

      while (!isComplete && htmlAttempts < MAX_HTML_RETRIES) {
        htmlAttempts++;

        if (htmlAttempts === 1) {
          const htmlOnlySystemPrompt = brief
            ? `You are an expert HTML/CSS/JS developer creating a single-file animated slide for a video frame.

STORY CONTEXT:
- Topic: "${params.userStory}"
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
            : `You are an expert HTML/CSS/JS developer. Create a single-file animated slide for a video about: "${params.userStory}".
OUTPUT RULES:
1. Output ONLY the raw HTML. Start with <!DOCTYPE html>, end with </html>. No JSON, no markdown.
2. Self-contained, ${dimLabel}, dark background, large readable text, CSS animations.
3. MANDATORY FULL-FRAME CSS: html, body { margin:0; padding:0; width:${width}px; height:${height}px; overflow:hidden; }`;

          const rawHtmlResponse = await callAIWithTracking({
            messages: [
              { role: 'system', content: htmlOnlySystemPrompt },
              { role: 'user', content: 'Generate the HTML document now. Output ONLY raw HTML starting with <!DOCTYPE html>.' },
            ],
            apiKey: params.apiKey, maxTokens: 2500, model: params.model,
          });

          htmlContent = stripMarkdown(rawHtmlResponse);
        } else if (htmlAttempts === 2 && !isHtmlComplete(htmlContent)) {
          const continuationResponse = await callAIWithTracking({
            messages: [
              { role: 'system', content: 'You are an HTML expert. Continue truncated HTML output exactly where it left off.' },
              { role: 'user', content: `The previous HTML was cut off mid-generation. Continue from exactly where it stopped.\n\nPREVIOUS HTML (incomplete):\n${htmlContent}\n\nCRITICAL: Pick up from where it was cut off. MUST end with </html>. Output ONLY the continuation.` },
            ],
            apiKey: params.apiKey, maxTokens: 3000, model: params.model,
          });
          htmlContent = htmlContent + stripMarkdown(continuationResponse);
        } else if (htmlAttempts === 3 && !isHtmlComplete(htmlContent)) {
          const regenerationResponse = await callAIWithTracking({
            messages: [
              { role: 'system', content: 'You MUST output complete HTML. If you cannot fit everything, make it shorter but COMPLETE.' },
              { role: 'user', content: `Create a COMPLETE HTML slide for a video. You MUST output the ENTIRE document.\nSTORY: "${params.userStory}"\nKey message: "${brief?.keyMessage ?? ''}"\nRULES:\n1. Output ONLY raw HTML, starting with <!DOCTYPE html> and ending with </html>\n2. Keep it concise — max 150 lines. Focus on quality, not quantity.\n3. Must include: dark gradient background, large headline, at least 1 SVG icon, CSS animations using window.__remotionTime\n4. No external resources. Self-contained.\n5. ${dimLabel} format. MANDATORY CSS: html, body { margin:0; padding:0; width:${width}px; height:${height}px; overflow:hidden; }` },
            ],
            apiKey: params.apiKey, maxTokens: 3000, model: params.model,
          });
          htmlContent = stripMarkdown(regenerationResponse);
        }

        isComplete = isHtmlComplete(htmlContent);
      }

      if (!htmlContent.includes('<') || !htmlContent.toLowerCase().includes('<!doctype')) {
        const retryResponse = await callAIWithTracking({
          messages: [
            { role: 'system', content: 'Output ONLY a complete HTML document starting with <!DOCTYPE html> and ending with </html>. No JSON, no markdown, no extra text.' },
            { role: 'user', content: `Create an animated HTML slide for a video about: "${params.userStory}". Key message: "${brief?.keyMessage ?? params.userStory}". Output raw HTML only. Make it COMPLETE.` },
          ],
          apiKey: params.apiKey, maxTokens: 3000, model: params.model,
        });
        htmlContent = stripMarkdown(retryResponse);
      }

      if (!isHtmlComplete(htmlContent)) {
        htmlContent = htmlContent + '\n</html>';
      }

      const htmlRawContent: Record<string, any> = {
        htmlContent,
        title:    brief?.narrativeRole ?? 'HTML Block',
        audioSrc: brief?.spokenScript ?? '',
      };

      console.log('[generate_content] ✅ HTML two-step done. htmlContent length:', htmlContent.length);
      return { rawContent: htmlRawContent, error: null };
    }

    // ── Diagram block ──
    if (params.blockType === 'diagram') {
      console.log('[generate_content] 📊 Diagram block detected');

      const diagramDirectorPrompt = brief
        ? `You are a diagram content director for a video block. Design a visually rich diagram.

STORY: "${params.userStory}"
Role: ${brief.narrativeRole} | Angle: ${brief.angle} | Tone: ${brief.tone}
Key message: ${brief.keyMessage}
${lensHintSection}
DIAGRAM REQUIREMENTS:
- Pick diagramType: flowchart | hierarchy | sequence | mindmap | network
- Pick layout: vertical (flowchart/hierarchy) | horizontal (sequence) | radial (mindmap/network)
- 3–8 nodes, each with a SHORT label (1–4 words max)
- Use SEQUENTIAL IDs: "n1", "n2", "n3", etc.
- All edge "from" and "to" values MUST exactly match an existing node "id"
- Use distinct high-contrast hex colors per node
- node "type": start | process | decision | data | end | default
- Include 2–6 edges connecting the nodes logically
- Each edge "style": solid | dashed | arrow

Return ONLY valid JSON. No markdown.
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
        : `You are a diagram content generator. Create a diagram for a video about: "${params.userStory}".
Use sequential node IDs: "n1", "n2", "n3", etc. All edge from/to values MUST match a node id exactly.
Return JSON: { diagramType, title, layout, primaryColor, nodes: [{id,label,type,color}], edges: [{from,to,label,style}], audioSrc }.`;

      const diagramDirectorResponse = await callAIWithTracking({
        messages: [
          { role: 'system', content: diagramDirectorPrompt },
          { role: 'user', content: `Generate the diagram JSON now. The narration (audioSrc) must be exactly: "${brief?.spokenScript || ''}"` },
        ],
        apiKey: params.apiKey, maxTokens: 1500, model: params.model,
      });

      const diagramRawContent = parseJSON(diagramDirectorResponse);

      // Sanitize edges
      if (Array.isArray(diagramRawContent.nodes) && Array.isArray(diagramRawContent.edges)) {
        const validIds = new Set<string>((diagramRawContent.nodes as any[]).map((n: any) => String(n.id)));
        diagramRawContent.edges = (diagramRawContent.edges as any[]).filter(
          (e: any) => validIds.has(String(e.from)) && validIds.has(String(e.to))
        );
      }

      if (brief?.spokenScript) {
        diagramRawContent.audioSrc = brief.spokenScript;
      }

      return { rawContent: diagramRawContent, error: null };
    }

    // ── Standard content generation ──
    let parallaxLayerHint = '';
    if (params.blockType === 'parallax-story' && Array.isArray(params.originalBlock?.layers) && params.originalBlock.layers.length > 0) {
      const layerSummary = (params.originalBlock.layers as any[]).map((l: any, i: number) =>
        `  Layer ${i} — name: "${l.name ?? `layer_${i}`}", depth: ${l.depth ?? i * 30}, parallaxFactor: ${l.parallaxFactor ?? 1}, motionDirection: "${l.motionDirection ?? 'right'}", removeBackground: ${l.removeBackground ?? (i > 0)}`
      ).join('\n');
      parallaxLayerHint = `\nPARALLAX LAYER STRUCTURE (MUST output exactly ${params.originalBlock.layers.length} layers in this order — only fill "image", keep all other fields as shown):\n${layerSummary}\n`;
    }

    // Array count constraints from normalizedFields — ensures LLM generates correct number of array items
    const DEFAULT_ARRAY_COUNTS: Record<string, Record<string, number>> = {
      'top-players': { players: 5 },
      'avatar-grid': { avatars: 4 },
    };
    const entryIsEmpty = (entry: unknown): boolean => {
      if (entry == null) return true;
      if (typeof entry !== 'object') return entry === '' || entry === 0;
      return Object.values(entry as Record<string, unknown>).every(
        v => v == null || (typeof v === 'string' && v.trim() === '')
      );
    };
    const arrayCountHints: string[] = [];
    const seenArrayNames = new Set<string>();
    if (schema.normalizedFields) {
      for (const field of schema.normalizedFields) {
        const match = field.path.match(/^([^[]+)\[\]/);
        if (!match) continue;
        const arrayName = match[1];
        if (seenArrayNames.has(arrayName)) continue;
        seenArrayNames.add(arrayName);

        const arr = params.originalBlock?.[arrayName];
        const effectiveLength = Array.isArray(arr)
          ? arr.filter(e => !entryIsEmpty(e)).length
          : 0;
        const defaultCount = DEFAULT_ARRAY_COUNTS[params.blockType]?.[arrayName] ?? 0;
        const count = Math.max(effectiveLength, defaultCount);
        if (count > 0) {
          arrayCountHints.push(`The "${arrayName}" array MUST have exactly ${count} entries. Each entry must have all required fields filled with real, specific data.`);
        }
      }
    }
    const arrayCountSection = arrayCountHints.length > 0
      ? `\nARRAY COUNT CONSTRAINTS (MANDATORY):\n${arrayCountHints.map(h => `- ${h}`).join('\n')}\n`
      : '';

    const response = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a video content generator filling a "${params.blockType}" block.
${runPlanContext}${narrativeContext}${storyBibleContext}${lensHintSection}${params.researchContext ? `\nRESEARCH CONTEXT (use these current facts — prefer over training data):\n${params.researchContext}\n` : ''}${parallaxLayerHint}${arrayCountSection}
FIELD DEFINITIONS:
${schemaDescription}

RULES:
1. TEXT fields  → specific, real, engaging content matching your narrative angle
2. IMAGE fields → ${useWebSearch ? `a specific web search query to find a real ${queryStyleHint} (NOT an artistic description)` : `vivid visual description matching the visual mood: "${brief?.visualMood ?? 'cinematic'}"`}
3. AUDIO fields → ${brief?.spokenScript ? 'use the EXACT spoken script from the narrative brief above — copy it word for word' : `natural spoken script matching tone: "${brief?.tone ?? 'engaging'}"`}
4. Return a single flat JSON object — no markdown, no extra keys
5. Be SPECIFIC — real names, real numbers, real facts${params.language !== 'en' ? `\n6. LANGUAGE: ALL viewer-facing text (text fields, audio/TTS fields, captions, quotes, list items) MUST be in ${languageName(params.language)}. JSON keys stay in English.` : ''}${params.blockType === 'video' ? `\n7. VIDEO src field → write a detailed cinematic scene description GROUNDED IN THE ACTUAL CONTENT above. Include specific names, places, products, or events from the Research Context, Story Bible, and Narrative Brief so the scene depicts the REAL subject. MATCH THE CONTENT TYPE: if the story is about a product/software/service → describe a UI, dashboard, or product-in-use scene (NOT a person reacting emotionally); if the story is about a person → describe that specific person; if the story is about a concept → describe the mechanism or visualization. NEVER write a generic mood shot or character emotional scene when the content is about a product or technical concept. NEVER write a filename, path, or URL.` : ''}

RESPONSE FORMAT (use this exact JSON structure):
${getResponseFormatTemplate(params.blockType)}

Example output format:
${schema.example}`,
        },
        {
          role: 'user',
          content: `Topic/Story: "${params.userStory}"
Block type: "${params.blockType}"
Block ${params.blockIndex + 1} of the video.
${brief ? `Your job this block: ${brief.keyMessage}` : ''}

Generate the JSON content object now.`,
        },
      ],
      apiKey: params.apiKey,
      maxTokens: 1500,
      model: params.model,
    });

    const rawContent = parseJSON(response);

    // Enforce audioSrc matches director's spokenScript
    if (brief?.spokenScript) {
      if (rawContent.audioSrc !== undefined) {
        rawContent.audioSrc = brief.spokenScript;
      }
      if (params.blockType === 'html' || params.blockType === 'diagram') {
        rawContent.audioSrc = brief.spokenScript;
      }
    }
    if (brief?.spokenScript && rawContent.text !== undefined &&
        ['video', 'parallax-story', 'motivational-image'].includes(params.blockType)) {
      rawContent.text = brief.spokenScript;
    }

    console.log('[generate_content] ✅ rawContent:', JSON.stringify(rawContent, null, 2));
    return { rawContent, error: null };
  } catch (e: any) {
    return { error: `generate_content failed: ${e.message}`, rawContent: {} };
  }
}
