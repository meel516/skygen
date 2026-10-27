'use client';

import { useState, useEffect } from 'react';
import { Loader2, Plus, Trash2, Crown, Film, Eye, EyeOff, ChevronDown, ChevronRight, Save } from '@/components/ui/studio-icons';

// ArcPattern — the AI layer of a story arc (stored in arc_pattern JSONB column).
// graph.ts reads this to structure the video narrative.
interface ArcPattern {
  roles: string[];      // ordered narrative roles, one per video block (stretched/trimmed to fit)
  defaultTone: string;  // emotional register injected verbatim into the director_agent prompt
}

interface StoryArc {
  id: string;
  label: string;
  emoji: string;
  description: string;
  arc_pattern: ArcPattern | null; // null = falls back to hardcoded ARC_PATTERNS in graph.ts
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
}

const inputCls = 'px-3 py-2 bg-muted border border-border rounded-sm text-white text-sm focus:outline-none focus:border-purple-500 w-full';

export default function StoryArcsPage() {
  const [arcs, setArcs] = useState<StoryArc[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [patternEdits, setPatternEdits] = useState<Record<string, { roles: string; defaultTone: string }>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newArc, setNewArc] = useState({ id: '', label: '', emoji: '📋', description: '', is_premium: true });

  const fetchArcs = () => {
    fetch('/api/admin/story-arcs')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setArcs(data); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchArcs(); }, []);

  const handleUpdate = async (arc: StoryArc) => {
    setSaving(true);
    try {
      await fetch('/api/admin/story-arcs', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arc),
      });
      fetchArcs();
    } catch { alert('Failed to update'); }
    finally { setSaving(false); }
  };

  const handleSavePattern = async (arc: StoryArc) => {
    const edit = patternEdits[arc.id];
    if (!edit) return;
    const rolesArr = edit.roles.split(',').map(r => r.trim()).filter(Boolean);
    await handleUpdate({ ...arc, arc_pattern: { roles: rolesArr, defaultTone: edit.defaultTone } });
    setExpandedId(null);
  };

  const handleAdd = async () => {
    if (!newArc.label.trim()) return;
    setSaving(true);
    try {
      await fetch('/api/admin/story-arcs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...newArc, sort_order: arcs.length }),
      });
      setNewArc({ id: '', label: '', emoji: '📋', description: '', is_premium: true });
      setShowAdd(false);
      fetchArcs();
    } catch { alert('Failed to add'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this arc?')) return;
    await fetch('/api/admin/story-arcs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchArcs();
  };

  const openPattern = (arc: StoryArc) => {
    setExpandedId(expandedId === arc.id ? null : arc.id);
    if (!patternEdits[arc.id]) {
      setPatternEdits(p => ({
        ...p,
        [arc.id]: {
          roles: arc.arc_pattern?.roles?.join(', ') ?? '',
          defaultTone: arc.arc_pattern?.defaultTone ?? '',
        },
      }));
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
            <Film className="w-6 h-6 text-primary" />
            Story Arcs
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage story arcs. Toggle premium/active per arc, and set the AI narrative pattern.
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-sm text-sm font-medium bg-primary hover:bg-primary"
        >
          <Plus className="w-4 h-4" /> Add Arc
        </button>
      </div>

      {showAdd && (
        <div className="rounded-sm p-5 space-y-3 bg-card/60 border border-primary/30">
          <h3 className="text-sm font-semibold text-muted-foreground">New Story Arc</h3>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Label (e.g. Documentary)" value={newArc.label} onChange={e => setNewArc(p => ({ ...p, label: e.target.value }))} className={inputCls} />
            <input placeholder="ID (auto-generated if empty)" value={newArc.id} onChange={e => setNewArc(p => ({ ...p, id: e.target.value }))} className={inputCls} />
            <input placeholder="Emoji" value={newArc.emoji} onChange={e => setNewArc(p => ({ ...p, emoji: e.target.value }))} className={inputCls} />
            <input placeholder="Description" value={newArc.description} onChange={e => setNewArc(p => ({ ...p, description: e.target.value }))} className={inputCls} />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
            <input type="checkbox" checked={newArc.is_premium} onChange={e => setNewArc(p => ({ ...p, is_premium: e.target.checked }))} className="w-4 h-4 rounded border-border bg-card text-primary" />
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
              <th className="px-4 py-3 w-28 text-center">AI Pattern</th>
              <th className="px-4 py-3 w-24 text-center">Premium</th>
              <th className="px-4 py-3 w-20 text-center">Active</th>
              <th className="px-4 py-3 w-14"></th>
            </tr>
          </thead>
          <tbody>
            {arcs.map((arc) => {
              const isExpanded = expandedId === arc.id;
              const edit = patternEdits[arc.id];
              const hasPattern = !!(arc.arc_pattern?.roles?.length);
              return (
                <>
                  <tr
                    key={arc.id}
                    className={`border-t border-border/50 ${!arc.is_active ? 'opacity-40' : ''} hover:bg-muted/40 transition-colors`}
                  >
                    <td className="px-4 py-3 text-muted-foreground text-xs">{arc.sort_order}</td>
                    <td className="px-4 py-3 text-xl">{arc.emoji}</td>
                    <td className="px-4 py-3 font-medium text-white">
                      {arc.label}
                      <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-45">{arc.description}</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{arc.id || '(auto)'}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => openPattern(arc)}
                        className={`flex items-center gap-1 mx-auto px-2 py-1 rounded text-xs font-medium transition-colors ${
                          hasPattern
                            ? 'bg-primary/20 text-primary hover:bg-primary/30'
                            : 'bg-card text-muted-foreground hover:bg-gray-700'
                        }`}
                      >
                        {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        {hasPattern ? `${arc.arc_pattern!.roles.length} roles` : 'Set'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleUpdate({ ...arc, is_premium: !arc.is_premium })}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          arc.is_premium ? 'bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30' : 'bg-card text-muted-foreground hover:bg-gray-700'
                        }`}
                      >
                        {arc.is_premium ? <><Crown className="w-3 h-3 inline mr-1" />Yes</> : 'Free'}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => handleUpdate({ ...arc, is_active: !arc.is_active })}
                        className={`p-1.5 rounded transition-colors ${arc.is_active ? 'text-green-400 hover:bg-green-500/10' : 'text-muted-foreground hover:bg-card'}`}
                      >
                        {arc.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      {arc.id !== '' && (
                        <button onClick={() => handleDelete(arc.id)} className="p-1.5 rounded text-muted-foreground hover:text-red-400 hover:bg-red-500/10">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr key={`${arc.id}-pattern`} className="border-t border-border/30 bg-card/60">
                      <td colSpan={8} className="px-6 py-4">
                        {/* AI Pattern editor — controls what graph.ts uses to structure the video */}
                        <div className="space-y-3 max-w-2xl">
                          <p className="text-xs text-muted-foreground">
                            <span className="text-primary font-medium">AI Pattern</span> — used by graph.ts to assign narrative roles to each video block and set the overall tone.
                          </p>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Narrative Roles <span className="text-muted-foreground">(comma-separated, e.g. hook, context, climax, resolution)</span>
                            </label>
                            <input
                              value={edit?.roles ?? ''}
                              onChange={e => setPatternEdits(p => ({ ...p, [arc.id]: { ...p[arc.id], roles: e.target.value } }))}
                              placeholder="hook, context, build-up, climax, resolution"
                              className={inputCls}
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-muted-foreground mb-1">
                              Default Tone <span className="text-muted-foreground">(prose description injected into the AI director prompt)</span>
                            </label>
                            <input
                              value={edit?.defaultTone ?? ''}
                              onChange={e => setPatternEdits(p => ({ ...p, [arc.id]: { ...p[arc.id], defaultTone: e.target.value } }))}
                              placeholder="cinematic, inspiring, emotionally building toward a peak moment"
                              className={inputCls}
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSavePattern(arc)}
                              disabled={saving}
                              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary rounded-sm text-xs font-medium disabled:opacity-50"
                            >
                              <Save className="w-3 h-3" /> Save Pattern
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
        {arcs.length} arcs · {arcs.filter(a => a.is_premium).length} premium · {arcs.filter(a => !a.is_active).length} hidden · {arcs.filter(a => a.arc_pattern).length} with AI pattern set
      </p>
    </div>
  );
}
