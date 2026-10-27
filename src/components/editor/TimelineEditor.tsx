'use client';

import { useEditorStore } from '@/store/editor-store';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GripVertical, Trash2, Copy, Clock, BarChart3, Type, Image, Quote,
  List, AlertCircle, MessageSquare, Code, Heart, MessageCircle,
  LineChart, PieChart, Grid3X3, Sparkles, ZoomIn, ZoomOut, Timer,
  QrCode, Video, Users, Share2, MousePointer, Palette, Waves, Hourglass,
  Play, Pause, ChevronDown, Box, TrendingUp, Layers, CloudSun,
} from '@/components/ui/studio-icons';
import { useState } from 'react';
import { cn } from '@/lib/utils';

const BLOCK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stat: BarChart3, comparison: BarChart3, text: Type, image: Image, quote: Quote,
  list: List, timeline: Clock, callout: AlertCircle, 'icon-list': Grid3X3,
  'line-chart': LineChart, 'pie-chart': PieChart, code: Code, testimonial: MessageSquare,
  'whatsapp-chat': MessageCircle, 'motivational-image': Heart,
  counter: Timer, 'progress-bar': BarChart3, 'qr-code': QrCode, video: Video,
  'avatar-grid': Users, 'social-stats': Share2, cta: MousePointer,
  'gradient-text': Palette, 'animated-bg': Waves, countdown: Hourglass,
  'tower-chart-3d': Box, 'bar-race-3d': TrendingUp, 'parallax-story': Layers,
  'weather-block': CloudSun,
};

const BLOCK_GRADIENTS: Record<string, string> = {
  stat: 'from-blue-500 to-cyan-500', comparison: 'from-purple-500 to-pink-500',
  text: 'from-gray-400 to-gray-600', image: 'from-green-500 to-emerald-500',
  quote: 'from-yellow-500 to-orange-500', list: 'from-orange-500 to-red-500',
  timeline: 'from-cyan-500 to-blue-500', callout: 'from-red-500 to-pink-500',
  'icon-list': 'from-pink-500 to-rose-500', 'line-chart': 'from-emerald-500 to-teal-500',
  'pie-chart': 'from-amber-500 to-yellow-500', code: 'from-slate-500 to-zinc-600',
  testimonial: 'from-indigo-500 to-purple-500', 'whatsapp-chat': 'from-green-500 to-green-600',
  'motivational-image': 'from-rose-500 to-pink-500',
  counter: 'from-cyan-500 to-blue-500', 'progress-bar': 'from-green-500 to-emerald-500',
  'qr-code': 'from-slate-500 to-gray-600', video: 'from-red-500 to-rose-500',
  'avatar-grid': 'from-cyan-500 to-indigo-500', 'social-stats': 'from-blue-500 to-indigo-500',
  cta: 'from-emerald-500 to-teal-500', 'gradient-text': 'from-violet-500 to-fuchsia-500',
  'animated-bg': 'from-indigo-500 to-purple-500', countdown: 'from-rose-500 to-orange-500',
  'tower-chart-3d': 'from-violet-600 to-indigo-500', 'bar-race-3d': 'from-emerald-600 to-teal-500',
  'parallax-story': 'from-pink-500 to-rose-500', 'weather-block': 'from-sky-400 to-cyan-500',
};

