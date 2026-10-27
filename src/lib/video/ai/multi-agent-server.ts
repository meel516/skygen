// Server-only: This module uses @langchain/langgraph which requires Node.js
// It should ONLY be imported in API routes or server-side code

import { StateGraph, Annotation } from '@langchain/langgraph';
import { generateTTS } from './deepgram-tts';
import { generateText } from './providers';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

// ============================================================================
// CONFIG & HELPERS
// ============================================================================

function getModel(): string {
  return process.env.GEMINI_MODEL || process.env.XAI_MODEL || 'gemini-2.5-flash';
}

async function callAI(
  messages: { role: string; content: string }[],
  apiKey: string,
  maxTokens = 1000
): Promise<string> {
  const result = await generateText({
    messages,
    apiKey,
    maxTokens,
    model: getModel(),
  });
  return result.text;
}

async function generateImageUrl(description: string): Promise<string> {
  if (!description?.trim()) return 'https://picsum.photos/seed/default/800/1200';
  try {
    const response = await fetch('/api/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: description }),
    });
    const data = await response.json();
    return data.signedUrl ?? 'https://picsum.photos/seed/fallback/800/1200';
  } catch {
    return 'https://picsum.photos/seed/error/800/1200';
  }
}

// ============================================================================
// AUDIO S3 UPLOAD HELPER
// ============================================================================

/**
 * Upload base64 audio to S3 and return a signed URL.
 * Uses the same S3 configuration as other media-service functions.
 */
async function uploadAudioToS3(base64DataUri: string): Promise<string> {
  try {
    const region = process.env.LAMBDA_REGION || 'us-east-1';
    const siteUrl = process.env.LAMBDA_SITE_URL || '';
    const bucketMatch = siteUrl.match(/https:\/\/([^.]+)\.s3\./);
    const bucket = bucketMatch?.[1] || process.env.S3_BUCKET || '';

    if (!bucket) {
      console.warn('[audio:s3] ⚠️ no S3 bucket — returning base64');
      return base64DataUri;
    }

    // Parse the base64 data URI
    const matches = base64DataUri.match(/^data:audio\/(\w+);base64,(.+)$/);
    if (!matches) {
      console.warn('[audio:s3] ⚠️ invalid base64 data URI format');
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

    console.log(`[audio:s3] 📤 uploading audio to S3 (${(buffer.length / 1024).toFixed(1)}KB)...`);

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

    console.log(`[audio:s3] ✅ uploaded to S3: s3://${bucket}/${key}`);
    return signedUrl;
  } catch (e: any) {
    console.error(`[audio:s3] ❌ ${e.message} — falling back to base64`);
    return base64DataUri;
  }
}

async function generateAudio(text: string): Promise<string> {
  if (!text) return '';
  try {
    const audioBase64 = await generateTTS(text);
    if (!audioBase64) return '';
    // Upload to S3 and return signed URL
    return await uploadAudioToS3(audioBase64);
  } catch {
    return '';
  }
}

// ============================================================================
// GRAPH STATE
// ============================================================================

const BlockFillState = Annotation.Root({
  // Inputs
  blockType: Annotation<string>(),
  blockIndex: Annotation<number>(),
  userStory: Annotation<string>(),
  originalBlock: Annotation<Record<string, any>>(),

  // Written by generate_content
  rawContent: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),

  // Written by classify_media_fields
  imageFields: Annotation<{ path: string; description: string }[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),
  audioFields: Annotation<{ path: string; text: string }[]>({
    default: () => [],
    reducer: (_, v) => v,
  }),

  // Written by resolve_images / resolve_audio (merged across parallel runs)
  resolvedUrls: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (existing, incoming) => ({ ...existing, ...incoming }),
  }),
  resolvedAudio: Annotation<Record<string, string>>({
    default: () => ({}),
    reducer: (existing, incoming) => ({ ...existing, ...incoming }),
  }),

  // Written by merge_media
  finalBlock: Annotation<Record<string, any>>({
    default: () => ({}),
    reducer: (_, v) => v,
  }),

  error: Annotation<string | null>({
    default: () => null,
    reducer: (_, v) => v,
  }),
});

