'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Blocks,
  FolderKanban,
  LayoutTemplate,
  LogOut,
  MessageSquare,
  Puzzle,
  Settings,
  Video,
  Moon,
  Sun,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useSiteConfig } from '@/lib/use-site-config';
import { useTheme } from 'next-themes';

const NAV_ITEMS = [
  { href: '/', label: 'Chat', icon: MessageSquare, match: ['/', '/chat'] },
  { href: '/editor', label: 'Editor', icon: Video, match: ['/editor'] },
  { href: '/templates', label: 'Templates', icon: LayoutTemplate, match: ['/templates'] },
  { href: '/plugins', label: 'Plugins', icon: Puzzle, match: ['/plugins'] },
  { href: '/blocks', label: 'Blocks', icon: Blocks, match: ['/blocks'] },
  { href: '/projects', label: 'Projects', icon: FolderKanban, match: ['/projects'] },
];

function isActive(pathname: string, match: string[]) {
  return match.some((item) => pathname === item || (item !== '/' && pathname.startsWith(`${item}/`)));
}

function BrandMark() {
  const { config } = useSiteConfig();
  const branding = config.branding || {};
  const appName = branding.appName || 'SKYGEN';
  const logoUrl = branding.logoUrl;

  return (
    <Link
      href="/"
      className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#13131C] shadow-sm transition-colors"
      aria-label={`${appName} home`}
    >
      {logoUrl ? (
        <img src={logoUrl} alt={appName} className="h-9 w-9 object-contain scale-[2.5]" />
      ) : (
        <img src="/logo.png" alt={appName} className="h-9 w-9 object-contain scale-[2.5]" />
      )}
    </Link>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 dark:text-[#55556A] transition-colors hover:bg-slate-200 dark:hover:bg-[#25253A] hover:text-slate-900 dark:hover:text-[#F1F1F8]"
      aria-label="Toggle theme"
    >
      <Sun className="h-5 w-5 dark:hidden" />
      <Moon className="hidden h-5 w-5 dark:block" />
    </button>
  );
}

function DesktopSidebar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const initial = session?.user?.name?.charAt(0) || session?.user?.email?.charAt(0) || 'S';

  return (
    <aside className="sticky top-0 hidden h-screen w-[76px] shrink-0 border-r border-slate-200 dark:border-white/[0.07] bg-slate-50 dark:bg-[#0A0A0F] p-2 md:flex md:flex-col transition-colors">
      <div className="flex justify-center pt-2">
        <BrandMark />
      </div>

      <TooltipProvider delayDuration={120}>
        <nav className="mt-8 flex flex-1 flex-col items-center gap-2">
          {NAV_ITEMS.map(({ href, label, icon: Icon, match }) => {
            const active = isActive(pathname, match);
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    aria-label={label}
                    className={cn(
                      'flex h-11 w-11 items-center justify-center rounded-xl transition-colors',
                      active
                        ? 'bg-[#7C3AED]/10 dark:bg-[#7C3AED]/20 text-[#7C3AED] dark:text-[#A78BFA] ring-1 ring-[#7C3AED]/30 dark:ring-[#7C3AED]/40'
                        : 'text-slate-500 dark:text-[#55556A] hover:bg-slate-200 dark:hover:bg-[#25253A] hover:text-slate-900 dark:hover:text-[#F1F1F8]',
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={10} className="border border-slate-200 dark:border-white/[0.07] bg-white dark:bg-[#1E1E2D] text-slate-900 dark:text-[#F1F1F8] shadow-md">
                  {label}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </nav>
      </TooltipProvider>

      <div className="flex flex-col items-center gap-2 pb-2">
        <ThemeToggle />
        <Link
          href="/account"
          aria-label="Account settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 dark:text-[#55556A] transition-colors hover:bg-slate-200 dark:hover:bg-[#25253A] hover:text-slate-900 dark:hover:text-[#F1F1F8]"
        >
          <Settings className="h-5 w-5" />
        </Link>
        <button
          type="button"
          aria-label="Sign out"
          onClick={() => void signOut({ callbackUrl: '/' })}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-slate-500 dark:text-[#55556A] transition-colors hover:bg-slate-200 dark:hover:bg-[#25253A] hover:text-slate-900 dark:hover:text-[#F1F1F8]"
        >
          <LogOut className="h-5 w-5" />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#0EA5E9] text-sm font-semibold text-white">
          {initial.toUpperCase()}
        </div>
      </div>
    </aside>
  );
}

function MobileNav() {
  const pathname = usePathname();
  const mobileItems = NAV_ITEMS.slice(0, 5);

  return (
    <nav className="fixed inset-x-3 bottom-3 z-50 flex items-center justify-between rounded-2xl border border-slate-200 dark:border-white/[0.07] bg-white/90 dark:bg-[#13131C]/95 px-2 py-2 shadow-lg backdrop-blur-md md:hidden">
      {mobileItems.map(({ href, label, icon: Icon, match }) => {
        const active = isActive(pathname, match);
        return (
          <Link
            key={href}
            href={href}
            aria-label={label}
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
              active ? 'bg-[#7C3AED]/15 dark:bg-[#7C3AED]/25 text-[#7C3AED] dark:text-[#A78BFA]' : 'text-slate-500 dark:text-[#8B8BAA] hover:bg-slate-100 dark:hover:bg-[#25253A]',
            )}
          >
            <Icon className="h-5 w-5" />
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-[#0A0A0F] text-slate-900 dark:text-[#F1F1F8] transition-colors">
      <DesktopSidebar />
      <main className="min-w-0 flex-1">
        {children}
      </main>
      <MobileNav />
    </div>
  );
}
