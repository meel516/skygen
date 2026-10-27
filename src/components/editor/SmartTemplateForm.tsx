'use client';

import { useState, useMemo } from 'react';
import { VideoTemplate } from '@/lib/video/templates/template-definitions';
import { AdvancedVideoTemplate } from '@/lib/video/templates/advanced-templates';
import { TemplateVariable } from '@/lib/video/templates/template-definitions';
import { ContentBlock } from '@/lib/video/schemas';
import { fillTemplateContent, generateFieldWithAgent } from '@/lib/video/ai/multi-agent';
import { generateTTS } from '@/lib/video/ai/deepgram-tts';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import {
  Sparkles,
  Loader2,
  Image as ImageIcon,
  Volume2,
  FileText,
  Wand2,
  Check,
  X,
  RefreshCw,
  Zap,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface SmartTemplateFormProps {
  template?: VideoTemplate | AdvancedVideoTemplate;
  variables: Record<string, string>;
  onChange: (variables: Record<string, string>) => void;
  onSubmit: () => void;
  isAdvanced?: boolean;
  blocks?: ContentBlock[];
  templateName?: string;
}

type FieldType = 'text' | 'textarea' | 'image' | 'audio' | 'url';

// Get all fields from blocks as a flat list
function getAllFieldsFromBlocks(blocks: ContentBlock[]): { key: string; label: string; type: FieldType; value: string }[] {
  const fields: { key: string; label: string; type: FieldType; value: string }[] = [];

  // Fields that are content vs styling
  const contentFields = ['content', 'subtitle', 'title', 'heading', 'value', 'subtext', 'text', 'author', 'caption', 'quote', 'alt', 'name', 'overlayText', 'events', 'items'];
  const imageFields = ['backgroundImage', 'imageSrc', 'src'];
  const audioFields = ['audioSrc', 'audio'];

  blocks.forEach((block, blockIndex) => {
    const blockAny = block as any;
    const sceneLabel = block.type ? `${block.type} Scene ${blockIndex + 1}` : `Scene ${blockIndex + 1}`;

    // Dynamically extract all content fields
    Object.entries(blockAny).forEach(([key, value]) => {
      if (key === 'type') return;
      if (value === undefined || value === null) return;

      // Skip styling fields
      if (!contentFields.includes(key) && !imageFields.includes(key) && !audioFields.includes(key)) return;

      // Handle arrays (items, events)
      if (Array.isArray(value)) {
        fields.push({
          key: `block_${blockIndex}_${key}`,
          label: `${sceneLabel} - ${key}`,
          type: 'textarea',
          value: JSON.stringify(value, null, 2),
        });
        return;
      }

      // Handle strings
      if (typeof value === 'string') {
        // Image field
        if (imageFields.includes(key)) {
          fields.push({
            key: `block_${blockIndex}_${key === 'backgroundImage' ? 'image' : key}`,
            label: `${sceneLabel} - Image`,
            type: 'image',
            value,
          });
        }
        // Audio field
        else if (audioFields.includes(key)) {
          fields.push({
            key: `block_${blockIndex}_audio`,
            label: `${sceneLabel} - Audio`,
            type: 'audio',
            value,
          });
        }
        // Content field
        else {
          const isLongText = key === 'content' || key === 'text' || key === 'quote' || key === 'description';
          fields.push({
            key: `block_${blockIndex}_${key}`,
            label: `${sceneLabel} - ${key}`,
            type: isLongText ? 'textarea' : 'text',
            value,
          });
        }
      }
    });
  });

  return fields;
}

export function SmartTemplateForm({
  template,
  variables,
  onChange,
  onSubmit,
  isAdvanced = false,
  blocks,
  templateName,
}: SmartTemplateFormProps) {
  const [aiPrompt, setAiPrompt] = useState('');
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [fieldPrompts, setFieldPrompts] = useState<Record<string, string>>({});
  const [activeFieldPrompt, setActiveFieldPrompt] = useState<string | null>(null);
  const [generatingField, setGeneratingField] = useState<string | null>(null);
  const [generationError, setGenerationError] = useState<string | null>(null);

  // Dedicated TTS state
  const [ttsText, setTtsText] = useState('');
  const [isGeneratingTts, setIsGeneratingTts] = useState(false);
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState<string | null>(null);
  const [generatedFields, setGeneratedFields] = useState<{ key: string; label: string; type: FieldType }[]>([]);

  // Get fields to display
  const fields = useMemo(() => {
    let baseFields: { key: string; label: string; type: FieldType; value: string }[] = [];

    if (blocks && blocks.length > 0) {
      baseFields = getAllFieldsFromBlocks(blocks);
    } else if (template?.requiredVariables) {
      baseFields = template.requiredVariables.map(v => ({
        key: v.key,
        label: v.label,
        type: v.type as FieldType,
        value: variables[v.key] || '',
      }));
    }

    // Merge with generated fields (show all fields from AI)
    const allFields = [...baseFields];
    const existingKeys = new Set(baseFields.map(f => f.key));

    generatedFields.forEach(f => {
      if (!existingKeys.has(f.key)) {
        allFields.push({
          ...f,
          value: variables[f.key] || '',
        });
      }
    });

    return allFields;
  }, [template, blocks, variables, generatedFields]);

  const effectiveVariables = fields.reduce((acc, f) => {
    acc[f.key] = variables[f.key] || f.value;
    return acc;
  }, {} as Record<string, string>);

  // Generate all content with Multi-Agent Workflow
  const handleGenerateAll = async () => {
    if (!aiPrompt.trim()) {
      setGenerationError('Please describe what you want');
      return;
    }

    setIsGeneratingAll(true);
    setGenerationError(null);

    try {
      // Use multi-agent workflow with template blocks
      console.log('📤 Passing blocks to AI:', JSON.stringify(blocks?.map(b => b.type)));
      const result = await fillTemplateContent(aiPrompt, blocks || []);
      console.log('Multi-agent result:', JSON.stringify(result, null, 2));

      // Convert result to flat key-value format
      const generated: Record<string, string> = {};
      const newFields: { key: string; label: string; type: FieldType }[] = [];

      result.blocks.forEach((block, index) => {
        const blockType = block.type;

        // Store the block type so editor knows what type to create
        generated[`block_${index}_type`] = blockType;

        Object.entries(block).forEach(([key, value]) => {
          if (key === 'type') return; // Skip type field in content

          const fieldKey = `block_${index}_${key}`;
          // Properly stringify objects/arrays, otherwise they become "[object Object],..."
          generated[fieldKey] = typeof value === 'object' ? JSON.stringify(value) : String(value);

          // Skip array/object fields (like items) from form - they're already generated correctly
          if (typeof value === 'object' && value !== null) {
            return;
          }

          // Determine field type from key
          let fieldType: FieldType = 'text';
          if (key.toLowerCase().includes('image') || key.toLowerCase().includes('src')) {
            fieldType = 'image';
          } else if (key.toLowerCase().includes('audio') || key.toLowerCase().includes('narration')) {
            fieldType = 'audio';
          } else if (key.toLowerCase().includes('content') || key.toLowerCase().includes('text')) {
            fieldType = 'textarea';
          }

          newFields.push({
            key: fieldKey,
            label: `Block ${index + 1} (${blockType}) - ${key}`,
            type: fieldType,
          });
        });
      });

      // Add generated fields to the form
      setGeneratedFields(newFields);
      onChange({ ...variables, ...generated });
    } catch (error) {
      console.error('AI generation error:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate');
    } finally {
      setIsGeneratingAll(false);
    }
  };

  // Generate content for a single field
  const handleGenerateField = async (fieldKey: string, fieldType: FieldType, fieldLabel: string) => {
    const prompt = fieldPrompts[fieldKey];
    if (!prompt?.trim()) {
      setGenerationError('Please describe what you want');
      return;
    }

    setGeneratingField(fieldKey);
    setGenerationError(null);

    try {
      const result = await generateFieldWithAgent(fieldType, prompt);
      onChange({ ...effectiveVariables, [fieldKey]: result });

      setFieldPrompts(prev => ({ ...prev, [fieldKey]: '' }));
      setActiveFieldPrompt(null);
    } catch (error) {
      console.error('Field generation error:', error);
      setGenerationError(error instanceof Error ? error.message : 'Failed to generate');
    } finally {
      setGeneratingField(null);
    }
  };

  // Dedicated TTS generator
  const handleGenerateTTS = async () => {
    if (!ttsText.trim()) return;
    setIsGeneratingTts(true);
    try {
      const audioBase64 = await generateTTS(ttsText);
      const binaryString = atob(audioBase64.replace(/^data:audio\/[^;]+;base64,/, ''));
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const blobUrl = URL.createObjectURL(blob);
      setGeneratedAudioUrl(blobUrl);
    } catch (error) {
      console.error('TTS error:', error);
      setGenerationError(error instanceof Error ? error.message : 'TTS failed');
    } finally {
      setIsGeneratingTts(false);
    }
  };

  // Handle stock image
  const handleStockImage = (fieldKey: string) => {
    const seed = Math.random().toString(36).substring(7);
    const imageUrl = `https://picsum.photos/seed/${seed}/800/1200`;
    onChange({ ...effectiveVariables, [fieldKey]: imageUrl });
  };

  // Render field input based on type
  const renderFieldInput = (field: { key: string; label: string; type: FieldType; value: string }) => {
    const value = effectiveVariables[field.key] || '';
    const isGeneratingThis = generatingField === field.key;
    const showPrompt = activeFieldPrompt === field.key;
    const promptValue = fieldPrompts[field.key] || '';

    return (
      <div key={field.key} className="space-y-2">
        <Label className="text-gray-300 flex items-center gap-2">
          {field.type === 'image' && <ImageIcon className="w-4 h-4 text-blue-400" />}
          {field.type === 'audio' && <Volume2 className="w-4 h-4 text-orange-400" />}
          {field.type === 'textarea' && <FileText className="w-4 h-4 text-green-400" />}
          {field.label}
        </Label>

        {field.type === 'image' ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                value={value}
                onChange={(e) => onChange({ ...effectiveVariables, [field.key]: e.target.value })}
                placeholder="Enter image URL"
                className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => handleStockImage(field.key)}
                className="border-gray-700 text-gray-300 hover:text-slate-900 dark:text-white"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveFieldPrompt(activeFieldPrompt === field.key ? null : field.key)}
                className="border-gray-700 text-gray-300 hover:text-slate-900 dark:text-white"
              >
                <Zap className="w-4 h-4" />
              </Button>
            </div>
            {showPrompt && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={promptValue}
                  onChange={(e) => setFieldPrompts({ ...fieldPrompts, [field.key]: e.target.value })}
                  placeholder="Describe the image you want..."
                  className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white flex-1"
                />
                <Button
                  onClick={() => handleGenerateField(field.key, field.type, field.label)}
                  disabled={isGeneratingThis}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGeneratingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                </Button>
              </div>
            )}
            {value && (
              <div className="relative w-full h-24 bg-gray-800 rounded-lg overflow-hidden">
                <img
                  src={value}
                  alt={field.label}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.target as HTMLImageElement;
                    if (!img.dataset.retry) {
                      img.dataset.retry = 'true';
                      img.src = '/placeholder-image.png';
                    }
                  }}
                />
                <button
                  onClick={() => onChange({ ...effectiveVariables, [field.key]: '' })}
                  className="absolute top-1 right-1 p-1 bg-white/50 dark:bg-black/50 rounded-full hover:bg-black/70"
                >
                  <X className="w-3 h-3 text-slate-900 dark:text-white" />
                </button>
              </div>
            )}
          </div>
        ) : field.type === 'audio' ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <Input
                type="text"
                value={value}
                onChange={(e) => onChange({ ...effectiveVariables, [field.key]: e.target.value })}
                placeholder="Audio URL"
                className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => setActiveFieldPrompt(activeFieldPrompt === field.key ? null : field.key)}
                className="border-gray-700 text-gray-300 hover:text-slate-900 dark:text-white"
              >
                {isGeneratingThis ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>
            {showPrompt && (
              <div className="flex gap-2">
                <Textarea
                  value={promptValue}
                  onChange={(e) => setFieldPrompts({ ...fieldPrompts, [field.key]: e.target.value })}
                  placeholder="Enter text to convert to speech..."
                  className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white flex-1 min-h-15"
                />
                <Button
                  onClick={() => handleGenerateField(field.key, field.type, field.label)}
                  disabled={isGeneratingThis}
                  className="bg-purple-600 hover:bg-purple-700 self-end"
                >
                  Generate
                </Button>
              </div>
            )}
            {value && (
              <div className="flex items-center gap-2 p-2 bg-gray-800 rounded-lg">
                <Volume2 className="w-4 h-4 text-green-400" />
                <audio controls className="flex-1 h-8">
                  <source src={value} />
                </audio>
                <button onClick={() => onChange({ ...effectiveVariables, [field.key]: '' })} className="p-1 hover:bg-gray-700 rounded">
                  <X className="w-3 h-3 text-gray-400" />
                </button>
              </div>
            )}
          </div>
        ) : field.type === 'textarea' ? (
          <div className="space-y-2">
            <Textarea
              value={value}
              onChange={(e) => onChange({ ...effectiveVariables, [field.key]: e.target.value })}
              placeholder="Enter text..."
              className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white min-h-20"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFieldPrompt(activeFieldPrompt === field.key ? null : field.key)}
              className="text-purple-400 hover:text-purple-300"
            >
              {isGeneratingThis ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Generate with AI
            </Button>
            {showPrompt && (
              <div className="flex gap-2">
                <Textarea
                  value={promptValue}
                  onChange={(e) => setFieldPrompts({ ...fieldPrompts, [field.key]: e.target.value })}
                  placeholder="Describe what you want this text to say..."
                  className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white flex-1 min-h-15"
                />
                <Button
                  onClick={() => handleGenerateField(field.key, field.type, field.label)}
                  disabled={isGeneratingThis}
                  className="bg-purple-600 hover:bg-purple-700 self-end"
                >
                  Generate
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Input
              type="text"
              value={value}
              onChange={(e) => onChange({ ...effectiveVariables, [field.key]: e.target.value })}
              placeholder="Enter text..."
              className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveFieldPrompt(activeFieldPrompt === field.key ? null : field.key)}
              className="text-purple-400 hover:text-purple-300"
            >
              {isGeneratingThis ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
              Generate with AI
            </Button>
            {showPrompt && (
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={promptValue}
                  onChange={(e) => setFieldPrompts({ ...fieldPrompts, [field.key]: e.target.value })}
                  placeholder="Describe what you want..."
                  className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white flex-1"
                />
                <Button
                  onClick={() => handleGenerateField(field.key, field.type, field.label)}
                  disabled={isGeneratingThis}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  Generate
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const filledCount = Object.values(effectiveVariables).filter(v => v.trim()).length;

  return (
    <div className="space-y-6">
      {/* Header - Template name if available */}
      {templateName && (
        <div className="text-lg font-semibold text-slate-900 dark:text-white">{templateName}</div>
      )}

      {/* AI Generate All Section */}
      <div className="bg-linear-to-r from-purple-900/30 to-indigo-900/30 rounded-xl p-6 border border-purple-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-purple-400" />
          <span className="font-medium text-slate-900 dark:text-white">Generate Complete Story</span>
        </div>

        <p className="text-gray-400 text-sm mb-4">
          Describe your entire story, and AI will fill all fields at once.
        </p>

        <div className="space-y-3">
          <Textarea
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            placeholder="e.g., Create a story about a hero who overcomes great challenges..."
            className="bg-gray-800/50 border-gray-700 text-slate-900 dark:text-white placeholder:text-gray-500 min-h-20"
          />

          {generationError && (
            <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
              {generationError}
            </div>
          )}

          <Button
            onClick={handleGenerateAll}
            disabled={isGeneratingAll || !aiPrompt.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700"
          >
            {isGeneratingAll ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating All...
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4 mr-2" />
                Generate Complete Story
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Dedicated TTS Audio Generator */}
      <div className="bg-orange-900/20 rounded-xl p-6 border border-orange-800/50">
        <div className="flex items-center gap-2 mb-4">
          <Volume2 className="w-5 h-5 text-orange-400" />
          <span className="font-medium text-slate-900 dark:text-white">Generate Audio (TTS)</span>
        </div>
        <p className="text-gray-400 text-sm mb-4">
          Type text and generate voice audio. Copy the URL to use in any audio field.
        </p>
        <div className="space-y-3">
          <Textarea
            value={ttsText}
            onChange={(e) => setTtsText(e.target.value)}
            placeholder="Enter text to convert to speech..."
            className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white min-h-20"
          />
          <Button
            onClick={handleGenerateTTS}
            disabled={isGeneratingTts || !ttsText.trim()}
            className="w-full bg-orange-600 hover:bg-orange-700"
          >
            {isGeneratingTts ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Volume2 className="w-4 h-4 mr-2" />
                Generate Audio
              </>
            )}
          </Button>
          {generatedAudioUrl && (
            <div className="flex items-center gap-2 p-3 bg-gray-800 rounded-lg">
              <Volume2 className="w-4 h-4 text-green-400" />
              <audio controls className="flex-1 h-8">
                <source src={generatedAudioUrl} />
              </audio>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(generatedAudioUrl)}
                className="border-gray-600 text-gray-300"
              >
                Copy URL
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-400">
          {filledCount}/{fields.length} fields filled
        </span>
        {filledCount === fields.length && fields.length > 0 && (
          <span className="text-green-400 flex items-center gap-1">
            <Check className="w-4 h-4" /> Ready
          </span>
        )}
      </div>

      {/* All Fields */}
      <div className="space-y-4">
        <div className="text-sm text-gray-400 mb-2">
          Or fill individual fields below:
        </div>
        {fields.map(field => renderFieldInput(field))}
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-3 pt-4">
        <Button
          onClick={onSubmit}
          disabled={filledCount === 0}
          className="bg-purple-600 hover:bg-purple-700"
        >
          Use Template
          <Check className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
