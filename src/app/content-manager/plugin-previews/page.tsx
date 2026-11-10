'use client';

import { useEffect, useState } from 'react';
import { Film, Loader2, Save } from '@/components/ui/studio-icons';
import { isPluginPreviewVideoUrl } from '@/lib/plugins/preview-url';

interface PluginItem {
  id: string;
  name: string;
  category?: string;
  previewUrl?: string;
}

function readPreviewMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter((entry): entry is [string, string] => isPluginPreviewVideoUrl(entry[1]))
  );
}

export default function PluginPreviewsPage() {
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [draftUrls, setDraftUrls] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      fetch('/api/plugins/registry').then((response) => response.json()),
      fetch('/api/content-manager/config').then((response) => response.json()),
    ]).then(([registry, configData]) => {
      if (cancelled) return;
      const configRow = configData.configs?.find((row: { key: string }) => row.key === 'plugin_preview_urls');
      const configured = readPreviewMap(configRow?.value);
      const items: PluginItem[] = Array.isArray(registry.plugins) ? registry.plugins : [];
      const effective = { ...configured };
      for (const plugin of items) {
        if (!effective[plugin.id] && isPluginPreviewVideoUrl(plugin.previewUrl)) {
          effective[plugin.id] = plugin.previewUrl;
        }
      }
      setPlugins(items.sort((a, b) => a.name.localeCompare(b.name)));
      setPreviewUrls(effective);
      setDraftUrls(effective);
    }).catch(() => {
      if (!cancelled) setError('Could not load plugins or preview settings.');
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, []);

  const savePreview = async (pluginId: string) => {
    const value = (draftUrls[pluginId] || '').trim();
    if (value && !isPluginPreviewVideoUrl(value)) {
      setError('Enter a direct HTTPS URL ending in .mp4 or .webm.');
      return;
    }

    setSavingId(pluginId);
    setError(null);
    setSavedId(null);
    const next = { ...previewUrls };
    if (value) next[pluginId] = value;
    else delete next[pluginId];

    try {
      const response = await fetch('/api/content-manager/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'plugin_preview_urls', value: next }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save the preview URL.');
      }
      setPreviewUrls(next);
      setDraftUrls(next);
      setSavedId(pluginId);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save the preview URL.');
    } finally {
      setSavingId(null);
    }
  };

  if (loading) {
    return <div className="flex h-64 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Plugin Card Previews</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Add a direct MP4 or WebM URL to show a muted preview on the plugin card. Videos load only while their cards are in view.
        </p>
      </div>

      {error && <p role="alert" className="mb-4 rounded-sm border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}

      {plugins.length === 0 ? (
        <p className="py-12 text-center text-muted-foreground">No plugins found.</p>
      ) : (
        <div className="space-y-3">
          {plugins.map((plugin) => {
            const currentUrl = previewUrls[plugin.id] || '';
            const draftUrl = draftUrls[plugin.id] || '';
            const saving = savingId === plugin.id;
            const dirty = draftUrl.trim() !== currentUrl;

            return (
              <section key={plugin.id} className="grid gap-3 rounded-sm border border-border bg-card/50 p-4 md:grid-cols-[minmax(180px,1fr)_2fr_auto] md:items-center">
                <div className="min-w-0">
                  <div className="truncate font-medium text-white">{plugin.name}</div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{plugin.id}</div>
                </div>

                <input
                  type="url"
                  inputMode="url"
                  value={draftUrl}
                  onChange={(event) => {
                    setDraftUrls((previous) => ({ ...previous, [plugin.id]: event.target.value }));
                    setSavedId(null);
                  }}
                  placeholder="https://cdn.example.com/preview.mp4"
                  aria-label={`Preview video URL for ${plugin.name}`}
                  className="min-w-0 rounded-sm border border-border bg-card px-3 py-2 text-sm text-white placeholder:text-muted-foreground focus:border-blue-500 focus:outline-none"
                />

                <button
                  type="button"
                  onClick={() => void savePreview(plugin.id)}
                  disabled={savingId !== null || (!dirty && savedId !== plugin.id)}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-blue-600 px-4 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : savedId === plugin.id ? <Film className="h-4 w-4" /> : <Save className="h-4 w-4" />}
                  {saving ? 'Saving…' : savedId === plugin.id ? 'Saved' : 'Save'}
                </button>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
