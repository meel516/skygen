'use client';

import { useEditorStore } from '@/store/editor-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useState, useEffect, useRef } from 'react';
import { useSiteConfig } from '@/lib/use-site-config';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { hasPremiumAccess, isPremiumBlockType } from '@/lib/roles';
import { usePremiumConfig, getUpgradeUrl } from '@/lib/use-premium-config';
import { getPluginLoader } from '@/lib/plugins/plugin-loader';
import type { PluginRegistryEntry } from '../../../shared/plugin-types';
import {
  BarChart3, Type, Image, Quote, List, Clock, AlertCircle,
  Grid3X3, LineChart, PieChart, Code, MessageSquare,
  MessageCircle, Sparkles, Zap, Timer, QrCode,
  Video, Users, Share2, MousePointer, Palette, Waves,
  Hourglass, CloudSun, Box, TrendingUp, Layers, Heart, Search, Crown,
  DollarSign, Globe, GitBranch, Briefcase, FileCode2, Network, Puzzle,
  Upload, Loader2,
} from '@/components/ui/studio-icons';

const BLOCK_CATEGORIES = [
  {
    id: 'Content',
    name: 'Content',
    icon: Type,
    blocks: [
      { type: 'text', label: 'Text', icon: Type, gradient: 'from-gray-400 to-gray-600', description: 'Rich text block' },
      { type: 'quote', label: 'Quote', icon: Quote, gradient: 'from-yellow-500 to-orange-500', description: 'Inspirational quote' },
      { type: 'list', label: 'List', icon: List, gradient: 'from-orange-500 to-red-500', description: 'Bullet list' },
      { type: 'callout', label: 'Callout', icon: AlertCircle, gradient: 'from-red-500 to-pink-500', description: 'Highlight info' },
      { type: 'code', label: 'Code', icon: Code, gradient: 'from-slate-500 to-zinc-600', description: 'Code snippet' },
      { type: 'gradient-text', label: 'Gradient', icon: Palette, gradient: 'from-violet-500 to-fuchsia-500', description: 'Gradient text' },
      { type: 'html', label: 'HTML', icon: FileCode2, gradient: 'from-orange-500 to-red-500', description: 'Custom HTML/CSS/JS' },
    ],
  },
  {
    id: 'Data',
    name: 'Data & Stats',
    icon: BarChart3,
    blocks: [
      { type: 'stat', label: 'Stat', icon: BarChart3, gradient: 'from-blue-500 to-cyan-500', description: 'Key metric' },
      { type: 'comparison', label: 'Compare', icon: BarChart3, gradient: 'from-cyan-500 to-indigo-500', description: 'Compare values' },
      { type: 'line-chart', label: 'Line Chart', icon: LineChart, gradient: 'from-emerald-500 to-teal-500', description: 'Data trend' },
      { type: 'pie-chart', label: 'Pie Chart', icon: PieChart, gradient: 'from-amber-500 to-yellow-500', description: 'Breakdown' },
      { type: 'counter', label: 'Counter', icon: Timer, gradient: 'from-cyan-500 to-blue-500', description: 'Animated counter' },
      { type: 'progress-bar', label: 'Progress', icon: BarChart3, gradient: 'from-green-500 to-emerald-500', description: 'Progress bar' },
      { type: 'tower-chart-3d', label: '3D Tower', icon: Box, gradient: 'from-violet-600 to-indigo-500', description: '3D ranking' },
      { type: 'bar-race-3d', label: '3D Race', icon: TrendingUp, gradient: 'from-emerald-600 to-teal-500', description: '3D bar race' },
      { type: 'parallax-story', label: 'Parallax', icon: Layers, gradient: 'from-pink-500 to-rose-500', description: 'Cinematic' },
      { type: 'top-players', label: 'Top Players', icon: Crown, gradient: 'from-amber-500 to-orange-500', description: 'Countdown zoom' },
      { type: 'diagram', label: 'Diagram', icon: Network, gradient: 'from-teal-500 to-cyan-500', description: 'Flowcharts & diagrams' },
    ],
  },
  {
    id: 'Visual',
    name: 'Visual & Media',
    icon: Image,
    blocks: [
      { type: 'image', label: 'Image', icon: Image, gradient: 'from-green-500 to-emerald-500', description: 'Display image' },
      { type: 'video', label: 'Video', icon: Video, gradient: 'from-red-500 to-rose-500', description: 'Video embed' },
      { type: 'motivational-image', label: 'Poster', icon: Heart, gradient: 'from-rose-500 to-pink-500', description: 'Image + text' },
      { type: 'qr-code', label: 'QR Code', icon: QrCode, gradient: 'from-slate-500 to-gray-600', description: 'QR code' },
      { type: 'animated-bg', label: 'BG Anim', icon: Waves, gradient: 'from-indigo-500 to-purple-500', description: 'Animated bg' },
      { type: 'weather-block', label: 'Weather', icon: CloudSun, gradient: 'from-sky-400 to-cyan-500', description: 'Weather widget' },
    ],
  },
  {
    id: 'Social',
    name: 'Social & People',
    icon: Users,
    blocks: [
      { type: 'testimonial', label: 'Review', icon: MessageSquare, gradient: 'from-indigo-500 to-purple-500', description: 'Customer review' },
      { type: 'whatsapp-chat', label: 'Chat', icon: MessageCircle, gradient: 'from-green-500 to-green-600', description: 'Chat mockup' },
      { type: 'avatar-grid', label: 'Team', icon: Users, gradient: 'from-orange-500 to-amber-500', description: 'Team grid' },
      { type: 'social-stats', label: 'Social', icon: Share2, gradient: 'from-blue-500 to-indigo-500', description: 'Social stats' },
    ],
  },
  {
    id: 'Business',
    name: 'Business & Sales',
    icon: Briefcase,
    blocks: [
      { type: 'pricing-table', label: 'Pricing', icon: DollarSign, gradient: 'from-emerald-500 to-green-500', description: 'Pricing plans' },
      { type: 'logo-wall', label: 'Logos', icon: Globe, gradient: 'from-sky-500 to-blue-500', description: 'Logo showcase' },
      { type: 'process-steps', label: 'Process', icon: GitBranch, gradient: 'from-amber-500 to-orange-500', description: 'Step-by-step' },
    ],
  },
  {
    id: 'Interactive',
    name: 'Interactive',
    icon: MousePointer,
    blocks: [
      { type: 'cta', label: 'CTA', icon: MousePointer, gradient: 'from-emerald-500 to-teal-500', description: 'Call to action' },
      { type: 'countdown', label: 'Countdown', icon: Hourglass, gradient: 'from-rose-500 to-orange-500', description: 'Countdown timer' },
      { type: 'timeline', label: 'Timeline', icon: Clock, gradient: 'from-cyan-500 to-blue-500', description: 'Event timeline' },
      { type: 'icon-list', label: 'Features', icon: Grid3X3, gradient: 'from-pink-500 to-rose-500', description: 'Feature list' },
    ],
  },
];

