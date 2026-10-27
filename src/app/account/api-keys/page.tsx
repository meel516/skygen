'use client';

import { useEffect, useRef, useState } from 'react';
import { Key, Copy, Check, X, Trash2 } from 'lucide-react';

interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function ApiKeysPage() {
  const [apiKeys, setApiKeys]           = useState<ApiKey[]>([]);
  const [loading, setLoading]           = useState(true);
  const [generating, setGenerating]     = useState(false);
  const [label, setLabel]               = useState('');
  const [revealedKey, setRevealedKey]   = useState<string | null>(null);
  const [copied, setCopied]             = useState(false);
  const copyTimeout                     = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch('/api/user/api-keys')
      .then(r => r.json())
      .then(d => setApiKeys(d.keys ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res  = await fetch('/api/user/api-keys', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ label: label || 'Default' }),
      });
      const data = await res.json();
      if (data.key) {
        setRevealedKey(data.key);
        setApiKeys(prev => [{
          id:           data.id ?? crypto.randomUUID(),
          key_prefix:   data.prefix,
          label:        data.label,
          created_at:   new Date().toISOString(),
          last_used_at: null,
        }, ...prev]);
        setLabel('');
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    await fetch('/api/user/api-keys', {
      method:  'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ id }),
    });
    setApiKeys(prev => prev.filter(k => k.id !== id));
  };

  const handleCopy = () => {
    if (!revealedKey) return;
    navigator.clipboard.writeText(revealedKey);
    setCopied(true);
    if (copyTimeout.current) clearTimeout(copyTimeout.current);
    copyTimeout.current = setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-2">
        <Key className="w-5 h-5 text-purple-400" />
        <h1 className="text-2xl font-bold" style={{ color: '#F1F1F8' }}>API Keys</h1>
      </div>
      <p className="text-sm mb-8" style={{ color: '#8B8BAA' }}>
        Use API keys to connect Claude Code or other MCP clients to your account. Keep keys secret — each has full account access.
      </p>

      {/* Revealed key banner */}
      {revealedKey && (
        <div className="mb-6 rounded-xl p-4 border" style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.3)' }}>
          <p className="text-sm font-medium text-purple-300 mb-3">Copy your key now — it won't be shown again.</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-sm bg-black/40 rounded-lg px-3 py-2 text-green-400 font-mono break-all">
              {revealedKey}
            </code>
            <button onClick={handleCopy} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
              {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white" />}
            </button>
            <button onClick={() => setRevealedKey(null)} className="p-2 rounded-lg" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
      )}

      {/* Generate form */}
      <div className="flex items-center gap-3 mb-8">
        <input
          type="text"
          placeholder="Key label (optional)"
          value={label}
          onChange={e => setLabel(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm text-white w-48 focus:outline-none"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}
        />
        <button
          onClick={handleGenerate}
          disabled={generating || apiKeys.length >= 5}
          className="px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50"
          style={{ background: '#7C3AED' }}
        >
          {generating ? 'Generating…' : 'Generate Key'}
        </button>
        {apiKeys.length >= 5 && (
          <span className="text-xs" style={{ color: '#8B8BAA' }}>Max 5 keys</span>
        )}
      </div>

      {/* Keys list */}
      {loading ? (
        <p className="text-sm" style={{ color: '#8B8BAA' }}>Loading…</p>
      ) : apiKeys.length === 0 ? (
        <p className="text-sm" style={{ color: '#8B8BAA' }}>No API keys yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {apiKeys.map(k => (
            <div
              key={k.id}
              className="flex items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-4">
                <code className="text-sm font-mono text-purple-300">{k.key_prefix}…</code>
                <span className="text-sm text-white">{k.label}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs" style={{ color: '#8B8BAA' }}>
                  Created {formatDate(k.created_at)}
                  {k.last_used_at && ` · Last used ${formatDate(k.last_used_at)}`}
                </span>
                <button
                  onClick={() => handleRevoke(k.id)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MCP setup hint */}
      <div className="mt-10 rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <p className="text-xs font-medium text-gray-400 mb-2">Claude Code setup</p>
        <p className="text-xs mb-2" style={{ color: '#55556A' }}>
          Paste your key into <code className="text-purple-300">.mcp.json</code> in the project root:
        </p>
        <code className="block text-xs text-green-400 bg-black/40 rounded-lg p-3 whitespace-pre">{`"VIDEOGEN_API_KEY": "sk-vg-your-key-here"`}</code>
      </div>
    </div>
  );
}
