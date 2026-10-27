'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, Trash2, X, Map as MapIcon } from '@/components/ui/studio-icons';

export type FieldMapRow = {
  path: string;
  type: 'image' | 'audio' | 'video';
  description: string;
  removeBackground?: boolean;
};

type Suggestion = {
  path: string;
  typeHint?: string;
  description?: string;
  editor?: string;
};

interface PluginFieldMapModalProps {
  open: boolean;
  pluginId: string;
  pluginName?: string;
  onClose: () => void;
  onSaved?: (fields: FieldMapRow[]) => void;
}

const emptyRow = (): FieldMapRow => ({
  path: '',
  type: 'video',
  description: '',
  removeBackground: false,
});

export function PluginFieldMapModal({
  open,
  pluginId,
  pluginName,
  onClose,
  onSaved,
}: PluginFieldMapModalProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldMapRow[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  const load = useCallback(async () => {
    if (!pluginId) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(pluginId)}/field-map`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load field map');
      setFields(
        Array.isArray(data.fields) && data.fields.length > 0
          ? data.fields.map((f: any) => ({
              path: f.path ?? '',
              type: (f.type === 'image' || f.type === 'audio' || f.type === 'video' ? f.type : 'video') as FieldMapRow['type'],
              description: f.description ?? '',
              removeBackground: !!f.removeBackground,
            }))
          : [emptyRow()],
      );
      setTags(Array.isArray(data.tags) ? data.tags : []);
      setTagsInput(Array.isArray(data.tags) ? data.tags.join(', ') : '');
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } catch (e: any) {
      setError(e?.message ?? 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    if (open && pluginId) void load();
  }, [open, pluginId, load]);

  function updateRow(index: number, patch: Partial<FieldMapRow>) {
    setFields((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addRow(from?: Suggestion) {
    const type =
      from?.editor === 'image' || from?.editor === 'audio' || from?.editor === 'video'
        ? from.editor
        : from?.typeHint === 'image' || from?.typeHint === 'audio' || from?.typeHint === 'video'
          ? from.typeHint
          : 'video';
    setFields((prev) => [
      ...prev,
      {
        path: from?.path ?? '',
        type: type as FieldMapRow['type'],
        description: from?.description ?? '',
        removeBackground: false,
      },
    ]);
  }

  function removeRow(index: number) {
    setFields((prev) => (prev.length <= 1 ? [emptyRow()] : prev.filter((_, i) => i !== index)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const cleaned = fields
        .map((f) => ({
          path: f.path.trim(),
          type: f.type,
          description: f.description.trim(),
          removeBackground: !!f.removeBackground,
        }))
        .filter((f) => f.path);

      const tagList = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch(`/api/plugins/${encodeURIComponent(pluginId)}/field-map`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: cleaned, tags: tagList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setFields(cleaned.length ? cleaned : [emptyRow()]);
      setTags(tagList);
      setSuccess(`Saved ${cleaned.length} media path(s). Wizard will use these on next fill.`);
      onSaved?.(cleaned);
    } catch (e: any) {
      setError(e?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  const mediaSuggestions = suggestions.filter(
    (s) =>
      s.editor === 'image' ||
      s.editor === 'video' ||
      s.editor === 'audio' ||
      /video|image|audio|Url|Src/i.test(s.path),
  );

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/75 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-sm border border-white/[0.08] bg-[var(--card)] shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
          <div>
            <div className="mb-1 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-[var(--primary)]">
              <MapIcon className="h-3.5 w-3.5" />
              Wizard field map
            </div>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              {pluginName || pluginId}
            </h2>
            <p className="mt-1 max-w-xl text-xs leading-5 text-[var(--muted-foreground)]">
              Decide which flattened paths the wizard fills as image / video / audio.
              This is <span className="text-[var(--primary)]">in addition</span> to auto-extract from schema
              editors on build — your map wins when you save it here.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.05] text-[var(--muted-foreground)] hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-16 text-[var(--muted-foreground)]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading field map…
            </div>
          ) : (
            <>
              <label className="mb-1 block text-xs font-medium text-[var(--muted-foreground)]">Catalog tags (comma-separated)</label>
              <input
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="cinematic, motion, documentary"
                className="mb-5 h-10 w-full rounded-sm border border-white/[0.08] bg-[var(--background)] px-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
              />

              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-[var(--foreground)]">Media paths for wizard</h3>
                <button
                  type="button"
                  onClick={() => addRow()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-white/[0.08] bg-white/[0.04] px-2.5 text-xs text-[var(--primary)] hover:bg-white/[0.08]"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add path
                </button>
              </div>

              <div className="space-y-3">
                {fields.map((row, index) => (
                  <div
                    key={index}
                    className="rounded-sm border border-white/[0.06] bg-[var(--background)] p-3"
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_110px_auto]">
                      <input
                        value={row.path}
                        onChange={(e) => updateRow(index, { path: e.target.value })}
                        placeholder="scenes[0].videoUrl"
                        className="h-9 rounded-sm border border-white/[0.08] bg-[var(--card)] px-2.5 font-mono text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
                      />
                      <select
                        value={row.type}
                        onChange={(e) =>
                          updateRow(index, { type: e.target.value as FieldMapRow['type'] })
                        }
                        className="h-9 rounded-sm border border-white/[0.08] bg-[var(--card)] px-2 text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]/50"
                      >
                        <option value="video">video</option>
                        <option value="image">image</option>
                        <option value="audio">audio</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeRow(index)}
                        className="flex h-9 w-9 items-center justify-center rounded-sm text-[var(--muted-foreground)] hover:bg-red-500/10 hover:text-red-300"
                        aria-label="Remove row"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    <textarea
                      value={row.description}
                      onChange={(e) => updateRow(index, { description: e.target.value })}
                      placeholder="Generation prompt shown in wizard review (replaced by URL later)"
                      rows={2}
                      className="mt-2 w-full rounded-sm border border-white/[0.08] bg-[var(--card)] px-2.5 py-2 text-xs text-[#D8D8EA] outline-none focus:border-[var(--primary)]/50"
                    />
                    {row.type === 'image' && (
                      <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <input
                          type="checkbox"
                          checked={!!row.removeBackground}
                          onChange={(e) => updateRow(index, { removeBackground: e.target.checked })}
                          className="rounded border-white/20"
                        />
                        Remove background after resolve
                      </label>
                    )}
                  </div>
                ))}
              </div>

              {mediaSuggestions.length > 0 && (
                <div className="mt-5">
                  <h3 className="mb-2 text-xs font-medium text-[var(--muted-foreground)]">Quick-add from schema</h3>
                  <div className="flex flex-wrap gap-2">
                    {mediaSuggestions.slice(0, 24).map((s) => (
                      <button
                        key={s.path}
                        type="button"
                        onClick={() => addRow(s)}
                        className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2.5 py-1 font-mono text-[10px] text-[#A8A8C2] hover:border-[var(--primary)]/40 hover:text-[var(--primary)]"
                        title={s.description}
                      >
                        + {s.path}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {error && (
                <p className="mt-4 rounded-sm border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  {error}
                </p>
              )}
              {success && (
                <p className="mt-4 rounded-sm border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                  {success}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-sm px-4 text-sm text-[var(--muted-foreground)] hover:bg-white/[0.05] hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || loading}
            onClick={() => void handleSave()}
            className="inline-flex h-10 items-center gap-2 rounded-sm bg-[var(--primary)] px-4 text-sm font-semibold text-primary-foreground hover:bg-[var(--primary)] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save field map
          </button>
        </div>
      </div>
    </div>
  );
}
