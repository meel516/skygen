'use client';

import { LayoutGrid, Layers, Music2, History, SlidersHorizontal } from 'lucide-react';
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
      <div className="w-12 flex flex-col items-center py-2 gap-1 flex-shrink-0 border-r z-20 bg-white dark:bg-[#13131C] border-slate-200 dark:border-white/[0.07] transition-colors">

        {TABS.map(({ id, icon: Icon, label }) => (
          <Tooltip key={id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onTabClick(id)}
                className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
                  activeTab === id
                    ? 'bg-[#7C3AED]/20 text-[#7C3AED] ring-1 ring-[#7C3AED]/40'
                    : 'text-slate-500 dark:text-[#55556A] hover:text-slate-600 dark:text-[#8B8BAA] hover:bg-slate-100 dark:bg-[#25253A]'
                )}
              >
                <Icon className="w-4 h-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="right"
              className="text-xs bg-slate-100 dark:bg-[#1E1E2D] border-slate-200 dark:border-white/[0.07] text-slate-900 dark:text-[#F1F1F8]"
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
                'w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200',
                propertiesOpen
                  ? 'bg-[#0EA5E9]/15 text-[#0EA5E9] ring-1 ring-[#0EA5E9]/30'
                  : 'text-slate-500 dark:text-[#55556A] hover:text-slate-600 dark:text-[#8B8BAA] hover:bg-slate-100 dark:bg-[#25253A]'
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            className="text-xs bg-slate-100 dark:bg-[#1E1E2D] border-slate-200 dark:border-white/[0.07] text-slate-900 dark:text-[#F1F1F8]"
          >
            Properties
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}
