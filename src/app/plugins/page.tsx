'use client';
import { LibrarySkeleton } from '@/components/app/LibrarySkeleton';
import { WorkspaceSkeleton } from '@/components/app/WorkspaceSkeleton';

import { AppShell } from '@/components/app/AppShell';
import { LibraryPreviewModal } from '@/components/app/LibraryPreviewModal';
import { PluginFieldMapModal } from '@/components/plugins/PluginFieldMapModal';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Copy, Heart, Loader2, Puzzle, Search, Sparkles, Tag, X } from '@/components/ui/studio-icons';

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

  if (status === 'loading') return <WorkspaceSkeleton />;

  if (status === 'unauthenticated') return null;

  return (
    <AppShell>
      <div className="h-screen overflow-y-auto bg-background dark:bg-[var(--background)] px-6 py-8 md:px-10 ">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/20 dark:border-[var(--primary)]/30 bg-[var(--primary)]/10 dark:bg-[var(--primary)]/15 px-3 py-1 text-xs font-medium text-[var(--primary)] dark:text-[var(--primary)] ">
                <Sparkles className="h-3.5 w-3.5" />
                Reusable motion components
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-foreground dark:text-[var(--foreground)]">Plugins</h1>
              <p className="mt-2 max-w-2xl text-sm font-medium text-muted-foreground dark:text-[var(--muted-foreground)]">
                Custom and installed renderers your agent can reuse inside videos.
              </p>
            </div>

            <div className="relative w-full md:w-[360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground dark:text-[var(--muted-foreground)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search plugins" placeholder="Search plugins..."
                className="h-11 w-full rounded-sm border border-border dark:border-white/[0.07] bg-white/70 dark:bg-[var(--card)]/70  pl-10 pr-4 text-sm text-foreground dark:text-[var(--foreground)] outline-none  placeholder:text-muted-foreground dark:placeholder:text-[var(--muted-foreground)] focus:border-[var(--primary)]/50 focus:ring-4 focus:ring-[var(--primary)]/10 shadow-none"
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
                  'h-10 shrink-0 rounded-full border px-5 text-sm font-medium   shadow-none',
                  category === item
                    ? 'border-[var(--primary)]/30 bg-[var(--primary)]/10 text-[var(--primary)] dark:border-[var(--primary)]/40 dark:bg-[var(--primary)]/20 dark:text-[var(--primary)]'
                    : 'border-border dark:border-white/[0.07] bg-white/50 dark:bg-[var(--card)]/50 text-muted-foreground dark:text-[var(--muted-foreground)] hover:border-border hover:text-foreground dark:hover:border-white/15 dark:hover:text-foreground dark:text-[var(--foreground)]',
                ].join(' ')}
              >
                {item}
              </button>
            ))}
          </div>

          {loading ? (
            <LibrarySkeleton label="Loading plugins" />
          ) : (
            <div className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-2">
              {filtered.map((plugin) => {

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
                    className="group cursor-pointer overflow-hidden rounded-sm border border-border dark:border-white/[0.08] bg-white/60 dark:bg-[var(--card)]/80  shadow-none hover:shadow-none dark:shadow-none    hover:border-[var(--primary)]/30 dark:hover:border-[var(--primary)]/45 hover:bg-card dark:hover:bg-background dark:bg-[#171724]"
                  >
                    <div
                      className="relative h-44 overflow-hidden border-b border-border dark:border-white/[0.07]"
                      style={{
                        background: 'var(--studio-accent-wash)',
                      }}
                    >
                      <div className="absolute inset-0 bg-background/50 dark:bg-[#09090D] -z-10" />
                      <div
                        className="absolute inset-0 opacity-[0.12] dark:opacity-[0.16]"
                        style={{
                          backgroundImage:
                            'none',
                          backgroundSize: '28px 28px',
                        }}
                      />

                      <div className="absolute left-4 top-4 flex gap-2">
                        {plugin.category && (
                          <span className="rounded-full border border-black/5 dark:border-white/[0.12] bg-white/50 dark:bg-black/30 px-2.5 py-1 text-xs font-bold capitalize text-foreground dark:text-[var(--foreground)]  shadow-none">
                            {plugin.category}
                          </span>
                        )}
                        {plugin.status && (
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-50 dark:bg-emerald-400/10 px-2.5 py-1 text-xs font-bold capitalize text-emerald-600 dark:text-emerald-300  shadow-none">
                            {plugin.status}
                          </span>
                        )}
                      </div>
                      <div className="absolute right-4 top-4 flex items-center gap-2">
                        <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-black/5 dark:border-white/[0.12] bg-white/50 dark:bg-black/30 px-2.5 text-xs font-bold text-foreground dark:text-[var(--foreground)]  shadow-none">
                          <Heart className="h-3.5 w-3.5 text-rose-500" />
                          {plugin.likesCount ?? 0}
                        </span>
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void navigator.clipboard?.writeText(plugin.id);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-full border border-black/5 dark:border-white/[0.12] bg-white/50 dark:bg-black/30 text-muted-foreground dark:text-[#D8D8EA]  shadow-none  hover:bg-white/80 dark:hover:bg-white/10 hover:text-foreground dark:hover:text-foreground dark:text-white"
                          aria-label={`Copy ${plugin.name} plugin id`}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-4">
                        <div
                          className="flex h-16 w-16 items-center justify-center rounded-sm text-foreground dark:text-white shadow-none dark:shadow-none ring-1 ring-white/40 dark:ring-white/20    group-hover:shadow-none srgb, var(--primary) 30%, transparent)]"
                          style={{ background: 'var(--studio-accent-wash)' }}
                        >
                          <Puzzle className="h-7 w-7 drop-shadow-none" />
                        </div>
                        <div className="mb-1 rounded-full border border-black/5 dark:border-white/[0.10] bg-white/50 dark:bg-white/[0.08] px-3 py-1 text-xs font-bold text-foreground dark:text-white/80  shadow-none">
                          Open preview
                        </div>
                      </div>
                    </div>

                    <div className="p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="line-clamp-1 text-lg font-bold tracking-tight text-foreground dark:text-[var(--foreground)]  group-hover:text-foreground dark:group-hover:text-foreground dark:text-white">
                            {plugin.name}
                          </h2>
                          <p className="mt-1 truncate text-xs font-medium text-muted-foreground dark:text-[var(--muted-foreground)]">{plugin.id}</p>
                        </div>
                        <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[var(--primary)] dark:text-[var(--primary)] opacity-60  group-hover:opacity-100" />
                      </div>

                      <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 font-medium text-muted-foreground dark:text-[#9A9AB5]">
                        {plugin.description || 'Reusable Skygen plugin.'}
                      </p>

                      <div className="mt-5 flex flex-wrap gap-2">
                        {tags.length > 0 ? (
                          tags.map((tag) => (
                            <span key={tag} className="inline-flex items-center gap-1.5 rounded-full bg-muted dark:bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-muted-foreground dark:text-[#A8A8C2] ring-1 ring-slate-200 dark:ring-white/[0.05]">
                              <Tag className="h-3 w-3" />
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span className="rounded-full bg-muted dark:bg-[var(--accent)] px-2.5 py-1 text-xs font-medium text-muted-foreground dark:text-[#77778F] ring-1 ring-slate-200 dark:ring-white/[0.05]">
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
            <div className="mt-16 rounded-sm border border-dashed border-border dark:border-white/[0.1] bg-white/40 dark:bg-[var(--card)]  p-10 text-center font-medium text-muted-foreground dark:text-[var(--muted-foreground)]">
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
        accent={'var(--primary)'}
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
        <div className="fixed bottom-6 right-6 z-[200] max-w-sm rounded-sm border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-200 ">
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