function getBlockLabel(block: { type: string; [key: string]: unknown }): string {
  switch (block.type) {
    case 'stat': return (block as { heading?: string }).heading || 'Stat';
    case 'comparison': return (block as { title?: string }).title || 'Comparison';
    case 'text': return ((block as { content?: string }).content?.slice(0, 14) || 'Text') + '…';
    case 'image': return (block as { caption?: string }).caption || 'Image';
    case 'quote': return 'Quote';
    case 'list': return (block as { title?: string }).title || 'List';
    case 'timeline': return (block as { title?: string }).title || 'Timeline';
    case 'callout': return (block as { title?: string }).title || 'Callout';
    case 'icon-list': return (block as { title?: string }).title || 'Features';
    case 'line-chart': return (block as { title?: string }).title || 'Line Chart';
    case 'pie-chart': return (block as { title?: string }).title || 'Pie Chart';
    case 'code': return (block as { title?: string }).title || 'Code';
    case 'testimonial': return (block as { author?: string }).author || 'Review';
    case 'whatsapp-chat': return `Chat (${(block as { messages?: unknown[] }).messages?.length || 0})`;
    case 'motivational-image': return ((block as { text?: string }).text?.slice(0, 12) || 'Poster') + '…';
    case 'counter': return (block as { label?: string }).label || 'Counter';
    case 'progress-bar': return (block as { label?: string }).label || 'Progress';
    case 'qr-code': return (block as { title?: string }).title || 'QR Code';
    case 'video': return 'Video';
    case 'avatar-grid': return (block as { title?: string }).title || 'Team';
    case 'social-stats': return (block as { username?: string }).username || 'Social';
    case 'cta': return (block as { text?: string }).text || 'CTA';
    case 'gradient-text': return ((block as { text?: string }).text?.slice(0, 12) || 'Gradient') + '…';
    case 'animated-bg': return 'Background';
    case 'countdown': return (block as { title?: string }).title || 'Countdown';
    case 'tower-chart-3d': return (block as { title?: string }).title || '3D Tower';
    case 'bar-race-3d': return (block as { title?: string }).title || '3D Race';
    case 'parallax-story': return (block as { title?: string }).title || 'Parallax';
    case 'weather-block': return 'Weather';
    default: return block.type;
  }
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

interface SortableBlockProps {
  block: { type: string; [key: string]: unknown };
  index: number;
  isSelected: boolean;
  zoom: number;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

function SortableBlock({ block, index, isSelected, zoom, onSelect, onDuplicate, onDelete }: SortableBlockProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: index.toString() });

  const baseWidth = 130;
  const width = Math.max(110, baseWidth * zoom);
  const style = { transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 50 : 1, width: `${width}px` };

  const Icon = BLOCK_ICONS[block.type] || BarChart3;
  const gradient = BLOCK_GRADIENTS[block.type] || 'from-gray-500 to-gray-600';
  const duration = (block as { duration?: number }).duration || 3;

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: isDragging ? 0.75 : 1, scale: isDragging ? 1.04 : 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={cn(
        'relative flex-shrink-0 rounded-sm cursor-pointer group',
        isSelected ? 'ring-1 ring-[var(--primary)]' : 'hover:ring-1',
        isDragging ? 'shadow-none' : ''
      )}
      onClick={onSelect}
    >
      <div
        className={cn("p-2.5 rounded-sm h-full flex flex-col gap-2 border",
          isSelected ? "bg-primary/10 border-primary/40" : "bg-card dark:bg-[var(--muted)] border-border dark:border-white/[0.07]"
        )}
      >
        {/* Colored left accent bar */}
        <div className={`absolute left-0 top-3 bottom-3 w-0.5 rounded-full bg-muted ${gradient}`} />

        {/* Header row */}
        <div className="flex items-center gap-1.5 pl-1.5">
          <button
            {...attributes}
            {...listeners}
            className="p-0.5 rounded cursor-grab active:cursor-grabbing opacity-100 text-[var(--muted-foreground)]"
            onClick={(e) => e.stopPropagation()}
          >
            <GripVertical className="w-3 h-3" />
          </button>
          <div className={`w-6 h-6 rounded-sm bg-muted ${gradient} flex items-center justify-center flex-shrink-0 shadow`}>
            <Icon className="w-3 h-3 text-foreground dark:text-white" />
          </div>
          <p className="text-[11px] font-medium truncate flex-1 text-foreground dark:text-[var(--foreground)]">
            {getBlockLabel(block)}
          </p>
        </div>

        {/* Duration bar */}
        <div className="h-1 rounded-full overflow-hidden bg-muted dark:bg-white/[0.07]">
          <div
            className={`h-full bg-muted ${gradient} rounded-full `}
            style={{ width: `${Math.min((duration / 15) * 100, 100)}%` }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono tabular-nums text-[var(--muted-foreground)]">
            {duration}s
          </span>
          <div className="flex items-center gap-0.5 opacity-100">
            <button
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--muted-foreground)] hover:text-foreground dark:hover:text-[var(--foreground)]"
              onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            >
              <Copy className="w-2.5 h-2.5" />
            </button>
            <button
              className="w-5 h-5 rounded flex items-center justify-center text-[var(--muted-foreground)] hover:text-red-500"
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

