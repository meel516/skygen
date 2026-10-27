import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';

/**
 * GET /api/admin/premium-config
 * Returns the current premium gating configuration.
 */
export async function GET() {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;

  try {
    const result = await db.query(
      `SELECT value FROM site_config WHERE key = 'premium_config'`
    );
    const config = result.rows[0]?.value || getDefaults();
    return NextResponse.json(config);
  } catch {
    return NextResponse.json(getDefaults());
  }
}

/**
 * PUT /api/admin/premium-config
 * Updates the premium gating configuration.
 */
export async function PUT(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ admin: true });
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  try {
    const body = await req.json();

    await db.query(
      `INSERT INTO site_config (key, value, updated_by, updated_at)
       VALUES ('premium_config', $1::jsonb, $2, now())
       ON CONFLICT (key) DO UPDATE SET value = $1::jsonb, updated_by = $2, updated_at = now()`,
      [JSON.stringify(body), session.user.id]
    );

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function getDefaults() {
  return {
    premiumBlockTypes: ['tower-chart-3d', 'parallax-story', 'video', 'bar-race-3d'],
    premiumVisualStyles: true,
    premiumVoiceProviders: ['elevenlabs'],
    upgradeWhatsApp: '917337253375',
    upgradeMessage: 'Hi, I would like to upgrade to Premium on SkyGen!',
  };
}
