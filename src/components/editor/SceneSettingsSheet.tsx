'use client';

import { Settings2 } from '@/components/ui/studio-icons';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { VideoMetaEditor } from './VideoMetaEditor';

interface SceneSettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SceneSettingsSheet({ open, onOpenChange }: SceneSettingsSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[320px] p-0 flex flex-col border-l"
        style={{ background: 'var(--card)', borderColor: 'var(--border)' }}
      >
        <SheetHeader
          className="px-4 py-3 flex-shrink-0 border-b"
          style={{ borderColor: 'var(--border)' }}
        >
          <SheetTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: 'var(--foreground)' }}>
            <div className="w-5 h-5 rounded bg-muted flex items-center justify-center">
              <Settings2 className="w-3 h-3 text-foreground dark:text-white" />
            </div>
            Scene Settings
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 min-h-0">
          <VideoMetaEditor />
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