type BlockFillStateType = typeof BlockFillState.State;

// ============================================================================
// HELPERS
// ============================================================================

function parseJSON(raw: string): Record<string, any> {
  let str = raw.trim();
  if (str.startsWith('```json')) str = str.slice(7);
  else if (str.startsWith('```')) str = str.slice(3);
  if (str.endsWith('```')) str = str.slice(0, -3);
  return JSON.parse(str.trim());
}

function setNestedValue(obj: any, dotPath: string, value: any): any {
  // Handles "src", "avatars[0].src", "layers[1].src" etc.
  const parts = dotPath.replace(/\[(\d+)\]/g, '.$1').split('.');
  const result = JSON.parse(JSON.stringify(obj));
  let cursor = result;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor = cursor[parts[i]];
  }
  cursor[parts[parts.length - 1]] = value;
  return result;
}

// ============================================================================
// NODE: generate_content
// ============================================================================

async function generateContent(state: BlockFillStateType, apiKey: string) {
  console.log(`[generate_content] block ${state.blockIndex + 1}: ${state.blockType}`);

  try {
    const response = await callAI([
      {
        role: 'system',
        content: `You are a content filler for video template blocks. Your ONLY job is to generate JSON content.
DO NOT change the block type. Return a single JSON object only, no markdown fences.

IMPORTANT: For any field that represents a visual image (regardless of the field name),
write a SHORT DESCRIPTIVE PHRASE of what the image should show — NOT a URL.
Example: "futuristic city skyline at dusk" not "https://example.com/city.jpg"`,
      },
      {
        role: 'user',
        content: `USER STORY: ${state.userStory}

Generate content for block #${state.blockIndex + 1}
BLOCK TYPE: "${state.blockType}"

Return a valid JSON object with appropriate fields for this block type.`,
      },
    ], apiKey, 1500);

    return { rawContent: parseJSON(response) };
  } catch (e: any) {
    return { error: `generate_content failed: ${e.message}`, rawContent: {} };
  }
}

// ============================================================================
// NODE: classify_media_fields
// The LLM reasons contextually about which fields need image/audio generation.
// No hardcoded field names, no regex — pure semantic reasoning.
// ============================================================================

async function classifyMediaFields(state: BlockFillStateType, apiKey: string) {
  console.log(`[classify_media_fields] inspecting content for ${state.blockType}`);

  try {
    const response = await callAI([
      {
        role: 'system',
        content: `You are a media field classifier. Given a block type and its generated JSON,
identify every field that needs media generation.

Reason about BOTH the field name AND the value together:
- Does the field name imply a visual? (src, image, img, photo, avatar, cover, thumbnail, banner, background, poster, icon, visual, picture, graphic...)
- Does the value look like an image description or placeholder URL? (picsum, unsplash, placeholder, lorem, example.com...)
- Given the block type, does this field semantically represent a visual asset?
- For audio: does the field name imply spoken content? (narration, speech, voiceover, audio, tts...)

For nested fields in arrays use dot notation: "avatars[0].src", "layers[1].src"

Return ONLY a JSON object with two arrays:
{
  "imageFields": [{ "path": "dot.path", "description": "clear image generation prompt" }],
  "audioFields": [{ "path": "dot.path", "text": "the text to convert to speech" }]
}

If a value is already a good image description, use it as-is.
If it's a placeholder URL, infer intent from context and rewrite as a description.
Return empty arrays if no fields qualify. Return JSON only, no markdown.`,
      },
      {
        role: 'user',
        content: `Block type: "${state.blockType}"
User story: "${state.userStory}"
Generated content: ${JSON.stringify(state.rawContent, null, 2)}`,
      },
    ], apiKey, 1000);

    const classified = parseJSON(response);

    return {
      imageFields: classified.imageFields ?? [],
      audioFields: classified.audioFields ?? [],
    };
  } catch (e: any) {
    console.warn('[classify_media_fields] failed, skipping media:', e.message);
    return { imageFields: [], audioFields: [] };
  }
}

