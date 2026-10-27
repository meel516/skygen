'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Crown, Palette, Eye, EyeOff, ChevronDown, ChevronRight, Save } from '@/components/ui/studio-icons';

// prompt_prefix — the AI layer of a visual style (stored in prompt_prefix TEXT column).
// This is prepended to every image-generation prompt for this style, ensuring
// visual consistency across all scenes in the video.
// Example: "Hyperrealistic cinematic photography, shallow depth of field, dramatic lighting"
// When null, graph.ts falls back to VISUAL_STYLE_PRESETS in graph.ts.

interface VisualStyle {
  id: string;
  label: string;
  emoji: string;
  description: string;
  prompt_prefix: string | null; // AI layer — prepended to every image-gen prompt
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
}

const inputCls = 'px-3 py-2 bg-muted border border-border rounded-sm text-white text-sm focus:outline-none focus:border-purple-500 w-full';

export default function VisualStylesPage() {
  const [styles, setStyles] = useState<VisualStyle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [prefixEdits, setPrefixEdits] = useState<Record<string, string>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newStyle, setNewStyle] = useState({ id: '', label: '', emoji: '🎨', description: '', is_premium: true });

  const fetchStyles = () => {
    fetch('/api/admin/visual-styles')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setStyles(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchStyles(); }, []);

  const handleUpdate = async (style: VisualStyle) => {
    setSaving(true);
    try {
      await fetch('/api/admin/visual-styles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(style),
      });
      fetchStyles();
    } catch { alert('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleSavePrefix = async (style: VisualStyle) => {
    await handleUpdate({ ...style, prompt_prefix: prefixEdits[style.id] || null });
    setExpandedId(null);
  };

  const handleAdd = async () => {
    if (!newStyle.label.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/admin/visual-styles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newStyle, sort_order: styles.length }),
      });
      setNewStyle({ id: '', label: '', emoji: '🎨', description: '', is_premium: true });
      setShowAdd(false);
      fetchStyles();
    } catch { alert('Failed to add'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this style?')) return;
    await fetch('/api/admin/visual-styles', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchStyles();
  };

  const openPrefix = (style: VisualStyle) => {
    setExpandedId(expandedId === style.id ? null : style.id);
    if (prefixEdits[style.id] === undefined) {
      setPrefixEdits(p => ({ ...p, [style.id]: style.prompt_prefix ?? '' }));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Palette className="w-6 h-6 text-primary" />
            Visual Styles
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage visual styles. Toggle premium/active per style, and set the image-gen prompt prefix.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium bg-primary hover:bg-primary"
        >
          <Plus className="w-4 h-4" /> Add Style
        </button>
      </div>

      {showAdd && (
        <div className="rounded-sm p-5 space-y-3 bg-card/60 border border-primary/30">
          <h3 className="text-sm font-semibold text-muted-foreground">New Visual Style</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Label (e.g. Watercolor)" value={newStyle.label} onChange={e => setNewStyle(p => ({ ...p, label: e.target.value }))} className={inputCls} />
            <input placeholder="ID (auto-generated if empty)" value={newStyle.id} onChange={e => setNewStyle(p => ({ ...p, id: e.target.value }))} className={inputCls} />
            <input placeholder="Emoji" value={newStyle.emoji} onChange={e => setNewStyle(p => ({ ...p, emoji: e.target.value }))} className={inputCls} />
            <input placeholder="Description" value={newStyle.description} onChange={e => setNewStyle(p => ({ ...p, description: e.target.value }))} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={newStyle.is_premium} onChange={e => setNewStyle(p => ({ ...p, is_premium: e.target.checked }))} className="w-4 h-4 rounded border-border bg-card text-primary" />
            Premium
          </label>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving} className="px-4 py-2 bg-primary rounded-sm text-sm font-medium hover:bg-primary disabled:opacity-50">
              {saving ? 'Adding...' : 'Add'}
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-card rounded-sm text-sm text-muted-foreground hover:text-white">Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-sm overflow-hidden border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-card/80 text-muted-foreground text-left">
              <th className="px-4 py-3 w-10">#</th>
              <th className="px-4 py-3 w-10"></th>
              <th className="px-4 py-3">Label</th>
              <th className="px-4 py-3">ID</th>
              <th className="px-4 py-3 w-28 text-center">Prompt Prefix</th>
              <th className="px-4 py-3 w-24 text-center">Premium</th>
              <th className="px-4 py-3 w-20 text-center">Active</th>
              <th className="px-4 py-3 w-14"></th>
            </tr>
          </thead>
          <tbody>
            {styles.map((style) => {
              const isExpanded = expandedId === style.id;
              const hasPrefix = !!style.prompt_prefix;
              return (
                <>
                  <tr
                    key={style.id}
                    className={`border-t border-border/50 ${!style.is_active ? 'opacity-40' : ''} hover:bg-muted/40 transition-colors`}
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">{style.sort_order}</td>
                    <td className="px-4 py-3 text-xl">{style.emoji}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      {style.label}
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-45">{style.description}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{style.id || '(auto)'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openPrefix(style)}
                        className={`flex items-center gap-1 mx-auto px-2 py-1 rounded text-xs font-medium transition-colors ${
                          hasPrefix
                            ? 'bg-primary/20 text-primary hover:bg-primary/30'
                            : 'bg-card text-muted-foreground hover:bg-gray-700'
                        }`}
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {hasPrefix ? 'Edit' : 'Set'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleUpdate({ ...style, is_premium: !style.is_premium })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          style.is_premium ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-card text-muted-foreground hover:bg-gray-700'
                        }`}
                      >
                        {style.is_premium ? <><Crown className="w-3 h-3 inline mr-1" />Yes</> : 'Free'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleUpdate({ ...style, is_active: !style.is_active })}
                        className={`p-1.5 rounded transition-colors ${style.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-card'}`}
                      >
                        {style.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {style.id !== '' && (
                        <button onClick={() => handleDelete(style.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${style.id}-prefix`} className="border-t border-border/30 bg-card/60">
                      <td colSpan={8} className="px-6 py-4">
                        {/* Prompt prefix editor — controls image generation in graph.ts */}
                        <div className="space-y-3 max-w-2xl">
                          <p className="text-xs text-muted-foreground">
                            <span className="text-primary font-medium">Image Prompt Prefix</span> — prepended to every AI image-generation prompt for this style. Sets the medium, lighting, palette, and rendering technique.
                          </p>
                          <textarea
                            value={prefixEdits[style.id] ?? ''}
                            onChange={e => setPrefixEdits(p => ({ ...p, [style.id]: e.target.value }))}
                            placeholder="e.g. Hyperrealistic cinematic photography, shallow depth of field, dramatic lighting, film grain, 8K detail"
                            rows={3}
                            className="px-3 py-2 bg-card border border-border rounded-sm text-white text-sm focus:outline-none focus:border-primary w-full resize-none"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSavePrefix(style)}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary rounded-sm text-xs font-medium disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" /> Save Prefix
                            </button>
                            <button onClick={() => setExpandedId(null)} className="px-3 py-1.5 bg-card rounded-sm text-xs text-muted-foreground hover:text-white">
                              Cancel
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        {styles.length} styles · {styles.filter(s => s.is_premium).length} premium · {styles.filter(s => !s.is_active).length} hidden · {styles.filter(s => s.prompt_prefix).length} with prompt prefix set
      </p>
    </div>
  );
}
