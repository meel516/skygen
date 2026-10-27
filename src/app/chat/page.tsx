'use client';
import { WorkspaceSkeleton } from '@/components/app/WorkspaceSkeleton';

import { AppShell } from '@/components/app/AppShell';
import { ChatWizard } from '@/components/chat/ChatWizard';
import { useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function ChatPage() {
  return <Suspense fallback={<WorkspaceSkeleton />}><ChatPageContent /></Suspense>;
}

function ChatPageContent() {
  const { status } = useSession();
  const router = useRouter();
  const isEmbed = useSearchParams().get('embed') === '1';

  useEffect(() => {
    if (status === 'unauthenticated' && !isEmbed) {
      router.push('/');
    }
  }, [router, status, isEmbed]);

  if (isEmbed) return <ChatWizard />;

  if (status === 'loading') return <WorkspaceSkeleton />;

  if (status === 'unauthenticated' && !isEmbed) return null;

  return (
    <AppShell>
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading chat...</div>}>
        <ChatWizard />
      </Suspense>
    </AppShell>
  );
}
