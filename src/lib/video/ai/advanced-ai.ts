import { AdvancedVideoTemplate } from '../templates/advanced-templates';

const DEFAULT_MODEL = 'gemini-2.5-flash';
const TTS_MODEL_STORAGE_KEY = 'videogen_tts_model';

/**
 * Get selected model
 */
function getSelectedModel(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('videogen_selected_model') || DEFAULT_MODEL;
  }
  return DEFAULT_MODEL;
}

function getTtsModel(): string {
  if (typeof window !== 'undefined') {
    return localStorage.getItem(TTS_MODEL_STORAGE_KEY) || 'tts-1';
  }
  return 'tts-1';
}

export function getStoredTtsModel(): string {
  return getTtsModel();
}

export function setTtsModel(model: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(TTS_MODEL_STORAGE_KEY, model);
  }
}

/**
 * Generate TTS audio from text
 */
export async function generateTTS(
  text: string,
  voice: string = 'alloy',
  apiKey?: string
): Promise<string> {
  // TTS placeholder - requires OpenAI API
  console.log('TTS requested for:', text.substring(0, 50) + '...');
  return '';
}

/**
 * Generate content for advanced template - simplified single message
 */
export async function generateAdvancedContent(
  template: AdvancedVideoTemplate,
  userPrompt: string,
  options: {
    generateImages?: boolean;
    generateTts?: boolean;
  } = {}
): Promise<Record<string, string>> {
  const { generateImages = true, generateTts = false } = options;

  // Build simplified single message prompt
  const sceneCount = template.scenes.length;
  const variableDescriptions = template.requiredVariables
    .map(v => `- ${v.label} (${v.key})`)
    .join('\n');

  const prompt = `Generate JSON for "${template.name}" - ${sceneCount} scenes. Variables needed: ${variableDescriptions}. User: "${userPrompt}". Return ONLY valid JSON with all variables. Use picsum.photos for images. JSON:`;

  try {
    const response = await fetch('/api/ai/text', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: getSelectedModel(),
        prompt,
        maxTokens: 4000,
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

    let generated = JSON.parse(jsonMatch[0]);

    // If images not requested, clear image URLs
    if (!generateImages) {
      Object.keys(generated).forEach(key => {
        if (key.includes('background') || key.includes('mid') || key.includes('foreground') || key.includes('image')) {
          generated[key] = '';
        }
      });
    }

    // Fill in any missing variables with defaults
    const result: Record<string, string> = {};
    template.requiredVariables.forEach(variable => {
      if (generated[variable.key]) {
        result[variable.key] = generated[variable.key];
      } else {
        result[variable.key] = '';
      }
    });

    return result;
  } catch (error) {
    console.error('Advanced content generation error:', error);
    throw error;
  }
}

/**
 * Simple image URL generator
 */
export function generateImageUrl(seed: string, width = 800, height = 1200): string {
  return `https://picsum.photos/seed/${seed}/${width}/${height}`;
}
