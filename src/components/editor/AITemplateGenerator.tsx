'use client';

import { VideoTemplate } from '@/lib/video/templates/template-definitions';
import { getSelectedModel } from '@/lib/video/ai/template-ai';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useState } from 'react';
import { Sparkles, Loader2, ArrowRight, ArrowLeft, ChevronDown } from 'lucide-react';

const ARC_OPTIONS = [
  { value: '',              label: '✨ Auto-detect' },
  { value: 'documentary',  label: '🎬 Documentary' },
  { value: 'listicle',     label: '📋 Listicle / Top-N' },
  { value: 'tutorial',     label: '📚 Tutorial / How-to' },
  { value: 'product_pitch',label: '🚀 Product Pitch' },
  { value: 'biography',    label: '👤 Biography' },
  { value: 'news',         label: '📰 News / Announcement' },
  { value: 'motivational', label: '🔥 Motivational' },
  { value: 'comparison',   label: '⚖️ Comparison / Versus' },
  { value: 'mini_doc',     label: '🎥 Mini Documentary' },
  { value: 'explainer',    label: '💡 Explainer' },
  { value: 'event_recap',  label: '🏆 Event Recap' },
  { value: 'brand_story',  label: '🏷️ Brand Story' },
];

interface AITemplateGeneratorProps {
  template: VideoTemplate;
  onGenerate: (content: { videoMeta: Record<string, any>; contentBlocks: Record<string, any>[] }) => void;
  onManual: () => void;
}

export function AITemplateGenerator({ template, onGenerate, onManual }: AITemplateGeneratorProps) {
  const [userPrompt, setUserPrompt] = useState('');
  const [selectedArc, setSelectedArc] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!userPrompt.trim()) {
      setError('Please describe what you want your video to be about');
      return;
    }

    const model = getSelectedModel();

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/template/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: template.id,
          userPrompt,
          model,
          preferredArc: selectedArc || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Generation failed');
      }

      const data = await response.json();
      onGenerate(data.content);
    } catch (err) {
      console.error('AI generation failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate content. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center gap-2 mb-6">
        <Sparkles className="w-5 h-5 text-purple-400" />
        <span className="font-medium">Generate with AI</span>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-gray-300 mb-2 block">Story Arc</Label>
          <div className="relative">
            <select
              value={selectedArc}
              onChange={e => setSelectedArc(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-slate-900 dark:text-white rounded-md px-3 py-2 pr-8 appearance-none focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {ARC_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>

        <div>
          <Label className="text-gray-300 mb-2 block">
            What should your video be about?
          </Label>
          <Textarea
            value={userPrompt}
            onChange={e => setUserPrompt(e.target.value)}
            placeholder={`e.g., "Create an inspiring motivational video about never giving up on your dreams. Include a powerful quote about perseverance and encourage viewers to take action."`}
            className="bg-gray-800 border-gray-700 text-slate-900 dark:text-white placeholder:text-gray-500 min-h-[120px]"
          />
        </div>

        {/* Suggestions */}
        <div className="flex flex-wrap gap-2">
          {template.category === 'motivation' && (
            <>
              <button
                onClick={() => setUserPrompt('Create a powerful motivational video about overcoming challenges and achieving success. Include an inspiring quote and call to action.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Overcoming challenges
              </button>
              <button
                onClick={() => setUserPrompt('Generate a motivational speech about never giving up, with an inspiring quote and uplifting tone.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Never give up
              </button>
              <button
                onClick={() => setUserPrompt('Create a motivational video about pursuing your dreams with passion and determination.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Pursue dreams
              </button>
            </>
          )}
          {template.category === 'food' && (
            <>
              <button
                onClick={() => setUserPrompt('Create a food vlog for a delicious creamy pasta recipe with step-by-step instructions and mouth-watering descriptions.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Pasta recipe
              </button>
              <button
                onClick={() => setUserPrompt('Generate a food vlog about a homemade burger with fresh ingredients and cooking tips.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Burger recipe
              </button>
              <button
                onClick={() => setUserPrompt('Create a food vlog about a healthy salad recipe with fresh vegetables and a tangy dressing.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Healthy salad
              </button>
            </>
          )}
          {template.category === 'tutorial' && (
            <>
              <button
                onClick={() => setUserPrompt('Create a tutorial about learning a new skill in 30 days with key milestones and tips.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Learn in 30 days
              </button>
              <button
                onClick={() => setUserPrompt('Generate an educational tutorial explaining how to build a mobile app from scratch.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Build an app
              </button>
              <button
                onClick={() => setUserPrompt('Create a tutorial about productivity tips for remote work with actionable advice.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Remote work tips
              </button>
            </>
          )}
          {template.category === 'business' && (
            <>
              <button
                onClick={() => setUserPrompt('Create a business pitch for an innovative AI startup with key metrics and growth potential.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                AI startup pitch
              </button>
              <button
                onClick={() => setUserPrompt('Generate a business pitch for a sustainable fashion brand with unique value proposition.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Fashion brand
              </button>
              <button
                onClick={() => setUserPrompt('Create a pitch for a food delivery app with market opportunity and competitive advantage.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Food delivery app
              </button>
            </>
          )}
          {template.category === 'lifestyle' && (
            <>
              <button
                onClick={() => setUserPrompt('Create a lifestyle vlog about a day in the life of a creative professional with inspiring moments.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Day in the life
              </button>
              <button
                onClick={() => setUserPrompt('Generate a lifestyle vlog about morning routines for productivity and wellness.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Morning routine
              </button>
              <button
                onClick={() => setUserPrompt('Create a vlog about travel adventures exploring a new city with memorable moments.')}
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-full text-gray-300 transition-colors"
              >
                Travel vlog
              </button>
            </>
          )}
        </div>

        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 p-3 rounded-lg">
            {error}
          </div>
        )}

        <div className="flex justify-between gap-3 pt-4">
          <Button
            variant="ghost"
            onClick={onManual}
            className="text-gray-400 hover:text-slate-900 dark:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Fill manually
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate Content
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
