import { NextResponse, NextRequest } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { runMigrations, runSeeders } from '@/lib/db-migrate';

export async function GET(req: NextRequest) {
  try {
    // Allow access via secret key (for first-time setup before any admin exists)
    const secret = req.nextUrl.searchParams.get('secret');
    const isSecretValid = secret && process.env.DB_INIT_SECRET && secret === process.env.DB_INIT_SECRET;

    if (!isSecretValid) {
      const authResult = await requireAuthenticatedSession({ admin: true });
      if ('response' in authResult) {
        return authResult.response;
      }
    }

    const { ran, skipped } = await runMigrations();
    const seeded = await runSeeders();

    return NextResponse.json({
      success: true,
      migrations: { ran, skipped },
      seeded,
    });
  } catch (e: any) {
    console.error('[db/init]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
