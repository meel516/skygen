'use client';

import { VideoEditor } from '@/components/editor';
import { AppShell } from '@/components/app/AppShell';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Video } from 'lucide-react';

export default function EditorPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-50 dark:bg-[#0A0A0F]">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}
          >
            <Video className="w-4 h-4 text-slate-900 dark:text-white" />
          </div>
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#7C3AED' }}
          />
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') return null;

  return (
    <AppShell>
      <VideoEditor />
    </AppShell>
  );
}
