
import type { GenerateTextParams, GenerateTextResult, ResolvedProviderConfig } from './types';

const X_AI_API_URL = 'https://api.x.ai/v1/chat/completions';

export async function generateWithXai(
  config: ResolvedProviderConfig,
  params: GenerateTextParams,
): Promise<GenerateTextResult> {
  const response = await fetch(X_AI_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.model,
      messages: params.messages,
      max_tokens: params.maxTokens ?? 1000,
      temperature: params.temperature,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`x.ai API error ${response.status}: ${raw.slice(0, 400)}`);
  }

  let data: any;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error('Failed to parse x.ai response as JSON');
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error('x.ai response had no content');
  }

  return {
    text,
    provider: 'xai',
    model: config.model,
    usage: {
      totalTokens: data?.usage?.total_tokens,
    },
  };
}
