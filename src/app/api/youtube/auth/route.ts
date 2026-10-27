import { NextResponse } from 'next/server';
import { getAuthUrl, isOAuthConfigured } from '@/lib/youtube/client';

// Start OAuth flow - redirect to Google
export async function GET() {
  // Check if OAuth is configured first
  if (!isOAuthConfigured()) {
    return NextResponse.json(
      { error: 'YouTube API not configured. Please set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in environment.' },
      { status: 500 }
    );
  }

  // Generate auth URL and redirect
  const authUrl = getAuthUrl();
  return NextResponse.redirect(authUrl);
}
