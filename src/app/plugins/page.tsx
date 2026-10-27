'use client';

import { AppShell } from '@/components/app/AppShell';
import { LibraryPreviewModal } from '@/components/app/LibraryPreviewModal';
import { PluginFieldMapModal } from '@/components/plugins/PluginFieldMapModal';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Copy, Heart, Loader2, Puzzle, Search, Sparkles, Tag, X } from 'lucide-react';

interface PluginItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  tags?: string[];
  likesCount?: number;
  color?: string;
}

const CATEGORIES = ['All', 'Maps', 'Motion', 'Stats', 'Social', '3D', 'Custom'];

function categoryMatches(plugin: PluginItem, category: string) {
  if (category === 'All') return true;
  const value = `${plugin.category ?? ''} ${(plugin.tags ?? []).join(' ')} ${plugin.name ?? ''}`.toLowerCase();
  return value.includes(category.toLowerCase());
}

export default function PluginsPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plugins, setPlugins] = useState<PluginItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const [selectedPlugin, setSelectedPlugin] = useState<PluginItem | null>(null);
  const [fieldMapPlugin, setFieldMapPlugin] = useState<PluginItem | null>(null);
  const [forking, setForking] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function loadPlugins() {
      setLoading(true);
      try {
        const res = await fetch('/api/plugins/registry');
        const data = await res.json();
        if (!cancelled) setPlugins(Array.isArray(data.plugins) ? data.plugins : []);
      } catch {
        if (!cancelled) setPlugins([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPlugins();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return plugins.filter((plugin) => {
      const text = `${plugin.name} ${plugin.description ?? ''} ${plugin.category ?? ''} ${(plugin.tags ?? []).join(' ')}`.toLowerCase();
      return (!q || text.includes(q)) && categoryMatches(plugin, category);
    });
  }, [category, plugins, query]);

  function openPluginInChat(plugin: PluginItem) {
    const prompt = `Create a video using the custom plugin "${plugin.name}" (pluginId: ${plugin.id}). Use it as the main visual style, adapt the content to my topic, and make the output polished.`;
    router.push(`/chat?pluginId=${encodeURIComponent(plugin.id)}&pluginName=${encodeURIComponent(plugin.name)}&prompt=${encodeURIComponent(prompt)}`);
  }

  async function handleForkPlugin(plugin: PluginItem) {
    setForking(true);
    setForkError(null);
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(plugin.id)}/fork`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fork plugin');
      }
      router.push(`/chat?forkPluginId=${encodeURIComponent(data.pluginId)}`);
    } catch (e: any) {
      setForkError(e.message);
    } finally {
      setForking(false);
    }
  }

  async function handleDeletePlugin(plugin: PluginItem) {
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/plugins/${encodeURIComponent(plugin.id)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete plugin');
      }
      setPlugins(plugins.filter((p) => p.id !== plugin.id));
      setSelectedPlugin(null);
    } catch (e: any) {
      setForkError(e.message);
    } finally {
      setIsDeleting(false);
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0A0A0F]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500 dark:text-[#8B8BAA]" />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <AppShell>
      <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-[#0A0A0F] px-6 py-8 md:px-10 transition-colors">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 dark:border-[#7C3AED]/30 bg-[#7C3AED]/10 dark:bg-[#7C3AED]/15 px-3 py-1 text-xs font-medium text-[#7C3AED] dark:text-[#A78BFA] backdrop-blur-sm">
                <Sparkles className="h-3.5 w-3.5" />
                Reusable motion components
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-[#F1F1F8]">Plugins</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500 dark:text-[#8B8BAA]">
                Custom and installed renderers your agent can reuse inside videos.
              </p>
            </div>

            <div className="relative w-full md:w-[360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-[#55556A]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search plugins..."
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white/70 dark:bg-[#13131C]/70 backdrop-blur-md pl-10 pr-4 text-sm text-slate-900 dark:text-[#F1F1F8] outline-none transition placeholder:text-slate-400 dark:placeholder:text-[#55556A] focus:border-[#7C3AED]/50 focus:ring-4 focus:ring-[#7C3AED]/10 shadow-sm"
              />
            </div>
          </div>

          <div className="mt-8 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {CATEGORIES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={[
                  'h-10 shrink-0 rounded-full border px-5 text-sm font-medium transition-all backdrop-blur-sm shadow-sm',
                  category === item
                    ? 'border-[#7C3AED]/30 bg-[#7C3AED]/10 text-[#7C3AED] dark:border-[#7C3AED]/40 dark:bg-[#7C3AED]/20 dark:text-[#A78BFA]'
                    : 'border-slate-200 dark:border-white/[0.07] bg-white/50 dark:bg-[#13131C]/50 text-slate-500 dark:text-[#8B8BAA] hover:border-slate-300 hover:text-slate-900 dark:hover:border-white/15 dark:hover:text-slate-900 dark:text-[#F1F1F8]',
                ].join(' ')}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="mt-16 flex items-center justify-center text-slate-500 dark:text-[#8B8BAA]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading plugins
            </div>
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {filtered.map((plugin) => {
                const accent = plugin.color || '#7C3AED';
                const tags = (plugin.tags ?? []).slice(0, 3);

                return (
                  <article
                    key={plugin.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedPlugin(plugin)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') setSelectedPlugin(plugin);
                    }}
                    className="group cursor-pointer overflow-hidden rounded-3xl border border-slate-200 dark:border-white/[0.08] bg-white/60 dark:bg-[#13131C]/80 backdrop-blur-xl shadow-lg hover:shadow-xl dark:shadow-[0_14px_40px_rgba(0,0,0,0.22)] transition-all duration-300 hover:-translate-y-1 hover:border-[#7C3AED]/30 dark:hover:border-[#7C3AED]/45 hover:bg-white dark:hover:bg-slate-50 dark:bg-[#171724]"
                  >
                    <div
                      className="relative h-44 overflow-hidden border-b border-slate-100 dark:border-white/[0.07]"
                      style={{
                        background: `radial-gradient(circle at 28% 24%, ${accent}33, transparent 40%), radial-gradient(circle at 76% 70%, #0EA5E922, transparent 40%), var(--card-bg, transparent)`,
                      }}
                    >
                      <div className="absolute inset-0 bg-slate-50/50 dark:bg-[#09090D] -z-10" />
                      <div
                        className="absolute inset-0 opacity-[0.12] dark:opacity-[0.16]"
                        style={{
                          backgroundImage:
                            'linear-gradient(rgba(128,128,128,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(128,128,128,0.2) 1px, transparent 1px)',
                          backgroundSize: '28px 28px',
                        }}
                      />
                      <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.4),transparent)] dark:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.13),transparent)] opacity-0 transition duration-500 group-hover:translate-x-full group-hover:opacity-100" />
                      <div className="absolute left-4 top-4 flex gap-2">
                        {plugin.category && (
                          <span className="rounded-full border border-black/5 dark:border-white/[0.12] bg-white/50 dark:bg-black/30 px-2.5 py-1 text-xs font-bold capitalize text-slate-700 dark:text-[#F1F1F8] backdrop-blur-md shadow-sm">
                            {plugin.category}
                          </span>
                        )}
                        {plugin.status && (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-400/10 px-2.5 py-1 text-xs font-bold capitalize text-emerald-600 dark:text-emerald-300 backdrop-blur-md shadow-sm">
                            {plugin.status}
                          </span>
                        )}
                      </div>
                      <div className="absolute right-4 top-4 flex items-center gap-2">
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/5 dark:border-white/[0.12] bg-white/50 dark:bg-black/30 px-2.5 text-xs font-bold text-slate-700 dark:text-[#F1F1F8] backdrop-blur-md shadow-sm">
                          <Heart className="h-3.5 w-3.5 text-rose-500" />
                          {plugin.likesCount ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard?.writeText(plugin.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 dark:border-white/[0.12] bg-white/50 dark:bg-black/30 text-slate-500 dark:text-[#D8D8EA] backdrop-blur-md shadow-sm transition hover:bg-white/80 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-slate-900 dark:text-white"
                          aria-label={`Copy ${plugin.name} plugin id`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4">
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-2xl text-slate-900 dark:text-white shadow-xl dark:shadow-2xl ring-1 ring-white/40 dark:ring-white/20 transition duration-300 group-hover:scale-105 group-hover:shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                          style={{ background: `linear-gradient(135deg, ${accent}, #0EA5E9)` }}
                        >
                          <Puzzle className="h-7 w-7 drop-shadow-md" />
                        </div>
                        <div className="mb-1 rounded-full border border-black/5 dark:border-white/[0.10] bg-white/50 dark:bg-white/[0.08] px-3 py-1 text-xs font-bold text-slate-700 dark:text-white/80 backdrop-blur-md shadow-sm">
                          Open preview
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="line-clamp-1 text-lg font-bold tracking-tight text-slate-800 dark:text-[#F1F1F8] transition group-hover:text-slate-900 dark:group-hover:text-slate-900 dark:text-white">
                            {plugin.name}
                          </h2>
                          <p className="mt-1 truncate text-xs font-medium text-slate-400 dark:text-[#55556A]">{plugin.id}</p>
                        </div>
                        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#7C3AED] dark:text-[#A78BFA] opacity-60 transition group-hover:opacity-100" />
                      </div>

                      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 font-medium text-slate-500 dark:text-[#9A9AB5]">
                        {plugin.description || 'Reusable Skygen plugin.'}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {tags.length > 0 ? (
                          tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 dark:bg-[#25253A] px-2.5 py-1 text-xs font-medium text-slate-500 dark:text-[#A8A8C2] ring-1 ring-slate-200 dark:ring-white/[0.05]">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-slate-100 dark:bg-[#25253A] px-2.5 py-1 text-xs font-medium text-slate-400 dark:text-[#77778F] ring-1 ring-slate-200 dark:ring-white/[0.05]">
                            custom
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div className="mt-16 rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.1] bg-white/40 dark:bg-[#13131C] backdrop-blur-sm p-10 text-center font-medium text-slate-500 dark:text-[#8B8BAA]">
              No plugins matched this search.
            </div>
          )}
        </div>
      </div>

      <LibraryPreviewModal
        open={Boolean(selectedPlugin)}
        title={selectedPlugin?.name ?? ''}
        subtitle={selectedPlugin?.id}
        description={selectedPlugin?.description}
        kind="Plugin"
        accent={selectedPlugin?.color || '#7C3AED'}
        previewUrl={selectedPlugin ? `/preview/plugin/${encodeURIComponent(selectedPlugin.id)}?embed=1` : undefined}
        tags={selectedPlugin?.tags ?? []}
        meta={[selectedPlugin?.category, selectedPlugin?.status].filter(Boolean) as string[]}
        onClose={() => {
          setSelectedPlugin(null);
          setForkError(null);
        }}
        onUseInChat={() => selectedPlugin && openPluginInChat(selectedPlugin)}
        onRemixSource={
          forking 
            ? undefined // Disabled while forking
            : () => selectedPlugin && handleForkPlugin(selectedPlugin)
        }
        onCopyId={() => {
          if (selectedPlugin) void navigator.clipboard?.writeText(selectedPlugin.id);
        }}
        onEditFieldMap={() => {
          if (selectedPlugin) setFieldMapPlugin(selectedPlugin);
        }}
        onDelete={
          selectedPlugin?.category !== 'Core'
            ? () => {
                if (selectedPlugin) void handleDeletePlugin(selectedPlugin);
              }
            : undefined
        }
      />

      <PluginFieldMapModal
        open={Boolean(fieldMapPlugin)}
        pluginId={fieldMapPlugin?.id ?? ''}
        pluginName={fieldMapPlugin?.name}
        onClose={() => setFieldMapPlugin(null)}
      />

      {/* Toast for error */}
      {forkError && (
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 backdrop-blur-md">
          <p className="font-semibold text-red-100">Fork Failed</p>
          <p className="mt-1">{forkError}</p>
          <button onClick={() => setForkError(null)} className="absolute right-2 top-2 text-red-300 hover:text-red-100">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </AppShell>
  );
}
