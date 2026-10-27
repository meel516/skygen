import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/admin/support — list all tickets (admin only)
export async function GET(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;

  const status = req.nextUrl.searchParams.get('status') || '';

  const result = await db.query(
    `SELECT
       t.id, t.email, t.name, t.subject, t.status, t.priority, t.created_at, t.updated_at,
       a.name AS assigned_name,
       (SELECT m.message FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_message,
       (SELECT m.sender_role FROM support_messages m WHERE m.ticket_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS last_sender_role,
       (SELECT COUNT(*)::int FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
     FROM support_tickets t
     LEFT JOIN users a ON a.id = t.assigned_to
     ${status ? 'WHERE t.status = $1' : ''}
     ORDER BY t.updated_at DESC`,
    status ? [status] : []
  );

  return NextResponse.json(result.rows);
}
