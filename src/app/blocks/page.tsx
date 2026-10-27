'use client';

import { AppShell } from '@/components/app/AppShell';
import { LibraryPreviewModal } from '@/components/app/LibraryPreviewModal';
import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Blocks, Code2, Loader2, Search, Sparkles } from 'lucide-react';

interface ContentBlock {
  type: string;
  description: string;
  keyFields?: string[];
  useWhen?: string;
}

export default function BlocksPage() {
  const { status } = useSession();
  const router = useRouter();
  const [blocks, setBlocks] = useState<ContentBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [selectedBlock, setSelectedBlock] = useState<ContentBlock | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;

    async function loadBlocks() {
      setLoading(true);
      try {
        const res = await fetch('/api/plugins/content-blocks');
        const data = await res.json();
        if (!cancelled) setBlocks(Array.isArray(data.blocks) ? data.blocks : []);
      } catch {
        if (!cancelled) setBlocks([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadBlocks();
    return () => {
      cancelled = true;
    };
  }, [status]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return blocks;
    return blocks.filter((block) => {
      const text = `${block.type} ${block.description} ${block.useWhen ?? ''} ${(block.keyFields ?? []).join(' ')}`.toLowerCase();
      return text.includes(q);
    });
  }, [blocks, query]);

  function openBlockInChat(block: ContentBlock) {
    const prompt = `Create a video using the "${block.type}" block (blockType: ${block.type}). Use this block intentionally as a key scene and adapt the content to my topic.`;
    router.push(`/chat?blockType=${encodeURIComponent(block.type)}&blockName=${encodeURIComponent(block.type)}&prompt=${encodeURIComponent(prompt)}`);
  }

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-[#0A0A0F]">
        <Loader2 className="h-5 w-5 animate-spin text-slate-600 dark:text-[#8B8BAA]" />
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <AppShell>
      <div className="h-screen overflow-y-auto bg-slate-50 dark:bg-[#0A0A0F] px-6 py-8 md:px-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#0EA5E9]/30 bg-[#0EA5E9]/15 px-3 py-1 text-xs font-medium text-[#67E8F9]">
                <Sparkles className="h-3.5 w-3.5" />
                Built-in scene primitives
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-[#F1F1F8]">Blocks</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-[#8B8BAA]">
                Core video blocks the agent can assemble before reaching for custom plugins.
              </p>
            </div>

            <div className="relative w-full md:w-[360px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 dark:text-[#55556A]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search blocks..."
                className="h-11 w-full rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#13131C] pl-10 pr-4 text-sm text-slate-900 dark:text-[#F1F1F8] outline-none transition placeholder:text-slate-500 dark:text-[#55556A] focus:border-[#0EA5E9]/50 focus:ring-4 focus:ring-[#0EA5E9]/10"
              />
            </div>
          </div>

          {loading ? (
            <div className="mt-16 flex items-center justify-center text-slate-600 dark:text-[#8B8BAA]">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Loading blocks
            </div>
          ) : (
            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((block) => (
                <article
                  key={block.type}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedBlock(block)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedBlock(block);
                  }}
                  className="cursor-pointer rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#13131C] p-4 shadow-sm transition hover:border-[#0EA5E9]/40 hover:bg-slate-50 dark:bg-[#171724]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#A78BFA] ring-1 ring-[#7C3AED]/30">
                      <Blocks className="h-5 w-5" />
                    </div>
                    <div>
                      <h2 className="font-semibold text-slate-900 dark:text-[#F1F1F8]">{block.type}</h2>
                      <p className="text-xs text-slate-500 dark:text-[#55556A]">Content block</p>
                    </div>
                  </div>
                  <p className="mt-4 min-h-10 text-sm leading-5 text-slate-600 dark:text-[#8B8BAA]">{block.description}</p>
                  <div className="mt-4 rounded-xl bg-slate-50 dark:bg-[#0A0A0F] p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-[#8B8BAA]">
                      <Code2 className="h-3.5 w-3.5" />
                      Key fields
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(block.keyFields ?? []).slice(0, 4).map((field) => (
                        <span key={field} className="rounded-md bg-slate-100 dark:bg-[#1E1E2D] px-2 py-1 text-xs text-slate-600 dark:text-[#8B8BAA] ring-1 ring-black/5 dark:ring-white/[0.06]">
                          {field}
                        </span>
                      ))}
                    </div>
                  </div>
                  {block.useWhen && (
                    <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-[#55556A]">
                      Use when: {block.useWhen}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <LibraryPreviewModal
        open={Boolean(selectedBlock)}
        title={selectedBlock?.type ?? ''}
        subtitle="Content block"
        description={selectedBlock?.description}
        kind="Block"
        accent="#0EA5E9"
        tags={(selectedBlock?.keyFields ?? []).slice(0, 5)}
        meta={selectedBlock?.useWhen ? [selectedBlock.useWhen] : []}
        onClose={() => setSelectedBlock(null)}
        onUseInChat={() => selectedBlock && openBlockInChat(selectedBlock)}
        onCopyId={() => {
          if (selectedBlock) void navigator.clipboard?.writeText(selectedBlock.type);
        }}
      />
    </AppShell>
  );
}
