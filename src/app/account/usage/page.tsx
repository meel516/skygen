'use client';

import { useEffect, useState } from 'react';
import { Sparkles, Video, Zap, Crown } from 'lucide-react';

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
      <div className="flex justify-between text-[12px] mb-1.5" style={{ color: '#8B8BAA' }}>
        <span>{used} used</span>
        <span>{limit - used} remaining</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: barColor }}
        />
      </div>
      <p className="text-[11px] mt-1" style={{ color: '#55556A' }}>{used} / {limit}</p>
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
        <div className="w-5 h-5 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
      </div>
    );
  }

  const u = usage ?? { videoCount: 0, videoLimit: 10, aiCount: 0, aiLimit: 20, aiTokensUsed: 0, aiTokenLimit: 100000, role: 'USER' };

  return (
    <div className="max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#F1F1F8' }}>Usage & Billing</h1>
        <p className="text-[13px]" style={{ color: '#8B8BAA' }}>Track your current usage and plan limits.</p>
      </div>

      {/* Current plan */}
      <div
        className="rounded-2xl p-6"
        style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Crown className="w-4 h-4" style={{ color: '#F59E0B' }} />
              <span className="text-[15px] font-semibold" style={{ color: '#F1F1F8' }}>Free Plan</span>
            </div>
            <p className="text-[12px]" style={{ color: '#55556A' }}>
              {u.role === 'ADMIN' ? 'Admin account' : 'Community tier'}
            </p>
          </div>
          <button
            className="px-4 py-2 rounded-lg text-[12px] font-medium text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #6D28D9)', boxShadow: '0 4px 16px rgba(124,58,237,0.3)' }}
          >
            Upgrade Plan
          </button>
        </div>
        <ul className="space-y-1.5 text-[12px]" style={{ color: '#8B8BAA' }}>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
            {u.videoLimit} video renders per month
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
            {(u.aiTokenLimit / 1000).toFixed(0)}K AI tokens
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
            Core content blocks on Free
          </li>
          <li className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#7C3AED]" />
            Premium unlocks 3D, Parallax, Video blocks, and My Templates
          </li>
        </ul>
      </div>

      {/* Usage cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Video renders */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(14,165,233,0.15)' }}
            >
              <Video className="w-4 h-4" style={{ color: '#0EA5E9' }} />
            </div>
            <div>
              <p className="text-[13px] font-medium" style={{ color: '#F1F1F8' }}>Video Renders</p>
              <p className="text-[11px]" style={{ color: '#55556A' }}>MP4 exports this month</p>
            </div>
          </div>
          <UsageBar used={u.videoCount} limit={u.videoLimit} color="#0EA5E9" />
        </div>

        {/* AI token usage */}
        <div
          className="rounded-2xl p-5 space-y-4"
          style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div className="flex items-center gap-2">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'rgba(124,58,237,0.15)' }}
            >
              <Sparkles className="w-4 h-4" style={{ color: '#A78BFA' }} />
            </div>
            <div>
              <p className="text-[13px] font-medium" style={{ color: '#F1F1F8' }}>AI Tokens</p>
              <p className="text-[11px]" style={{ color: '#55556A' }}>{u.aiCount} generation{u.aiCount !== 1 ? 's' : ''} · {u.aiTokensUsed.toLocaleString()} tokens used</p>
            </div>
          </div>
          <UsageBar used={u.aiTokensUsed} limit={u.aiTokenLimit} color="#7C3AED" />
        </div>
      </div>

      {/* Info note */}
      <div
        className="flex items-start gap-3 p-4 rounded-xl text-[12px]"
        style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: '#8B8BAA' }}
      >
        <Zap className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#A78BFA' }} />
        <p>
          Limits reset monthly. Need more? Upgrade your plan for unlimited renders and AI generations,
          priority rendering, and advanced export options.
        </p>
      </div>
    </div>
  );
}
