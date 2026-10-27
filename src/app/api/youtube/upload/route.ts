import { NextRequest, NextResponse } from 'next/server';
import { uploadVideoToYouTube, refreshAccessToken } from '@/lib/youtube/client';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { videoData, videoUrl, title, description, privacyStatus, tags, categoryId } = body;

    if ((!videoData && !videoUrl) || !title) {
      return NextResponse.json(
        { error: 'Missing required fields: videoData or videoUrl, title' },
        { status: 400 }
      );
    }

    // Fetch tokens from DB
    const result = await db.query(
      'SELECT access_token, refresh_token, expiry_date FROM youtube_accounts WHERE user_id = $1',
      [session.user.id]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'YouTube account not connected. Please connect your YouTube account first.' },
        { status: 403 }
      );
    }

    let { access_token, refresh_token, expiry_date } = result.rows[0];

    // Auto-refresh if token is expired
    if (expiry_date && Date.now() >= Number(expiry_date)) {
      if (!refresh_token) {
        return NextResponse.json(
          { error: 'YouTube token expired. Please reconnect your YouTube account.' },
          { status: 403 }
        );
      }
      const refreshed = await refreshAccessToken(refresh_token);
      access_token = refreshed.access_token ?? access_token;
      const newExpiry = refreshed.expiry_date ?? null;
      await db.query(
        `UPDATE youtube_accounts SET access_token = $1, expiry_date = $2, updated_at = now()
         WHERE user_id = $3`,
        [access_token, newExpiry, session.user.id]
      );
    }

    const tokens = { access_token, refresh_token };

    // Build video Blob from either a URL (S3) or base64 data
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

    // Upload to YouTube
    const uploadResult = await uploadVideoToYouTube(tokens, {
      videoBlob,
      title,
      description: description || '',
      tags: tags || [],
      privacyStatus: privacyStatus || 'private',
      categoryId: categoryId || '22',
    });

    return NextResponse.json({
      success: true,
      video: uploadResult,
    });
  } catch (error) {
    console.error('YouTube upload error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
