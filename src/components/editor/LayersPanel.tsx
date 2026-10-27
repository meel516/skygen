'use client';

import { useEditorStore } from '@/store/editor-store';
import { Layers, BarChart3 } from '@/components/ui/studio-icons';
import { cn } from '@/lib/utils';

export function LayersPanel() {
  const { videoInput, selectedBlockIndex, selectBlock } = useEditorStore();
  const blocks = videoInput.contentBlocks;

  return (
    <div className="w-[280px] h-full flex flex-col overflow-hidden bg-card dark:bg-[var(--card)]">
      <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: 'var(--border)' }}>
        <Layers className="w-4 h-4" style={{ color: 'var(--primary)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Layers</span>
        <span className="ml-auto text-xs font-mono" style={{ color: 'var(--muted-foreground)' }}>{blocks.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
            <Layers className="w-8 h-8" style={{ color: 'var(--muted-foreground)' }} />
            <p className="text-xs text-center" style={{ color: 'var(--muted-foreground)' }}>No layers yet</p>
          </div>
        ) : (
          [...blocks].reverse().map((block, reversedIndex) => {
            const index = blocks.length - 1 - reversedIndex;
            const isSelected = selectedBlockIndex === index;
            return (
              <button
                key={index}
                onClick={() => selectBlock(index)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-left',
                  isSelected
                    ? 'ring-1 ring-[var(--primary)] bg-[var(--primary)]/10'
                    : 'hover:bg-muted dark:bg-[var(--accent)]'
                )}
              >
                <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--muted-foreground)' }} />
                <span className="text-xs truncate flex-1" style={{ color: 'var(--foreground)' }}>
                  {block.type}
                </span>
                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: 'var(--muted-foreground)' }}>
                  {index + 1}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
