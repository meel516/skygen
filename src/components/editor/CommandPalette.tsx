'use client';

import { useEffect } from 'react';
import {
  CommandDialog, CommandInput, CommandList, CommandGroup,
  CommandItem, CommandEmpty, CommandSeparator,
} from '@/components/ui/command';
import { useEditorStore } from '@/store/editor-store';
import {
  BarChart3, Type, Image, Quote, List, AlertCircle, Code, Palette,
  LineChart, PieChart, Timer, Box, TrendingUp, Layers,
  Video, Heart, QrCode, Waves, CloudSun, MessageSquare,
  MessageCircle, Users, Share2, MousePointer, Hourglass, Clock,
  Grid3X3, Undo2, Redo2, DollarSign, Globe, GitBranch, Crown,
  FileCode2, Network,
} from '@/components/ui/studio-icons';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { hasPremiumAccess, isPremiumBlockType } from '@/lib/roles';
import { usePremiumConfig, getUpgradeUrl } from '@/lib/use-premium-config';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const COMMAND_BLOCKS = [
  { type: 'text', label: 'Text', icon: Type },
  { type: 'quote', label: 'Quote', icon: Quote },
  { type: 'list', label: 'List', icon: List },
  { type: 'callout', label: 'Callout', icon: AlertCircle },
  { type: 'code', label: 'Code', icon: Code },
  { type: 'gradient-text', label: 'Gradient Text', icon: Palette },
  { type: 'stat', label: 'Stat', icon: BarChart3 },
  { type: 'comparison', label: 'Compare', icon: BarChart3 },
  { type: 'line-chart', label: 'Line Chart', icon: LineChart },
  { type: 'pie-chart', label: 'Pie Chart', icon: PieChart },
  { type: 'counter', label: 'Counter', icon: Timer },
  { type: 'progress-bar', label: 'Progress Bar', icon: BarChart3 },
  { type: 'tower-chart-3d', label: '3D Tower Chart', icon: Box },
  { type: 'bar-race-3d', label: '3D Bar Race', icon: TrendingUp },
  { type: 'parallax-story', label: 'Parallax Story', icon: Layers },
  { type: 'image', label: 'Image', icon: Image },
  { type: 'video', label: 'Video', icon: Video },
  { type: 'motivational-image', label: 'Poster', icon: Heart },
  { type: 'qr-code', label: 'QR Code', icon: QrCode },
  { type: 'animated-bg', label: 'Background', icon: Waves },
  { type: 'weather-block', label: 'Weather', icon: CloudSun },
  { type: 'html', label: 'HTML Block', icon: FileCode2 },
  { type: 'diagram', label: 'Diagram', icon: Network },
  { type: 'testimonial', label: 'Review', icon: MessageSquare },
  { type: 'whatsapp-chat', label: 'Chat', icon: MessageCircle },
  { type: 'avatar-grid', label: 'Team Grid', icon: Users },
  { type: 'social-stats', label: 'Social Stats', icon: Share2 },
  { type: 'pricing-table', label: 'Pricing Table', icon: DollarSign },
  { type: 'logo-wall', label: 'Logo Wall', icon: Globe },
  { type: 'process-steps', label: 'Process Steps', icon: GitBranch },
  { type: 'cta', label: 'CTA Button', icon: MousePointer },
  { type: 'countdown', label: 'Countdown', icon: Hourglass },
  { type: 'timeline', label: 'Timeline', icon: Clock },
  { type: 'icon-list', label: 'Features', icon: Grid3X3 },
];

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const { addBlock, undo, redo, canUndo, canRedo } = useEditorStore();
  const { data: session } = useSession();
  const { toast } = useToast();
  const hasPremium = hasPremiumAccess(session?.user?.role);
  const premiumConfig = usePremiumConfig();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, [open, onOpenChange]);

  const handleSelect = (action: () => void) => {
    action();
    onOpenChange(false);
  };

  const handleAddBlock = (type: string) => {
    if (isPremiumBlockType(type) && !hasPremium) {
      toast({
        title: 'Premium required',
        description: 'Upgrade to Premium to use advanced blocks like 3D Tower, 3D Race, Parallax, and Video.',
      });
      window.open(getUpgradeUrl(premiumConfig), '_blank');
      return;
    }

    addBlock(type);
  };

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search blocks and actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Add Block">
          {COMMAND_BLOCKS.map(({ type, label, icon: Icon }) => (
            <CommandItem
              key={type}
              value={label}
              onSelect={() => handleSelect(() => handleAddBlock(type))}
              className="flex items-center gap-2"
            >
              <Icon className="w-4 h-4 text-muted-foreground dark:text-[var(--muted-foreground)]" />
              <span className="flex-1">{label}</span>
              {isPremiumBlockType(type) && !hasPremium && (
                <span className="inline-flex items-center gap-1 text-[10px] text-amber-300">
                  <Crown className="w-3 h-3" />
                  Premium
                </span>
              )}
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Actions">
          <CommandItem
            value="undo"
            disabled={!canUndo()}
            onSelect={() => handleSelect(undo)}
            className="flex items-center gap-2"
          >
            <Undo2 className="w-4 h-4 text-muted-foreground dark:text-[var(--muted-foreground)]" />
            Undo
          </CommandItem>
          <CommandItem
            value="redo"
            disabled={!canRedo()}
            onSelect={() => handleSelect(redo)}
            className="flex items-center gap-2"
          >
            <Redo2 className="w-4 h-4 text-muted-foreground dark:text-[var(--muted-foreground)]" />
            Redo
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
