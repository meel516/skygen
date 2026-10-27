'use client';

import { useEffect, useRef, useState } from 'react';
import { Pencil, Trash2, LayoutGrid, ExternalLink, Globe, Lock, Play, Crown, Key, Copy, Check, X } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { hasPremiumAccess } from '@/lib/roles';
import { usePremiumConfig, getUpgradeUrl } from '@/lib/use-premium-config';

interface Template {
  id: string;
  name: string;
  description: string | null;
  category: string;
  isPublic: boolean;
  createdAt: string;
  previewUrl?: string | null;
  blocks?: { type: string }[];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ApiKey { id: string; key_prefix: string; label: string; created_at: string; last_used_at: string | null }

function ApiKeysSection({ apiKeys, apiKeysLoading, generatingKey, newKeyLabel, setNewKeyLabel, revealedKey, setRevealedKey, copied, handleGenerateKey, handleRevokeKey, handleCopy }: {
  apiKeys: ApiKey[];
  apiKeysLoading: boolean;
  generatingKey: boolean;
  newKeyLabel: string;
  setNewKeyLabel: (v: string) => void;
  revealedKey: string | null;
  setRevealedKey: (v: string | null) => void;
  copied: boolean;
  handleGenerateKey: () => void;
  handleRevokeKey: (id: string) => void;
  handleCopy: () => void;
}) {
  return (
    <div className="mt-12 mb-8">
      <div className="flex items-center gap-3 mb-2">
        <Key className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-bold text-white">API Keys</h2>
      </div>
      <p className="text-sm mb-6" style={{ color: '#8B8BAA' }}>
        Use API keys to connect Claude Code or other tools to your account. Each key has full access — keep it secret.
      </p>
      {revealedKey && (
        <div className="mb-6 rounded-xl p-4 border" style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.3)' }}>
          <p className="text-sm font-medium text-purple-300 mb-2">Copy your key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-black/40 rounded-lg px-3 py-2 text-green-400 font-mono break-all">{revealedKey}</code>
            <button onClick={handleCopy} className="p-2 rounded-lg transition-colors" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
            </button>
            <button onClick={() => setRevealedKey(null)} className="p-2 rounded-lg transition-colors" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}
      <div className="flex items-center gap-3 mb-6">
        <input
          type="text"
          placeholder="Key label (optional)"
          value={newKeyLabel}
          onChange={e => setNewKeyLabel(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm text-white w-48 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <button
          onClick={handleGenerateKey}
          disabled={generatingKey || apiKeys.length >= 5}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white transition-all disabled:opacity-50"
          style={{ background: '#7C3AED' }}
        >
          {generatingKey ? 'Generating…' : 'Generate Key'}
        </button>
        {apiKeys.length >= 5 && (
          <span className="text-xs" style={{ color: '#8B8BAA' }}>Max 5 keys reached</span>
        )}
      </div>
      {apiKeysLoading ? (
        <p className="text-sm" style={{ color: '#8B8BAA' }}>Loading…</p>
      ) : apiKeys.length === 0 ? (
        <p className="text-sm" style={{ color: '#8B8BAA' }}>No API keys yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {apiKeys.map(k => (
            <div key={k.id} className="flex items-center justify-between rounded-xl px-4 py-3" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="flex items-center gap-4">
                <code className="text-sm font-mono text-purple-300">{k.key_prefix}…</code>
                <span className="text-sm text-white">{k.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs" style={{ color: '#8B8BAA' }}>
                  Created {formatDate(k.created_at)}
                  {k.last_used_at && ` · Last used ${formatDate(k.last_used_at)}`}
                </span>
                <button onClick={() => handleRevokeKey(k.id)} className="p-1.5 rounded-lg transition-colors hover:bg-red-500/10">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper to get emoji based on category
const getCategoryEmoji = (category: string) => {
  const emojiMap: Record<string, string> = {
    motivation: '🔥', documentary: '🎬', tutorial: '📚', business: '💼',
    lifestyle: '🌟', sports: '🏆', food: '🍔', news: '📰',
    entertainment: '🎭', finance: '📈', religious: '🕌', educational: '📖',
    story: '📖', movie: '🎥',
  };
  return emojiMap[category?.toLowerCase()] ?? '🎬';
};

export default function TemplatesPage() {
  const { data: session } = useSession();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', category: '', isPublic: false });
  const [saving, setSaving] = useState(false);
  const hasPremium = hasPremiumAccess(session?.user?.role);
  const premiumConfig = usePremiumConfig();

  // API Keys state
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [apiKeysLoading, setApiKeysLoading] = useState(true);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!hasPremium) {
      setLoading(false);
      return;
    }

    fetch('/api/templates')
      .then((r) => r.json())
      .then((data) => {
        const all: Template[] = Array.isArray(data) ? data : data.templates ?? [];
        setTemplates(all.filter((t) => t.isPublic !== undefined));
      })
      .finally(() => setLoading(false));
  }, [hasPremium]);

  useEffect(() => {
    fetch('/api/user/api-keys')
      .then(r => r.json())
      .then(data => setApiKeys(data.keys ?? []))
      .finally(() => setApiKeysLoading(false));
  }, []);

  const handleGenerateKey = async () => {
    setGeneratingKey(true);
    try {
      const res = await fetch('/api/user/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: newKeyLabel || 'Default' }),
      });
      const data = await res.json();
      if (data.key) {
        setRevealedKey(data.key);
        setApiKeys(prev => [{ id: data.id ?? crypto.randomUUID(), key_prefix: data.prefix, label: data.label, created_at: new Date().toISOString(), last_used_at: null }, ...prev]);
        setNewKeyLabel('');
      }
    } finally {
      setGeneratingKey(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    await fetch('/api/user/api-keys', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const handleCopy = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) setTemplates((prev) => prev.filter((t) => t.id !== id));
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  const openEdit = (t: Template) => {
    setEditForm({ name: t.name, description: t.description ?? '', category: t.category, isPublic: t.isPublic });
    setEditingId(t.id);
  };

  const handleSave = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/templates/${editingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      if (res.ok) {
        const updated = await res.json();
        setTemplates((prev) => prev.map((t) => (t.id === editingId ? { ...t, ...updated } : t)));
        setEditingId(null);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleLoadInEditor = (template: Template) => {
    try {
      localStorage.setItem('load_template', JSON.stringify(template));
      window.location.href = '/';
    } catch { /* ignore */ }
  };

  const handleEditInEditor = (template: Template) => {
    try {
      localStorage.setItem('edit_template', JSON.stringify(template));
      window.location.href = '/editor';
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!hasPremium) {
    return (
      <div className="max-w-3xl">
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
          style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.2)' }}
          >
            <Crown className="w-7 h-7" style={{ color: '#FBBF24' }} />
          </div>
          <p className="text-[18px] font-semibold mb-2" style={{ color: '#F1F1F8' }}>My Templates is Premium</p>
          <p className="text-[13px] max-w-[420px] mb-6" style={{ color: '#8B8BAA' }}>
            Upgrade to Premium to save your own templates, reuse them later, and unlock advanced workflows.
          </p>
          <button
            onClick={() => { window.open(getUpgradeUrl(premiumConfig), '_blank'); }}
            className="px-4 py-2 rounded-lg text-[12px] font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
          >
            Upgrade to Premium
          </button>
        </div>
        {/* API Keys available to all users */}
        <ApiKeysSection
          apiKeys={apiKeys}
          apiKeysLoading={apiKeysLoading}
          generatingKey={generatingKey}
          newKeyLabel={newKeyLabel}
          setNewKeyLabel={setNewKeyLabel}
          revealedKey={revealedKey}
          setRevealedKey={setRevealedKey}
          copied={copied}
          handleGenerateKey={handleGenerateKey}
          handleRevokeKey={handleRevokeKey}
          handleCopy={handleCopy}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#F1F1F8' }}>My Templates</h1>
        <p className="text-[13px]" style={{ color: '#8B8BAA' }}>
          {templates.length} saved template{templates.length !== 1 ? 's' : ''}
        </p>
      </div>

      {templates.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
          style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <LayoutGrid className="w-7 h-7" style={{ color: '#55556A' }} />
          </div>
          <p className="text-[14px] font-medium mb-1" style={{ color: '#F1F1F8' }}>No templates yet</p>
          <p className="text-[12px] max-w-[220px]" style={{ color: '#55556A' }}>
            Build a video in the editor and use "Save as Template" to save it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="rounded-xl overflow-hidden"
              style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* Card row - Video/Image preview style */}
              <div className="flex items-center gap-4 p-4">
                {/* Thumbnail preview */}
                <div className="relative w-24 h-36 rounded-lg overflow-hidden flex-shrink-0 bg-gray-800">
                  {template.previewUrl ? (
                    template.previewUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                      <video src={template.previewUrl} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                    ) : (
                      <img src={template.previewUrl} alt={template.name} className="w-full h-full object-cover" />
                    )
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-gray-800 to-gray-900">
                      <span className="text-3xl">{getCategoryEmoji(template.category)}</span>
                      <span className="text-[10px] text-gray-500">{template.blocks?.length || 0} blocks</span>
                    </div>
                  )}
                  {/* Play icon overlay */}
                  {template.previewUrl && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 hover:opacity-100 transition-opacity">
                      <div className="w-10 h-10 rounded-full bg-white/90 flex items-center justify-center">
                        <Play className="w-5 h-5 fill-white text-gray-900 ml-0.5" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Template info */}
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center gap-2">
                    <p className="text-[14px] font-semibold truncate" style={{ color: '#F1F1F8' }}>{template.name}</p>
                    <span
                      className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px]"
                      style={{
                        background: template.isPublic ? 'rgba(16,185,129,0.12)' : 'rgba(255,255,255,0.05)',
                        color: template.isPublic ? '#34D399' : '#55556A',
                      }}
                    >
                      {template.isPublic ? <Globe className="w-2.5 h-2.5" /> : <Lock className="w-2.5 h-2.5" />}
                      {template.isPublic ? 'Public' : 'Private'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {template.description && (
                      <span className="text-[11px] truncate" style={{ color: '#8B8BAA' }}>{template.description}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: '#55556A' }}>
                    <span>{getCategoryEmoji(template.category)} {template.category || 'General'}</span>
                    <span>📦 {template.blocks?.length || 0} blocks</span>
                    <span>📅 {formatDate(template.createdAt)}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLoadInEditor(template)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
                    style={{ color: '#8B8BAA', border: '1px solid rgba(255,255,255,0.08)' }}
                    title="Load into editor"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open
                  </button>
                  {/* Quick public/private toggle */}
                  <button
                    onClick={async () => {
                      const newPublic = !template.isPublic;
                      const res = await fetch(`/api/templates/${template.id}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ isPublic: newPublic }),
                      });
                      if (res.ok) {
                        setTemplates(prev => prev.map(t => t.id === template.id ? { ...t, isPublic: newPublic } : t));
                      }
                    }}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors"
                    style={{
                      border: `1px solid ${template.isPublic ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      color: template.isPublic ? '#34D399' : '#55556A',
                    }}
                    title={template.isPublic ? 'Make private' : 'Make public'}
                  >
                    {template.isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                    {template.isPublic ? 'Public' : 'Private'}
                  </button>
                  <button
                    onClick={() => handleEditInEditor(template)}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] transition-colors hover:bg-[#25253A]"
                    style={{ color: '#8B8BAA', border: '1px solid rgba(255,255,255,0.08)' }}
                    title="Edit template in editor"
                  >
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                  {confirmId === template.id ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => handleDelete(template.id)}
                        disabled={deleting === template.id}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-white"
                        style={{ background: '#EF4444' }}
                      >
                        {deleting === template.id ? '…' : 'Delete'}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="px-2.5 py-1 rounded-lg text-[11px]"
                        style={{ color: '#8B8BAA', border: '1px solid rgba(255,255,255,0.08)' }}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmId(template.id)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                      style={{ color: '#55556A' }}
                      title="Delete template"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Edit form (inline expand) */}
              {editingId === template.id && (
                <div
                  className="px-4 pb-4 pt-0 border-t space-y-3"
                  style={{ borderColor: 'rgba(255,255,255,0.06)' }}
                >
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: '#55556A' }}>Name</label>
                      <input
                        value={editForm.name}
                        onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg text-[12px] outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F1F8' }}
                      />
                    </div>
                    <div>
                      <label className="text-[11px] mb-1 block" style={{ color: '#55556A' }}>Category</label>
                      <input
                        value={editForm.category}
                        onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                        className="w-full px-3 py-1.5 rounded-lg text-[12px] outline-none"
                        style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F1F8' }}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[11px] mb-1 block" style={{ color: '#55556A' }}>Description</label>
                    <input
                      value={editForm.description}
                      onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                      className="w-full px-3 py-1.5 rounded-lg text-[12px] outline-none"
                      style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#F1F1F8' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id={`pub-${template.id}`}
                      checked={editForm.isPublic}
                      onChange={(e) => setEditForm((f) => ({ ...f, isPublic: e.target.checked }))}
                      className="accent-[#7C3AED]"
                    />
                    <label htmlFor={`pub-${template.id}`} className="text-[12px]" style={{ color: '#8B8BAA' }}>
                      Make public (visible to all users)
                    </label>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-1.5 rounded-lg text-[12px] font-medium text-white transition-all"
                      style={{ background: '#7C3AED' }}
                    >
                      {saving ? 'Saving…' : 'Save Changes'}
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-4 py-1.5 rounded-lg text-[12px] transition-colors"
                      style={{ color: '#8B8BAA', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <ApiKeysSection
        apiKeys={apiKeys}
        apiKeysLoading={apiKeysLoading}
        generatingKey={generatingKey}
        newKeyLabel={newKeyLabel}
        setNewKeyLabel={setNewKeyLabel}
        revealedKey={revealedKey}
        setRevealedKey={setRevealedKey}
        copied={copied}
        handleGenerateKey={handleGenerateKey}
        handleRevokeKey={handleRevokeKey}
        handleCopy={handleCopy}
      />
    </div>
  );
}
