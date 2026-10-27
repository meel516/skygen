'use client';

import { useEffect, useState } from 'react';
import { Youtube, Instagram, Linkedin, CheckCircle2, Link2Off, Loader2, ExternalLink } from '@/components/ui/studio-icons';

export default function IntegrationsPage() {
  const [ytConnected, setYtConnected] = useState<boolean | null>(null);
  const [ytLoading, setYtLoading] = useState(true);
  const [ytDisconnecting, setYtDisconnecting] = useState(false);

  const [liConnected, setLiConnected] = useState<boolean | null>(null);
  const [liLoading, setLiLoading] = useState(true);
  const [liDisconnecting, setLiDisconnecting] = useState(false);

  useEffect(() => {
    fetch('/api/youtube/status')
      .then(r => r.json())
      .then(d => setYtConnected(!!d.connected))
      .catch(() => setYtConnected(false))
      .finally(() => setYtLoading(false));

    fetch('/api/linkedin/status')
      .then(r => r.json())
      .then(d => setLiConnected(!!d.connected))
      .catch(() => setLiConnected(false))
      .finally(() => setLiLoading(false));
  }, []);

  async function handleDisconnect() {
    setYtDisconnecting(true);
    try {
      await fetch('/api/youtube/disconnect', { method: 'DELETE' });
      setYtConnected(false);
    } finally {
      setYtDisconnecting(false);
    }
  }

  async function handleLiDisconnect() {
    setLiDisconnecting(true);
    try {
      await fetch('/api/linkedin/disconnect', { method: 'DELETE' });
      setLiConnected(false);
    } finally {
      setLiDisconnecting(false);
    }
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Integrations</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>
          Connect your social accounts to upload videos directly after rendering.
        </p>
      </div>

      {/* YouTube */}
      <div
        className="rounded-sm p-5 flex items-start gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="w-11 h-11 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(255,0,0,0.12)', border: '1px solid rgba(255,0,0,0.2)' }}
        >
          <Youtube className="w-5 h-5" style={{ color: '#ff0000' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>YouTube</h2>
            {ytConnected && (
              <span
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Upload rendered videos directly to your YouTube channel.
          </p>

          <div className="mt-4 flex items-center gap-3">
            {ytLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            ) : ytConnected ? (
              <button
                onClick={handleDisconnect}
                disabled={ytDisconnecting}
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-sm disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
              >
                {ytDisconnecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Link2Off className="w-3 h-3" />
                )}
                Disconnect
              </button>
            ) : (
              <a
                href="/api/youtube/auth"
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-sm"
                style={{ background: 'rgba(255,0,0,0.1)', border: '1px solid rgba(255,0,0,0.25)', color: '#ff4444' }}
              >
                <ExternalLink className="w-3 h-3" />
                Connect YouTube
              </a>
            )}
          </div>
        </div>
      </div>

      {/* LinkedIn */}
      <div
        className="rounded-sm p-5 flex items-start gap-4"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="w-11 h-11 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(10,102,194,0.12)', border: '1px solid rgba(10,102,194,0.2)' }}
        >
          <Linkedin className="w-5 h-5" style={{ color: '#0a66c2' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>LinkedIn</h2>
            {liConnected && (
              <span
                className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(34,197,94,0.12)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.25)' }}
              >
                <CheckCircle2 className="w-3 h-3" /> Connected
              </span>
            )}
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Post rendered videos directly to your LinkedIn feed.
          </p>

          <div className="mt-4 flex items-center gap-3">
            {liLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
            ) : liConnected ? (
              <button
                onClick={handleLiDisconnect}
                disabled={liDisconnecting}
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-sm disabled:opacity-50"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}
              >
                {liDisconnecting ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Link2Off className="w-3 h-3" />
                )}
                Disconnect
              </button>
            ) : (
              <a
                href="/api/linkedin/auth"
                className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-sm"
                style={{ background: 'rgba(10,102,194,0.1)', border: '1px solid rgba(10,102,194,0.25)', color: '#0a66c2' }}
              >
                <ExternalLink className="w-3 h-3" />
                Connect LinkedIn
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Instagram — coming soon */}
      <div
        className="rounded-sm p-5 flex items-start gap-4 opacity-60"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div
          className="w-11 h-11 rounded-sm flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(225,48,108,0.12)', border: '1px solid rgba(225,48,108,0.2)' }}
        >
          <Instagram className="w-5 h-5" style={{ color: '#e1306c' }} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[14px] font-semibold" style={{ color: 'var(--foreground)' }}>Instagram</h2>
            <span
              className="text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: 'var(--border)', color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
            >
              Coming soon
            </span>
          </div>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
            Upload Reels and feed videos to Instagram. Requires an Instagram Business or Creator account.
          </p>
        </div>
      </div>
    </div>
  );
}
