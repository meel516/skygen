'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { isContentManager as isContentManagerRole } from '@/lib/roles';
import { AppShell } from '@/components/app/AppShell';

const NAV = [
  { href: '/account', label: 'Overview' },
  { href: '/account/usage', label: 'Usage & billing' },
  { href: '/account/videos', label: 'Videos' },
  { href: '/account/templates', label: 'Templates' },
  { href: '/account/integrations', label: 'Integrations' },
  { href: '/account/api-keys', label: 'API keys' },
];
export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const pathname = usePathname();
  return <AppShell><div className="studio-account">
    <header><span className="studio-eyebrow">Your workspace</span><h1>Account</h1>
      <nav aria-label="Account navigation">{NAV.map(({ href, label }) => <Link key={href} href={href} aria-current={pathname === href ? 'page' : undefined}>{label}</Link>)}
        {isContentManagerRole(session?.user?.role) && <Link href="/content-manager/branding">Content manager</Link>}
        {session?.user?.role === 'ADMIN' && <Link href="/admin/users">Administration</Link>}
      </nav>
    </header><div className="studio-account-content">{children}</div>
  </div></AppShell>;
}
