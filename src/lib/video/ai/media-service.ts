// ============================================================================
// MEDIA SERVICE — Generic abstraction for image, audio, and video generation.
// Swap providers by changing the implementation here — graph.ts stays untouched.
// ============================================================================

import { generateTTS } from './deepgram-tts';
import { generateVideoUrl } from './veo-video';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// ── Provider configuration (env vars or defaults) ──────────────────────────

const CF_ACCOUNT_ID        = () => process.env.CF_ACCOUNT_ID        || '';
const CF_API_TOKEN         = () => process.env.CF_API_TOKEN          || '';
const RUNWARE_API_KEY      = () => process.env.RUNWARE_API_KEY       || '';
const BG_REMOVAL_WEBHOOK   = () => process.env.BG_REMOVAL_WEBHOOK   || 'https://salru.duckdns.org/webhook/1b6b383a-696d-471d-9196-e2dca29e50d3';
const BG_REMOVAL_API_URL   = () => process.env.BG_REMOVAL_API_URL   || 'https://sybppqk12a.execute-api.us-east-1.amazonaws.com/remove-bg-asset';
const DEFAULT_TTS_VOICE    = 'aura-2-thalia-en';
const IMAGE_PLACEHOLDER    = 'https://picsum.photos/seed/default/800/1200';

// ============================================================================
// IMAGE GENERATION
// ============================================================================

/**
 * Generate an image from a text description.
 * Currently uses a webhook — swap to any provider (DALL-E, Midjourney, Flux, etc.)
 * by changing this function.
 */
// Upload a raw image buffer to S3 (if configured) or return a data URL.
async function uploadImageBuffer(buffer: Buffer, ext: 'png' | 'jpg', dataUrlFallback: string): Promise<string> {
  const region  = process.env.LAMBDA_REGION || 'us-east-1';
  const siteUrl = process.env.LAMBDA_SITE_URL || '';
  const bucketMatch = siteUrl.match(/https:\/\/([^.]+)\.s3\./);
  const bucket  = bucketMatch?.[1] || process.env.S3_BUCKET || '';

  if (bucket) {
    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId:     process.env.AWS_ACCESS_KEY_ID     || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
      requestHandler: { requestTimeout: 30000, connectionTimeout: 10000 },
    });
    const contentType = ext === 'png' ? 'image/png' : 'image/jpeg';
    const key = `generated-images/${randomUUID()}.${ext}`;
    try {
      await s3.send(
        new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType }),
        { abortSignal: AbortSignal.timeout(30000) },
      );
    } catch (e: any) {
      console.warn(`[media:image] ⚠️ S3 upload failed (${e.message}) — falling back to data URL`);
      return dataUrlFallback;
    }
    const signedUrl = await getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 7 * 24 * 60 * 60 });
    console.log('[media:image] ✅ uploaded to S3');
    return signedUrl;
  }

  console.log('[media:image] ✅ returning base64 data URL (no S3)');
  return dataUrlFallback;
}

