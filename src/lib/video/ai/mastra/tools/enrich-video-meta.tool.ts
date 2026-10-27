import { callAIWithTracking, parseJSON, languageName } from '../shared/utils';

/**
 * Enrich partial videoMeta with AI-generated defaults.
 * Owns its logic — no graph.ts dependency.
 */
export async function enrichVideoMeta(params: {
  userStory: string;
  partialVideoMeta: Record<string, any>;
  language: string;
  apiKey: string;
  model: string;
}): Promise<Record<string, any>> {
  console.log('[enrich_video_meta] ▶ filling missing videoMeta fields');

  const provided   = params.partialVideoMeta ?? {};
  const alreadySet = Object.keys(provided).filter(k => provided[k] !== undefined);

  try {
    const response = await callAIWithTracking({
      messages: [
        {
          role: 'system',
          content: `You are a video metadata generator. Fill in any missing videoMeta fields.

Valid values:
- aspectRatio: "16:9" | "9:16" | "1:1" | "4:5"  (default "9:16" for social/mobile)
- theme: "dark_modern" | "light_clean" | "gradient_vibrant" | "minimal_bw"
- fps: 24 | 30 | 60  (default 30)
- intro: { title (string), subtitle (string), duration (1-5) }
- outro: { title (string), subtitle (string), duration (1-5) }
- audioTracks: [] (leave empty unless story explicitly mentions background music)
- subtitleTrack: optional object { entries: [{startTime, endTime, text}], style: {textStyle, fontSize, ...}, enabled } — leave out unless user requests subtitles
- textOverlayTracks: [] optional array of persistent text overlays (watermarks, lower thirds). Each: { id, text, textStyle, fontSize, textPosition, textColor, opacity, startTime, endTime (null=forever), enabled }

DO NOT change already-provided fields: ${alreadySet.join(', ') || 'none'}
Pick theme and aspectRatio that best fit the story's tone and platform.
${params.language !== 'en' ? `LANGUAGE: All viewer-facing text (intro title/subtitle, outro title/subtitle) MUST be in ${languageName(params.language)}.` : ''}
Return complete JSON only, no markdown.`,
        },
        {
          role: 'user',
          content: `Story: "${params.userStory}"
Already provided: ${JSON.stringify(provided, null, 2)}
Return complete videoMeta JSON.`,
        },
      ],
      apiKey: params.apiKey,
      maxTokens: 600,
      model: params.model,
    });

    const aiMeta   = parseJSON(response);
    const videoMeta = { ...aiMeta, ...provided };
    console.log('[enrich_video_meta] ✅ videoMeta:', JSON.stringify(videoMeta));
    return videoMeta;
  } catch (e: any) {
    console.warn('[enrich_video_meta] ⚠️ failed, using defaults:', e.message);
    return {
      aspectRatio: '9:16',
      theme:       'dark_modern',
      fps:         30,
      audioTracks: [],
      textOverlayTracks: [],
      intro:       { title: '', subtitle: '', duration: 2 },
      outro:       { title: '', subtitle: '', duration: 2 },
      ...provided,
    };
  }
}
