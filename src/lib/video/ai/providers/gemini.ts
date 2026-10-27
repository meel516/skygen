
import type { AIMessage, GenerateTextParams, GenerateTextResult, ResolvedProviderConfig } from './types';

const GOOGLE_PROJECT_ID = () => process.env.GOOGLE_PROJECT_ID || '';
const GOOGLE_LOCATION = () => process.env.GOOGLE_LOCATION || 'us-central1';

const DEFAULT_SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' },
];

function splitMessages(messages: AIMessage[]): {
  systemInstruction?: { parts: Array<{ text: string }> };
  contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
  const systemText = messages
    .filter((message) => message.role === 'system' && message.content?.trim())
    .map((message) => message.content.trim())
    .join('\n\n');

  const contents = messages
    .filter((message) => message.role !== 'system' && message.content?.trim())
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' as const : 'user' as const,
      parts: [{ text: message.content }],
    }));

  return {
    systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
    contents,
  };
}

function extractText(data: any): string {
  const candidate = data?.candidates?.[0];
  const parts = candidate?.content?.parts ?? [];
  const text = parts
    .map((part: any) => part?.text)
    .filter((value: unknown): value is string => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .trim();

  if (!text) {
    const finishReason = candidate?.finishReason || 'UNKNOWN';
    const blockReason = data?.promptFeedback?.blockReason;
    throw new Error(
      `Gemini response had no text content (finishReason=${finishReason}${blockReason ? `, blockReason=${blockReason}` : ''}, parts=${parts.length})`,
    );
  }

  return text;
}

function shouldDisableThinking(model: string): boolean {
  return /gemini-2\.5-flash(-lite)?/i.test(model);
}

export async function generateWithGemini(
  config: ResolvedProviderConfig,
  params: GenerateTextParams,
): Promise<GenerateTextResult> {
  const { systemInstruction, contents } = splitMessages(params.messages);
  if (contents.length === 0) {
    throw new Error('Gemini request requires at least one non-system message.');
  }

  const projectId = GOOGLE_PROJECT_ID();
  const location = GOOGLE_LOCATION();
  if (!projectId) {
    throw new Error('GOOGLE_PROJECT_ID is required for Vertex Gemini text generation.');
  }

  const url = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${config.model}:generateContent?key=${config.apiKey}`;
  const body = {
    ...(systemInstruction ? { systemInstruction } : {}),
    contents,
    generationConfig: {
      temperature: params.temperature ?? 1,
      maxOutputTokens: params.maxTokens ?? 1000,
      topP: 0.95,
      ...(shouldDisableThinking(config.model) ? {
        thinkingConfig: {
          thinkingBudget: 0,
        },
      } : {}),
    },
    safetySettings: DEFAULT_SAFETY_SETTINGS,
    ...(params.enableWebSearch ? { tools: [{ googleSearch: {} }] } : {}),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${raw.slice(0, 400)}`);
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse Gemini response as JSON');
  }

  return {
    text: extractText(data),
    provider: 'gemini',
    model: config.model,
    usage: {
      totalTokens: data?.usageMetadata?.totalTokenCount,
    },
  };
}