// Try Cloudflare FLUX.1-schnell. Returns base64 string on success, null on failure.
async function tryCloudflare(description: string, width: number, height: number): Promise<string | null> {
  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID()}/ai/run/@cf/black-forest-labs/flux-1-schnell`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${CF_API_TOKEN()}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify({ prompt: description, num_steps: 8, width, height }),
      signal:  AbortSignal.timeout(30000),
    });
    if (!res.ok) {
      console.warn(`[media:image] ⚠️ Cloudflare ${res.status} — will try Runware`);
      return null;
    }
    const json = await res.json() as { result?: { image?: string } };
    const b64 = json?.result?.image;
    if (!b64) { console.warn('[media:image] ⚠️ Cloudflare: no image in response'); return null; }
    console.log('[media:image] ✅ Cloudflare succeeded');
    return b64; // raw base64 JPEG
  } catch (e: any) {
    console.warn('[media:image] ⚠️ Cloudflare error:', e.message, '— will try Runware');
    return null;
  }
}

// Try Runware image inference. Returns a hosted image URL on success.
async function tryRunware(description: string, width: number, height: number): Promise<string | null> {
  const apiKey = RUNWARE_API_KEY();
  if (!apiKey) {
    console.warn('[media:image] ⚠️ Runware skipped: RUNWARE_API_KEY is not set');
    return null;
  }

  try {
    const res = await fetch('https://api.runware.ai/v1', {
      method:  'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify([{
        taskType: 'imageInference',
        model: 'runware:100@1',
        numberResults: 1,
        width,
        height,
        steps: 4,
        CFGScale: 1,
        scheduler: 'FlowMatchEulerDiscreteScheduler',
        includeCost: true,
        checkNSFW: true,
        outputType: ['URL'],
        outputQuality: 85,
        positivePrompt: description,
        taskUUID: randomUUID(),
      }]),
      signal:  AbortSignal.timeout(120000),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => '');
      console.warn(`[media:image] ⚠️ Runware ${res.status}:`, err.slice(0, 200));
      return null;
    }
    const json = await res.json() as { data?: Array<{ imageURL?: string; NSFWContent?: boolean; cost?: number }> };
    const result = json?.data?.[0];
    if (!result?.imageURL) { console.warn('[media:image] ⚠️ Runware: no imageURL in response'); return null; }
    if (result.NSFWContent) { console.warn('[media:image] ⚠️ Runware flagged NSFW content'); return null; }
    console.log(`[media:image] ✅ Runware succeeded${typeof result.cost === 'number' ? ` ($${result.cost})` : ''}`);
    return result.imageURL;
  } catch (e: any) {
    console.warn('[media:image] ⚠️ Runware error:', e.message);
    return null;
  }
}

export async function generateImage(description: string, width = 768, height = 1344): Promise<string> {
  console.log('[media:image] ▶', description?.slice(0, 100));

  if (!description?.trim()) {
    console.warn('[media:image] ⚠️ empty description');
    return IMAGE_PLACEHOLDER;
  }

  // ── Chain: Cloudflare → Runware → placeholder ─────────────────────────────
  const cfB64 = await tryCloudflare(description, width, height);
  if (cfB64) {
    const buffer = Buffer.from(cfB64, 'base64');
    return uploadImageBuffer(buffer, 'jpg', `data:image/jpeg;base64,${cfB64}`);
  }

  const runwareUrl = await tryRunware(description, width, height);
  if (runwareUrl) {
    return runwareUrl;
  }

  console.error('[media:image] ❌ all providers failed — returning placeholder');
  return IMAGE_PLACEHOLDER;
}

/**
 * Generate an image with background removed.
 * Separate endpoint/provider — swap independently of regular image gen.
 */
export async function generateBgRemovedImage(description: string): Promise<string> {
  console.log('[media:image-bg] ▶', description?.slice(0, 100));

  if (!description?.trim()) {
    console.warn('[media:image-bg] ⚠️ empty description');
    return IMAGE_PLACEHOLDER;
  }

  // Generate via Cloudflare, then remove background
  const imageUrl = await generateImage(description);
  if (imageUrl === IMAGE_PLACEHOLDER) return IMAGE_PLACEHOLDER;
  return removeBackgroundFromUrl(imageUrl);
}

/**
 * Remove background from an existing image URL.
 * Downloads the image, sends it to the bg-removal API, returns the S3 signed URL.
 * Falls back to the original URL on failure.
 */
export async function removeBackgroundFromUrl(imageUrl: string): Promise<string> {
  try {
    console.log(`[media:rmbg] ▶ downloading ${imageUrl.slice(0, 80)}...`);
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
    if (!imgRes.ok) {
      console.warn(`[media:rmbg] ⚠️ download failed HTTP ${imgRes.status}`);
      return imageUrl;
    }

    // Convert directly to base64 without holding a separate Buffer copy
    const imageBase64 = Buffer.from(await imgRes.arrayBuffer()).toString('base64');

    const callRmbgApi = async (): Promise<Response> => {
      console.log(`[media:rmbg] ▶ sending to bg-removal API...`);
      return fetch(BG_REMOVAL_API_URL(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
        signal: AbortSignal.timeout(60000),
      });
    };

    let res = await callRmbgApi();

    // Cold-start retry: Lambda needs ~25-50s on first call to load model.
    // First call wakes the container; wait for it to finish, then retry.
    if (!res.ok) {
      console.warn(`[media:rmbg] ⚠️ first call HTTP ${res.status} — cold start? waiting 45s and retrying...`);
      await new Promise(r => setTimeout(r, 45000));
      res = await callRmbgApi();
    }

    if (!res.ok) {
      console.warn(`[media:rmbg] ⚠️ retry also failed HTTP ${res.status}`);
      return imageUrl;
    }

    const data = await res.json();
    const signedUrl = data?.output?.signedUrl;
    if (signedUrl) {
      console.log(`[media:rmbg] ✅ bg removed: ${signedUrl.slice(0, 80)}`);
      return signedUrl;
    }

    console.warn('[media:rmbg] ⚠️ no signedUrl in response, falling back');
    return imageUrl;
  } catch (e: any) {
    console.error(`[media:rmbg] ❌ ${e.message}`);
    return imageUrl;
  }
}

/**
 * Fire-and-forget pre-warm ping to the bg-removal Lambda.
 * Call this at the start of generateVideo so the container wakes up
 * while the pipeline runs (story → content → images). By the time
 * bg-removal is actually needed (~30-60s later), the container is warm.
 */
export function prewarmBgRemoval(): void {
  const url = BG_REMOVAL_API_URL();
  console.log(`[media:rmbg] 🔥 pre-warm ping to ${url.slice(0, 60)}...`);
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prewarm: true }),
    signal: AbortSignal.timeout(30000),
  })
    .then(res => console.log(`[media:rmbg] 🔥 pre-warm done HTTP ${res.status}`))
    .catch(() => { /* ignore — best effort */ });
}

// ============================================================================
// WEB IMAGE SEARCH (Serper.dev — Google Images API)
// ============================================================================

const SERPER_API_KEY = () => process.env.SERPER_API_KEY || 'b6e71757c42328c5dfd373af4811deae8275d53b';

/**
 * Search the web for a real image using Serper.dev (Google Images).
 * Returns the URL of the first result, or null if search fails or is not configured.
 */
export async function searchWebImage(
  query: string,
  opts?: { minWidth?: number; autoScreenshot?: boolean },
): Promise<string | null> {
  const key = SERPER_API_KEY();
  if (!key) {
    console.warn('[media:web-search] ⚠️ SERPER_API_KEY not set');
    return null;
  }

  if (!query?.trim()) return null;

  let q = query;
  if (opts?.autoScreenshot && !q.toLowerCase().includes('screenshot')) {
    q += ' screenshot';
  }

  const minW = opts?.minWidth ?? 0;

  const doSearch = async (searchQuery: string): Promise<string | null> => {
    console.log('[media:web-search] 🔍', searchQuery.slice(0, 100));
    const res = await fetch('https://google.serper.dev/images', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: searchQuery, num: 10 }),
    });

    if (!res.ok) {
      console.error(`[media:web-search] ❌ HTTP ${res.status}`);
      return null;
    }
    const data = await res.json();
    const images: any[] = data.images ?? [];

    // Filter by minimum width if specified
    const candidates = minW > 0
      ? images.filter((img: any) => (img.imageWidth ?? 0) >= minW)
      : images;

    const best = candidates[0]?.imageUrl ?? images[0]?.imageUrl ?? null;
    return best;
  };

  try {
    // First attempt with full query
    let url = await doSearch(q);
    if (url) {
      console.log(`[media:web-search] ✅ found: ${url.slice(0, 80)}`);
      return url;
    }

    // Retry with simplified query: drop the last word
    const words = q.split(/\s+/);
    if (words.length > 2) {
      const simpler = words.slice(0, -1).join(' ');
      console.log('[media:web-search] 🔄 retrying with simpler query');
      url = await doSearch(simpler);
      if (url) {
        console.log(`[media:web-search] ✅ found on retry: ${url.slice(0, 80)}`);
        return url;
      }
    }

    console.warn('[media:web-search] ⚠️ no results for query');
    return null;
  } catch (e: any) {
    console.error('[media:web-search] ❌', e.message);
    return null;
  }
}

// ============================================================================
// WEB SEARCH (Serper.dev — Google Search API)
// ============================================================================

export interface WebSearchResult {
  snippets: string[];
  answerBox?: string;
  knowledgeGraph?: string;
}

/**
 * Search the web for current information using Serper.dev (Google Search).
 * Returns snippets, answer box, and knowledge graph data.
 */
export async function searchWeb(query: string): Promise<WebSearchResult> {
  const key = SERPER_API_KEY();
  if (!key || !query?.trim()) return { snippets: [] };

  try {
    console.log('[media:web-research] 🔎', query.slice(0, 100));
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!res.ok) {
      console.error(`[media:web-research] ❌ HTTP ${res.status}`);
      return { snippets: [] };
    }

    const data = await res.json();
    const snippets = (data.organic || []).slice(0, 5).map((r: any) => r.snippet).filter(Boolean);
    const answerBox = data.answerBox?.snippet || data.answerBox?.answer;
    const knowledgeGraph = data.knowledgeGraph?.description;

    console.log(`[media:web-research] ✅ ${snippets.length} snippets${answerBox ? ' + answerBox' : ''}${knowledgeGraph ? ' + knowledgeGraph' : ''}`);
    return { snippets, answerBox, knowledgeGraph };
  } catch (e: any) {
    console.error('[media:web-research] ❌', e.message);
    return { snippets: [] };
  }
}

/**
 * Search for recent news using Serper.dev (Google News).
 */
export async function searchNews(query: string): Promise<{ title: string; snippet: string; date: string }[]> {
  const key = SERPER_API_KEY();
  if (!key || !query?.trim()) return [];

  try {
    console.log('[media:news-search] 📰', query.slice(0, 100));
    const res = await fetch('https://google.serper.dev/news', {
      method: 'POST',
      headers: { 'X-API-KEY': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: query, num: 5 }),
    });

    if (!res.ok) return [];
    const data = await res.json();
    return (data.news || []).slice(0, 5).map((n: any) => ({
      title: n.title || '',
      snippet: n.snippet || '',
      date: n.date || '',
    }));
  } catch (e: any) {
    console.error('[media:news-search] ❌', e.message);
    return [];
  }
}

// ============================================================================
// AUDIO / TTS GENERATION
// ============================================================================

/**
 * Upload base64 audio to S3 and return a signed URL.
 * Uses the same S3 configuration as proxyImageToS3 and Veo video upload.
 */
async function uploadAudioToS3(base64DataUri: string): Promise<string> {
  try {
    const region = process.env.LAMBDA_REGION || 'us-east-1';
    const siteUrl = process.env.LAMBDA_SITE_URL || '';
    const bucketMatch = siteUrl.match(/https:\/\/([^.]+)\.s3\./);
    const bucket = bucketMatch?.[1] || process.env.S3_BUCKET || '';

    if (!bucket) {
      console.warn('[media:audio:s3] ⚠️ no S3 bucket — returning base64');
      return base64DataUri;
    }

    // Parse the base64 data URI
    const matches = base64DataUri.match(/^data:audio\/(\w+);base64,(.+)$/);
    if (!matches) {
      console.warn('[media:audio:s3] ⚠️ invalid base64 data URI format');
      return base64DataUri;
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');
    const ext = mimeType === 'mpeg' || mimeType === 'mp3' ? 'mp3' : 'wav';

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const key = `tts-audio/${randomUUID()}.${ext}`;

    console.log(`[media:audio:s3] 📤 uploading audio to S3 (${(buffer.length / 1024).toFixed(1)}KB)...`);

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: `audio/${ext === 'mp3' ? 'mpeg' : ext}`,
    }));

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 7 * 24 * 60 * 60 }, // 7 days
    );

    console.log(`[media:audio:s3] ✅ uploaded to S3: s3://${bucket}/${key}`);
    return signedUrl;
  } catch (e: any) {
    console.error(`[media:audio:s3] ❌ ${e.message} — falling back to base64`);
    return base64DataUri;
  }
}

