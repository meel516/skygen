import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import { requireAuthenticatedSession } from '@/lib/api-security';

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

/**
 * POST /api/content-manager/upload
 * Upload content images (logos, thumbnails, favicons) to S3.
 * Accepts multipart/form-data with a "file" field.
 * Returns { url } — the public S3 URL of the uploaded file.
 */
export async function POST(req: NextRequest) {
  const authResult = await requireAuthenticatedSession({ contentManager: true });
  if ('response' in authResult) return authResult.response;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'png';
    const key = `content/${randomUUID()}.${ext}`;
    const bucket = getBucketName();
    const buffer = Buffer.from(await file.arrayBuffer());

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: buffer,
        ContentType: file.type || 'image/png',
        CacheControl: 'public, max-age=31536000',
      })
    );

    const url = `https://${bucket}.s3.${REGION}.amazonaws.com/${key}`;

    return NextResponse.json({ url });
  } catch (error: any) {
    console.error('Content upload error:', error);
    return NextResponse.json({ error: error.message || 'Upload failed' }, { status: 500 });
  }
}
