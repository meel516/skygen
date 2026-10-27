import { generateImage, generateBgRemovedImage, generateAudio, searchWebImage, proxyImageToS3, removeBackgroundFromUrl } from '../../media-service';
import type { MediaStrategy } from '../shared/types';

/**
 * Resolve (generate/search) images for classified image fields.
 * Uses removeBackground from normalizedFields (passed through classify step).
 */
export async function resolveImages(params: {
  imageFields: { path: string; description: string; searchQuery?: string; removeBackground?: boolean }[];
  rawContent: Record<string, any>;
  blockIndex: number;
  blockType: string;
  mediaStrategy: MediaStrategy | null;
  visualStyleGuide: string;
  apiKey: string;
}): Promise<{ resolvedUrls: Record<string, string> }> {
  console.log(`[resolve_images] ▶ ENTERED — imageFields:`, JSON.stringify(params.imageFields));

  if (params.imageFields.length === 0) {
    return { resolvedUrls: {} };
  }

  const blockStrategy = params.mediaStrategy?.blockStrategies
    ?.find(b => b.blockIndex === params.blockIndex);

  const results = await Promise.all(
    params.imageFields.map(async ({ path, description, searchQuery, removeBackground }) => {
      const needsBgRemoval = removeBackground ?? false;

      if (searchQuery) {
        const webUrl = await searchWebImage(searchQuery, {
          minWidth: blockStrategy?.minWidth ?? 800,
          autoScreenshot: blockStrategy?.autoScreenshot ?? false,
        });
        if (webUrl) {
          console.log(`[resolve_images] 🔍 web hit "${path}": ${webUrl.slice(0, 80)}`);
          if (needsBgRemoval) {
            const bgRemoved = await removeBackgroundFromUrl(webUrl);
            return [path, bgRemoved] as const;
          }
          const proxied = await proxyImageToS3(webUrl);
          return [path, proxied] as const;
        }
        console.log(`[resolve_images] 🔍 web miss "${path}", falling back to AI generation`);
      }

      const styledDescription = params.visualStyleGuide
        ? `${params.visualStyleGuide}. ${description}`
        : description;

      console.log(`[resolve_images] → generating "${path}" (bgRemoval=${needsBgRemoval}): ${styledDescription.slice(0, 120)}`);
      const TIMEOUT_MS = 90_000;
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`image timeout after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS)
      );
      const url = await Promise.race([
        needsBgRemoval ? generateBgRemovedImage(styledDescription) : generateImage(styledDescription),
        timeoutPromise,
      ]).catch((e: Error) => {
        console.warn(`[resolve_images] ⚠️ "${path}" failed: ${e.message} — using placeholder`);
        return 'https://picsum.photos/seed/placeholder/800/1200';
      });
      console.log(`[resolve_images] ✅ "${path}": ${url.slice(0, 80)}`);
      return [path, url] as const;
    })
  );

  return { resolvedUrls: Object.fromEntries(results) };
}

/**
 * Resolve (generate TTS) audio for classified audio fields.
 */
export async function resolveAudio(params: {
  audioFields: { path: string; text: string }[];
  preferredVoice: string | null;
  blockIndex: number;
}): Promise<{ resolvedAudio: Record<string, string> }> {
  console.log(`[resolve_audio] ▶ ENTERED — audioFields:`, JSON.stringify(params.audioFields));

  if (params.audioFields.length === 0) {
    return { resolvedAudio: {} };
  }

  const results = await Promise.all(
    params.audioFields.map(async ({ path, text }) => {
      console.log(`[resolve_audio] → TTS for "${path}": ${text.slice(0, 80)}`);
      const audio = await generateAudio(text, params.preferredVoice ?? undefined);
      console.log(`[resolve_audio] ✅ "${path}": audio length ${audio?.length ?? 0}`);
      return [path, audio] as const;
    })
  );

  return { resolvedAudio: Object.fromEntries(results) };
}

/**
 * Resolve video fields (currently defers to review step).
 */
export async function resolveVideo(params: {
  videoFields: { path: string; prompt: string }[];
  rawContent: Record<string, any>;
  blockIndex: number;
}): Promise<{ resolvedUrls: Record<string, string> }> {
  console.log(`[resolve_video] ▶ ENTERED — videoFields:`, JSON.stringify(params.videoFields));
  console.log('[resolve_video] ⏭️ deferring video generation to review step');
  return { resolvedUrls: {} };
}
