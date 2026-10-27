'use client';

import Link from 'next/link';
import { BarChart3, Video, LayoutGrid, ArrowLeft, Plug, ShieldCheck, Palette, Key } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { isContentManager as isContentManagerRole } from '@/lib/roles';

const NAV = [
  { href: '/account/usage', label: 'Usage & Billing', icon: BarChart3 },
  { href: '/account/videos', label: 'My Videos', icon: Video },
  { href: '/account/templates', label: 'My Templates', icon: LayoutGrid },
  { href: '/account/integrations', label: 'Integrations', icon: Plug },
  { href: '/account/api-keys',     label: 'API Keys',     icon: Key  },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === 'ADMIN';
  const isContentMgr = isContentManagerRole(session?.user?.role);
  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0A0A0F] text-slate-900 dark:text-[#F1F1F8] transition-colors">
      {/* Sidebar */}
      <aside
        className="w-56 flex-shrink-0 flex flex-col border-r border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#13131C]"
      >
        {/* Logo area */}
        <div className="px-4 py-5 border-b border-slate-200 dark:border-white/[0.07]">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#7C3AED] to-[#0EA5E9]"
            >
              <Video className="w-3.5 h-3.5 text-slate-900 dark:text-white" />
            </div>
            <span className="text-[13px] font-bold text-slate-900 dark:text-[#F1F1F8]">SKYGEN</span>
          </div>
          <p className="text-[11px] mt-1 font-medium text-slate-500 dark:text-[#55556A]">Account Settings</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-slate-600 dark:text-[#8B8BAA] hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-900 dark:text-white transition-colors"
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        {/* Back to editor + Admin */}
        <div className="px-2 py-3 border-t border-slate-200 dark:border-white/[0.07] space-y-0.5">
          {isContentMgr && (
            <Link
              href="/content-manager/branding"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-sky-600 dark:text-[#38BDF8] hover:bg-sky-50 dark:hover:bg-[#38BDF8]/10 transition-colors"
            >
              <Palette className="w-3.5 h-3.5" />
              Content Manager
            </Link>
          )}
          {isAdmin && (
            <Link
              href="/admin/users"
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-purple-600 dark:text-[#A78BFA] hover:bg-purple-50 dark:hover:bg-[#A78BFA]/10 transition-colors"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Admin Panel
            </Link>
          )}
          <Link
            href="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-[12px] font-medium text-slate-500 dark:text-[#55556A] hover:bg-slate-100 dark:hover:bg-slate-100 dark:bg-white/[0.05] hover:text-slate-900 dark:hover:text-slate-900 dark:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Editor
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}
