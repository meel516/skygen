'use client';

import { useState, useEffect } from 'react';
import { Loader2, Save, Crown, Lock, Music2, MessageSquare, Phone } from 'lucide-react';

const ALL_BLOCK_TYPES = [
  { type: 'tower-chart-3d', label: '3D Tower Chart' },
  { type: 'bar-race-3d', label: '3D Bar Race' },
  { type: 'parallax-story', label: 'Parallax Story' },
  { type: 'video', label: 'Video' },
  { type: 'line-chart', label: 'Line Chart' },
  { type: 'pie-chart', label: 'Pie Chart' },
  { type: 'counter', label: 'Counter' },
  { type: 'progress-bar', label: 'Progress Bar' },
  { type: 'qr-code', label: 'QR Code' },
  { type: 'animated-bg', label: 'Animated BG' },
  { type: 'countdown', label: 'Countdown' },
  { type: 'weather-block', label: 'Weather' },
  { type: 'pricing-table', label: 'Pricing Table' },
  { type: 'logo-wall', label: 'Logo Wall' },
  { type: 'process-steps', label: 'Process Steps' },
  { type: 'whatsapp-chat', label: 'WhatsApp Chat' },
  { type: 'motivational-image', label: 'Motivational Image' },
  { type: 'avatar-grid', label: 'Avatar Grid' },
  { type: 'social-stats', label: 'Social Stats' },
];

const VOICE_PROVIDERS = [
  { id: 'elevenlabs', label: 'ElevenLabs' },
  { id: 'deepgram', label: 'Deepgram' },
];

interface PremiumConfig {
  premiumBlockTypes: string[];
  premiumVoiceProviders: string[];
  upgradeWhatsApp: string;
  upgradeMessage: string;
}

const DEFAULTS: PremiumConfig = {
  premiumBlockTypes: ['tower-chart-3d', 'parallax-story', 'video', 'bar-race-3d'],
  premiumVoiceProviders: ['elevenlabs'],
  upgradeWhatsApp: '917337253375',
  upgradeMessage: 'Hi, I would like to upgrade to Premium on SkyGen!',
};

export default function PremiumConfigPage() {
  const [config, setConfig] = useState<PremiumConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch('/api/admin/premium-config')
      .then(r => r.json())
      .then(data => {
        if (data.premiumBlockTypes) setConfig(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch('/api/admin/premium-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      if (!res.ok) throw new Error('Save failed');
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      alert('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const toggleBlockType = (type: string) => {
    setConfig(prev => ({
      ...prev,
      premiumBlockTypes: prev.premiumBlockTypes.includes(type)
        ? prev.premiumBlockTypes.filter(t => t !== type)
        : [...prev.premiumBlockTypes, type],
    }));
  };

  const toggleVoiceProvider = (id: string) => {
    setConfig(prev => ({
      ...prev,
      premiumVoiceProviders: prev.premiumVoiceProviders.includes(id)
        ? prev.premiumVoiceProviders.filter(p => p !== id)
        : [...prev.premiumVoiceProviders, id],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  const checkboxClass = 'w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500 focus:ring-offset-0 cursor-pointer';

  return (
    <div className="max-w-3xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Crown className="w-6 h-6 text-yellow-400" />
            Premium Configuration
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Control which features require a premium subscription.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          style={{
            background: saved ? 'rgba(34,197,94,0.2)' : 'rgba(124,58,237,0.85)',
            color: saved ? '#22c55e' : '#fff',
          }}
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
          ) : saved ? (
            <><Save className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Changes</>
          )}
        </button>
      </div>

      {/* Premium Block Types */}
      <section className="rounded-xl p-5 space-y-4 bg-gray-900/60 border border-gray-800">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-gray-200">Premium Block Types</h2>
        </div>
        <p className="text-xs text-gray-500">
          Checked blocks require premium. Unchecked blocks are free for all users.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {ALL_BLOCK_TYPES.map(block => (
            <label
              key={block.type}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={config.premiumBlockTypes.includes(block.type)}
                onChange={() => toggleBlockType(block.type)}
                className={checkboxClass}
              />
              <span className="text-sm text-gray-300">{block.label}</span>
              <span className="text-[10px] text-gray-600 font-mono">{block.type}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Voice Providers */}
      <section className="rounded-xl p-5 space-y-4 bg-gray-900/60 border border-gray-800">
        <div className="flex items-center gap-2">
          <Music2 className="w-4 h-4 text-purple-400" />
          <h2 className="text-sm font-semibold text-gray-200">Premium Voice Providers</h2>
        </div>
        <p className="text-xs text-gray-500">
          Checked providers require premium. Unchecked providers are free.
        </p>
        <div className="space-y-2">
          {VOICE_PROVIDERS.map(provider => (
            <label
              key={provider.id}
              className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={config.premiumVoiceProviders.includes(provider.id)}
                onChange={() => toggleVoiceProvider(provider.id)}
                className={checkboxClass}
              />
              <span className="text-sm text-gray-300">{provider.label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Upgrade Contact */}
      <section className="rounded-xl p-5 space-y-4 bg-gray-900/60 border border-gray-800">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-green-400" />
          <h2 className="text-sm font-semibold text-gray-200">Upgrade Contact (WhatsApp)</h2>
        </div>
        <p className="text-xs text-gray-500">
          When users click "Upgrade to Premium", they'll be redirected to WhatsApp with this number and message.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              <Phone className="w-3 h-3 inline mr-1" />
              WhatsApp Number (with country code, no +)
            </label>
            <input
              type="text"
              value={config.upgradeWhatsApp}
              onChange={e => setConfig(prev => ({ ...prev, upgradeWhatsApp: e.target.value }))}
              placeholder="e.g. 917337253375"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Pre-filled Message</label>
            <textarea
              value={config.upgradeMessage}
              onChange={e => setConfig(prev => ({ ...prev, upgradeMessage: e.target.value }))}
              rows={2}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
            />
          </div>
          <div className="text-xs text-gray-600">
            Preview: <a href={`https://wa.me/${config.upgradeWhatsApp}?text=${encodeURIComponent(config.upgradeMessage)}`} target="_blank" rel="noopener noreferrer" className="text-green-400 underline">Open WhatsApp link</a>
          </div>
        </div>
      </section>
    </div>
  );
}
