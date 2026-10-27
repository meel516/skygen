'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useSiteConfig } from '@/lib/use-site-config';
import { useState } from 'react';

const NAV_ITEMS = [
  { href: '/', label: 'Create', match: ['/', '/chat'] },
  { href: '/editor', label: 'Editor', match: ['/editor'] },
  { href: '/projects', label: 'Projects', match: ['/projects'] },
  { href: '/templates', label: 'Templates', match: ['/templates'] },
  { href: '/plugins', label: 'Plugins', match: ['/plugins'] },
  { href: '/blocks', label: 'Blocks', match: ['/blocks'] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data: session } = useSession();
  const { resolvedTheme, setTheme } = useTheme();
  const { config } = useSiteConfig();
  const [menuOpen, setMenuOpen] = useState(false);
  const appName = config.branding?.appName || 'SKYGEN';
  return (
    <div className="studio-shell">
      <a href="#workspace" className="studio-skip">Skip to workspace</a>
      <aside className="studio-nav">
        <Link href="/" className="studio-wordmark" aria-label={`${appName} home`}><span className="studio-mark" aria-hidden="true">S</span>{appName}</Link>
        <button type="button" className="studio-menu-toggle" aria-expanded={menuOpen} aria-controls="studio-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? 'Close menu' : 'Menu'}</button>
        <div id="studio-navigation" className="studio-nav-body" data-open={menuOpen}>
          <span className="studio-eyebrow studio-nav-caption">Workspace</span>
          <nav aria-label="Main navigation">
            {NAV_ITEMS.map(({ href, label, match }, index) => {
              const active = match.some(item => pathname === item || (item !== '/' && pathname.startsWith(`${item}/`)));
              return <Link key={href} href={href} aria-current={active ? 'page' : undefined} onClick={() => setMenuOpen(false)}><span>{label}</span><span className="studio-nav-number" aria-hidden="true">0{index + 1}</span></Link>;
            })}
          </nav>
          <div className="studio-nav-bottom">
            <div className="studio-account-name">{session?.user?.name || 'Your workspace'}</div>
            <Link href="/account" onClick={() => setMenuOpen(false)}>Account settings</Link>
            <button type="button" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>Switch appearance</button>
            <button type="button" onClick={() => void signOut({ callbackUrl: '/' })}>Sign out</button>
            <div className="studio-legal"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link></div>
          </div>
        </div>
      </aside>
      <main id="workspace" className="studio-workspace">{children}</main>
    </div>
  );
}
