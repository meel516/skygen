import { VideoTemplate } from '../templates/template-definitions';

// Store available models - will be populated from API
let availableModels: string[] = [];

const DEFAULT_MODEL = 'deepseek-chat';
const MODEL_STORAGE_KEY = 'videogen_selected_model';

// Built-in DeepSeek is the default. Additional models are supplied by the server config.
export const KNOWN_MODELS = [
  'deepseek-chat',
  'deepseek-reasoner',
];

const DEFAULT_VISIBLE_MODELS = KNOWN_MODELS;

export function getSelectedModel(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_MODEL;
  }
  return DEFAULT_MODEL;
}

export function setSelectedModel(model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(MODEL_STORAGE_KEY, model);
  }
}


/**
 * Fetch available models from the server-side AI configuration
 */
export async function fetchAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch('/api/ai/models');

    if (!response.ok) {
      console.error('Failed to fetch models:', response.status);
      return DEFAULT_VISIBLE_MODELS;
    }

    const data = await response.json();
    const serverModels = Array.isArray(data.availableModels) ? data.availableModels : [];
    availableModels = Array.from(new Set([
      ...serverModels,
      ...(serverModels.length === 0 ? KNOWN_MODELS : []),
    ]));
    return availableModels;
  } catch (error) {
    console.error('Error fetching models:', error);
    return DEFAULT_VISIBLE_MODELS;
  }
}

export function getAvailableModels(): string[] {
  return availableModels.length > 0 ? availableModels : DEFAULT_VISIBLE_MODELS;
}

/**
 * Generate content for template variables based on user prompt
 */
export async function generateTemplateContent(
  template: VideoTemplate,
  userPrompt: string
): Promise<Record<string, string>> {
  const model = getSelectedModel();

  // Build simplified single message prompt
  const variableDescriptions = template.requiredVariables
    .map(v => `- ${v.label}: ${v.placeholder || 'required'}`)
    .join('\n');

  const prompt = `Generate JSON for video template "${template.name}". Variables needed: ${variableDescriptions}. User request: "${userPrompt}". Return ONLY valid JSON with these keys filled. For images use picsum.photos URLs. JSON:`;

  try {
    const response = await fetch('/api/ai/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt,
        maxTokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data.text;

    if (!responseText) {
      throw new Error('No response from AI');
    }

    // Parse JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Invalid response format from AI');
    }

    const generated = JSON.parse(jsonMatch[0]);

    // Fill in any missing variables with defaults
    const result: Record<string, string> = {};
    template.requiredVariables.forEach(variable => {
      if (generated[variable.key]) {
        result[variable.key] = generated[variable.key];
      } else if (variable.defaultValue) {
        result[variable.key] = variable.defaultValue;
      } else {
        result[variable.key] = '';
      }
    });

    return result;
  } catch (error) {
    console.error('AI generation error:', error);
    if (error instanceof SyntaxError) {
      throw new Error('Failed to parse AI response. Please try again.');
    }
    throw error;
  }
}

/**
 * Generate image URL using free image service
 */
export function generateImageUrl(keywords: string, width = 800): string {
  const seed = Math.floor(Math.random() * 1000);
  return `https://picsum.photos/seed/${seed}/${width}/${Math.floor(width * 0.6)}`;
}
