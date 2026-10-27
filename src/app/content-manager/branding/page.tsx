'use client';

import { useState, useEffect } from 'react';
import { ImageUploader } from '@/components/content-manager/ImageUploader';
import { Save, Loader2 } from 'lucide-react';

interface BrandingConfig {
  appName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
}

const DEFAULTS: BrandingConfig = {
  appName: 'SKYGEN',
  logoUrl: '',
  faviconUrl: '',
  primaryColor: '#7C3AED',
  secondaryColor: '#0EA5E9',
};

export default function BrandingPage() {
  const [config, setConfig] = useState<BrandingConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/content-manager/config')
      .then((r) => r.json())
      .then((data) => {
        const branding = data.configs?.find((c: { key: string }) => c.key === 'branding');
        if (branding?.value) {
          setConfig({ ...DEFAULTS, ...branding.value });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch('/api/content-manager/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'branding', value: config }),
    });
    setSaving(false);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Branding</h2>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">App Name</label>
          <input
            value={config.appName}
            onChange={(e) => setConfig({ ...config, appName: e.target.value })}
            className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
            placeholder="SKYGEN"
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <ImageUploader
            label="Logo"
            value={config.logoUrl || undefined}
            onChange={(url) => setConfig({ ...config, logoUrl: url || '' })}
          />
          <ImageUploader
            label="Favicon"
            value={config.faviconUrl || undefined}
            onChange={(url) => setConfig({ ...config, faviconUrl: url || '' })}
          />
        </div>

        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Primary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                value={config.primaryColor}
                onChange={(e) => setConfig({ ...config, primaryColor: e.target.value })}
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Secondary Color</label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={config.secondaryColor}
                onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              />
              <input
                value={config.secondaryColor}
                onChange={(e) => setConfig({ ...config, secondaryColor: e.target.value })}
                className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white font-mono text-sm"
              />
            </div>
          </div>
        </div>

        {/* Live Preview */}
        <div className="rounded-lg border border-gray-700 p-6 bg-gray-900/50">
          <p className="text-xs text-gray-500 mb-3">Preview</p>
          <div className="flex items-center gap-3">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
            ) : (
              <div className="w-8 h-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})` }} />
            )}
            <span className="text-lg font-bold" style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {config.appName || 'SKYGEN'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
