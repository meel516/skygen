import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { isAdmin } from '@/lib/roles';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';

// GET /api/support/[id]/messages — get full chat thread (own ticket or admin)
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  // Check ticket exists + user owns it (or is admin)
  const ticket = await db.query(`SELECT user_id FROM support_tickets WHERE id = $1`, [id]);
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  if (ticket.rows[0].user_id !== session.user.id && !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const messages = await db.query(
    `SELECT m.id, m.sender_role, m.message, m.created_at,
            u.name AS sender_name, u.email AS sender_email
     FROM support_messages m
     LEFT JOIN users u ON u.id = m.sender_id
     WHERE m.ticket_id = $1
     ORDER BY m.created_at ASC`,
    [id]
  );

  // Also return ticket metadata
  const ticketInfo = await db.query(
    `SELECT t.id, t.subject, t.status, t.priority, t.email, t.name, t.created_at,
            a.name AS assigned_name
     FROM support_tickets t
     LEFT JOIN users a ON a.id = t.assigned_to
     WHERE t.id = $1`,
    [id]
  );

  return NextResponse.json({ ticket: ticketInfo.rows[0], messages: messages.rows });
}

// POST /api/support/[id]/messages — send a message (own ticket or admin)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const { message } = await req.json();
  if (!message?.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const ticket = await db.query(`SELECT user_id, status FROM support_tickets WHERE id = $1`, [id]);
  if (ticket.rows.length === 0) {
    return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
  }
  const isOwner = ticket.rows[0].user_id === session.user.id;
  const adminUser = isAdmin(session.user.role);
  if (!isOwner && !adminUser) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const senderRole = adminUser ? 'admin' : 'user';
  const msgId = randomUUID();

  await db.query(
    `INSERT INTO support_messages (id, ticket_id, sender_id, sender_role, message)
     VALUES ($1, $2, $3, $4, $5)`,
    [msgId, id, session.user.id, senderRole, message.trim()]
  );

  // Update ticket updated_at + reopen if closed/resolved and user replies
  if (!adminUser && ['resolved', 'closed'].includes(ticket.rows[0].status)) {
    await db.query(`UPDATE support_tickets SET status = 'open', updated_at = NOW() WHERE id = $1`, [id]);
  } else {
    await db.query(`UPDATE support_tickets SET updated_at = NOW() WHERE id = $1`, [id]);
  }

  return NextResponse.json({ id: msgId }, { status: 201 });
}
