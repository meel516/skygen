'use client';

import { useState, useEffect } from 'react';
import { Loader2, Eye, EyeOff } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  isPublic: boolean;
  previewUrl: string;
  createdAt: string;
}

const CATEGORIES = ['general', 'motivation', 'food', 'tutorial', 'business', 'lifestyle', 'education', 'tech'];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/content-manager/templates')
      .then((r) => r.json())
      .then((data) => setTemplates(data.templates || []))
      .finally(() => setLoading(false));
  }, []);

  const updateTemplate = async (id: string, updates: Partial<Template>) => {
    setUpdatingId(id);
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t)));
    await fetch('/api/content-manager/templates', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...updates }),
    });
    setUpdatingId(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-2xl font-bold">Public Templates</h2>
        <p className="text-sm text-gray-400 mt-1">Manage template visibility, categories, and preview URLs.</p>
      </div>

      {templates.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No templates found.</p>
      ) : (
        <div className="space-y-3">
          {templates.map((template) => (
            <div
              key={template.id}
              className="bg-gray-900/50 rounded-lg border border-gray-800 p-4 flex items-center gap-4"
            >
              <button
                onClick={() => updateTemplate(template.id, { isPublic: !template.isPublic })}
                className={`p-2 rounded-lg transition-colors ${
                  template.isPublic
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-gray-800 text-gray-500'
                }`}
                title={template.isPublic ? 'Public — click to hide' : 'Hidden — click to publish'}
              >
                {template.isPublic ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>

              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{template.name}</div>
                <div className="text-xs text-gray-500">{template.description || 'No description'}</div>
              </div>

              <select
                value={template.category || 'general'}
                onChange={(e) => updateTemplate(template.id, { category: e.target.value })}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>

              <input
                value={template.previewUrl || ''}
                onChange={(e) => updateTemplate(template.id, { previewUrl: e.target.value })}
                className="w-48 bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-white"
                placeholder="Preview URL"
              />

              {updatingId === template.id && <Loader2 className="w-4 h-4 animate-spin text-blue-400 shrink-0" />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
