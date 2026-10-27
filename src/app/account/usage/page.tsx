'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Video, Zap, Crown } from '@/components/ui/studio-icons';

interface Usage {
  videoCount: number;
  videoLimit: number;
  aiCount: number;
  aiLimit: number;
  aiTokensUsed: number;
  aiTokenLimit: number;
  role: string;
}

function UsageBar({ used, limit, color }: { used: number; limit: number; color: string }) {
  const pct = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const barColor = pct >= 90 ? '#EF4444' : pct >= 70 ? '#F59E0B' : color;
  return (
    <div>
      <div className="flex justify-between text-[12px] mb-1.5" style={{ color: 'var(--muted-foreground)' }}>
        <span>{used} used</span>
        <span>{limit - used} remaining</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p className="text-[11px] mt-1" style={{ color: 'var(--muted-foreground)' }}>{used} / {limit}</p>
    </div>
  );
}

export default function UsagePage() {
  const [usage, setUsage] = useState<Usage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/user/usage')
      .then((r) => r.json())
      .then(setUsage)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  const u = usage ?? { videoCount: 0, videoLimit: 10, aiCount: 0, aiLimit: 20, aiTokensUsed: 0, aiTokenLimit: 100000, role: 'USER' };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>Usage & Billing</h1>
        <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>Track your current usage and plan limits.</p>
      </div>

      {/* Current plan */}
      <div
        className="rounded-sm p-6"
        style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <span className="text-[15px] font-semibold" style={{ color: 'var(--foreground)' }}>Free Plan</span>
            </div>
            <p className="text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
              {u.role === 'ADMIN' ? 'Admin account' : 'Community tier'}
            </p>
          </div>
          <button
            className="px-4 py-2 rounded-sm text-[12px] font-medium text-white"
            style={{ background: 'var(--primary)', boxShadow: 'none' }}
          >
            Upgrade Plan
          </button>
        </div>
        <ul className="space-y-1.5 text-[12px]" style={{ color: 'var(--muted-foreground)' }}>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            {u.videoLimit} video renders per month
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            {(u.aiTokenLimit / 1000).toFixed(0)}K AI tokens
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            Core content blocks on Free
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)]" />
            Premium unlocks 3D, Parallax, Video blocks, and My Templates
          </li>
        </ul>
      </div>

      {/* Usage cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Video renders */}
        <div
          className="rounded-sm p-5 space-y-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-sm flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
            >
              <Video className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>Video Renders</p>
              <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>MP4 exports this month</p>
            </div>
          </div>
          <UsageBar used={u.videoCount} limit={u.videoLimit} color="#0EA5E9" />
        </div>

        {/* AI token usage */}
        <div
          className="rounded-sm p-5 space-y-4"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-sm flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <p className="text-[13px] font-medium" style={{ color: 'var(--foreground)' }}>AI Tokens</p>
              <p className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{u.aiCount} generation{u.aiCount !== 1 ? 's' : ''} · {u.aiTokensUsed.toLocaleString()} tokens used</p>
            </div>
          </div>
          <UsageBar used={u.aiTokensUsed} limit={u.aiTokenLimit} color="#7C3AED" />
        </div>
      </div>

      {/* Info note */}
      <div
        className="flex items-start gap-3 p-4 rounded-sm text-[12px]"
        style={{ background: 'color-mix(in srgb, var(--primary) 8%, transparent)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', color: 'var(--muted-foreground)' }}
      >
        <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--primary)' }} />
        <p>
          Limits reset monthly. Need more? Upgrade your plan for unlimited renders and AI generations,
          priority rendering, and advanced export options.
        </p>
      </div>
    </div>
  );
}