// ============================================================================
// NODE: resolve_images
// Runs all image generations in parallel inside the node.
// ============================================================================

async function resolveImages(state: BlockFillStateType) {
  console.log(`[resolve_images] generating ${state.imageFields.length} image(s)`);

  const results = await Promise.all(
    state.imageFields.map(async ({ path, description }) => {
      const url = await generateImageUrl(description);
      console.log(`  ✓ ${path} → ${url.slice(0, 60)}...`);
      return [path, url] as const;
    })
  );

  return {
    resolvedUrls: Object.fromEntries(results),
  };
}

// ============================================================================
// NODE: resolve_audio
// Runs all TTS generations in parallel inside the node.
// ============================================================================

async function resolveAudio(state: BlockFillStateType) {
  console.log(`[resolve_audio] generating ${state.audioFields.length} audio clip(s)`);

  const results = await Promise.all(
    state.audioFields.map(async ({ path, text }) => {
      const url = await generateAudio(text);
      console.log(`  ✓ ${path} → audio blob`);
      return [path, url] as const;
    })
  );

  return {
    resolvedAudio: Object.fromEntries(results),
  };
}

// ============================================================================
// NODE: merge_media
// Writes all resolved URLs back into rawContent, then merges with
// original block's customization fields (animations, colors, etc.)
// ============================================================================

async function mergeMedia(state: BlockFillStateType) {
  console.log('[merge_media] merging resolved media into block');

  let content = { ...state.rawContent };

  // Write resolved image URLs back at their dot-notation paths
  for (const [path, url] of Object.entries(state.resolvedUrls)) {
    content = setNestedValue(content, path, url);
  }

  // Write resolved audio URLs back
  for (const [path, url] of Object.entries(state.resolvedAudio)) {
    if (url) {
      content = setNestedValue(content, path, url);
      // Also set audioSrc if this is a narration field
      if (path.includes('narration') || path.includes('audio')) {
        content.audioSrc = url;
      }
    }
  }

  // Remove any 'type' key the LLM may have added
  const { type: _stripped, ...contentWithoutType } = content;

  // Merge with original block's customization (preserve animations, colors, etc.)
  const orig = state.originalBlock ?? {};
  const finalBlock: Record<string, any> = {
    type: state.blockType, // always forced from template
    ...contentWithoutType,
    // Preserve these fields from the original template block
    ...(orig.verticalAlign   !== undefined && { verticalAlign:   orig.verticalAlign }),
    ...(orig.horizontalAlign !== undefined && { horizontalAlign: orig.horizontalAlign }),
    ...(orig.enterAnimation  !== undefined && { enterAnimation:  orig.enterAnimation }),
    ...(orig.exitAnimation   !== undefined && { exitAnimation:   orig.exitAnimation }),
    ...(orig.animationDuration!== undefined && { animationDuration: orig.animationDuration }),
    ...(orig.backgroundColor !== undefined && { backgroundColor: orig.backgroundColor }),
    ...(orig.backgroundImage !== undefined && { backgroundImage: orig.backgroundImage }),
    ...(orig.backgroundBlur  !== undefined && { backgroundBlur:  orig.backgroundBlur }),
    ...(orig.borderColor     !== undefined && { borderColor:     orig.borderColor }),
    ...(orig.borderWidth     !== undefined && { borderWidth:     orig.borderWidth }),
    ...(orig.borderRadius    !== undefined && { borderRadius:    orig.borderRadius }),
    ...(orig.shadowEnabled   !== undefined && { shadowEnabled:   orig.shadowEnabled }),
    ...(orig.shadowColor     !== undefined && { shadowColor:     orig.shadowColor }),
    ...(orig.shadowBlur      !== undefined && { shadowBlur:      orig.shadowBlur }),
    ...(orig.padding         !== undefined && { padding:         orig.padding }),
    ...(orig.margin          !== undefined && { margin:          orig.margin }),
  };

  return { finalBlock };
}

