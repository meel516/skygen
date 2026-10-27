'use client';

import { useEditorStore } from '@/store/editor-store';
import { History, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function HistoryPanel() {
  const { undo, redo, canUndo, canRedo } = useEditorStore();

  return (
    <div className="w-[280px] h-full flex flex-col overflow-hidden bg-white dark:bg-[#13131C] transition-colors">
      <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <History className="w-4 h-4" style={{ color: '#7C3AED' }} />
        <span className="text-sm font-semibold" style={{ color: '#F1F1F8' }}>History</span>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: '#1E1E2D', border: '1px solid rgba(255,255,255,0.07)' }}>
          <History className="w-6 h-6" style={{ color: '#55556A' }} />
        </div>
        <p className="text-xs text-center" style={{ color: '#55556A' }}>
          Use undo/redo to navigate history
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={undo}
            disabled={!canUndo()}
            className="h-8 gap-1.5 text-xs border"
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#8B8BAA', background: 'transparent' }}
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
            style={{ borderColor: 'rgba(255,255,255,0.1)', color: '#8B8BAA', background: 'transparent' }}
          >
            <Redo2 className="w-3.5 h-3.5" />
            Redo
          </Button>
        </div>
      </div>
    </div>
  );
}
