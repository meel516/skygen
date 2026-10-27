
import { createOpenAI } from '@ai-sdk/openai';
import type { GenerateTextParams, GenerateTextResult } from './types';
import { generateText as aiGenerateText } from 'ai';

/**
 * Create an OpenRouter-backed model instance using the Vercel AI SDK
 * OpenAI-compatible provider. This is model-agnostic — any model
 * available on OpenRouter can be selected by ID.
 */
export function createOpenRouterModel(modelId?: string, apiKey?: string | null) {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || apiKey?.trim();

  // Routed to DeepSeek via their OpenAI-compat endpoint.
  // Name kept as `createOpenRouterModel` so existing agent imports work unchanged.
  const deepseek = createOpenAI({
    baseURL: 'https://api.deepseek.com/v1',
    apiKey: deepseekKey || 'missing-deepseek-api-key',
  });
  return deepseek.chat(modelId ?? process.env.DEFAULT_AI_MODEL ?? 'deepseek-chat');
}

/**
 * Generate text via OpenRouter using the Vercel AI SDK.
 * Replaces the old gemini.ts / xai.ts raw-fetch implementations.
 */
export async function generateWithOpenRouter(
  params: GenerateTextParams,
): Promise<GenerateTextResult> {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || params.apiKey?.trim();
  if (!deepseekKey) {
    throw new Error('No DeepSeek API key configured. Set DEEPSEEK_API_KEY or pass a per-request apiKey.');
  }

  const modelId = params.model?.trim() || process.env.DEFAULT_AI_MODEL || 'deepseek-chat';
  const model = createOpenRouterModel(modelId, deepseekKey);

  // Map our AIMessage format to Vercel AI SDK CoreMessage format
  const systemParts: string[] = [];
  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  for (const msg of params.messages) {
    if (msg.role === 'system') {
      systemParts.push(msg.content);
    } else {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }
  }

  const system = systemParts.join('\n\n');

  const result = await aiGenerateText({
    model,
    system: system || undefined,
    messages,
    maxOutputTokens: params.maxTokens ?? 1000,
    temperature: params.temperature,
  });

  return {
    text: result.text,
    provider: 'openrouter',
    model: modelId,
    usage: {
      totalTokens: result.usage?.totalTokens,
    },
  };
}
