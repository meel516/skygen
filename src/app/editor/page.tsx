'use client';
import { WorkspaceSkeleton } from '@/components/app/WorkspaceSkeleton';

import { VideoEditor } from '@/components/editor';
import { AppShell } from '@/components/app/AppShell';
import { useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Video } from '@/components/ui/studio-icons';

export default function EditorPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/');
    }
  }, [router, status]);

  if (status === 'loading') return <WorkspaceSkeleton />;

  if (status === 'unauthenticated') return null;

  return (
    <AppShell>
      <VideoEditor />
    </AppShell>
  );
}
