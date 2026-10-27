
import { createOpenAI } from '@ai-sdk/openai';

/**
 * Create a Google AI Studio–backed model via the Gemini OpenAI-compat endpoint.
 * No extra SDK needed — Google exposes `/v1beta/openai/chat/completions` which
 * works with @ai-sdk/openai the same way OpenRouter does.
 *
 * Free tier (as of 2026): 1500 req/day, 1M TPM on gemini-flash-latest.
 */
export function createGoogleModel(modelId?: string) {
  const google = createOpenAI({
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY!,
  });
  return google.chat(modelId ?? process.env.DEFAULT_AI_MODEL ?? 'gemini-2.5-pro');
}
