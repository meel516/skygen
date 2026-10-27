import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

export const maxDuration = 30;

/**
 * POST /api/video/stage-payload
 * Stores a video payload in the DB so /api/video/generate can read it by ID.
 * This avoids Vercel's 4.5MB request body limit — the client sends the payload
 * here (which goes through Vercel's streaming body, not the JSON parser limit),
 * then sends just the payloadId to /api/video/generate.
 */
export async function POST(request: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  try {
    // Read raw body as text to avoid JSON parser limits
    const rawBody = await request.text();
    const payloadId = randomUUID();

    // Store in DB with 1-hour expiry
    await db.query(
      `INSERT INTO staged_payloads (id, payload, user_id, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [payloadId, rawBody, authResult.session.user.id]
    );

    // Clean up old staged payloads (older than 1 hour)
    await db.query(
      `DELETE FROM staged_payloads WHERE created_at < NOW() - INTERVAL '1 hour'`
    ).catch(() => {});

    return NextResponse.json({ payloadId });
  } catch (e: any) {
    console.error('[stage-payload]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
