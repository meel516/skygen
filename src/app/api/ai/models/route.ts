import { NextResponse } from 'next/server';

import { requireAuthenticatedSession } from '@/lib/api-security';
import { getServerAiSettings } from '@/lib/video/ai/providers';

export async function GET() {
  const authResult = await requireAuthenticatedSession();
  if ('response' in authResult) {
    return authResult.response;
  }

  return NextResponse.json(getServerAiSettings());
}
