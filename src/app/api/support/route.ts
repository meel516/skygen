import { requireAuthenticatedSession } from '@/lib/api-security';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// POST /api/support — Create a support ticket + first message
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { subject, message, priority = 'normal', email: guestEmail, name: guestName } = body;

  if (!subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });
  }

  // Try to get session (not required — guests can submit tickets)
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? guestEmail;
  const name = session?.user?.name ?? guestName ?? null;

  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  const ticketId = randomUUID();
  const messageId = randomUUID();

  await db.query(
    `INSERT INTO support_tickets (id, user_id, email, name, subject, priority)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [ticketId, userId, email, name, subject.trim(), priority]
  );

  await db.query(
    `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [messageId, ticketId, userId, 'user', message.trim()]
  );

  return NextResponse.json({ id: ticketId }, { status: 201 });
}

// GET /api/support — List own tickets (authenticated)
export async function GET() {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const result = await db.query(
    `SELECT
       t.id, t.subject, t.status, t.priority, t.created_at, t.updated_at,
       (SELECT m.message FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
       (SELECT m.sender_role FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender_role
     FROM support_tickets t
     WHERE t.user_id = $1
     ORDER BY t.updated_at DESC`,
    [session.user.id]
  );

  return NextResponse.json(result.rows);
}
