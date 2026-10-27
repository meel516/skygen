// ============================================================================
// VEO VIDEO GENERATION SERVICE
// Uses Vertex AI REST API directly (with API key) to generate videos with Veo 3.1
// ============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

const GOOGLE_API_KEY    = () => process.env.GOOGLE_API_KEY || '';
const GOOGLE_PROJECT_ID = () => process.env.GOOGLE_PROJECT_ID || '';
const GOOGLE_LOCATION   = () => process.env.GOOGLE_LOCATION || 'us-central1';

const VEO_MODEL = 'veo-3.1-generate-001';
const POLL_INTERVAL_MS = 10_000; // 10 seconds
const MAX_POLL_ATTEMPTS = 60;    // 10 minutes max wait

interface VeoOptions {
  prompt: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  durationSeconds?: 5 | 6 | 7 | 8;
  resolution?: '480p' | '720p';
  generateAudio?: boolean;
}

interface VeoResult {
  videoUrl: string;
  mimeType: string;
}

/**
 * Build the Vertex AI base URL
 */
function getBaseUrl(): string {
  const project = GOOGLE_PROJECT_ID();
  const location = GOOGLE_LOCATION();
  if (!project) throw new Error('Missing GOOGLE_PROJECT_ID env var');
  return `https://${location}-aiplatform.googleapis.com/v1/projects/${project}/locations/${location}`;
}

/**
 * Append API key to URL
 */
function withKey(url: string): string {
  const key = GOOGLE_API_KEY();
  if (!key) throw new Error('Missing GOOGLE_API_KEY env var');
  return `${url}?key=${key}`;
}

/**
 * Generate a video using Vertex AI Veo 3.1 via direct REST API
 */
export async function generateVideo(options: VeoOptions): Promise<VeoResult> {
  const {
    prompt,
    aspectRatio = '16:9',
    durationSeconds = 8,
    generateAudio = true,
  } = options;

  console.log(`[veo] ▶ generating video: "${prompt.slice(0, 100)}..."`);
  console.log(`[veo]   aspect=${aspectRatio} duration=${durationSeconds}s audio=${generateAudio}`);

  const baseUrl = getBaseUrl();

  // Step 1: Start generation via predictLongRunning
  const startUrl = withKey(`${baseUrl}/publishers/google/models/${VEO_MODEL}:predictLongRunning`);

  const body = {
    instances: [{ prompt }],
    parameters: {
      aspectRatio,
      sampleCount: 1,
      durationSeconds,
      personGeneration: 'allow_all',
      generateAudio,
    },
  };

  console.log(`[veo] → POST ${startUrl.replace(/key=.*/, 'key=***')}`);

  const startRes = await fetch(startUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!startRes.ok) {
    const errText = await startRes.text();
    throw new Error(`Veo generation failed to start (${startRes.status}): ${errText}`);
  }

  const startData = await startRes.json();
  const operationName = startData.name;

  if (!operationName) {
    throw new Error('Veo returned no operation name: ' + JSON.stringify(startData));
  }

  console.log(`[veo] ⏳ operation started: ${operationName}`);

  // Step 2: Poll using fetchPredictOperation
  let attempts = 0;
  let result: any = startData;

  while (!result.done) {
    attempts++;
    if (attempts > MAX_POLL_ATTEMPTS) {
      throw new Error('Veo video generation timed out after 10 minutes');
    }

    console.log(`[veo] ⏳ polling attempt ${attempts}/${MAX_POLL_ATTEMPTS}...`);
    await sleep(POLL_INTERVAL_MS);

    const pollUrl = withKey(`${baseUrl}/publishers/google/models/${VEO_MODEL}:fetchPredictOperation`);

    try {
      const pollRes = await fetch(pollUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operationName }),
      });

      if (!pollRes.ok) {
        const errText = await pollRes.text();
        console.warn(`[veo] ⚠️ poll error (attempt ${attempts}): ${pollRes.status} ${errText}`);
        continue;
      }

      result = await pollRes.json();
    } catch (e: any) {
      console.warn(`[veo] ⚠️ poll fetch error (attempt ${attempts}):`, e.message);
    }
  }

  console.log('[veo] ✅ generation complete');

  // Step 3: Extract video from response
  const response = result.response;
  if (!response) {
    throw new Error('Veo generation completed but returned no response: ' + JSON.stringify(result));
  }

  const videos = response.videos || response.generatedVideos;
  if (!videos || videos.length === 0) {
    throw new Error('Veo generation completed but no videos were returned');
  }

  const video = videos[0];

  // Response format: { bytesBase64Encoded: "..." } or { video: { uri, videoBytes } }
  if (video.bytesBase64Encoded) {
    console.log(`[veo] ✅ video received (base64): ${video.bytesBase64Encoded.length} chars`);
    const dataUri = `data:video/mp4;base64,${video.bytesBase64Encoded}`;
    return { videoUrl: dataUri, mimeType: 'video/mp4' };
  }

  if (video.video?.videoBytes) {
    console.log(`[veo] ✅ video received (videoBytes): ${video.video.videoBytes.length} chars`);
    const dataUri = `data:video/mp4;base64,${video.video.videoBytes}`;
    return { videoUrl: dataUri, mimeType: 'video/mp4' };
  }

  if (video.video?.uri || video.uri) {
    const uri = video.video?.uri || video.uri;
    console.log(`[veo] ✅ video received (URI): ${uri.slice(0, 100)}`);
    return { videoUrl: uri, mimeType: 'video/mp4' };
  }

  throw new Error('Veo video has no recognizable data: ' + JSON.stringify(video).slice(0, 500));
}

/**
 * Generate video and upload to S3, returns a signed URL
 */
export async function generateVideoUrl(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
): Promise<string> {
  if (!prompt?.trim()) {
    throw new Error('Empty video prompt');
  }

  const result = await generateVideo({
    prompt,
    aspectRatio,
    durationSeconds: 8,
    generateAudio: true,
  });

  // If it's already a URL (not a data URI), return directly
  if (result.videoUrl.startsWith('http')) {
    return result.videoUrl;
  }

  // Upload base64 video to S3 and get a signed URL
  if (result.videoUrl.startsWith('data:')) {
    const signedUrl = await uploadVideoToS3(result.videoUrl);
    if (signedUrl) return signedUrl;
  }

  return result.videoUrl;
}

/**
 * Upload base64 video directly to S3 and return a signed URL
 */
async function uploadVideoToS3(base64DataUri: string): Promise<string | null> {
  const base64Data = base64DataUri.replace(/^data:video\/\w+;base64,/, '');
  const buffer = Buffer.from(base64Data, 'base64');

  console.log(`[veo] → uploading video to S3 (${(buffer.length / 1024 / 1024).toFixed(1)}MB)...`);

  const region = process.env.LAMBDA_REGION || 'us-east-1';

  // Extract bucket name from LAMBDA_SITE_URL
  const siteUrl = process.env.LAMBDA_SITE_URL || '';
  const bucketMatch = siteUrl.match(/https:\/\/([^.]+)\.s3\./);
  const bucket = bucketMatch?.[1] || process.env.S3_BUCKET || '';

  if (!bucket) {
    console.warn('[veo] ⚠️ no S3 bucket found — cannot upload');
    return null;
  }

  const s3 = new S3Client({
    region,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
    },
  });

  const key = `generated-videos/${randomUUID()}.mp4`;

  await s3.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'video/mp4',
  }));

  // Signed URL valid for 7 days
  const signedUrl = await getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 7 * 24 * 60 * 60 },
  );

  console.log(`[veo] ✅ uploaded to S3: s3://${bucket}/${key}`);
  return signedUrl;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
