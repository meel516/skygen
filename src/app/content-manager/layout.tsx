'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Palette, Layout, Grid3X3, FileText, LogOut, Image, Music } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

function isContentManagerRole(role?: string) {
  return role === 'ADMIN' || role === 'CONTENT_MANAGER';
}

export default function ContentManagerLayout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    } else if (status === 'authenticated' && !isContentManagerRole(session?.user?.role)) {
      router.push('/');
    }
  }, [status, session, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white">Loading...</div>
      </div>
    );
  }

  if (!isContentManagerRole(session?.user?.role)) {
    return null;
  }

  const navItems = [
    { href: '/content-manager/branding', label: 'Branding', icon: Palette },
    { href: '/content-manager/landing', label: 'Landing Page', icon: Layout },
    { href: '/content-manager/blocks', label: 'Block Thumbnails', icon: Grid3X3 },
    { href: '/content-manager/style-previews', label: 'Style & Arc Previews', icon: Image },
    { href: '/content-manager/templates', label: 'Templates', icon: FileText },
    { href: '/content-manager/music', label: 'Music Library', icon: Music },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <header className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Content Manager
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-400">{session?.user?.email}</span>
            <button
              onClick={() => window.location.href = '/api/auth/logout'}
              className="flex items-center gap-2 text-gray-400 hover:text-white"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="w-64 min-h-[calc(100vh-73px)] border-r border-gray-800 p-4">
          <nav className="space-y-2">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                    isActive
                      ? 'text-white bg-gray-800'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </aside>

        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
