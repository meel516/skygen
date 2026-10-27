'use client';
import Link from 'next/link';
import { AppShell } from '@/components/app/AppShell';
import { WorkspaceSkeleton } from '@/components/app/WorkspaceSkeleton';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function ProjectsPage() {
  const { status } = useSession();
  const router = useRouter();
  useEffect(() => { if (status === 'unauthenticated') router.push('/'); }, [router, status]);
  if (status === 'loading') return <WorkspaceSkeleton />;
  if (status === 'unauthenticated') return null;
  return <AppShell><div className="studio-page">
    <header className="studio-page-heading"><span className="studio-eyebrow">Workspace / Projects</span><h1>A home for your work.</h1><p>Project workspaces are coming soon. Your videos and reusable designs are already available in your libraries.</p></header>
    <div className="studio-directory">
      <Link href="/account/videos"><span>01</span><div><h2>Your videos</h2><p>Find your saved videos and continue editing.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/account/templates"><span>02</span><div><h2>Your templates</h2><p>Return to the formats and designs you have saved.</p></div><span aria-hidden="true">↗</span></Link>
      <Link href="/plugins"><span>03</span><div><h2>Plugin library</h2><p>Explore editable scenes and reusable motion graphics.</p></div><span aria-hidden="true">↗</span></Link>
    </div>
  </div></AppShell>;
}
