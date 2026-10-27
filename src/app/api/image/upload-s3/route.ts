import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';

const REGION = process.env.LAMBDA_REGION || 'us-east-1';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20MB for images

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

function extFromMime(mime: string): string {
  if (mime.includes('png')) return 'png';
  if (mime.includes('webp')) return 'webp';
  if (mime.includes('gif')) return 'gif';
  return 'jpg';
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) return authResult.response;

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request: req,
      userId: session.user.id,
      scope: 'image-upload-s3',
      limit: 20,
      windowMs: 10 * 60_000,
    });
    if ('response' in rateLimitResult) return rateLimitResult.response;

    const rateLimitHeaders = rateLimitResult.headers;
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400, headers: rateLimitHeaders });
    }

    const mimeType = file.type || 'image/jpeg';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 20MB)' }, { status: 413, headers: rateLimitHeaders });
    }

    const bucket = getBucketName();
    const ext = extFromMime(mimeType);
    const key = `generated-images/${randomUUID()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    }));

    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 7 * 24 * 60 * 60 }
    );

    return NextResponse.json({ url, key, bucket }, { headers: rateLimitHeaders });
  } catch (error: any) {
    console.error('[image/upload-s3]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
