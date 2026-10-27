import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

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
 * GET /api/music/[filename] — Stream a music file from S3
 * Files are stored under the music/ prefix in the S3 bucket.
 * Cached aggressively since these are static assets.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params;

  // Sanitize filename — only allow alphanumeric, hyphens, dots
  if (!/^[\w\-]+\.mp3$/i.test(filename)) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  try {
    const result = await s3.send(
      new GetObjectCommand({
        Bucket: getBucketName(),
        Key: `music/${filename}`,
      })
    );

    if (!result.Body) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const bytes = await result.Body.transformToByteArray();

    return new NextResponse(bytes, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Accept-Ranges': 'bytes',
      },
    });
  } catch (err: any) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 });
    }
    console.error('Music stream error:', err);
    return NextResponse.json({ error: 'Failed to stream music' }, { status: 500 });
  }
}
