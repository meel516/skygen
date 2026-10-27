import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// PATCH /api/admin/support/[id] — update ticket status, priority, assigned_to
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  const body = await req.json();
  const { status, priority, assigned_to, pickup } = body;

  // "pickup" is a shorthand: assign to self + set in_progress
  if (pickup) {
    await db.query(
      `UPDATE support_tickets SET status = 'in_progress', assigned_to = $1, updated_at = NOW() WHERE id = $2`,
      [session.user.id, id]
    );
    return NextResponse.json({ success: true });
  }

  const updates: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  if (status !== undefined) { updates.push(`status = $${idx++}`); values.push(status); }
  if (priority !== undefined) { updates.push(`priority = $${idx++}`); values.push(priority); }
  if (assigned_to !== undefined) { updates.push(`assigned_to = $${idx++}`); values.push(assigned_to); }

  if (updates.length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }

  updates.push(`updated_at = NOW()`);
  values.push(id);

  await db.query(
    `UPDATE support_tickets SET ${updates.join(', ')} WHERE id = $${idx}`,
    values
  );

  return NextResponse.json({ success: true });
}
