import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';

// Allow up to 2 minutes for large video uploads
export const maxDuration = 120;

// Disable Next.js body size limit — we enforce our own 250 MB cap below
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

const REGION = process.env.LAMBDA_REGION || 'us-east-1';
const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

// Extract bucket name from LAMBDA_SITE_URL
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

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request: req,
      userId: session.user.id,
      scope: 'video-upload-s3',
      limit: 6,
      windowMs: 10 * 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const contentType = req.headers.get('content-type') || '';
    let buffer: Buffer;
    let mimeType = 'video/mp4';

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const file = formData.get('file') as File | null;
      if (!file) {
        return NextResponse.json({ error: 'Missing file in form data' }, { status: 400, headers: rateLimitHeaders });
      }
      mimeType = file.type || 'video/mp4';
      const arrayBuffer = await file.arrayBuffer();
      buffer = Buffer.from(arrayBuffer);
    } else {
      const { video, mimeType: providedMimeType = 'video/mp4' } = await req.json();
      if (!video) {
        return NextResponse.json({ error: 'Missing video base64 data' }, { status: 400, headers: rateLimitHeaders });
      }
      mimeType = providedMimeType;
      buffer = Buffer.from(video, 'base64');
    }

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'Upload too large', maxBytes: MAX_UPLOAD_BYTES },
        { status: 413, headers: rateLimitHeaders }
      );
    }

    const bucket = getBucketName();
    const ext = mimeType.includes('webm') ? 'webm' : 'mp4';
    const key = `generated-videos/${randomUUID()}.${ext}`;

    console.log(`[upload-s3] Uploading ${(buffer.length / 1024 / 1024).toFixed(1)}MB to s3://${bucket}/${key}`);

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

    console.log(`[upload-s3] Uploaded. Signed URL: ${url.slice(0, 100)}...`);

    return NextResponse.json({ url, key, bucket }, { headers: rateLimitHeaders });
  } catch (error: any) {
    console.error('[upload-s3]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
