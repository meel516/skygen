'use client';

import { useState } from 'react';
import { AdvancedVideoTemplate } from '@/lib/video/templates/advanced-templates';
import { generateAdvancedContent } from '@/lib/video/ai/advanced-ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Sparkles, Loader2, ArrowRight, ArrowLeft, Image, Volume2 } from '@/components/ui/studio-icons';

interface AdvancedTemplateGeneratorProps {
  template: AdvancedVideoTemplate;
  onGenerate: (variables: Record<string, string>) => void;
  onManual: () => void;
}

export function AdvancedTemplateGenerator({ template, onGenerate, onManual }: AdvancedTemplateGeneratorProps) {
  const [userPrompt, setUserPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generateImages, setGenerateImages] = useState(true);
  const [generateTts, setGenerateTts] = useState(false);

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      setError('Please describe what you want your video to be about');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const generatedVariables = await generateAdvancedContent(template, userPrompt, {
        generateImages,
        generateTts,
      });
      onGenerate(generatedVariables);
    } catch (err) {
      console.error('AI generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Story Input */}
      <div className="bg-card rounded-sm p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-primary" />
          <span className="font-medium">Generate Your Story</span>
        </div>

        <div className="space-y-4">
          <div>
            <Label className="text-muted-foreground mb-2 block">
              What is your video about?
            </Label>
            <Textarea
              value={userPrompt}
              onChange={e => setUserPrompt(e.target.value)}
              placeholder={`e.g., "Create a beautiful story about Prophet Yusuf being thrown into the well by his jealous brothers. Include themes of faith, betrayal, and divine providence."`}
              className="bg-card border-border text-foreground dark:text-white placeholder:text-muted-foreground min-h-[120px]"
            />
          </div>

          {/* Options */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={generateImages}
                onChange={e => setGenerateImages(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-border"
              />
              <Image className="w-4 h-4" />
              Generate Images
            </label>
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
              <input
                type="checkbox"
                checked={generateTts}
                onChange={e => setGenerateTts(e.target.checked)}
                className="w-4 h-4 rounded bg-gray-700 border-border"
              />
              <Volume2 className="w-4 h-4" />
              Generate TTS Audio
            </label>
          </div>

          {/* Suggestions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setUserPrompt('Create a religious story about a prophet with themes of faith and perseverance. Include 4 scenes: beginning, challenge, climax, and resolution.')}
              className="text-xs px-3 py-1.5 bg-card hover:bg-gray-700 rounded-full text-muted-foreground"
            >
              Religious Story
            </button>
            <button
              onClick={() => setUserPrompt('Create a documentary about historical events with dramatic narration and cinematic visuals.')}
              className="text-xs px-3 py-1.5 bg-card hover:bg-gray-700 rounded-full text-muted-foreground"
            >
              Documentary
            </button>
            <button
              onClick={() => setUserPrompt('Create an educational video explaining a scientific concept with visual demonstrations.')}
              className="text-xs px-3 py-1.5 bg-card hover:bg-gray-700 rounded-full text-muted-foreground"
            >
              Educational
            </button>
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-sm">
              {error}
            </div>
          )}

          <div className="flex justify-between gap-3 pt-4">
            <Button
              variant="ghost"
              onClick={onManual}
              className="text-muted-foreground hover:text-foreground dark:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Fill manually
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="bg-primary hover:bg-primary"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Story
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Manual Form */}
      <div className="bg-card rounded-sm p-6 border border-border">
        <div className="flex items-center gap-2 mb-4">
          <span className="font-medium">Or fill manually</span>
        </div>
        <div className="text-muted-foreground text-sm mb-4">
          This template has {template.scenes.length} scenes with {template.requiredVariables.length} fields to fill.
        </div>
        <Button
          variant="outline"
          onClick={onManual}
          className="border-border text-muted-foreground hover:text-foreground dark:text-white hover:bg-card"
        >
          Open Manual Form
        </Button>
      </div>
    </div>
  );
}
