import { NextResponse } from 'next/server';
import { getAuthUrl, isOAuthConfigured } from '@/lib/linkedin/client';

export async function GET() {
  if (!isOAuthConfigured()) {
    return NextResponse.json(
      { error: 'LinkedIn API not configured. Set LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET.' },
      { status: 500 }
    );
  }

  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
