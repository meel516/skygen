'use client';

import { useState, useEffect } from 'react';
import { ImageUploader } from '@/components/content-manager/ImageUploader';
import { Loader2, Save } from '@/components/ui/studio-icons';

const ALL_BLOCK_TYPES = [
  { type: 'text', label: 'Text' },
  { type: 'quote', label: 'Quote' },
  { type: 'list', label: 'List' },
  { type: 'callout', label: 'Callout' },
  { type: 'code', label: 'Code' },
  { type: 'gradient-text', label: 'Gradient Text' },
  { type: 'stat', label: 'Stat' },
  { type: 'comparison', label: 'Compare' },
  { type: 'line-chart', label: 'Line Chart' },
  { type: 'pie-chart', label: 'Pie Chart' },
  { type: 'counter', label: 'Counter' },
  { type: 'progress-bar', label: 'Progress Bar' },
  { type: 'tower-chart-3d', label: '3D Tower' },
  { type: 'bar-race-3d', label: '3D Bar Race' },
  { type: 'parallax-story', label: 'Parallax Story' },
  { type: 'image', label: 'Image' },
  { type: 'video', label: 'Video' },
  { type: 'motivational-image', label: 'Poster' },
  { type: 'qr-code', label: 'QR Code' },
  { type: 'animated-bg', label: 'Animated BG' },
  { type: 'weather-block', label: 'Weather' },
  { type: 'testimonial', label: 'Review' },
  { type: 'whatsapp-chat', label: 'Chat' },
  { type: 'avatar-grid', label: 'Team Grid' },
  { type: 'social-stats', label: 'Social Stats' },
  { type: 'pricing-table', label: 'Pricing' },
  { type: 'logo-wall', label: 'Logo Wall' },
  { type: 'process-steps', label: 'Process Steps' },
  { type: 'cta', label: 'CTA' },
  { type: 'countdown', label: 'Countdown' },
  { type: 'timeline', label: 'Timeline' },
  { type: 'icon-list', label: 'Features' },
];

export default function BlockThumbnailsPage() {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingType, setSavingType] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/content-manager/block-thumbnails')
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, string> = {};
        for (const row of data.thumbnails || []) {
          map[row.block_type] = row.thumbnail_url;
        }
        setThumbnails(map);
      })
      .finally(() => setLoading(false));
  }, []);

  const saveThumbnail = async (blockType: string, url: string | null) => {
    setSavingType(blockType);
    setThumbnails((prev) => {
      const next = { ...prev };
      if (url) next[blockType] = url;
      else delete next[blockType];
      return next;
    });
    await fetch('/api/content-manager/block-thumbnails', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ blockType, thumbnailUrl: url }),
    });
    setSavingType(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Block Thumbnails</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Upload preview images for each content block. These replace the default icons in the editor sidebar.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {ALL_BLOCK_TYPES.map(({ type, label }) => (
          <div
            key={type}
            className="bg-card/50 rounded-sm border border-border p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">{label}</span>
              <span className="text-[10px] text-muted-foreground font-mono">{type}</span>
            </div>
            <ImageUploader
              value={thumbnails[type] || undefined}
              onChange={(url) => saveThumbnail(type, url)}
            />
            {savingType === type && (
              <div className="flex items-center gap-1 text-xs text-blue-400">
                <Loader2 className="w-3 h-3 animate-spin" /> Saving...
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
