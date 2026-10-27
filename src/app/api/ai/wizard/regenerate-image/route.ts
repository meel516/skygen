import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { regenerateSingleImage } from '@/lib/video/ai';

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;

  const { description, removeBackground = false } = await req.json();
  if (!description) {
    return NextResponse.json({ error: 'description required' }, { status: 400 });
  }

  try {
    const result = await regenerateSingleImage(description, removeBackground);
    return NextResponse.json({ url: result.url });
  } catch (e: any) {
    console.error('[regenerate-image]', e.message);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
