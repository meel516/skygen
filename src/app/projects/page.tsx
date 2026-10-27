'use client';

import { AppShell } from '@/components/app/AppShell';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { FolderKanban, LayoutTemplate, Loader2, Plus, Puzzle, Users } from 'lucide-react';

const PROJECTS = [
  {
    name: 'Sports content lab',
    description: 'Reusable cricket templates, map plugins, stat blocks, and player profile videos.',
    meta: 'Concept workspace',
  },
  {
    name: 'Product launch kit',
    description: 'Launch templates, logo stings, pricing blocks, and explainer scenes for SaaS videos.',
    meta: 'Concept workspace',
  },
];

export default function ProjectsPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

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
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                <Users className="h-3.5 w-3.5" />
                Coming next
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-slate-900 dark:text-[#F1F1F8]">Projects</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-[#8B8BAA]">
                Workspaces for videos, project templates, reusable plugins, generated assets, and collaborators.
              </p>
            </div>

            <button
              type="button"
              disabled
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-4 text-sm font-medium text-slate-900 dark:text-white opacity-50"
            >
              <Plus className="h-4 w-4" />
              New project
            </button>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {PROJECTS.map((project) => (
              <article key={project.name} className="rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#13131C] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#7C3AED]/20 text-[#A78BFA] ring-1 ring-[#7C3AED]/30">
                    <FolderKanban className="h-5 w-5" />
                  </div>
                  <span className="rounded-full bg-slate-100 dark:bg-[#25253A] px-3 py-1 text-xs text-slate-600 dark:text-[#8B8BAA]">{project.meta}</span>
                </div>
                <h2 className="mt-5 text-xl font-semibold text-slate-900 dark:text-[#F1F1F8]">{project.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-[#8B8BAA]">{project.description}</p>
                <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs text-slate-600 dark:text-[#8B8BAA]">
                  <div className="rounded-xl bg-slate-50 dark:bg-[#0A0A0F] p-3">
                    <LayoutTemplate className="mx-auto mb-1 h-4 w-4" />
                    Templates
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#0A0A0F] p-3">
                    <Puzzle className="mx-auto mb-1 h-4 w-4" />
                    Plugins
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-[#0A0A0F] p-3">
                    <Users className="mx-auto mb-1 h-4 w-4" />
                    Team
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-8 rounded-2xl border border-dashed border-slate-200 dark:border-white/[0.1] bg-white dark:bg-[#13131C] p-6 text-sm leading-6 text-slate-600 dark:text-[#8B8BAA]">
            This page is intentionally UI-first for now. The next step is a real projects table with membership,
            project-owned templates, project plugins, and shared generated assets.
          </div>
        </div>
      </div>
    </AppShell>
  );
}