// ============================================================================
// CONDITIONAL EDGE ROUTERS
// All branching logic lives here, inside the graph.
// ============================================================================

function routeAfterClassify(state: BlockFillStateType): string[] {
  const next: string[] = [];
  if (state.imageFields.length > 0) next.push('resolve_images');
  if (state.audioFields.length > 0) next.push('resolve_audio');
  if (next.length === 0) next.push('merge_media');
  return next;
}

function routeAfterResolve(state: BlockFillStateType): string {
  // Wait until both resolvers have run if both were needed.
  // LangGraph fan-in: merge_media only runs once both parallel nodes complete.
  return 'merge_media';
}

// ============================================================================
// GRAPH ASSEMBLY
// ============================================================================

function buildBlockFillGraph(apiKey: string) {
  const graph = new StateGraph(BlockFillState)
    .addNode('generate_content',      (state) => generateContent(state, apiKey))
    .addNode('classify_media_fields', (state) => classifyMediaFields(state, apiKey))
    .addNode('resolve_images',        resolveImages)
    .addNode('resolve_audio',         resolveAudio)
    .addNode('merge_media',           mergeMedia)

    .addEdge('__start__',             'generate_content')
    .addEdge('generate_content',      'classify_media_fields')

    // Branch: images only / audio only / both / neither — all decided inside graph
    .addConditionalEdges('classify_media_fields', routeAfterClassify, {
      resolve_images: 'resolve_images',
      resolve_audio:  'resolve_audio',
      merge_media:    'merge_media',
    })

    .addEdge('resolve_images', 'merge_media')
    .addEdge('resolve_audio',  'merge_media')
    .addEdge('merge_media',    '__end__');

  return graph.compile();
}

// ============================================================================
// PUBLIC API — Server-side execution
// ============================================================================

export interface FilledBlock {
  type: string;
  [key: string]: any;
}

export interface FillTemplateContentResult {
  success: boolean;
  blocks: FilledBlock[];
  errors: string[];
}

export async function fillTemplateContentServer(
  userStory: string,
  templateBlocks: Array<{ type: string; [key: string]: any }>,
  apiKey: string
): Promise<FillTemplateContentResult> {
  console.log('🎬 Starting template content filling via LangGraph (server-side)...');
  console.log(`   Story: "${userStory.slice(0, 50)}..."`);
  console.log(`   Blocks: ${templateBlocks.length} (${templateBlocks.map(b => b.type).join(', ')})`);

  if (templateBlocks.length === 0) {
    return { success: true, blocks: [], errors: [] };
  }

  const errors: string[] = [];

  // Create a fresh graph for each call (to avoid state issues)
  const blockFillGraph = buildBlockFillGraph(apiKey);

  // Process blocks sequentially (each is its own graph invocation)
  const blocks = await Promise.all(
    templateBlocks.map(async (block, i) => {
      try {
        const result = await blockFillGraph.invoke({
          blockType:     block.type,
          blockIndex:    i,
          userStory,
          originalBlock: block,
        });

        if (result.error) {
          errors.push(`Block ${i + 1} (${block.type}): ${result.error}`);
          // Fall back to original block on error
          return block as FilledBlock;
        }

        return result.finalBlock as FilledBlock;
      } catch (e: any) {
        errors.push(`Block ${i + 1} (${block.type}): ${e.message}`);
        return block as FilledBlock;
      }
    })
  );

  console.log('✅ All blocks filled.');
  return { success: errors.length === 0, blocks, errors };
}
