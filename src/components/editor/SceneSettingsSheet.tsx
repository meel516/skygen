'use client';

import { Settings2 } from 'lucide-react';
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
        style={{ background: '#13131C', borderColor: 'rgba(255,255,255,0.07)' }}
      >
        <SheetHeader
          className="px-4 py-3 flex-shrink-0 border-b"
          style={{ borderColor: 'rgba(255,255,255,0.07)' }}
        >
          <SheetTitle className="text-sm font-semibold flex items-center gap-2" style={{ color: '#F1F1F8' }}>
            <div className="w-5 h-5 rounded bg-gradient-to-br from-[#7C3AED] to-[#0EA5E9] flex items-center justify-center">
              <Settings2 className="w-3 h-3 text-slate-900 dark:text-white" />
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
