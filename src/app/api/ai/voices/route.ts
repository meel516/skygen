import { NextResponse } from 'next/server';

import { requireAuthenticatedSession } from '@/lib/api-security';
import { fetchAllVoices } from '@/lib/video/ai/deepgram-tts';

export async function GET() {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const voices = await fetchAllVoices();
    return NextResponse.json({ voices });
  } catch (e: any) {
    return NextResponse.json({ error: e.message, voices: [] }, { status: 500 });
  }
}
