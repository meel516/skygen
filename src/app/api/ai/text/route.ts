import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { generateText, type AIMessage } from '@/lib/video/ai/providers';

function normalizeMessages(body: any): AIMessage[] {
  if (Array.isArray(body?.messages)) {
    return body.messages
      .filter((message: any) => message && typeof message.content === 'string' && message.content.trim().length > 0)
      .map((message: any) => ({
        role: typeof message.role === 'string' ? message.role : 'user',
        content: message.content,
      }));
  }

  if (typeof body?.prompt === 'string' && body.prompt.trim()) {
    return [{ role: 'user', content: body.prompt }];
  }

  return [];
}

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
      scope: 'ai-text',
      limit: 20,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const body = await req.json();
    const messages = normalizeMessages(body);

    if (messages.length === 0) {
      return NextResponse.json({ error: 'Missing prompt or messages' }, { status: 400, headers: rateLimitHeaders });
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
      // Non-fatal if usage columns do not exist yet.
    }

    const result = await generateText({
      messages,
      model: body.model,
      maxTokens: body.maxTokens,
      temperature: body.temperature,
      enableWebSearch: body.enableWebSearch,
    });

    if ((result.usage.totalTokens ?? 0) > 0) {
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

    return NextResponse.json(result, { headers: rateLimitHeaders });
  } catch (error) {
    console.error('[/api/ai/text]', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI request failed' },
      { status: 500 }
    );
  }
}
