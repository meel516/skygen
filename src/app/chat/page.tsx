'use client';

import { AppShell } from '@/components/app/AppShell';
import { ChatWizard } from '@/components/chat/ChatWizard';
import { useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';

export default function ChatPage() {
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
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C3AED] to-[#0EA5E9]">
            <Video className="h-4 w-4 text-slate-900 dark:text-white" />
          </div>
          <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#7C3AED]" />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <AppShell>
      <Suspense fallback={<div className="h-screen w-full flex items-center justify-center">Loading chat...</div>}>
        <ChatWizard />
      </Suspense>
    </AppShell>
  );
}
