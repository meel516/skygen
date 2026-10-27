'use client';

import { useEditorStore } from '@/store/editor-store';
import { Layers, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function LayersPanel() {
  const { videoInput, selectedBlockIndex, selectBlock } = useEditorStore();
  const blocks = videoInput.contentBlocks;

  return (
    <div className="w-[280px] h-full flex flex-col overflow-hidden bg-white dark:bg-[#13131C] transition-colors">
      <div className="px-4 py-3 border-b flex items-center gap-2 flex-shrink-0"
        style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
        <Layers className="w-4 h-4" style={{ color: '#7C3AED' }} />
        <span className="text-sm font-semibold" style={{ color: '#F1F1F8' }}>Layers</span>
        <span className="ml-auto text-xs font-mono" style={{ color: '#55556A' }}>{blocks.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {blocks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-12">
            <Layers className="w-8 h-8" style={{ color: '#55556A' }} />
            <p className="text-xs text-center" style={{ color: '#55556A' }}>No layers yet</p>
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
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all',
                  isSelected
                    ? 'ring-1 ring-[#7C3AED] bg-[#7C3AED]/10'
                    : 'hover:bg-slate-100 dark:bg-[#25253A]'
                )}
              >
                <BarChart3 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: '#8B8BAA' }} />
                <span className="text-xs truncate flex-1" style={{ color: '#F1F1F8' }}>
                  {block.type}
                </span>
                <span className="text-[10px] font-mono flex-shrink-0" style={{ color: '#55556A' }}>
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