/**
 * Generate speech audio from text.
 * Generates audio via TTS provider, then uploads to S3 for a signed URL.
 * Returns S3 signed URL or empty string on failure.
 */
export async function generateAudio(text: string, voice?: string): Promise<string> {
  if (!text?.trim()) return '';
  try {
    const base64 = await generateTTS(text, voice || DEFAULT_TTS_VOICE);
    if (!base64) return '';
    
    // Upload to S3 and return signed URL
    return await uploadAudioToS3(base64);
  } catch (e: any) {
    console.error('[media:audio] ❌', e.message);
    return '';
  }
}

// ============================================================================
// VIDEO GENERATION
// ============================================================================

/**
 * Generate a video from a text prompt.
 * Currently uses Google Veo 3.1 via Vertex AI.
 * Returns a signed S3 URL or data URI. Throws on failure.
 */
export async function generateVideo(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
): Promise<string> {
  return generateVideoUrl(prompt, aspectRatio);
}

// ============================================================================
// IMAGE PROXYING — download web images and re-upload to S3 for persistence
// ============================================================================

/**
 * Download an image from a URL and upload it to S3.
 * Returns a signed S3 URL (7-day expiry). Falls back to original URL on failure.
 */
export async function proxyImageToS3(sourceUrl: string): Promise<string> {
  try {
    const region = process.env.LAMBDA_REGION || 'us-east-1';
    const siteUrl = process.env.LAMBDA_SITE_URL || '';
    const bucketMatch = siteUrl.match(/https:\/\/([^.]+)\.s3\./);
    const bucket = bucketMatch?.[1] || process.env.S3_BUCKET || '';

    if (!bucket) {
      console.warn('[media:proxy] ⚠️ no S3 bucket — returning original URL');
      return sourceUrl;
    }

    console.log(`[media:proxy] 📦 downloading ${sourceUrl.slice(0, 80)}...`);
    const res = await fetch(sourceUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      console.warn(`[media:proxy] ⚠️ HTTP ${res.status} — returning original`);
      return sourceUrl;
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg';

    const s3 = new S3Client({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });

    const key = `proxied-images/${randomUUID()}.${ext}`;

    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }));

    const signedUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: bucket, Key: key }),
      { expiresIn: 7 * 24 * 60 * 60 },
    );

    console.log(`[media:proxy] ✅ proxied to S3: s3://${bucket}/${key}`);
    return signedUrl;
  } catch (e: any) {
    console.error(`[media:proxy] ❌ ${e.message} — returning original URL`);
    return sourceUrl;
  }
}

