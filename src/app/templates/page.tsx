'use client';
import { WorkspaceSkeleton } from '@/components/app/WorkspaceSkeleton';

import { TemplateGallery } from '@/components/editor/TemplateGallery';
import { AppShell } from '@/components/app/AppShell';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function TemplatesPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') return <WorkspaceSkeleton />;

  if (status === 'unauthenticated') {
    return null;
  }

  return (
    <AppShell>
      <TemplateGallery />
    </AppShell>
  );
}
