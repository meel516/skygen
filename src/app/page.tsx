'use client';

import { ChatWizard } from '@/components/chat/ChatWizard';
import { AppShell } from '@/components/app/AppShell';
import { LandingPage } from '@/components/app/LandingPage';
import { WorkspaceSkeleton } from '@/components/app/WorkspaceSkeleton';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';

export default function HomePage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user?.id) {
      const hasSynced = localStorage.getItem('userSynced');
      if (hasSynced) return;

      fetch('/api/user/sync', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          localStorage.setItem('userData', JSON.stringify(data));
          localStorage.setItem('userSynced', 'true');
        })
        .catch(err => console.error('[Auth] Sync error:', err));
    }
  }, [session]);

  if (status === 'loading') return <WorkspaceSkeleton />;

  // Unauthenticated — show landing page
  if (status === 'unauthenticated') {
    return <LandingPage />;
  }

  // Authenticated — show chat wizard as homepage
  return (
    <AppShell>
      <ChatWizard />
    </AppShell>
  );
}
