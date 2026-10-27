'use client';

import { LayoutGrid, Layers, Music2, History, SlidersHorizontal } from '@/components/ui/studio-icons';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type ActiveTab = 'blocks' | 'layers' | 'audio' | 'history' | null;

interface IconNavStripProps {
  activeTab: ActiveTab;
  onTabClick: (tab: 'blocks' | 'layers' | 'audio' | 'history') => void;
  propertiesOpen: boolean;
  onToggleProperties: () => void;
}

const TABS = [
  { id: 'blocks' as const, icon: LayoutGrid, label: 'Block Library' },
  { id: 'layers' as const, icon: Layers, label: 'Layers' },
  { id: 'audio' as const, icon: Music2, label: 'Audio' },
  { id: 'history' as const, icon: History, label: 'History' },
];

export function IconNavStrip({ activeTab, onTabClick, propertiesOpen, onToggleProperties }: IconNavStripProps) {
  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-12 flex flex-col items-center py-2 gap-1 flex-shrink-0 border-r z-20 bg-card dark:bg-[var(--card)] border-border dark:border-white/[0.07]">

        {TABS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTabClick(id)}
                className={cn(
                  'w-9 h-9 rounded-sm flex items-center justify-center duration-200',
                  activeTab === id
                    ? 'bg-[var(--primary)]/20 text-[var(--primary)] ring-1 ring-[var(--primary)]/40'
                    : 'text-muted-foreground dark:text-[var(--muted-foreground)] hover:text-muted-foreground dark:text-[var(--muted-foreground)] hover:bg-muted dark:bg-[var(--accent)]'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="text-xs bg-muted dark:bg-[var(--muted)] border-border dark:border-white/[0.07] text-foreground dark:text-[var(--foreground)]"
            >
              {label}
            </TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={onToggleProperties}
              className={cn(
                'w-9 h-9 rounded-sm flex items-center justify-center duration-200',
                propertiesOpen
                  ? 'bg-[var(--primary)]/15 text-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                  : 'text-muted-foreground dark:text-[var(--muted-foreground)] hover:text-muted-foreground dark:text-[var(--muted-foreground)] hover:bg-muted dark:bg-[var(--accent)]'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs bg-muted dark:bg-[var(--muted)] border-border dark:border-white/[0.07] text-foreground dark:text-[var(--foreground)]"
          >
            Properties
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
