import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { generateText } from '@/lib/video/ai/providers';
import { getApiKeyFromCookie, getDeepSeekKeyForUser } from '@/lib/api-key-cookies';

const ENHANCE_SYSTEM_PROMPT = `You are a SkyGen Magic Prompt Enhancer. Your job is to take a simple user description for a video, motion graphic, or template, and expand/enhance it into a highly detailed, cinematic prompt that is perfectly optimized for the SkyGen Remotion video generator.

The enhanced prompt must:
- Be detailed, concise, and structured.
- Propose specific, high-fidelity visual scenes and motion cues.
- Proactively suggest incorporating 2-4 of SkyGen's 69 advanced cinematic capabilities, such as:
  • Blur-to-sharp rack focus entrances with spring-driven defocus
  • 3D exploding UI layers with preserve-3d and translateZ separation
  • Audio waveforms with glossy floor reflections (scaleY(-1) + CSS mask gradient)
  • Multi-cursor collaboration with two-speed noise wobble and ripple rings
  • Scanning comparison sliders with sparkle trails and clipPath
  • Kinetic typography with mixed size/weight hierarchy per word
  • Gradient text via background-clip with drop-shadow glow
  • Frosted glassmorphism panels with triple-layer boxShadow
  • Matrix rain character shuffling and node connection pulse dots
  • Aurora blob breathing and type-color polymorphism
  • Staggered SVG logo choreography and physics-driven spring cascades
  • 3D Grid Perspective Tilting and procedural math waveforms
  • Sparkle burst particles at completion moments
  • interpolateColors for time-based accent color cycling
  • CSS 3D wireframe spheres and orbital badge carousels
  • Perspective grid ground planes with radial mask and vignette
  • Animated number counters with tabular-nums
  • Toast notifications with asymmetric spring enter / linear exit
      You MUST strictly adhere to the 69 Remotion coding patterns and rules found in your library.
      For example, ALWAYS use \`spring\` (with \`Math.max\`, \`fps\`, \`config\`), \`interpolate\`, and \`interpolateColors\` over CSS transitions.
      Use \`makeTransform\` and \`Easing.out(Easing.exp)\` where applicable. Integrate advanced capabilities like 3D depth, particle systems, noise overlays, procedural waveforms, mathematical SVG path evolution, and organic sine-wave breathing as dictated by the 69 patterns.
  • Step progress pill indicators and mini-map viewports
  • Dark/light scene polarity alternation with transition diversity
  • Spring-gated noise to prevent pre-entrance drift
- Include suggestions for color palettes (e.g., specific brand hex codes or gradients), typography styles (italic, skew, weight), and timings.
- Keep the tone premium, state-of-the-art, and aesthetic.
- DO NOT output any explanation, markdown formatting blocks (like \\\`\\\`\\\`), or preambles. Output ONLY the enhanced prompt string itself.`;

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request: req,
      userId: session.user.id,
      scope: 'ai-enhance-prompt',
      limit: 20,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400, headers: rateLimitHeaders });
    }

    try {
      const usage = await db.query(
        `SELECT "aiTokensUsed", "aiTokenLimit" FROM users WHERE id = $1`,
        [session.user.id]
      );

      if (usage.rows.length > 0) {
        const { aiTokensUsed, aiTokenLimit } = usage.rows[0];
        const used = aiTokensUsed ?? 0;
        const limit = aiTokenLimit ?? 100000;
        if (used >= limit) {
          return NextResponse.json(
            { error: 'AI token limit reached', used, limit },
            { status: 403, headers: rateLimitHeaders }
          );
        }
      }
    } catch {
      // Non-fatal if columns don't exist.
    }

    // Resolve user's DeepSeek key from cookie or DB fallback
    const cookieKey = await getApiKeyFromCookie('deepseek');
    const dbKey = cookieKey ? '' : await getDeepSeekKeyForUser(session.user.id);
    const apiKey = cookieKey || dbKey || '';

    const result = await generateText({
      messages: [
        { role: 'system', content: ENHANCE_SYSTEM_PROMPT },
        { role: 'user', content: `Please enhance this prompt: "${prompt}"` },
      ],
      apiKey: apiKey,
      model: body.model || 'deepseek-chat',
      maxTokens: 500,
      temperature: 0.7,
    });

    if ((result.usage?.totalTokens ?? 0) > 0) {
      try {
        await db.query(
          `UPDATE users
           SET "aiTokensUsed" = COALESCE("aiTokensUsed", 0) + $1,
               "aiCount" = COALESCE("aiCount", 0) + 1
           WHERE id = $2`,
          [result.usage.totalTokens, session.user.id]
        );
      } catch {
        // Non-fatal.
      }
    }

    return NextResponse.json({ enhancedPrompt: result.text }, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('[/api/ai/enhance-prompt]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
