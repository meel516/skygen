
import type { AIProvider, ResolvedProviderConfig } from './types';

export const DEFAULT_AI_MODEL = process.env.DEFAULT_AI_MODEL || process.env.DEEPSEEK_MODEL || 'deepseek-chat';

export const DEEPSEEK_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
];

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Resolve the text provider config.
 * The `openrouter` provider id is kept for compatibility with older code, but
 * the implementation now points directly at DeepSeek's OpenAI-compatible API.
 * Prefer the server-side DEEPSEEK_API_KEY, but allow a per-user key from
 * api_key_deepseek for template/LangGraph flows when the server key is absent.
 */
export function resolveTextProvider(options: {
  apiKey?: string | null;
  model?: string | null;
}): ResolvedProviderConfig {
  const deepseekKey = process.env.DEEPSEEK_API_KEY?.trim() || options.apiKey?.trim() || '';
  const requestedModel = options.model?.trim() || DEFAULT_AI_MODEL;

  if (hasText(deepseekKey)) {
    return {
      provider: 'openrouter',
      apiKey: deepseekKey,
      model: requestedModel,
    };
  }

  // Fallback: try legacy keys for backward compatibility during migration
  const googleKey = process.env.GOOGLE_API_KEY?.trim() || '';
  const serverXaiKey = process.env.XAI_API_KEY?.trim() || '';

  if (hasText(googleKey)) {
    return {
      provider: 'gemini',
      apiKey: googleKey,
      model: requestedModel.startsWith('gemini') ? requestedModel : (process.env.GEMINI_MODEL || 'gemini-2.5-flash'),
    };
  }

  if (hasText(serverXaiKey)) {
    return {
      provider: 'xai',
      apiKey: serverXaiKey,
      model: requestedModel.startsWith('grok') ? requestedModel : (process.env.XAI_MODEL || 'grok-3'),
    };
  }

  throw new Error('No AI provider configured. Set DEEPSEEK_API_KEY (recommended) or GOOGLE_API_KEY or XAI_API_KEY.');
}

export function getServerAiSettings(): {
  defaultProvider: AIProvider;
  defaultModel: string;
  availableModels: string[];
  userKeyOptional: boolean;
  builtinProviderLabel: string;
} {
  const hasDeepSeek = hasText(process.env.DEEPSEEK_API_KEY);
  const hasGoogle = hasText(process.env.GOOGLE_API_KEY);
  const hasXai = hasText(process.env.XAI_API_KEY);

  const defaultProvider: AIProvider = hasDeepSeek ? 'openrouter' : hasGoogle ? 'gemini' : 'xai';
  const defaultModel = DEFAULT_AI_MODEL;

  const availableModels = hasDeepSeek
    ? DEEPSEEK_MODELS
    : Array.from(new Set([
        ...(hasGoogle ? ['gemini-2.5-flash', 'gemini-2.5-pro'] : []),
        ...(hasXai ? ['grok-3', 'grok-2-latest'] : []),
        ...(!hasGoogle && !hasXai ? DEEPSEEK_MODELS : []),
      ]));

  return {
    defaultProvider,
    defaultModel,
    availableModels,
    userKeyOptional: hasDeepSeek,
    builtinProviderLabel: hasDeepSeek ? 'DeepSeek' : hasGoogle ? 'Gemini' : hasXai ? 'x.ai' : 'None',
  };
}
