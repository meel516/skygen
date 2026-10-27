'use client';

import { useState, useEffect } from 'react';
import { ImageUploader } from '@/components/content-manager/ImageUploader';
import { Loader2 } from 'lucide-react';

const VISUAL_STYLES = [
  { id: '_auto',         label: 'Auto-detect' },
  { id: 'photorealistic', label: 'Photorealistic' },
  { id: 'anime',          label: 'Anime' },
  { id: '3d-cinematic',   label: '3D Cinematic' },
  { id: 'cartoon',        label: 'Cartoon' },
  { id: 'watercolor',     label: 'Watercolor' },
  { id: 'comic-book',     label: 'Comic Book' },
  { id: 'pixel-art',      label: 'Pixel Art' },
  { id: 'oil-painting',   label: 'Oil Painting' },
  { id: 'neon-cyberpunk', label: 'Neon Cyberpunk' },
  { id: 'vintage-film',   label: 'Vintage Film' },
  { id: 'minimalist',     label: 'Minimalist' },
  { id: 'dark-moody',     label: 'Dark & Moody' },
  { id: 'custom',         label: 'Custom' },
];

const STORY_ARCS = [
  { id: '_auto',          label: 'Auto-detect' },
  { id: 'documentary',    label: 'Documentary' },
  { id: 'listicle',       label: 'Listicle' },
  { id: 'tutorial',       label: 'Tutorial' },
  { id: 'product_pitch',  label: 'Product Pitch' },
  { id: 'biography',      label: 'Biography' },
  { id: 'news',           label: 'News' },
  { id: 'motivational',   label: 'Motivational' },
  { id: 'comparison',     label: 'Comparison' },
  { id: 'mini_doc',       label: 'Mini Doc' },
  { id: 'explainer',      label: 'Explainer' },
  { id: 'event_recap',    label: 'Event Recap' },
  { id: 'brand_story',    label: 'Brand Story' },
  { id: 'reaction',       label: 'Reaction' },
  { id: 'transformation', label: 'Transformation' },
  { id: 'mystery',        label: 'Mystery' },
  { id: 'storytime',      label: 'Storytime' },
  { id: 'review',         label: 'Review' },
  { id: 'day_in_life',    label: 'Day in Life' },
  { id: 'myth_busting',   label: 'Myth Busting' },
  { id: 'countdown',      label: 'Countdown' },
];

export default function StylePreviewsPage() {
  const [stylePreviews, setStylePreviews] = useState<Record<string, string>>({});
  const [arcPreviews, setArcPreviews] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/content-manager/config');
        const data = await res.json();
        const configs: Record<string, any> = {};
        for (const row of data.configs || []) {
          configs[row.key] = row.value;
        }
        setStylePreviews(configs.visual_style_previews || {});
        setArcPreviews(configs.arc_previews || {});
      } catch { /* tables may not exist yet */ }
      setLoading(false);
    })();
  }, []);

  const saveConfig = async (key: string, value: Record<string, string>) => {
    await fetch('/api/content-manager/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
  };

  const updateStylePreview = async (id: string, url: string | null) => {
    setSaving(`style-${id}`);
    const next = { ...stylePreviews };
    if (url) next[id] = url; else delete next[id];
    setStylePreviews(next);
    await saveConfig('visual_style_previews', next);
    setSaving(null);
  };

  const updateArcPreview = async (id: string, url: string | null) => {
    setSaving(`arc-${id}`);
    const next = { ...arcPreviews };
    if (url) next[id] = url; else delete next[id];
    setArcPreviews(next);
    await saveConfig('arc_previews', next);
    setSaving(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div>
      {/* Visual Styles */}
      <div className="mb-12">
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Visual Style Previews</h2>
          <p className="text-sm text-gray-400 mt-1">
            Upload preview images for each art style. These show as image cards in the wizard instead of emoji icons.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {VISUAL_STYLES.map(({ id, label }) => (
            <div key={id} className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{label}</span>
                <span className="text-[10px] text-gray-600 font-mono">{id}</span>
              </div>
              <ImageUploader
                value={stylePreviews[id] || undefined}
                onChange={(url) => updateStylePreview(id, url)}
              />
              {saving === `style-${id}` && (
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Story Arcs */}
      <div>
        <div className="mb-6">
          <h2 className="text-2xl font-bold">Story Arc Previews</h2>
          <p className="text-sm text-gray-400 mt-1">
            Upload preview images for each narrative arc. These show as image cards in the wizard instead of emoji icons.
          </p>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STORY_ARCS.map(({ id, label }) => (
            <div key={id} className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-white">{label}</span>
                <span className="text-[10px] text-gray-600 font-mono">{id}</span>
              </div>
              <ImageUploader
                value={arcPreviews[id] || undefined}
                onChange={(url) => updateArcPreview(id, url)}
              />
              {saving === `arc-${id}` && (
                <div className="flex items-center gap-1 text-xs text-blue-400">
                  <Loader2 className="w-3 h-3 animate-spin" /> Saving...
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
