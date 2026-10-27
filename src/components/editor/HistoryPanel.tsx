'use client';

import { useEditorStore } from '@/store/editor-store';
import { History, Undo2, Redo2 } from '@/components/ui/studio-icons';
import { Button } from '@/components/ui/button';

export function HistoryPanel() {
  const { undo, redo, canUndo, canRedo } = useEditorStore();

  return (
    <div className="w-[280px] h-full flex flex-col overflow-hidden bg-card dark:bg-[var(--card)]">
      <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <History className="w-4 h-4" style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>History</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-sm flex items-center justify-center"
          style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <History className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
        </div>
        <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>
          Use undo/redo to navigate history
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo()}
            className="h-8 gap-1.5 text-xs border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}
          >
            <Undo2 className="w-3.5 h-3.5" />
            Undo
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={redo}
            disabled={!canRedo()}
            className="h-8 gap-1.5 text-xs border"
            style={{ borderColor: 'var(--border)', color: 'var(--muted-foreground)', background: 'transparent' }}
          >
            <Redo2 className="w-3.5 h-3.5" />
            Redo
          </Button>
        </div>
      </div>
    </div>
  );
}
