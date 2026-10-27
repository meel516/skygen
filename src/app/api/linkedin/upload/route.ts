import { NextRequest, NextResponse } from 'next/server';
import {
  uploadVideoToLinkedIn,
  refreshAccessToken,
  getLinkedInPersonUrn,
} from '@/lib/linkedin/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { videoData, videoUrl, title, description, visibility } = body;

    if ((!videoData && !videoUrl) || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: videoData or videoUrl, title' },
        { status: 400 }
      );
    }

    // Fetch tokens from DB
    const result = await db.query(
      'SELECT access_token, refresh_token, expiry_date FROM linkedin_accounts WHERE user_id = $1',
      [session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'LinkedIn account not connected. Please connect first.' },
        { status: 403 }
      );
    }

    let { access_token, refresh_token, expiry_date } = result.rows[0];

    // Auto-refresh if expired
    if (expiry_date && Date.now() >= Number(expiry_date)) {
      if (!refresh_token) {
        return NextResponse.json(
          { error: 'LinkedIn token expired. Please reconnect your account.' },
          { status: 403 }
        );
      }
      const refreshed = await refreshAccessToken(refresh_token);
      access_token = refreshed.access_token;
      const newExpiry = refreshed.expires_in
        ? Date.now() + refreshed.expires_in * 1000
        : null;
      await db.query(
        `UPDATE linkedin_accounts SET access_token = $1, expiry_date = $2, updated_at = now()
         WHERE user_id = $3`,
        [access_token, newExpiry, session.user.id]
      );
    }

    // Build video blob
    let videoBlob: Blob;
    if (videoUrl) {
      const fetchRes = await fetch(videoUrl);
      if (!fetchRes.ok) throw new Error('Failed to fetch video from URL');
      const buf = await fetchRes.arrayBuffer();
      videoBlob = new Blob([buf], { type: 'video/mp4' });
    } else {
      const videoBuffer = Buffer.from(videoData, 'base64');
      videoBlob = new Blob([videoBuffer], { type: 'video/mp4' });
    }

    // Get person URN for the authenticated user
    const personUrn = await getLinkedInPersonUrn(access_token);

    // Upload and create post
    const uploadResult = await uploadVideoToLinkedIn(access_token, personUrn, {
      videoBlob,
      title,
      description: description || '',
      visibility: visibility || 'PUBLIC',
    });

    return NextResponse.json({
      success: true,
      post: uploadResult,
    });
  } catch (error) {
    console.error('LinkedIn upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