interface TimelineEditorProps {
  onCollapse?: () => void;
}

export function TimelineEditor({ onCollapse }: TimelineEditorProps) {
  const {
    videoInput, selectedBlockIndex, selectBlock, moveBlock,
    duplicateBlock, removeBlock, isPlaying, setIsPlaying,
  } = useEditorStore();
  const [zoom, setZoom] = useState(1);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      moveBlock(parseInt(active.id as string), parseInt(over.id as string));
    }
  };

  const totalDuration = videoInput.contentBlocks.reduce(
    (acc, block) => acc + ((block as { duration?: number }).duration || 3), 0
  );

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: undefined }}>
      {/* Header */}
      <div
        className="h-11 flex items-center justify-between px-3 flex-shrink-0 border-b bg-card dark:bg-[var(--card)] border-border dark:border-white/[0.07]"
      >
        {/* Play + time */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-7 h-7 rounded-sm flex items-center justify-center shadow-none"
            style={{
              background: 'var(--primary)',
              boxShadow: 'none',
            }}


          >
            {isPlaying
              ? <Pause className="w-3.5 h-3.5 text-foreground dark:text-white" />
              : <Play className="w-3.5 h-3.5 text-foreground dark:text-white fill-white" />
            }
          </button>

          <div className="text-[11px] font-mono tabular-nums text-[var(--muted-foreground)]">
            <span className="text-foreground dark:text-[var(--foreground)]">00:00</span>
            <span className="text-[var(--muted-foreground)]"> / {formatTime(totalDuration)}</span>
          </div>

          {videoInput.contentBlocks.length > 0 && (
            <div
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-muted dark:bg-white/[0.04] border border-border dark:border-white/[0.06]"
            >
              <Sparkles className="w-2.5 h-2.5 text-[var(--primary)]" />
              <span className="text-[10px] text-[var(--muted-foreground)]">
                {videoInput.contentBlocks.length} blocks
              </span>
            </div>
          )}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1">
          {/* Zoom out */}
          <button
            className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 text-[var(--muted-foreground)] hover:text-foreground dark:hover:text-[var(--foreground)]"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
            disabled={zoom <= 0.5}
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-mono tabular-nums w-8 text-center text-[var(--muted-foreground)]">
            {Math.round(zoom * 100)}%
          </span>
          {/* Zoom in */}
          <button
            className="w-6 h-6 rounded flex items-center justify-center disabled:opacity-30 text-[var(--muted-foreground)] hover:text-foreground dark:hover:text-[var(--foreground)]"
            onClick={() => setZoom((z) => Math.min(2, z + 0.25))}
            disabled={zoom >= 2}
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>

          <div className="w-px h-4 mx-1 bg-muted dark:bg-white/[0.07]" />

          {/* Collapse */}
          {onCollapse && (
            <button
              className="w-6 h-6 rounded flex items-center justify-center text-[var(--muted-foreground)] hover:text-foreground dark:hover:text-[var(--foreground)]"
              onClick={onCollapse}
              title="Collapse timeline"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Timeline content */}
      <div className="flex-1 p-3 overflow-hidden min-h-0">
        {videoInput.contentBlocks.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col items-center justify-center gap-3"
          >
            <div
              className="w-12 h-12 rounded-sm flex items-center justify-center bg-muted dark:bg-[var(--muted)] border border-border dark:border-white/[0.07]"
            >
              <Sparkles className="w-5 h-5 text-[var(--muted-foreground)]" />
            </div>
            <p className="text-xs text-[var(--muted-foreground)]">Add blocks from the library to begin</p>
          </motion.div>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext
              items={videoInput.contentBlocks.map((_, i) => i.toString())}
              strategy={horizontalListSortingStrategy}
            >
              <ScrollArea className="h-full">
                <div className="flex gap-2.5 px-1 pt-1 pb-2">
                  <AnimatePresence>
                    {videoInput.contentBlocks.map((block, index) => (
                      <SortableBlock
                        key={index}
                        block={block}
                        index={index}
                        isSelected={selectedBlockIndex === index}
                        zoom={zoom}
                        onSelect={() => selectBlock(index)}
                        onDuplicate={() => duplicateBlock(index)}
                        onDelete={() => removeBlock(index)}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </ScrollArea>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}
