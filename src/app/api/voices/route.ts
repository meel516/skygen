import { NextResponse } from 'next/server';
import { fetchAllVoices } from '@/lib/video/ai/deepgram-tts';

export async function GET() {
  try {
    const voices = await fetchAllVoices();
    return NextResponse.json({ voices });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
