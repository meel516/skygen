import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function DELETE() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    await db.query('DELETE FROM linkedin_accounts WHERE user_id = $1', [session.user.id]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('LinkedIn disconnect error:', err);
    return NextResponse.json({ error: 'Failed to disconnect' }, { status: 500 });
  }
}
