import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

import { getJob, patchJobState } from '@/lib/mcp/wizard-jobs';

const REGION = process.env.LAMBDA_REGION || 'us-east-1';
const MAX_UPLOAD_BYTES = 500 * 1024 * 1024; // 500MB

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
  if (mime.includes('mp4')) return 'mp4';
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('mpeg')) return 'mp3';
  if (mime.includes('wav')) return 'wav';
  if (mime.includes('ogg')) return 'ogg';
  return 'bin';
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const uploadId = formData.get('uploadId') as string | null;
    const file = formData.get('file') as File | null;
    
    if (!uploadId || !uploadId.startsWith('mcp_upload_')) {
      return NextResponse.json({ error: 'Missing or invalid uploadId' }, { status: 400, headers: CORS_HEADERS });
    }
    if (!file) {
      return NextResponse.json({ error: 'Missing file' }, { status: 400, headers: CORS_HEADERS });
    }

    const job = await getJob(uploadId);
    if (!job) {
      return NextResponse.json({ error: 'Upload session expired or invalid' }, { status: 401, headers: CORS_HEADERS });
    }

    const mimeType = file.type || 'application/octet-stream';
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File too large (max 500MB)' }, { status: 413, headers: CORS_HEADERS });
    }

    const bucket = getBucketName();
    const ext = extFromMime(mimeType);
    const key = `mcp-uploads/${randomUUID()}.${ext}`;

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

    // Consume the upload session
    await patchJobState(uploadId, { status: 'complete' }).catch(() => {});

    return NextResponse.json({ url, key, bucket }, { headers: CORS_HEADERS });
  } catch (error: any) {
    console.error('[mcp/upload-media]', error.message);
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
}
