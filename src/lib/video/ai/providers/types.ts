export type AIProvider = 'openrouter' | 'gemini' | 'xai';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant' | string;
  content: string;
}

export interface GenerateTextParams {
  messages: AIMessage[];
  apiKey?: string | null;
  model?: string | null;
  maxTokens?: number;
  temperature?: number;
  enableWebSearch?: boolean;
}

export interface GenerateTextResult {
  text: string;
  provider: AIProvider;
  model: string;
  usage: {
    totalTokens?: number;
  };
}

export interface ResolvedProviderConfig {
  provider: AIProvider;
  apiKey: string;
  model: string;
}
