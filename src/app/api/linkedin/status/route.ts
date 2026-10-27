import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ connected: false });
  }

  try {
    const result = await db.query(
      'SELECT user_id FROM linkedin_accounts WHERE user_id = $1',
      [session.user.id]
    );
    return NextResponse.json({ connected: result.rows.length > 0 });
  } catch {
    return NextResponse.json({ connected: false });
  }
}