// ============================================================================
// CONVENIENCE: Regenerate single assets (used by API routes)
// ============================================================================

export async function regenerateSingleImage(
  description: string,
  removeBackground: boolean,
): Promise<{ url: string }> {
  // Web-first policy: try SerpAPI image search before falling back to AI generation
  // (Cloudflare → Runware). Real photos beat AI for any subject that exists in the
  // real world. Same chain as the initial-creation path in resolve-media.tool.ts.
  try {
    const webUrl = await searchWebImage(description, { minWidth: 800 });
    if (webUrl) {
      console.log(`[regenerate-image] 🔍 web hit, using real photo`);
      if (removeBackground) {
        const bgRemoved = await removeBackgroundFromUrl(webUrl);
        return { url: bgRemoved };
      }
      const proxied = await proxyImageToS3(webUrl);
      return { url: proxied };
    }
    console.log(`[regenerate-image] 🔍 web miss, falling back to AI generation`);
  } catch (e: any) {
    console.warn(`[regenerate-image] ⚠️ web search errored, falling back: ${e.message}`);
  }

  const url = removeBackground
    ? await generateBgRemovedImage(description)
    : await generateImage(description);
  return { url };
}

export async function regenerateSingleVideo(
  prompt: string,
  aspectRatio: '16:9' | '9:16' | '1:1' = '16:9',
): Promise<{ url: string }> {
  const url = await generateVideo(prompt, aspectRatio);
  return { url };
}
