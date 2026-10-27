import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { getTtsKeysForUser } from '@/lib/api-key-cookies';
import { setTtsApiKeys } from '@/lib/video/ai/deepgram-tts';
import { generateAudio } from '@/lib/video/ai/media-service';

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) return authResult.response;
  const { session } = authResult as { session: { user: { id: string } } };

  const { script, voice } = await req.json();
  if (!script?.trim()) return NextResponse.json({ error: 'script required' }, { status: 400 });

  const ttsKeys = await getTtsKeysForUser(session.user.id);
  setTtsApiKeys(ttsKeys);

  const url = await generateAudio(script, voice);
  return NextResponse.json({ url });
}
