'use client';

import { useState, useEffect } from 'react';
import { Save, Loader2, Plus, Trash2, GripVertical } from 'lucide-react';

interface HeroConfig {
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
}

interface Feature {
  title: string;
  description: string;
  icon: string;
}

interface Stat {
  value: string;
  label: string;
}

export default function LandingPage() {
  const [hero, setHero] = useState<HeroConfig>({ title: '', subtitle: '', ctaText: '', ctaLink: '' });
  const [features, setFeatures] = useState<Feature[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/content-manager/config')
      .then((r) => r.json())
      .then((data) => {
        const configs = data.configs || [];
        const heroConfig = configs.find((c: { key: string }) => c.key === 'landing_hero');
        const featuresConfig = configs.find((c: { key: string }) => c.key === 'landing_features');
        const statsConfig = configs.find((c: { key: string }) => c.key === 'landing_stats');
        if (heroConfig?.value) setHero(heroConfig.value);
        if (featuresConfig?.value) setFeatures(featuresConfig.value);
        if (statsConfig?.value) setStats(statsConfig.value);
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    await Promise.all([
      fetch('/api/content-manager/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'landing_hero', value: hero }),
      }),
      fetch('/api/content-manager/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'landing_features', value: features }),
      }),
      fetch('/api/content-manager/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'landing_stats', value: stats }),
      }),
    ]);
    setSaving(false);
  };

  const updateFeature = (i: number, field: keyof Feature, value: string) => {
    const updated = [...features];
    updated[i] = { ...updated[i], [field]: value };
    setFeatures(updated);
  };

  const updateStat = (i: number, field: keyof Stat, value: string) => {
    const updated = [...stats];
    updated[i] = { ...updated[i], [field]: value };
    setStats(updated);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold">Landing Page</h2>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save All
        </button>
      </div>

      {/* Hero Section */}
      <section className="mb-10">
        <h3 className="text-lg font-semibold mb-4 text-gray-300">Hero Section</h3>
        <div className="space-y-4 bg-gray-900/50 rounded-lg border border-gray-800 p-5">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Title</label>
            <input
              value={hero.title}
              onChange={(e) => setHero({ ...hero, title: e.target.value })}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
              placeholder="Create Stunning AI Videos"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Subtitle</label>
            <textarea
              value={hero.subtitle}
              onChange={(e) => setHero({ ...hero, subtitle: e.target.value })}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white min-h-[60px]"
              placeholder="Transform your ideas into professional videos..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">CTA Text</label>
              <input
                value={hero.ctaText}
                onChange={(e) => setHero({ ...hero, ctaText: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                placeholder="Get Started Free"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">CTA Link</label>
              <input
                value={hero.ctaLink}
                onChange={(e) => setHero({ ...hero, ctaLink: e.target.value })}
                className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2.5 text-white"
                placeholder="/templates"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-300">Features</h3>
          <button
            onClick={() => setFeatures([...features, { title: '', description: '', icon: '✨' }])}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-4 h-4" /> Add Feature
          </button>
        </div>
        <div className="space-y-3">
          {features.map((feature, i) => (
            <div key={i} className="bg-gray-900/50 rounded-lg border border-gray-800 p-4">
              <div className="flex items-start gap-3">
                <GripVertical className="w-4 h-4 text-gray-600 mt-3 shrink-0" />
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-[60px_1fr] gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Icon</label>
                      <input
                        value={feature.icon}
                        onChange={(e) => updateFeature(i, 'icon', e.target.value)}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded px-2 py-1.5 text-white text-center text-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Title</label>
                      <input
                        value={feature.title}
                        onChange={(e) => updateFeature(i, 'title', e.target.value)}
                        className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Description</label>
                    <input
                      value={feature.description}
                      onChange={(e) => updateFeature(i, 'description', e.target.value)}
                      className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                    />
                  </div>
                </div>
                <button
                  onClick={() => setFeatures(features.filter((_, idx) => idx !== i))}
                  className="p-1.5 text-red-400 hover:text-red-300 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {features.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-6">No features configured. Hardcoded defaults will be used.</p>
          )}
        </div>
      </section>

      {/* Stats */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-300">Stats</h3>
          <button
            onClick={() => setStats([...stats, { value: '0', label: 'Label' }])}
            className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300"
          >
            <Plus className="w-4 h-4" /> Add Stat
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {stats.map((stat, i) => (
            <div key={i} className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 flex items-center gap-3">
              <div className="flex-1 space-y-2">
                <input
                  value={stat.value}
                  onChange={(e) => updateStat(i, 'value', e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-1.5 text-white text-lg font-bold"
                  placeholder="100+"
                />
                <input
                  value={stat.label}
                  onChange={(e) => updateStat(i, 'label', e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700 rounded px-3 py-1.5 text-white text-sm"
                  placeholder="Videos Created"
                />
              </div>
              <button
                onClick={() => setStats(stats.filter((_, idx) => idx !== i))}
                className="p-1.5 text-red-400 hover:text-red-300"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        {stats.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-6">No stats configured. Hardcoded defaults will be used.</p>
        )}
      </section>
    </div>
  );
}