const ALL_BLOCKS = BLOCK_CATEGORIES.flatMap((c) => c.blocks.map((b) => ({ ...b, categoryId: c.id })));
const TOTAL_BLOCKS = ALL_BLOCKS.length;
const RECENTLY_USED_KEY = 'videogen-recently-used-blocks';

export function BlockLibrarySidebar() {
  const addBlock = useEditorStore((state) => state.addBlock);
  const addPluginBlock = useEditorStore((state) => state.addPluginBlock);
  const { blockThumbnails } = useSiteConfig();
  const { data: session } = useSession();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [recentlyUsed, setRecentlyUsed] = useState<string[]>([]);
  const [installedPlugins, setInstalledPlugins] = useState<PluginRegistryEntry[]>([]);
  const [installing, setInstalling] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const hasPremium = hasPremiumAccess(session?.user?.role);
  const premiumConfig = usePremiumConfig();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(RECENTLY_USED_KEY);
      if (stored) setRecentlyUsed(JSON.parse(stored));
    } catch { /* ignore */ }
  }, []);

  // Load installed plugins from registry
  useEffect(() => {
    getPluginLoader().getAllPlugins()
      .then(setInstalledPlugins)
      .catch(() => setInstalledPlugins([]));
  }, []);

  const handleAddPluginBlock = async (plugin: PluginRegistryEntry) => {
    try {
      const schema = await getPluginLoader().getPluginSchema(plugin.id);
      const defaults = schema ? await import('@/lib/plugins/schema-to-ui').then(m => m.getDefaultsFromSchema(schema)) : {};
      addPluginBlock(plugin.id, defaults);
    } catch {
      toast({ title: 'Failed to load plugin', description: `Could not load "${plugin.name}"` });
    }
  };

  const handleInstallPlugin = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Reset input so same file can be re-selected
    e.target.value = '';

    setInstalling(true);
    try {
      const formData = new FormData();
      formData.append('plugin', file);
      const res = await fetch('/api/plugins/install', { method: 'POST', body: formData });
      const json = await res.json();
      if (!res.ok) {
        toast({
          title: 'Install failed',
          description: json.errors?.[0] ?? json.error ?? 'Unknown error',
          variant: 'destructive',
        });
        return;
      }
      toast({ title: `Plugin installed: ${json.name}`, description: json.warnings?.[0] });
      // Refresh plugin list (bust cache so new plugin appears)
      const loader = getPluginLoader();
      loader.clearCache();
      const plugins = await loader.getAllPlugins();
      setInstalledPlugins(plugins);
    } catch (err) {
      toast({ title: 'Install failed', description: String(err), variant: 'destructive' });
    } finally {
      setInstalling(false);
    }
  };

  const handlePremiumUpgrade = () => {
    toast({
      title: 'Premium required',
      description: 'Upgrade to Premium to use advanced blocks like 3D Tower, 3D Race, Parallax, and Video.',
    });
    window.open(getUpgradeUrl(premiumConfig), '_blank');
  };

  const handleAddBlock = (type: string) => {
    if (isPremiumBlockType(type) && !hasPremium) {
      handlePremiumUpgrade();
      return;
    }

    addBlock(type);
    setRecentlyUsed((prev) => {
      const next = [type, ...prev.filter((t) => t !== type)].slice(0, 4);
      try { localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const filteredCategories = BLOCK_CATEGORIES.map((cat) => ({
    ...cat,
    blocks: cat.blocks.filter((block) => {
      const matchesSearch = !searchQuery ||
        block.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        block.type.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = activeCategory === 'All' || cat.id === activeCategory;
      return matchesSearch && matchesCategory;
    }),
  })).filter((cat) => cat.blocks.length > 0);

  const recentBlocks = recentlyUsed
    .map((type) => ALL_BLOCKS.find((b) => b.type === type))
    .filter(Boolean) as typeof ALL_BLOCKS;

  return (
    <TooltipProvider delayDuration={400}>
      <div className="h-full flex flex-col overflow-hidden bg-background dark:bg-[var(--card)]" style={{ width: 280 }}>
        {/* Search + category pills */}
        <div className="px-3 pt-3 pb-2.5 flex-shrink-0 space-y-2 border-b border-border dark:border-white/[0.07]">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search blocks…"
              className="w-full h-8 pl-8 pr-3 rounded-sm text-[12px] outline-none bg-muted dark:bg-white/[0.05] border border-border dark:border-white/[0.07] text-[var(--foreground)] focus:border-primary"

            />
          </div>
          {/* Category pills */}
          <div className="flex gap-1 flex-wrap">
            {['All', 'Content', 'Data', 'Visual', 'Social', 'Interactive'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  'px-2 py-0.5 rounded-full text-[10px] font-medium',
                  activeCategory === cat
                    ? 'bg-[var(--primary)]/25 text-[var(--primary)] ring-1 ring-[var(--primary)]/30'
                    : 'bg-muted dark:bg-white/[0.05] text-[var(--muted-foreground)] hover:text-muted-foreground dark:text-[var(--muted-foreground)]'
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-4 pb-16">
            {/* Recently Used */}
            {recentBlocks.length > 0 && !searchQuery && activeCategory === 'All' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <Sparkles className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                    Recently Used
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {recentBlocks.map((block) => {
                    const Icon = block.icon;
                    const isLocked = isPremiumBlockType(block.type) && !hasPremium;
                    return (
                      <Tooltip key={block.type}>
                        <TooltipTrigger asChild>
                          <motion.button


                            onClick={() => handleAddBlock(block.type)}
                            className="flex flex-col items-center gap-1 p-1.5 rounded-sm group bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.06]"
                          >
                            <div className={`w-7 h-7 rounded-sm bg-muted ${block.gradient} flex items-center justify-center  group-hover:scale-105 overflow-hidden relative`}>
                              {blockThumbnails[block.type] ? (
                                <img src={blockThumbnails[block.type]} alt={block.label} className="w-full h-full object-cover" />
                              ) : (
                                <Icon className="w-3.5 h-3.5 text-foreground dark:text-white" />
                              )}
                              {isLocked && (
                                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                  <Crown className="w-3 h-3 text-amber-300" />
                                </div>
                              )}
                            </div>
                            <span className="text-[9px] leading-none text-center line-clamp-1"
                              style={{ color: 'var(--muted-foreground)' }}>{block.label}</span>
                          </motion.button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-[11px] bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07] text-[var(--muted-foreground)]">
                          {isLocked ? `${block.description} • Premium` : block.description}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Block categories */}
            {filteredCategories.map((category, catIndex) => {
              const CatIcon = category.icon;
              return (
                <motion.div
                  key={category.name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: catIndex * 0.04 }}
                  className="space-y-2"
                >
                  {/* Category header */}
                  <div className="flex items-center gap-2 px-1">
                    <CatIcon className="w-3 h-3" style={{ color: 'var(--muted-foreground)' }} />
                    <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--muted-foreground)' }}>
                      {category.name}
                    </span>
                    <div className="flex-1 h-px bg-muted dark:bg-white/[0.05]" />
                    <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{category.blocks.length}</span>
                  </div>

                  {/* Blocks grid */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {category.blocks.map((blockType, index) => {
                      const Icon = blockType.icon;
                      const isLocked = isPremiumBlockType(blockType.type) && !hasPremium;
                      return (
                        <Tooltip key={blockType.type}>
                          <TooltipTrigger asChild>
                            <motion.button
                              initial={{ opacity: 0, scale: 0.9 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: catIndex * 0.04 + index * 0.015 }}


                              onClick={() => handleAddBlock(blockType.type)}
                              className={cn("flex flex-col items-center gap-1.5 p-2.5 rounded-sm group cursor-pointer border",
                                isLocked ? 'bg-background dark:bg-white/[0.025] border-border dark:border-white/[0.05]' : 'bg-muted dark:bg-white/[0.03] border-border dark:border-white/[0.05] hover:bg-muted dark:hover:bg-[var(--accent)] hover:border-border dark:hover:border-white/[0.12]'
                              )}
                            >
                              <div className={`w-8 h-8 rounded-sm bg-muted ${blockType.gradient} flex items-center justify-center shadow-none transition-shadow group-hover:shadow-none overflow-hidden relative`}>
                                {blockThumbnails[blockType.type] ? (
                                  <img src={blockThumbnails[blockType.type]} alt={blockType.label} className="w-full h-full object-cover" />
                                ) : (
                                  <Icon className="w-3.5 h-3.5 text-foreground dark:text-white" />
                                )}
                                {isLocked && (
                                  <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                                    <Crown className="w-3.5 h-3.5 text-amber-300" />
                                  </div>
                                )}
                              </div>
                              <span className="text-[10px] font-medium leading-none text-center line-clamp-1"
                                style={{ color: 'var(--muted-foreground)' }}>
                                {blockType.label}
                              </span>
                              {isLocked && (
                                <span className="text-[9px] leading-none" style={{ color: '#FBBF24' }}>
                                  Premium
                                </span>
                              )}
                            </motion.button>
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            className="text-[11px] bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07] text-[var(--muted-foreground)]"
                          >
                            {isLocked ? `${blockType.description} • Upgrade to Premium` : blockType.description}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </motion.div>
              );
            })}

            {/* Custom Plugins */}
            {installedPlugins.length > 0 && (activeCategory === 'All' || activeCategory === 'Plugins') && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <div className="flex items-center gap-2 px-1">
                  <Puzzle className="w-3 h-3" style={{ color: 'var(--primary)' }} />
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--primary)' }}>
                    Custom Plugins
                  </span>
                  <div className="flex-1 h-px" style={{ background: 'color-mix(in srgb, var(--primary) 20%, transparent)' }} />
                  <span className="text-[9px]" style={{ color: 'var(--muted-foreground)' }}>{installedPlugins.length}</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {installedPlugins
                    .filter(p =>
                      !searchQuery ||
                      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (p.description ?? '').toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((plugin, index) => (
                    <Tooltip key={plugin.id}>
                      <TooltipTrigger asChild>
                        <motion.button
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: index * 0.015 }}


                          onClick={() => handleAddPluginBlock(plugin)}
                          className="flex flex-col items-center gap-1.5 p-2.5 rounded-sm group cursor-pointer bg-primary/5 dark:bg-primary/10 border border-primary/10 dark:border-primary/20 hover:bg-primary/10 dark:hover:bg-primary/20 hover:border-primary/20 dark:hover:border-primary/40"
                        >
                          <div
                            className="w-8 h-8 rounded-sm flex items-center justify-center shadow-none"
                            style={{ background: plugin.color ?? 'var(--primary)' }}
                          >
                            <Puzzle className="w-3.5 h-3.5 text-foreground dark:text-white" />
                          </div>
                          <span className="text-[10px] font-medium leading-none text-center line-clamp-1"
                            style={{ color: 'var(--muted-foreground)' }}>
                            {plugin.name}
                          </span>
                        </motion.button>
                      </TooltipTrigger>
                      <TooltipContent side="right" className="text-[11px] bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07] text-[var(--muted-foreground)]">
                        {plugin.description ?? plugin.name}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </motion.div>
            )}

            {filteredCategories.length === 0 && installedPlugins.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Search className="w-6 h-6" style={{ color: 'var(--muted-foreground)' }} />
                <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>No blocks match "{searchQuery}"</p>
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border dark:border-white/[0.07] flex-shrink-0 flex flex-col gap-2">
          {/* Install Plugin button */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".zip"
            className="hidden"
            onChange={handleInstallPlugin}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={installing}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-sm text-[11px] font-medium"
            style={{
              background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
              border: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              color: installing ? 'var(--muted-foreground)' : 'var(--primary)',
              cursor: installing ? 'not-allowed' : 'pointer',
            }}
          >
            {installing
              ? <><Loader2 className="w-3 h-3 animate-spin" /> Installing…</>
              : <><Upload className="w-3 h-3" /> Install Plugin (.zip)</>
            }
          </button>
          <div className="flex items-center justify-center gap-1.5">
            <Zap className="w-3 h-3" style={{ color: 'var(--primary)' }} />
            <span className="text-[10px]" style={{ color: 'var(--muted-foreground)' }}>
              {TOTAL_BLOCKS + installedPlugins.length} blocks · {BLOCK_CATEGORIES.length} categories{installedPlugins.length > 0 ? ` · ${installedPlugins.length} plugins` : ''}
            </span>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
