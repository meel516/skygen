
import { resolveTextProvider } from './config';
import { generateWithOpenRouter } from './openrouter';
import { generateWithGemini } from './gemini';
import { generateWithXai } from './xai';
import type { GenerateTextParams, GenerateTextResult } from './types';

export type { AIMessage, GenerateTextParams, GenerateTextResult } from './types';
export { getServerAiSettings } from './config';

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const config = resolveTextProvider({
    apiKey: params.apiKey,
    model: params.model,
  });

  // Primary path: OpenRouter
  if (config.provider === 'openrouter') {
    return generateWithOpenRouter(params);
  }

  // Legacy fallback paths (removed in Phase 4)
  if (config.provider === 'gemini') {
    return generateWithGemini(config, params);
  }

  return generateWithXai(config, params);
}
