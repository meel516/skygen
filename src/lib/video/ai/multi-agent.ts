import { getSelectedModel } from './template-ai';
import { generateTTS } from './deepgram-tts';

export interface GenerateVideoPayloadResult {
  success: boolean;
  payload: {
    videoMeta: Record<string, any>;
    contentBlocks: Record<string, any>[];
  };
  errors: string[];
}

// ── Main entry — generates the full VideoInputSchema payload from a story + template
export async function generateVideoPayload(
  userStory: string,
  templateBlocks: Array<{ type: string; [key: string]: any }>,
  partialVideoMeta: Record<string, any> = {}
): Promise<GenerateVideoPayloadResult> {
  console.log('🎬 Sending to server-side LangGraph...');

  const response = await fetch('/api/ai/multi-agent', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userStory,
      templateBlocks,
      partialVideoMeta,
      model: getSelectedModel(),

    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    return {
      success: false,
      payload: { videoMeta: partialVideoMeta, contentBlocks: templateBlocks },
      errors: [err.error],
    };
  }

  return response.json();
}

// ── Field-level magic button — client-side only, no graph needed
export async function generateFieldWithAgent(
  fieldType: 'text' | 'image' | 'audio',
  prompt: string,
  _apiKey?: string
): Promise<string> {
  if (fieldType === 'image') {
    const res = await fetch('/api/image/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    return data.signedUrl ?? '';
  }

  if (fieldType === 'audio') {
    try {
      const audioBase64 = await generateTTS(prompt);
      const binary = atob(audioBase64.replace(/^data:audio\/[^;]+;base64,/, ''));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
    } catch {
      return '';
    }
  }

  // Text field
  const res = await fetch('/api/ai/text', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, model: getSelectedModel() }),
  });
  const data = await res.json();
  return data.text ?? '';
}

// Backward compat
export const fillTemplateContent = async (
  userStory: string,
  templateBlocks: Array<{ type: string; [key: string]: any }>,
  partialVideoMeta: Record<string, any> = {}
) => {
  // Client-side function already gets apiKey & model from localStorage internally
  const result = await generateVideoPayload(userStory, templateBlocks, partialVideoMeta);
  return {
    success: result.success,
    blocks:  result.payload.contentBlocks,
    errors:  result.errors,
  };
};
export const generateVideoContentWithAgents = fillTemplateContent;
