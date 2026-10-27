import { NextRequest, NextResponse } from 'next/server';
import { requireAuthenticatedSession } from '@/lib/api-security';
import { db } from '@/lib/db';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

const REGION = process.env.LAMBDA_REGION || 'us-east-1';

function getBucketName(): string {
  const siteUrl = process.env.LAMBDA_SITE_URL || '';
  const match = siteUrl.match(/https:\/\/([^.]+)\.s3\./);
  return match?.[1] || process.env.S3_BUCKET || 'remotionlambda-useast1-l722vmwfn0';
}

const s3 = new S3Client({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

/** GET /api/content-manager/music — List all music tracks (content manager) */
export async function GET() {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  try {
    const result = await db.query(
      `SELECT id, name, artist, mood, duration, src, tags, "createdAt", "createdBy"
       FROM music_tracks ORDER BY mood, name`
    );
    return NextResponse.json({ tracks: result.rows });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/content-manager/music — Upload a music track
 * Accepts multipart/form-data with fields: file, name, artist, mood, duration, tags
 * Uploads MP3 to S3 under music/ prefix, saves metadata to DB.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;
  const { session } = authResult;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const name = (formData.get('name') as string) || 'Untitled Track';
    const artist = (formData.get('artist') as string) || 'Unknown';
    const mood = (formData.get('mood') as string) || 'calm';
    const duration = parseInt((formData.get('duration') as string) || '120', 10);
    const tagsRaw = (formData.get('tags') as string) || '';
    const tags = tagsRaw.split(',').map(t => t.trim()).filter(Boolean);

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    if (!file.type.includes('audio')) {
      return NextResponse.json({ error: 'File must be an audio file' }, { status: 400 });
    }

    const id = randomUUID();
    const ext = file.name.split('.').pop() || 'mp3';
    const s3Key = `music/${id}.${ext}`;
    const bucket = getBucketName();
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: s3Key,
        Body: buffer,
        ContentType: file.type || 'audio/mpeg',
        CacheControl: 'public, max-age=31536000',
      })
    );

    // The src is the API proxy path so it works without exposing S3 directly
    const src = `/api/music/${id}.${ext}`;

    await db.query(
      `INSERT INTO music_tracks (id, name, artist, mood, duration, src, tags, "createdBy")
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, name, artist, mood, duration, src, tags, session.user.id]
    );

    return NextResponse.json({ id, name, artist, mood, duration, src, tags });
  } catch (err: any) {
    console.error('Music upload error:', err);
    return NextResponse.json({ error: err.message || 'Upload failed' }, { status: 500 });
  }
}

/** DELETE /api/content-manager/music?id=xxx — Delete a music track */
export async function DELETE(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  const id = req.nextUrl.searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM music_tracks WHERE id = $1`, [id]);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
