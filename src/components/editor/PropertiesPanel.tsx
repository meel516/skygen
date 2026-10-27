'use client';

import { useEditorStore } from '@/store/editor-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trash2, Copy, Settings, Plus, X, Sparkles, ChevronDown, ChevronUp,
  BarChart3, Type, Image, Quote, List, Clock, AlertCircle,
  Grid3X3, LineChart, PieChart, Code, MessageSquare, Heart, MessageCircle,
  Timer, QrCode, Video, Users, Share2, MousePointer, Palette, Waves, Hourglass,
  Layers, Box, Move, Zap, TrendingUp, CloudSun, Activity, Music, Volume2,
  DollarSign, Globe, GitBranch, FileCode2, Network, Crown,
} from '@/components/ui/studio-icons';
import { useState, useEffect } from 'react';
import { generateEditorFromSchema, FieldEditor } from '@/lib/plugins/schema-to-ui';
import { getPluginLoader } from '@/lib/plugins/plugin-loader';
import type { PluginSchema } from '../../../shared/plugin-types';
import type { CustomPluginBlock } from '@/lib/video/schemas';

const BLOCK_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  stat: BarChart3, comparison: BarChart3, text: Type, image: Image, quote: Quote,
  list: List, timeline: Clock, callout: AlertCircle, 'icon-list': Grid3X3,
  'line-chart': LineChart, 'pie-chart': PieChart, code: Code, testimonial: MessageSquare,
  'whatsapp-chat': MessageCircle, 'motivational-image': Heart,
  // New blocks
  counter: Clock, 'progress-bar': BarChart3, 'qr-code': Image, video: Image,
  'avatar-grid': Users, 'social-stats': Share2, cta: MousePointer,
  'gradient-text': Palette, 'animated-bg': Waves, countdown: Hourglass,
  'weather-block': CloudSun,
  'tower-chart-3d': Box,
  'bar-race-3d': Activity,
  'parallax-story': Layers,
  'top-players': Crown,
  'pricing-table': DollarSign,
  'logo-wall': Globe,
  'process-steps': GitBranch,
  html: FileCode2,
  diagram: Network,
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
  // New blocks
  counter: 'from-cyan-500 to-blue-500', 'progress-bar': 'from-green-500 to-emerald-500',
  'qr-code': 'from-slate-500 to-gray-600', video: 'from-red-500 to-rose-500',
  'avatar-grid': 'from-orange-500 to-amber-500', 'social-stats': 'from-blue-500 to-indigo-500',
  cta: 'from-emerald-500 to-teal-500', 'gradient-text': 'from-violet-500 to-fuchsia-500',
  'animated-bg': 'from-indigo-500 to-purple-500', countdown: 'from-rose-500 to-orange-500',
  'weather-block': 'from-sky-400 to-cyan-500',
  'tower-chart-3d': 'from-violet-600 to-indigo-500',
  'bar-race-3d': 'from-emerald-600 to-teal-500',
  'parallax-story': 'from-pink-500 to-rose-500',
  'top-players': 'from-amber-500 to-orange-500',
  html: 'from-orange-500 to-red-500',
  diagram: 'from-teal-500 to-cyan-500',
};

// Color Picker Component
function ColorPicker({ value, onChange, label }: { value: string; onChange: (color: string) => void; label?: string }) {
  return (
    <div className="space-y-2">
      {label && <Label className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">{label}</Label>}
      <div className="flex gap-2">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-10 h-10 rounded-sm border border-border dark:border-border cursor-pointer bg-muted dark:bg-card appearance-none"
            style={{ padding: 0 }}
          />
          <div
            className="absolute inset-0 rounded-sm pointer-events-none ring-1 ring-inset ring-white/10"
            style={{ backgroundColor: value }}
          />
        </div>
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white h-10 font-mono text-sm"
          placeholder="#FFFFFF"
        />
      </div>
    </div>
  );
}

// Slider Input Component
function SliderInput({ label, value, onChange, min = 0, max = 10, step = 0.5, unit = 's' }: {
  label: string; value: number; onChange: (value: number) => void;
  min?: number; max?: number; step?: number; unit?: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <Label className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">{label}</Label>
        <span className="text-xs text-foreground dark:text-white bg-muted dark:bg-card px-2 py-0.5 rounded">{value}{unit}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
    </div>
  );
}

// Collapsible Section
function CollapsibleSection({ title, icon: Icon, children, defaultOpen = true }: {
  title: string; icon?: React.ComponentType<{ className?: string }>; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-border dark:border-border/50 rounded-sm overflow-hidden bg-background dark:bg-card/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-3 hover:bg-muted dark:bg-card/50"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-muted-foreground dark:text-muted-foreground" />}
          <span className="text-sm font-medium text-foreground dark:text-white">{title}</span>
        </div>
        <ChevronDown className={`w-4 h-4 text-muted-foreground dark:text-muted-foreground  ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="p-4 pt-0 space-y-4 border-t border-border dark:border-border/50 mt-1">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// COMMON CUSTOMIZATION SECTIONS
// ============================================================================

// Animation Settings Section
function AnimationSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  const { updateBlock } = useEditorStore();

  return (
    <CollapsibleSection title="Animation" icon={Zap} defaultOpen={false}>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Enter Animation</Label>
          <Select value={(block.enterAnimation as string) || 'fade'} onValueChange={(v) => updateBlock(index, { enterAnimation: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="slide-up">Slide Up</SelectItem>
              <SelectItem value="slide-down">Slide Down</SelectItem>
              <SelectItem value="slide-left">Slide Left</SelectItem>
              <SelectItem value="slide-right">Slide Right</SelectItem>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
              <SelectItem value="rotate">Rotate</SelectItem>
              <SelectItem value="flip">Flip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Exit Animation</Label>
          <Select value={(block.exitAnimation as string) || 'fade'} onValueChange={(v) => updateBlock(index, { exitAnimation: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fade">Fade</SelectItem>
              <SelectItem value="slide-up">Slide Up</SelectItem>
              <SelectItem value="slide-down">Slide Down</SelectItem>
              <SelectItem value="slide-left">Slide Left</SelectItem>
              <SelectItem value="slide-right">Slide Right</SelectItem>
              <SelectItem value="zoom">Zoom</SelectItem>
              <SelectItem value="bounce">Bounce</SelectItem>
              <SelectItem value="rotate">Rotate</SelectItem>
              <SelectItem value="flip">Flip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <SliderInput
          label="Animation Duration"
          value={(block.animationDuration as number) || 0.5}
          onChange={(v) => updateBlock(index, { animationDuration: v })}
          min={0.1}
          max={2}
          step={0.1}
          unit="s"
        />
      </div>
    </CollapsibleSection>
  );
}

// Background Settings Section
function BackgroundSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  const { updateBlock } = useEditorStore();

  return (
    <CollapsibleSection title="Background" icon={Layers} defaultOpen={false}>
      <div className="space-y-3">
        <ColorPicker
          value={(block.backgroundColor as string) || 'transparent'}
          onChange={(v) => updateBlock(index, { backgroundColor: v })}
          label="Background Color"
        />
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Background Image URL</Label>
          <Input
            value={(block.backgroundImage as string) || ''}
            onChange={(e) => updateBlock(index, { backgroundImage: e.target.value })}
            className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"
            placeholder="https://..."
          />
        </div>
        <SliderInput
          label="Background Blur"
          value={(block.backgroundBlur as number) || 0}
          onChange={(v) => updateBlock(index, { backgroundBlur: v })}
          min={0}
          max={20}
          step={1}
          unit="px"
        />
      </div>
    </CollapsibleSection>
  );
}

// Border/Shadow Settings Section
function BorderShadowSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  const { updateBlock } = useEditorStore();

  return (
    <CollapsibleSection title="Border & Shadow" icon={Box} defaultOpen={false}>
      <div className="space-y-3">
        <ColorPicker
          value={(block.borderColor as string) || '#374151'}
          onChange={(v) => updateBlock(index, { borderColor: v })}
          label="Border Color"
        />
        <SliderInput
          label="Border Width"
          value={(block.borderWidth as number) || 0}
          onChange={(v) => updateBlock(index, { borderWidth: v })}
          min={0}
          max={10}
          step={1}
          unit="px"
        />
        <SliderInput
          label="Border Radius"
          value={(block.borderRadius as number) || 0}
          onChange={(v) => updateBlock(index, { borderRadius: v })}
          min={0}
          max={50}
          step={2}
          unit="px"
        />
        <div className="flex items-center gap-2">
          <Switch
            checked={(block.shadowEnabled as boolean) ?? false}
            onCheckedChange={(v) => updateBlock(index, { shadowEnabled: v })}
          />
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Enable Shadow</Label>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// Padding/Spacing Settings Section
function PaddingSpacingSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  const { updateBlock } = useEditorStore();

  return (
    <CollapsibleSection title="Padding & Spacing" icon={Move} defaultOpen={false}>
      <div className="space-y-3">
        <SliderInput
          label="Padding"
          value={(block.padding as number) || 16}
          onChange={(v) => updateBlock(index, { padding: v })}
          min={0}
          max={64}
          step={4}
          unit="px"
        />
        <SliderInput
          label="Margin"
          value={(block.margin as number) || 0}
          onChange={(v) => updateBlock(index, { margin: v })}
          min={0}
          max={64}
          step={4}
          unit="px"
        />
      </div>
    </CollapsibleSection>
  );
}

// Position Settings Component
function PositionSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  const { updateBlock } = useEditorStore();

  return (
    <CollapsibleSection title="Position" icon={Move} defaultOpen={true}>
      <div className="space-y-3">
        {/* Vertical Alignment */}
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">Vertical Position</Label>
          <div className="grid grid-cols-3 gap-1 mt-2">
            {['top', 'center', 'bottom'].map((pos) => (
              <button
                key={pos}
                onClick={() => updateBlock(index, { verticalAlign: pos })}
                className={`p-2 rounded-sm border text-xs font-medium  ${
                  (block.verticalAlign as string) === pos || (!block.verticalAlign && pos === 'center')
                    ? 'border-primary bg-primary/20 text-foreground dark:text-white'
                    : 'border-border dark:border-border/50 bg-background dark:bg-card/30 text-muted-foreground dark:text-muted-foreground hover:border-border'
                }`}
              >
                {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Horizontal Alignment */}
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground font-medium">Horizontal Position</Label>
          <div className="grid grid-cols-3 gap-1 mt-2">
            {['left', 'center', 'right'].map((pos) => (
              <button
                key={pos}
                onClick={() => updateBlock(index, { horizontalAlign: pos })}
                className={`p-2 rounded-sm border text-xs font-medium  ${
                  (block.horizontalAlign as string) === pos || (!block.horizontalAlign && pos === 'center')
                    ? 'border-primary bg-primary/20 text-foreground dark:text-white'
                    : 'border-border dark:border-border/50 bg-background dark:bg-card/30 text-muted-foreground dark:text-muted-foreground hover:border-border'
                }`}
              >
                {pos.charAt(0).toUpperCase() + pos.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

// Audio Settings - shown for ALL blocks except those with their own audio section
function AudioNarrationSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  const { updateBlock } = useEditorStore();
  if (block.type === 'parallax-story' || block.type === 'motivational-image' || block.type === 'video' || block.type === 'top-players') return null;
  return (
    <CollapsibleSection title="Audio" icon={Music} defaultOpen={false}>
      <div className="space-y-3">
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Audio URL (MP3/WAV)</Label>
          <Input
            value={(block.audioSrc as string) || ''}
            onChange={(e) => updateBlock(index, { audioSrc: e.target.value })}
            className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1"
            placeholder="https://...mp3"
          />
        </div>
        {(block.audioSrc as string) && (
          <div className="p-2 bg-muted dark:bg-card/50 rounded-sm border border-border dark:border-border/30">
            <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground mb-1">
              <Volume2 className="w-3 h-3" />
              <span className="truncate">{(block.audioSrc as string).split('/').pop()}</span>
            </div>
            <audio src={block.audioSrc as string} controls className="w-full h-7" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}

// Common Settings Wrapper - applies all common sections
function CommonSettings({ block, index }: { block: Record<string, unknown>; index: number }) {
  return (
    <>
      <AudioNarrationSettings block={block} index={index} />
      <PositionSettings block={block} index={index} />
      <AnimationSettings block={block} index={index} />
      <BackgroundSettings block={block} index={index} />
      <BorderShadowSettings block={block} index={index} />
      <PaddingSpacingSettings block={block} index={index} />
    </>
  );
}

export function PropertiesPanel() {
  const { videoInput, selectedBlockIndex, updateBlock, duplicateBlock, removeBlock } = useEditorStore();

  const selectedBlock = selectedBlockIndex !== null ? videoInput.contentBlocks[selectedBlockIndex] : null;

  if (!selectedBlock) {
    return (
      <div className="w-full min-w-0 bg-background dark:bg-muted border-l border-border dark:border-border/50 flex flex-col h-full overflow-hidden">
        <div className="p-5 border-b border-border dark:border-border/50 bg-muted">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-sm bg-muted flex items-center justify-center shadow-none">
              <Settings className="w-5 h-5 text-foreground dark:text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground dark:text-white">Properties</h2>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground">Edit block settings</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-sm bg-muted dark:bg-card/50 flex items-center justify-center mx-auto mb-4 border border-border dark:border-border/50">
              <Sparkles className="w-6 h-6 text-muted-foreground dark:text-muted-foreground" />
            </div>
            <p className="text-muted-foreground dark:text-muted-foreground text-sm">Select a block to edit</p>
          </motion.div>
        </div>
      </div>
    );
  }

  const blockType = selectedBlock.type;
  const Icon = BLOCK_ICONS[blockType] || Settings;
  const gradient = BLOCK_GRADIENTS[blockType] || 'from-gray-500 to-gray-600';

  return (
    <div className="w-full min-w-0 bg-background dark:bg-muted border-l border-border dark:border-border/50 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border dark:border-border/50 bg-white/50 dark:bg-card/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={`w-8 h-8 rounded-sm bg-muted ${gradient} flex items-center justify-center shadow-none`}>
              <Icon className="w-4 h-4 text-foreground dark:text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-foreground dark:text-white capitalize">{blockType.replace('-', ' ')}</h2>
              <p className="text-[10px] text-muted-foreground dark:text-muted-foreground">Block Properties</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:text-white hover:bg-muted dark:bg-card" onClick={() => duplicateBlock(selectedBlockIndex!)} title="Duplicate">
              <Copy className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground dark:text-muted-foreground hover:text-red-400 hover:bg-muted dark:bg-card" onClick={() => removeBlock(selectedBlockIndex!)} title="Delete">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Properties Form */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-4 space-y-4">
          {/* Duration Slider */}
          <CollapsibleSection title="Timing" icon={Clock} defaultOpen={true}>
            <SliderInput
              label="Duration"
              value={(selectedBlock as { duration?: number }).duration || 4}
              onChange={(v) => updateBlock(selectedBlockIndex!, { duration: v })}
              min={1}
              max={120}
              step={0.5}
              unit="s"
            />
          </CollapsibleSection>

          {/* Block-specific editors */}
          {blockType === 'stat' && <StatEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'comparison' && <ComparisonEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'text' && <TextEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'image' && <ImageEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'quote' && <QuoteEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'list' && <ListEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'timeline' && <TimelineEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'callout' && <CalloutEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'code' && <CodeEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'testimonial' && <TestimonialEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'whatsapp-chat' && <WhatsAppEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'motivational-image' && <MotivationalEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'line-chart' && <LineChartEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'pie-chart' && <PieChartEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'icon-list' && <IconListEditor block={selectedBlock} index={selectedBlockIndex} />}
          {/* New block editors */}
          {blockType === 'counter' && <CounterEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'progress-bar' && <ProgressBarEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'qr-code' && <QRCodeEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'video' && <VideoBlockEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'avatar-grid' && <AvatarGridEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'social-stats' && <SocialStatsEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'cta' && <CTAEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'gradient-text' && <GradientTextEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'animated-bg' && <AnimatedBgEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'countdown' && <CountdownEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'weather-block' && <WeatherEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'tower-chart-3d' && <TowerChart3DEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'bar-race-3d' && <BarRace3DEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'parallax-story' && <ParallaxStoryEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'top-players' && <TopPlayersEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'pricing-table' && <PricingTableEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'logo-wall' && <LogoWallEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'process-steps' && <ProcessStepsEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'html' && <HtmlBlockEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'diagram' && <DiagramBlockEditor block={selectedBlock} index={selectedBlockIndex} />}
          {blockType === 'custom-plugin' && (
            <PluginBlockEditor block={selectedBlock as unknown as CustomPluginBlock} index={selectedBlockIndex!} />
          )}

          {/* Common Settings for all blocks (plugin blocks render this themselves) */}
          {blockType !== 'custom-plugin' && (
            <CommonSettings block={selectedBlock} index={selectedBlockIndex} />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================================
// PLUGIN BLOCK EDITOR - Auto-generated from plugin schema.json
// ============================================================================

function PluginBlockEditor({ block, index }: { block: CustomPluginBlock; index: number }) {
  const { updateBlock } = useEditorStore();
  const [schema, setSchema] = useState<PluginSchema | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPluginLoader().getPluginSchema(block.pluginId)
      .then(s => { setSchema(s); setLoading(false); })
      .catch(() => setLoading(false));
  }, [block.pluginId]);

  const handleChange = (field: string, value: unknown) => {
    updateBlock(index, {
      pluginData: { ...(block.pluginData ?? {}), [field]: value },
    } as Partial<CustomPluginBlock>);
  };

  if (loading) {
    return (
      <div className="p-4 text-center text-xs" style={{ color: 'var(--muted-foreground)' }}>
        Loading plugin schema…
      </div>
    );
  }

  if (!schema) {
    return (
      <div className="p-4 text-center text-xs" style={{ color: '#EF4444' }}>
        Could not load schema for plugin &quot;{block.pluginId}&quot;
      </div>
    );
  }

  const sections = generateEditorFromSchema(schema);
  const data = block.pluginData ?? {};

  return (
    <>
      {sections.map((section) => (
        <CollapsibleSection key={section.title} title={section.title} defaultOpen={section.defaultOpen}>
          <div className="space-y-3">
            {section.fields.map(({ key, property }) => (
              <FieldEditor
                key={key}
                field={key}
                property={property}
                value={data[key]}
                onChange={(val) => handleChange(key, val)}
              />
            ))}
          </div>
        </CollapsibleSection>
      ))}
      {/* Common plugin-level customization (background, alignment, etc.) */}
      <CommonSettings block={block as unknown as Record<string, unknown>} index={index} />
    </>
  );
}

// ============================================================================
// BLOCK EDITORS
// ============================================================================

interface EditorProps {
  block: Record<string, unknown>;
  index: number;
}

function StatEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();

  // Icon options for selector
  const iconOptions = ['📈', '📉', '📊', '💰', '👥', '⭐', '🔥', '💡', '🎯', '🚀', '✅', '❤️', '💎', '🌟', '🏆'];

  return (
    <>
      <CollapsibleSection title="Content" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Heading</Label>
            <Input value={(block.heading as string) || ''} onChange={(e) => updateBlock(index, { heading: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Value</Label>
            <Input value={(block.value as string) || ''} onChange={(e) => updateBlock(index, { value: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xl font-bold" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtext</Label>
            <Input value={(block.subtext as string) || ''} onChange={(e) => updateBlock(index, { subtext: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" />
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Stat Display" icon={BarChart3} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Icon</Label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {iconOptions.map((icon) => (
                <button
                  key={icon}
                  onClick={() => updateBlock(index, { icon })}
                  className={`w-8 h-8 rounded-sm text-lg flex items-center justify-center transition-colors ${(block.icon as string) === icon ? 'bg-blue-500/30 border border-blue-500' : 'bg-muted dark:bg-card/50 hover:bg-gray-700/50 border border-border dark:border-border/30'}`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
          <ColorPicker
            value={(block.trendColor as string) || '#10B981'}
            onChange={(v) => updateBlock(index, { trendColor: v })}
            label="Trend Indicator Color"
          />
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Value Animation Style</Label>
            <Select value={(block.valueAnimationStyle as string) || 'countUp'} onValueChange={(v) => updateBlock(index, { valueAnimationStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="countUp">Count Up</SelectItem>
                <SelectItem value="fade">Fade In</SelectItem>
                <SelectItem value="slide">Slide In</SelectItem>
                <SelectItem value="scale">Scale Up</SelectItem>
                <SelectItem value="typewriter">Typewriter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showTrend as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showTrend: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Trend Indicator</Label>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function ComparisonEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const items = (block.items as Array<{ label: string; value: number; color?: string }>) || [];

  return (
    <>
      <CollapsibleSection title="Comparison Items" icon={BarChart3} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label>
            <Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Items ({items.length})</Label>
              <Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { items: [...items, { label: 'New', value: 50, color: '#3B82F6' }] })}>
                <Plus className="w-3 h-3 mr-1" /> Add
              </Button>
            </div>
            {items.map((item, i) => (
              <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
                <div className="flex gap-2">
                  <Input value={item.label} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], label: e.target.value }; updateBlock(index, { items: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" />
                  <Input value={item.value.toString()} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], value: parseFloat(e.target.value) || 0 }; updateBlock(index, { items: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" type="number" />
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { items: items.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
                </div>
                <ColorPicker value={item.color || '#3B82F6'} onChange={(c) => { const n = [...items]; n[i] = { ...n[i], color: c }; updateBlock(index, { items: n }); }} />
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Chart Style" icon={BarChart3} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Chart Style</Label>
            <Select value={(block.chartStyle as string) || 'bar'} onValueChange={(v) => updateBlock(index, { chartStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bar">Bar Chart</SelectItem>
                <SelectItem value="horizontal">Horizontal Bar</SelectItem>
                <SelectItem value="radial">Radial Chart</SelectItem>
                <SelectItem value="pie">Pie Chart</SelectItem>
                <SelectItem value="donut">Donut Chart</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showLegend as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showLegend: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Legend</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showValues as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showValues: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Values</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showPercentage as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { showPercentage: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Percentage</Label>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function TextEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();

  return (
    <>
      <CollapsibleSection title="Text Content" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Content</Label>
            <Textarea value={(block.content as string) || ''} onChange={(e) => updateBlock(index, { content: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[100px]" />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Emphasis</Label>
            <Select value={(block.emphasis as string) || 'medium'} onValueChange={(v) => updateBlock(index, { emphasis: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Typography" icon={Type} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Family</Label>
            <Select value={(block.fontFamily as string) || 'sans'} onValueChange={(v) => updateBlock(index, { fontFamily: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sans">Sans Serif</SelectItem>
                <SelectItem value="serif">Serif</SelectItem>
                <SelectItem value="mono">Monospace</SelectItem>
                <SelectItem value="display">Display</SelectItem>
                <SelectItem value="handwriting">Handwriting</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderInput
            label="Letter Spacing"
            value={(block.letterSpacing as number) || 0}
            onChange={(v) => updateBlock(index, { letterSpacing: v })}
            min={-5}
            max={20}
            step={0.5}
            unit="px"
          />
          <SliderInput
            label="Line Height"
            value={(block.lineHeight as number) || 1.5}
            onChange={(v) => updateBlock(index, { lineHeight: v })}
            min={0.8}
            max={3}
            step={0.1}
            unit=""
          />
          <div className="flex items-center gap-2">
            <Switch checked={(block.textShadow as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { textShadow: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text Shadow</Label>
          </div>
          {block.textShadow && (
            <ColorPicker
              value={(block.textShadowColor as string) || '#000000'}
              onChange={(v) => updateBlock(index, { textShadowColor: v })}
              label="Shadow Color"
            />
          )}
        </div>
      </CollapsibleSection>
    </>
  );
}

function ImageEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <>
      <CollapsibleSection title="Image Settings" icon={Image} defaultOpen={true}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Image URL</Label>
            <Input value={(block.src as string) || ''} onChange={(e) => updateBlock(index, { src: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" />
          </div>
          {block.src && <div className="aspect-video bg-muted dark:bg-card rounded-sm overflow-hidden border border-border dark:border-border/30"><img src={block.src as string} alt="Preview" className="w-full h-full object-cover" /></div>}
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Alt Text</Label><Input value={(block.alt as string) || ''} onChange={(e) => updateBlock(index, { alt: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Caption</Label><Input value={(block.caption as string) || ''} onChange={(e) => updateBlock(index, { caption: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Image Style" icon={Image} defaultOpen={false}>
        <div className="space-y-3">
          <SliderInput
            label="Border Radius"
            value={(block.imageBorderRadius as number) || 0}
            onChange={(v) => updateBlock(index, { imageBorderRadius: v })}
            min={0}
            max={50}
            step={2}
            unit="px"
          />
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Object Fit</Label>
            <Select value={(block.objectFit as string) || 'cover'} onValueChange={(v) => updateBlock(index, { objectFit: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover</SelectItem>
                <SelectItem value="contain">Contain</SelectItem>
                <SelectItem value="fill">Fill</SelectItem>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="scale-down">Scale Down</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Hover Effect</Label>
            <Select value={(block.hoverEffect as string) || 'none'} onValueChange={(v) => updateBlock(index, { hoverEffect: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="zoom">Zoom</SelectItem>
                <SelectItem value="brighten">Brighten</SelectItem>
                <SelectItem value="darken">Darken</SelectItem>
                <SelectItem value="blur">Blur</SelectItem>
                <SelectItem value="grayscale">Grayscale</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function QuoteEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <>
      <CollapsibleSection title="Quote" icon={Quote} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Quote Text</Label><Textarea value={(block.text as string) || ''} onChange={(e) => updateBlock(index, { text: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[100px]" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Author</Label><Input value={(block.author as string) || ''} onChange={(e) => updateBlock(index, { author: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Quote Style" icon={Quote} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
            <Select value={(block.quoteStyle as string) || 'modern'} onValueChange={(v) => updateBlock(index, { quoteStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="modern">Modern</SelectItem>
                <SelectItem value="classic">Classic</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="boxed">Boxed</SelectItem>
                <SelectItem value="highlighted">Highlighted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showQuotationMarks as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showQuotationMarks: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Quotation Marks</Label>
          </div>
          <ColorPicker
            value={(block.quoteColor as string) || '#FBBF24'}
            onChange={(v) => updateBlock(index, { quoteColor: v })}
            label="Quote Mark Color"
          />
          <ColorPicker
            value={(block.authorColor as string) || '#9CA3AF'}
            onChange={(v) => updateBlock(index, { authorColor: v })}
            label="Author Color"
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function ListEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const items = (block.items as string[]) || [];
  return (
    <>
      <CollapsibleSection title="List Items" icon={List} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
            <Select value={(block.style as string) || 'bullet'} onValueChange={(v) => updateBlock(index, { style: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bullet">• Bullet</SelectItem>
                <SelectItem value="numbered">1. Numbered</SelectItem>
                <SelectItem value="checkmarks">✓ Checkmarks</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between items-center"><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Items</Label><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { items: [...items, 'New Item'] })}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
            {items.map((item, i) => (
              <div key={i} className="flex gap-1">
                <Input value={item} onChange={(e) => { const n = [...items]; n[i] = e.target.value; updateBlock(index, { items: n }); }} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white h-9 text-sm" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { items: items.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="List Animation" icon={Zap} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Item Animation</Label>
            <Select value={(block.itemAnimation as string) || 'sequential'} onValueChange={(v) => updateBlock(index, { itemAnimation: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="sequential">Sequential</SelectItem>
                <SelectItem value="allAtOnce">All At Once</SelectItem>
                <SelectItem value="staggered">Staggered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ColorPicker
            value={(block.bulletColor as string) || '#3B82F6'}
            onChange={(v) => updateBlock(index, { bulletColor: v })}
            label="Bullet/Number Color"
          />
          <SliderInput
            label="Animation Delay"
            value={(block.animationDelay as number) || 0.2}
            onChange={(v) => updateBlock(index, { animationDelay: v })}
            min={0}
            max={1}
            step={0.05}
            unit="s"
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function TimelineEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const events = (block.events as Array<{ year: string; title: string; description?: string }>) || [];
  return (
    <>
      <CollapsibleSection title="Timeline Events" icon={Clock} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div className="space-y-2">
            <div className="flex justify-between items-center"><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Events</Label><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { events: [...events, { year: '2024', title: 'New Event', description: '' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
            {events.map((event, i) => (
              <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
                <div className="flex gap-2">
                  <Input value={event.year} onChange={(e) => { const n = [...events]; n[i] = { ...n[i], year: e.target.value }; updateBlock(index, { events: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white w-20 h-9 text-sm" placeholder="Year" />
                  <Input value={event.title} onChange={(e) => { const n = [...events]; n[i] = { ...n[i], title: e.target.value }; updateBlock(index, { events: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" placeholder="Title" />
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { events: events.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
                </div>
                <Input value={event.description || ''} onChange={(e) => { const n = [...events]; n[i] = { ...n[i], description: e.target.value }; updateBlock(index, { events: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Description" />
              </div>
            ))}
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Timeline Style" icon={Clock} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Orientation</Label>
            <Select value={(block.orientation as string) || 'vertical'} onValueChange={(v) => updateBlock(index, { orientation: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vertical">Vertical</SelectItem>
                <SelectItem value="horizontal">Horizontal</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Line Style</Label>
            <Select value={(block.lineStyle as string) || 'solid'} onValueChange={(v) => updateBlock(index, { lineStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <ColorPicker
            value={(block.lineColor as string) || '#3B82F6'}
            onChange={(v) => updateBlock(index, { lineColor: v })}
            label="Line Color"
          />
          <ColorPicker
            value={(block.dotColor as string) || '#3B82F6'}
            onChange={(v) => updateBlock(index, { dotColor: v })}
            label="Dot Color"
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function CalloutEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="Callout" icon={AlertCircle} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Content</Label><Textarea value={(block.content as string) || ''} onChange={(e) => updateBlock(index, { content: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[80px]" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Variant</Label>
          <Select value={(block.variant as string) || 'default'} onValueChange={(v) => updateBlock(index, { variant: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default</SelectItem>
              <SelectItem value="success">Success</SelectItem>
              <SelectItem value="warning">Warning</SelectItem>
              <SelectItem value="info">Info</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function CodeEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="Code Block" icon={Code} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Language</Label>
          <Select value={(block.language as string) || 'javascript'} onValueChange={(v) => updateBlock(index, { language: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="javascript">JavaScript</SelectItem>
              <SelectItem value="typescript">TypeScript</SelectItem>
              <SelectItem value="python">Python</SelectItem>
              <SelectItem value="java">Java</SelectItem>
              <SelectItem value="go">Go</SelectItem>
              <SelectItem value="rust">Rust</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
              <SelectItem value="css">CSS</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Code</Label><Textarea value={(block.code as string) || ''} onChange={(e) => updateBlock(index, { code: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-sm min-h-[150px]" /></div>
      </div>
    </CollapsibleSection>
  );
}

function TestimonialEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="Testimonial" icon={MessageSquare} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Quote</Label><Textarea value={(block.quote as string) || ''} onChange={(e) => updateBlock(index, { quote: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[80px]" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Author</Label><Input value={(block.author as string) || ''} onChange={(e) => updateBlock(index, { author: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Role</Label><Input value={(block.role as string) || ''} onChange={(e) => updateBlock(index, { role: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Company</Label><Input value={(block.company as string) || ''} onChange={(e) => updateBlock(index, { company: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Avatar URL</Label><Input value={(block.avatar as string) || ''} onChange={(e) => updateBlock(index, { avatar: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://..." /></div>
      </div>
    </CollapsibleSection>
  );
}

function WhatsAppEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const messages = (block.messages as Array<{ from: string; text: string; time?: string }>) || [];
  return (
    <>
      <CollapsibleSection title="Participants" icon={MessageCircle} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Person 1 (You - Green)</Label><Input value={((block.person1 as Record<string, unknown>)?.name as string) || ''} onChange={(e) => updateBlock(index, { person1: { ...block.person1, name: e.target.value } })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Person 1 Avatar</Label><Input value={((block.person1 as Record<string, unknown>)?.avatar as string) || ''} onChange={(e) => updateBlock(index, { person1: { ...block.person1, avatar: e.target.value } })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://..." /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Person 2 (White)</Label><Input value={((block.person2 as Record<string, unknown>)?.name as string) || ''} onChange={(e) => updateBlock(index, { person2: { ...block.person2, name: e.target.value } })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Person 2 Avatar</Label><Input value={((block.person2 as Record<string, unknown>)?.avatar as string) || ''} onChange={(e) => updateBlock(index, { person2: { ...block.person2, avatar: e.target.value } })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://..." /></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Messages" icon={List} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { messages: [...messages, { from: 'person1', text: 'New message', time: '' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {messages.map((msg, i) => (
              <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-2 space-y-2 border border-border dark:border-border/30">
                <div className="flex gap-2 items-center">
                  <Select value={msg.from} onValueChange={(v) => { const n = [...messages]; n[i] = { ...n[i], from: v }; updateBlock(index, { messages: n }); }}>
                    <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white h-7 w-20 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="person1">You</SelectItem><SelectItem value="person2">Other</SelectItem></SelectContent>
                  </Select>
                  <Input value={msg.time || ''} onChange={(e) => { const n = [...messages]; n[i] = { ...n[i], time: e.target.value }; updateBlock(index, { messages: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white w-20 h-7 text-xs" placeholder="Time" />
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => updateBlock(index, { messages: messages.filter((_, idx) => idx !== i) })}><X className="w-3 h-3" /></Button>
                </div>
                <Input value={msg.text} onChange={(e) => { const n = [...messages]; n[i] = { ...n[i], text: e.target.value }; updateBlock(index, { messages: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Message" />
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-2">
            <Switch checked={(block.showTypingIndicator as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showTypingIndicator: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show typing indicator</Label>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function MotivationalEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const colorOverlay = block.colorOverlay as { enabled?: boolean; color?: string; opacity?: number } | undefined;

  return (
    <>
      <CollapsibleSection title="Image" icon={Image} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Image URL</Label><Input value={(block.imageSrc as string) || ''} onChange={(e) => updateBlock(index, { imageSrc: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          {block.imageSrc && <div className="aspect-video bg-muted dark:bg-card rounded-sm overflow-hidden border border-border dark:border-border/30"><img src={block.imageSrc as string} alt="Preview" className="w-full h-full" style={{ objectFit: ((block as any).imageFit || 'cover') as any }} /></div>}
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Image Fit</Label>
            <Select value={(block as any).imageFit || 'cover'} onValueChange={(v) => updateBlock(index, { imageFit: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (crop to fill)</SelectItem>
                <SelectItem value="contain">Contain (fit inside)</SelectItem>
                <SelectItem value="fill">Stretch to fill</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Image Position</Label>
            <Select value={(block as any).imagePosition || 'center'} onValueChange={(v) => updateBlock(index, { imagePosition: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="center">Center</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="bottom">Bottom</SelectItem>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Text" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text</Label><Textarea value={(block.text as string) || ''} onChange={(e) => updateBlock(index, { text: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[60px]" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
            <Select value={(block.textStyle as string) || 'default'} onValueChange={(v) => updateBlock(index, { textStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="default">Default</SelectItem>
                <SelectItem value="quote">Quote</SelectItem>
                <SelectItem value="typing">Typing</SelectItem>
                <SelectItem value="words">Word by Word</SelectItem>
                <SelectItem value="glow">Glow</SelectItem>
                <SelectItem value="outline">Outline</SelectItem>
                <SelectItem value="bold-glow">Bold Glow</SelectItem>
                <SelectItem value="shadow">Shadow</SelectItem>
                <SelectItem value="karaoke">Karaoke (group highlight)</SelectItem>
                <SelectItem value="karaoke-full">Karaoke Full (all words)</SelectItem>
                <SelectItem value="shorts">Shorts (pop groups)</SelectItem>
                <SelectItem value="three-line">Three-Line Teleprompter</SelectItem>
                <SelectItem value="cinematic">Cinematic</SelectItem>
                <SelectItem value="neon">Neon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Subtitle-style controls — only for shorts / three-line */}
          {/* Speed control — show for all animated text styles */}
          {['shorts', 'three-line', 'words', 'typing', 'karaoke', 'karaoke-full'].includes(block.textStyle as string) && (
            <SliderInput
              label="Words Per Second"
              value={(block as any).wordsPerSecond ?? 3}
              onChange={(v) => updateBlock(index, { wordsPerSecond: v })}
              min={0.5}
              max={8}
              step={0.1}
              unit=" wps"
            />
          )}
          {(['shorts', 'three-line', 'karaoke'].includes(block.textStyle as string)) && (
            <>
              <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Words Per Group</Label>
                <Select value={String((block as any).wordsPerGroup ?? 3)} onValueChange={(v) => updateBlock(index, { wordsPerGroup: parseInt(v) })}>
                  <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 word</SelectItem>
                    <SelectItem value="2">2 words</SelectItem>
                    <SelectItem value="3">3 words</SelectItem>
                    <SelectItem value="4">4 words</SelectItem>
                    <SelectItem value="5">5 words</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <ColorPicker value={(block as any).highlightColor || '#00FF88'} onChange={(v) => updateBlock(index, { highlightColor: v })} label="Highlight Color" />
              <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle Background</Label>
                <Select value={(block as any).subtitleBackground ?? 'none'} onValueChange={(v) => updateBlock(index, { subtitleBackground: v })}>
                  <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="pill">Pill</SelectItem>
                    <SelectItem value="bar">Full Bar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Family</Label>
            <Select value={(block as any).fontFamily || 'inter'} onValueChange={(v) => updateBlock(index, { fontFamily: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="inter">Inter (Default)</SelectItem>
                <SelectItem value="roboto">Roboto</SelectItem>
                <SelectItem value="montserrat">Montserrat</SelectItem>
                <SelectItem value="oswald">Oswald (Condensed)</SelectItem>
                <SelectItem value="playfair">Playfair Display (Serif)</SelectItem>
                <SelectItem value="bebas">Bebas Neue (Display)</SelectItem>
                <SelectItem value="poppins">Poppins</SelectItem>
                <SelectItem value="raleway">Raleway</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Size</Label>
              <Select value={(block.fontSize as string) || 'xlarge'} onValueChange={(v) => updateBlock(index, { fontSize: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem>
                  <SelectItem value="xlarge">XLarge</SelectItem><SelectItem value="xxlarge">XXLarge</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Weight</Label>
              <Select value={(block.fontWeight as string) || 'bold'} onValueChange={(v) => updateBlock(index, { fontWeight: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem><SelectItem value="black">Black</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Align</Label>
              <Select value={(block.textAlign as string) || 'center'} onValueChange={(v) => updateBlock(index, { textAlign: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Position</Label>
              <Select value={(block.textPosition as string) || 'center'} onValueChange={(v) => updateBlock(index, { textPosition: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="top">Top</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="bottom">Bottom</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <ColorPicker value={(block.textColor as string) || '#FFFFFF'} onChange={(v) => updateBlock(index, { textColor: v })} label="Text Color" />
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Image Effect" icon={Sparkles} defaultOpen={false}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Effect</Label>
            <Select value={(block.imageEffect as string) || 'fade'} onValueChange={(v) => updateBlock(index, { imageEffect: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem><SelectItem value="fade">Fade</SelectItem><SelectItem value="slide-up">Slide Up</SelectItem>
                <SelectItem value="zoom-in">Zoom In</SelectItem><SelectItem value="zoom-out">Zoom Out</SelectItem>
                <SelectItem value="ken-burns">Ken Burns</SelectItem><SelectItem value="blur">Blur</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Overlay" icon={AlertCircle} defaultOpen={false}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Overlay Type</Label>
            <Select value={(block as any).overlayType ?? 'gradient-bottom'} onValueChange={(v) => updateBlock(index, { overlayType: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gradient-bottom">Gradient Bottom (cinematic)</SelectItem>
                <SelectItem value="gradient-top">Gradient Top</SelectItem>
                <SelectItem value="vignette">Vignette</SelectItem>
                <SelectItem value="solid">Solid Color</SelectItem>
                <SelectItem value="none">None</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {(block as any).overlayType === 'solid' && (
            <>
              <div className="flex items-center gap-2">
                <Switch checked={colorOverlay?.enabled ?? false} onCheckedChange={(v) => updateBlock(index, { colorOverlay: { ...colorOverlay, enabled: v, color: colorOverlay?.color || '#000000', opacity: colorOverlay?.opacity || 0.4 } })} />
                <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Enable Solid Overlay</Label>
              </div>
              {colorOverlay?.enabled && (
                <>
                  <ColorPicker value={colorOverlay.color || '#000000'} onChange={(v) => updateBlock(index, { colorOverlay: { ...colorOverlay, color: v } })} label="Color" />
                  <SliderInput label="Opacity" value={colorOverlay.opacity || 0.4} onChange={(v) => updateBlock(index, { colorOverlay: { ...colorOverlay, opacity: v } })} min={0} max={1} step={0.05} unit="" />
                </>
              )}
            </>
          )}
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Audio" icon={MessageCircle} defaultOpen={false}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Audio URL (MP3)</Label><Input value={(block.audioSrc as string) || ''} onChange={(e) => updateBlock(index, { audioSrc: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://..." /></div>
          {(block.audioSrc as string) && <SliderInput label="Volume" value={(block.audioVolume as number) || 0.7} onChange={(v) => updateBlock(index, { audioVolume: v })} min={0} max={1} step={0.1} unit="" />}
        </div>
      </CollapsibleSection>
    </>
  );
}

function LineChartEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const data = (block.data as number[]) || [];
  return (
    <CollapsibleSection title="Chart Data" icon={LineChart} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <ColorPicker value={(block.lineColor as string) || '#3B82F6'} onChange={(v) => updateBlock(index, { lineColor: v })} label="Line Color" />
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Data Points</Label><Input value={data.join(', ')} onChange={(e) => updateBlock(index, { data: e.target.value.split(',').map(v => parseFloat(v.trim()) || 0) })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="10, 20, 30" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Labels</Label><Input value={((block.labels as string[]) || []).join(', ')} onChange={(e) => updateBlock(index, { labels: e.target.value.split(',').map(v => v.trim()) })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Jan, Feb, Mar" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">X-Axis Label</Label><Input value={(block.xAxisLabel as string) || ''} onChange={(e) => updateBlock(index, { xAxisLabel: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="e.g. Months" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Y-Axis Label</Label><Input value={(block.yAxisLabel as string) || ''} onChange={(e) => updateBlock(index, { yAxisLabel: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="e.g. Revenue" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Unit Suffix</Label><Input value={(block.unit as string) || ''} onChange={(e) => updateBlock(index, { unit: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="e.g. $, %, K" /></div>
        <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Data Labels</Label><Switch checked={!!block.showDataLabels} onCheckedChange={(v) => updateBlock(index, { showDataLabels: v })} /></div>
      </div>
    </CollapsibleSection>
  );
}

function PieChartEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const segments = (block.segments as Array<{ label: string; value: number; color?: string }>) || [];
  return (
    <CollapsibleSection title="Pie Segments" icon={PieChart} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Legend</Label><Switch checked={(block.showLegend as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showLegend: v })} /></div>
        <div className="flex items-center justify-between"><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Percentage</Label><Switch checked={(block.showPercentage as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showPercentage: v })} /></div>
        <div className="space-y-2">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { segments: [...segments, { label: 'New', value: 25, color: '#888888' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
          {segments.map((seg, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex gap-2">
                <Input value={seg.label} onChange={(e) => { const n = [...segments]; n[i] = { ...n[i], label: e.target.value }; updateBlock(index, { segments: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" />
                <Input value={seg.value.toString()} onChange={(e) => { const n = [...segments]; n[i] = { ...n[i], value: parseFloat(e.target.value) || 0 }; updateBlock(index, { segments: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" type="number" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { segments: segments.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
              </div>
              <ColorPicker value={seg.color || '#888888'} onChange={(c) => { const n = [...segments]; n[i] = { ...n[i], color: c }; updateBlock(index, { segments: n }); }} />
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function IconListEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const items = (block.items as Array<{ icon: string; title: string; description?: string }>) || [];
  return (
    <CollapsibleSection title="Features" icon={Grid3X3} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div className="space-y-2">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { items: [...items, { icon: '⭐', title: 'New Item', description: '' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
          {items.map((item, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex gap-2">
                <Input value={item.icon} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], icon: e.target.value }; updateBlock(index, { items: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white w-12 h-9 text-sm text-center" placeholder="icon" />
                <Input value={item.title} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], title: e.target.value }; updateBlock(index, { items: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" placeholder="Title" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { items: items.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
              </div>
              <Input value={item.description || ''} onChange={(e) => { const n = [...items]; n[i] = { ...n[i], description: e.target.value }; updateBlock(index, { items: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Description" />
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

// ============================================================================
// NEW BLOCK EDITORS
// ============================================================================

function CounterEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <>
      <CollapsibleSection title="Counter Settings" icon={Timer} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Label</Label><Input value={(block.label as string) || ''} onChange={(e) => updateBlock(index, { label: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">From</Label><Input value={(block.from as number) ?? 0} onChange={(e) => updateBlock(index, { from: parseFloat(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">To</Label><Input value={(block.to as number) ?? 100} onChange={(e) => updateBlock(index, { to: parseFloat(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Prefix</Label><Input value={(block.prefix as string) || ''} onChange={(e) => updateBlock(index, { prefix: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="$" /></div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Suffix</Label><Input value={(block.suffix as string) || ''} onChange={(e) => updateBlock(index, { suffix: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="%" /></div>
          </div>
          <SliderInput label="Animation Duration" value={(block.duration as number) || 3} onChange={(v) => updateBlock(index, { duration: v })} min={1} max={10} step={0.5} unit="s" />
          <ColorPicker value={(block.color as string) || '#3B82F6'} onChange={(v) => updateBlock(index, { color: v })} label="Color" />
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Animation Style</Label>
            <Select value={(block.animationStyle as string) || 'easeOut'} onValueChange={(v) => updateBlock(index, { animationStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="linear">Linear</SelectItem>
                <SelectItem value="easeOut">Ease Out</SelectItem>
                <SelectItem value="easeInOut">Ease In Out</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Number Formatting" icon={Type} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Switch checked={(block.useCommaSeparators as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { useCommaSeparators: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Comma Separators (1,000)</Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showCurrency as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { showCurrency: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Currency Symbol</Label>
          </div>
          {(block.showCurrency as boolean) && (
            <div>
              <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Currency Symbol</Label>
              <Input value={(block.currencySymbol as string) || '$'} onChange={(e) => updateBlock(index, { currencySymbol: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" />
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Label Position</Label>
            <Select value={(block.labelPosition as string) || 'bottom'} onValueChange={(v) => updateBlock(index, { labelPosition: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="top">Above Number</SelectItem>
                <SelectItem value="bottom">Below Number</SelectItem>
                <SelectItem value="left">Left Side</SelectItem>
                <SelectItem value="right">Right Side</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Decimal Places</Label>
            <Select value={((block.decimalPlaces as number) || 0).toString()} onValueChange={(v) => updateBlock(index, { decimalPlaces: parseInt(v) })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">0</SelectItem>
                <SelectItem value="1">1</SelectItem>
                <SelectItem value="2">2</SelectItem>
                <SelectItem value="3">3</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function ProgressBarEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <>
      <CollapsibleSection title="Progress Bar Settings" icon={BarChart3} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Label</Label><Input value={(block.label as string) || ''} onChange={(e) => updateBlock(index, { label: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <SliderInput label="Value" value={(block.value as number) || 75} onChange={(v) => updateBlock(index, { value: v })} min={0} max={100} step={1} unit="%" />
          <ColorPicker value={(block.color as string) || '#10B981'} onChange={(v) => updateBlock(index, { color: v })} label="Bar Color" />
          <ColorPicker value={(block.backgroundColor as string) || '#1F2937'} onChange={(v) => updateBlock(index, { backgroundColor: v })} label="Background" />
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Height</Label>
            <Select value={(block.height as string) || 'medium'} onValueChange={(v) => updateBlock(index, { height: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><Switch checked={(block.showPercentage as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showPercentage: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Percentage</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.animated as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { animated: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Animated</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.stripes as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { stripes: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Stripes</Label></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Animation Style" icon={Zap} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Animation Type</Label>
            <Select value={(block.progressBarAnimation as string) || 'fill'} onValueChange={(v) => updateBlock(index, { progressBarAnimation: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fill">Fill</SelectItem>
                <SelectItem value="pulse">Pulse</SelectItem>
                <SelectItem value="bounce">Bounce</SelectItem>
                <SelectItem value="glow">Glow</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={(block.showValueInsideBar as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { showValueInsideBar: v })} />
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Value Inside Bar</Label>
          </div>
          <SliderInput
            label="Animation Speed"
            value={(block.animationSpeed as number) || 1}
            onChange={(v) => updateBlock(index, { animationSpeed: v })}
            min={0.5}
            max={3}
            step={0.25}
            unit="x"
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function QRCodeEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="QR Code Settings" icon={QrCode} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Data/URL</Label><Textarea value={(block.data as string) || ''} onChange={(e) => updateBlock(index, { data: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[60px]" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Size</Label>
          <Select value={(block.size as string) || 'medium'} onValueChange={(v) => updateBlock(index, { size: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ColorPicker value={(block.fgColor as string) || '#000000'} onChange={(v) => updateBlock(index, { fgColor: v })} label="Foreground" />
        <ColorPicker value={(block.bgColor as string) || '#FFFFFF'} onChange={(v) => updateBlock(index, { bgColor: v })} label="Background" />
      </div>
    </CollapsibleSection>
  );
}

function VideoBlockEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const hasTextOverlay = !!(block.text as string);
  const colorOverlay = block.colorOverlay as { enabled?: boolean; color?: string; opacity?: number } | undefined;

  return (
    <>
      <CollapsibleSection title="Video Settings" icon={Video} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Video URL</Label><Input value={(block.src as string) || ''} onChange={(e) => updateBlock(index, { src: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://..." /></div>
          {!hasTextOverlay && (
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Caption</Label><Input value={(block.caption as string) || ''} onChange={(e) => updateBlock(index, { caption: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2"><Switch checked={(block.muted as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { muted: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Muted</Label></div>
            <div className="flex items-center gap-2"><Switch checked={(block.loop as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { loop: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Loop</Label></div>
          </div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Video Fit</Label>
            <Select value={(block.videoFit as string) || 'cover'} onValueChange={(v) => updateBlock(index, { videoFit: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cover">Cover (fill frame)</SelectItem>
                <SelectItem value="contain">Contain (show all)</SelectItem>
                <SelectItem value="fill">Fill (stretch)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Text Overlay" icon={Type} defaultOpen={hasTextOverlay}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground dark:text-muted-foreground">Add text to switch from legacy mode to full-bleed enhanced mode with overlay.</p>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text</Label><Textarea value={(block.text as string) || ''} onChange={(e) => updateBlock(index, { text: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[60px]" placeholder="Enter overlay text..." /></div>
          {hasTextOverlay && (
            <>
              <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
                <Select value={(block.textStyle as string) || 'shorts'} onValueChange={(v) => updateBlock(index, { textStyle: v })}>
                  <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="quote">Quote</SelectItem>
                    <SelectItem value="typing">Typing</SelectItem>
                    <SelectItem value="words">Word by Word</SelectItem>
                    <SelectItem value="glow">Glow</SelectItem>
                    <SelectItem value="outline">Outline</SelectItem>
                    <SelectItem value="bold-glow">Bold Glow</SelectItem>
                    <SelectItem value="shadow">Shadow</SelectItem>
                    <SelectItem value="karaoke">Karaoke (group highlight)</SelectItem>
                    <SelectItem value="karaoke-full">Karaoke Full (all words)</SelectItem>
                    <SelectItem value="shorts">Shorts (pop groups)</SelectItem>
                    <SelectItem value="three-line">Three-Line Teleprompter</SelectItem>
                    <SelectItem value="cinematic">Cinematic</SelectItem>
                    <SelectItem value="neon">Neon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {['shorts', 'three-line', 'words', 'typing', 'karaoke', 'karaoke-full'].includes(block.textStyle as string) && (
                <SliderInput
                  label="Words Per Second"
                  value={(block as any).wordsPerSecond ?? 3}
                  onChange={(v) => updateBlock(index, { wordsPerSecond: v })}
                  min={0.5}
                  max={8}
                  step={0.1}
                  unit=" wps"
                />
              )}
              {(['shorts', 'three-line', 'karaoke'].includes(block.textStyle as string)) && (
                <>
                  <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Words Per Group</Label>
                    <Select value={String((block as any).wordsPerGroup ?? 3)} onValueChange={(v) => updateBlock(index, { wordsPerGroup: parseInt(v) })}>
                      <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 word</SelectItem>
                        <SelectItem value="2">2 words</SelectItem>
                        <SelectItem value="3">3 words</SelectItem>
                        <SelectItem value="4">4 words</SelectItem>
                        <SelectItem value="5">5 words</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <ColorPicker value={(block as any).highlightColor || '#00FF88'} onChange={(v) => updateBlock(index, { highlightColor: v })} label="Highlight Color" />
                  <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle Background</Label>
                    <Select value={(block as any).subtitleBackground ?? 'none'} onValueChange={(v) => updateBlock(index, { subtitleBackground: v })}>
                      <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="pill">Pill</SelectItem>
                        <SelectItem value="bar">Full Bar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Family</Label>
                <Select value={(block as any).fontFamily || 'inter'} onValueChange={(v) => updateBlock(index, { fontFamily: v })}>
                  <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter (Default)</SelectItem>
                    <SelectItem value="roboto">Roboto</SelectItem>
                    <SelectItem value="montserrat">Montserrat</SelectItem>
                    <SelectItem value="oswald">Oswald (Condensed)</SelectItem>
                    <SelectItem value="playfair">Playfair Display (Serif)</SelectItem>
                    <SelectItem value="bebas">Bebas Neue (Display)</SelectItem>
                    <SelectItem value="poppins">Poppins</SelectItem>
                    <SelectItem value="raleway">Raleway</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Size</Label>
                  <Select value={(block.fontSize as string) || 'xlarge'} onValueChange={(v) => updateBlock(index, { fontSize: v })}>
                    <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="small">Small</SelectItem><SelectItem value="medium">Medium</SelectItem><SelectItem value="large">Large</SelectItem>
                      <SelectItem value="xlarge">XLarge</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Weight</Label>
                  <Select value={(block.fontWeight as string) || 'bold'} onValueChange={(v) => updateBlock(index, { fontWeight: v })}>
                    <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="normal">Normal</SelectItem><SelectItem value="bold">Bold</SelectItem><SelectItem value="extrabold">Extra Bold</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Align</Label>
                  <Select value={(block.textAlign as string) || 'center'} onValueChange={(v) => updateBlock(index, { textAlign: v })}>
                    <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Position</Label>
                  <Select value={(block.textPosition as string) || 'bottom'} onValueChange={(v) => updateBlock(index, { textPosition: v })}>
                    <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="top">Top</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="bottom">Bottom</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <ColorPicker value={(block.textColor as string) || '#FFFFFF'} onChange={(v) => updateBlock(index, { textColor: v })} label="Text Color" />
            </>
          )}
        </div>
      </CollapsibleSection>

      {hasTextOverlay && (
        <CollapsibleSection title="Overlay" icon={AlertCircle} defaultOpen={false}>
          <div className="space-y-3">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Overlay Type</Label>
              <Select value={(block as any).overlayType ?? 'gradient-bottom'} onValueChange={(v) => updateBlock(index, { overlayType: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gradient-bottom">Gradient Bottom (cinematic)</SelectItem>
                  <SelectItem value="gradient-top">Gradient Top</SelectItem>
                  <SelectItem value="vignette">Vignette</SelectItem>
                  <SelectItem value="solid">Solid Color</SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(block as any).overlayType === 'solid' && (
              <>
                <div className="flex items-center gap-2">
                  <Switch checked={colorOverlay?.enabled ?? false} onCheckedChange={(v) => updateBlock(index, { colorOverlay: { ...colorOverlay, enabled: v, color: colorOverlay?.color || '#000000', opacity: colorOverlay?.opacity || 0.4 } })} />
                  <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Enable Solid Overlay</Label>
                </div>
                {colorOverlay?.enabled && (
                  <>
                    <ColorPicker value={colorOverlay.color || '#000000'} onChange={(v) => updateBlock(index, { colorOverlay: { ...colorOverlay, color: v } })} label="Color" />
                    <SliderInput label="Opacity" value={colorOverlay.opacity || 0.4} onChange={(v) => updateBlock(index, { colorOverlay: { ...colorOverlay, opacity: v } })} min={0} max={1} step={0.05} unit="" />
                  </>
                )}
              </>
            )}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Audio" icon={MessageCircle} defaultOpen={false}>
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground dark:text-muted-foreground">Narration audio plays alongside the video. Overlay audio is a second track (e.g. music).</p>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Narration Audio URL</Label><Input value={(block.audioSrc as string) || ''} onChange={(e) => updateBlock(index, { audioSrc: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://...mp3" /></div>
          {(block.audioSrc as string) && (
            <div className="p-2 bg-muted dark:bg-card/50 rounded-sm border border-border dark:border-border/30">
              <audio src={block.audioSrc as string} controls className="w-full h-7" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
            </div>
          )}
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Overlay Audio URL (optional)</Label><Input value={(block.overlayAudioSrc as string) || ''} onChange={(e) => updateBlock(index, { overlayAudioSrc: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="https://...mp3" /></div>
          {(block.overlayAudioSrc as string) && <SliderInput label="Overlay Volume" value={(block.overlayAudioVolume as number) ?? 0.7} onChange={(v) => updateBlock(index, { overlayAudioVolume: v })} min={0} max={1} step={0.1} unit="" />}
        </div>
      </CollapsibleSection>
    </>
  );
}

function AvatarGridEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const avatars = (block.avatars as Array<{ name: string; role?: string; image?: string }>) || [];
  return (
    <>
      <CollapsibleSection title="Grid Settings" icon={Users} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Layout</Label>
              <Select value={(block.layout as string) || 'grid'} onValueChange={(v) => updateBlock(index, { layout: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="grid">Grid</SelectItem>
                  <SelectItem value="carousel">Carousel</SelectItem>
                  <SelectItem value="stacked">Stacked</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Columns</Label>
              <Select value={((block.columns as number) || 3).toString()} onValueChange={(v) => updateBlock(index, { columns: parseInt(v) })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="2">2</SelectItem>
                  <SelectItem value="3">3</SelectItem>
                  <SelectItem value="4">4</SelectItem>
                  <SelectItem value="5">5</SelectItem>
                  <SelectItem value="6">6</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Team Members" icon={Users} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { avatars: [...avatars, { name: 'New Member', role: '' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button></div>
          {avatars.map((avatar, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex gap-2">
                <Input value={avatar.name} onChange={(e) => { const n = [...avatars]; n[i] = { ...n[i], name: e.target.value }; updateBlock(index, { avatars: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" placeholder="Name" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { avatars: avatars.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
              </div>
              <Input value={avatar.role || ''} onChange={(e) => { const n = [...avatars]; n[i] = { ...n[i], role: e.target.value }; updateBlock(index, { avatars: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Role" />
              <Input value={avatar.image || ''} onChange={(e) => { const n = [...avatars]; n[i] = { ...n[i], image: e.target.value }; updateBlock(index, { avatars: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Image URL" />
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </>
  );
}

function SocialStatsEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="Social Stats" icon={Share2} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Platform</Label>
          <Select value={(block.platform as string) || 'twitter'} onValueChange={(v) => updateBlock(index, { platform: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="twitter">Twitter/X</SelectItem>
              <SelectItem value="instagram">Instagram</SelectItem>
              <SelectItem value="youtube">YouTube</SelectItem>
              <SelectItem value="tiktok">TikTok</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="facebook">Facebook</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Username</Label><Input value={(block.username as string) || ''} onChange={(e) => updateBlock(index, { username: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="@username" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Followers</Label><Input value={(block.followers as number) || 0} onChange={(e) => updateBlock(index, { followers: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Posts</Label><Input value={(block.posts as number) || 0} onChange={(e) => updateBlock(index, { posts: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Likes</Label><Input value={(block.likes as number) || 0} onChange={(e) => updateBlock(index, { likes: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
        </div>
        <div className="flex items-center gap-2"><Switch checked={(block.verified as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { verified: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Verified</Label></div>
        <div className="flex items-center gap-2"><Switch checked={(block.showGrowth as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showGrowth: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Growth</Label></div>
        {(block.showGrowth as boolean) && <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Growth %</Label><Input value={(block.growthPercentage as number) || 0} onChange={(e) => updateBlock(index, { growthPercentage: parseFloat(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" step="0.1" /></div>}
      </div>
    </CollapsibleSection>
  );
}

function CTAEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <>
      <CollapsibleSection title="CTA Button" icon={MousePointer} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Button Text</Label><Input value={(block.text as string) || ''} onChange={(e) => updateBlock(index, { text: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Description</Label><Textarea value={(block.description as string) || ''} onChange={(e) => updateBlock(index, { description: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[60px]" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
              <Select value={(block.buttonStyle as string) || 'primary'} onValueChange={(v) => updateBlock(index, { buttonStyle: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="secondary">Secondary</SelectItem>
                  <SelectItem value="outline">Outline</SelectItem>
                  <SelectItem value="ghost">Ghost</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Size</Label>
              <Select value={(block.size as string) || 'large'} onValueChange={(v) => updateBlock(index, { size: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <ColorPicker value={(block.color as string) || '#3B82F6'} onChange={(v) => updateBlock(index, { color: v })} label="Button Color" />
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Icon (emoji)</Label><Input value={(block.icon as string) || ''} onChange={(e) => updateBlock(index, { icon: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="🚀" /></div>
          <div className="flex items-center gap-2"><Switch checked={(block.pulse as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { pulse: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Pulse Animation</Label></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Button Style" icon={MousePointer} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Hover Effect</Label>
            <Select value={(block.hoverEffect as string) || 'scale'} onValueChange={(v) => updateBlock(index, { hoverEffect: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="scale">Scale Up</SelectItem>
                <SelectItem value="brighten">Brighten</SelectItem>
                <SelectItem value="darken">Darken</SelectItem>
                <SelectItem value="glow">Glow</SelectItem>
                <SelectItem value="shake">Shake</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Button Shape</Label>
            <Select value={(block.buttonShape as string) || 'rounded'} onValueChange={(v) => updateBlock(index, { buttonShape: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rounded">Rounded</SelectItem>
                <SelectItem value="square">Square</SelectItem>
                <SelectItem value="pill">Pill</SelectItem>
                <SelectItem value="circle">Circle</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Icon Position</Label>
            <Select value={(block.iconPosition as string) || 'left'} onValueChange={(v) => updateBlock(index, { iconPosition: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="left">Left</SelectItem>
                <SelectItem value="right">Right</SelectItem>
                <SelectItem value="top">Top</SelectItem>
                <SelectItem value="none">No Icon</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderInput
            label="Button Width"
            value={(block.buttonWidth as number) || 100}
            onChange={(v) => updateBlock(index, { buttonWidth: v })}
            min={50}
            max={100}
            step={5}
            unit="%"
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function GradientTextEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const gradient = (block.gradient as string[]) || ['#3B82F6', '#8B5CF6'];
  return (
    <CollapsibleSection title="Gradient Text" icon={Palette} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text</Label><Textarea value={(block.text as string) || ''} onChange={(e) => updateBlock(index, { text: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white -[60px]" /></div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Gradient Colors</Label>
          <div className="flex gap-2">
            {gradient.map((color, i) => (
              <div key={i} className="relative">
                <input type="color" value={color} onChange={(e) => { const n = [...gradient]; n[i] = e.target.value; updateBlock(index, { gradient: n }); }} className="w-10 h-10 rounded-sm border border-border dark:border-border cursor-pointer bg-muted dark:bg-card" />
              </div>
            ))}
            <Button variant="outline" size="sm" className="h-10 px-2 bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { gradient: [...gradient, '#EC4899'] })}><Plus className="w-4 h-4" /></Button>
          </div>
        </div>
        <SliderInput label="Angle" value={(block.angle as number) || 45} onChange={(v) => updateBlock(index, { angle: v })} min={0} max={360} step={15} unit="°" />
        <div className="flex items-center gap-2"><Switch checked={(block.animate as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { animate: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Animate Gradient</Label></div>
        {(block.animate as boolean) && <SliderInput label="Animation Speed" value={(block.animationSpeed as number) || 3} onChange={(v) => updateBlock(index, { animationSpeed: v })} min={1} max={10} step={0.5} unit="s" />}
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Size</Label>
            <Select value={(block.fontSize as string) || 'xlarge'} onValueChange={(v) => updateBlock(index, { fontSize: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="small">Small</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="large">Large</SelectItem>
                <SelectItem value="xlarge">XLarge</SelectItem>
                <SelectItem value="xxlarge">XXLarge</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Weight</Label>
            <Select value={(block.fontWeight as string) || 'bold'} onValueChange={(v) => updateBlock(index, { fontWeight: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="bold">Bold</SelectItem>
                <SelectItem value="black">Black</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </CollapsibleSection>
  );
}

function AnimatedBgEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="Animated Background" icon={Waves} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
          <Select value={(block.style as string) || 'particles'} onValueChange={(v) => updateBlock(index, { style: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="particles">Particles</SelectItem>
              <SelectItem value="waves">Waves</SelectItem>
              <SelectItem value="gradient">Gradient Flow</SelectItem>
              <SelectItem value="noise">Noise</SelectItem>
              <SelectItem value="geometric">Geometric</SelectItem>
              <SelectItem value="aurora">Aurora</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ColorPicker value={(block.primaryColor as string) || '#3B82F6'} onChange={(v) => updateBlock(index, { primaryColor: v })} label="Primary Color" />
        <ColorPicker value={(block.secondaryColor as string) || '#8B5CF6'} onChange={(v) => updateBlock(index, { secondaryColor: v })} label="Secondary Color" />
        <SliderInput label="Speed" value={(block.speed as number) || 1} onChange={(v) => updateBlock(index, { speed: v })} min={0.5} max={5} step={0.5} unit="x" />
        <SliderInput label="Intensity" value={(block.intensity as number) || 0.5} onChange={(v) => updateBlock(index, { intensity: v })} min={0.1} max={1} step={0.1} unit="" />
        <div className="flex items-center gap-2"><Switch checked={(block.overlay as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { overlay: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Dark Overlay</Label></div>
        {(block.overlay as boolean) && <SliderInput label="Overlay Opacity" value={(block.overlayOpacity as number) || 0.3} onChange={(v) => updateBlock(index, { overlayOpacity: v })} min={0} max={1} step={0.1} unit="" />}
      </div>
    </CollapsibleSection>
  );
}

function CountdownEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="Countdown Timer" icon={Hourglass} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div className="grid grid-cols-4 gap-2">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Days</Label><Input value={(block.days as number) || 0} onChange={(e) => updateBlock(index, { days: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-center" type="number" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Hours</Label><Input value={(block.hours as number) || 0} onChange={(e) => updateBlock(index, { hours: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-center" type="number" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Min</Label><Input value={(block.minutes as number) || 0} onChange={(e) => updateBlock(index, { minutes: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-center" type="number" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Sec</Label><Input value={(block.seconds as number) || 0} onChange={(e) => updateBlock(index, { seconds: parseInt(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-center" type="number" /></div>
        </div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Style</Label>
          <Select value={(block.style as string) || 'modern'} onValueChange={(v) => updateBlock(index, { style: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">Modern</SelectItem>
              <SelectItem value="classic">Classic</SelectItem>
              <SelectItem value="minimal">Minimal</SelectItem>
              <SelectItem value="flip">Flip</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <ColorPicker value={(block.color as string) || '#FFFFFF'} onChange={(v) => updateBlock(index, { color: v })} label="Color" />
        <div className="flex items-center gap-2"><Switch checked={(block.showLabels as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showLabels: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Labels</Label></div>
      </div>
    </CollapsibleSection>
  );
}

function WeatherEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();

  return (
    <>
      <CollapsibleSection title="Location & Temperature" icon={CloudSun} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Location</Label><Input value={(block.location as string) || 'San Francisco'} onChange={(e) => updateBlock(index, { location: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Temperature</Label><Input value={(block.temperature as number) || 72} onChange={(e) => updateBlock(index, { temperature: parseFloat(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Unit</Label>
              <Select value={(block.unit as string) || 'F'} onValueChange={(v) => updateBlock(index, { unit: v })}>
                <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="F">°F</SelectItem>
                  <SelectItem value="C">°C</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Condition</Label>
            <Select value={(block.condition as string) || 'partly-cloudy'} onValueChange={(v) => updateBlock(index, { condition: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="sunny">☀️ Sunny</SelectItem>
                <SelectItem value="partly-cloudy">⛅ Partly Cloudy</SelectItem>
                <SelectItem value="cloudy">☁️ Cloudy</SelectItem>
                <SelectItem value="rainy">🌧️ Rainy</SelectItem>
                <SelectItem value="stormy">⛈️ Stormy</SelectItem>
                <SelectItem value="snowy">❄️ Snowy</SelectItem>
                <SelectItem value="windy">💨 Windy</SelectItem>
                <SelectItem value="foggy">🌫️ Foggy</SelectItem>
                <SelectItem value="night-clear">🌙 Night Clear</SelectItem>
                <SelectItem value="night-cloudy">☁️ Night Cloudy</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Description</Label><Input value={(block.description as string) || ''} onChange={(e) => updateBlock(index, { description: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Partly cloudy" /></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Details" icon={Palette} defaultOpen={false}>
        <div className="space-y-3">
          <SliderInput label="Humidity" value={(block.humidity as number) || 65} onChange={(v) => updateBlock(index, { humidity: v })} min={0} max={100} step={1} unit="%" />
          <SliderInput label="Wind Speed" value={(block.windSpeed as number) || 12} onChange={(v) => updateBlock(index, { windSpeed: v })} min={0} max={100} step={1} unit=" mph" />
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">High Temp</Label><Input value={(block.highTemp as number) || 78} onChange={(e) => updateBlock(index, { highTemp: parseFloat(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
            <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Low Temp</Label><Input value={(block.lowTemp as number) || 58} onChange={(e) => updateBlock(index, { lowTemp: parseFloat(e.target.value) || 0 })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" type="number" /></div>
          </div>
          <div className="flex items-center gap-2"><Switch checked={(block.showForecast as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showForecast: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show High/Low</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.showDetails as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showDetails: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Humidity & Wind</Label></div>
        </div>
      </CollapsibleSection>
      <CollapsibleSection title="Style" icon={Palette} defaultOpen={false}>
        <div className="space-y-3">
          <ColorPicker value={(block.accentColor as string) || '#38BDF8'} onChange={(v) => updateBlock(index, { accentColor: v })} label="Accent Color" />
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Card Style</Label>
            <Select value={(block.cardStyle as string) || 'glass'} onValueChange={(v) => updateBlock(index, { cardStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="glass">Glass Effect</SelectItem>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="minimal">Minimal</SelectItem>
                <SelectItem value="gradient">Gradient</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2"><Switch checked={(block.animateIcon as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { animateIcon: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Animate Icon</Label></div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function TowerChart3DEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const items = (block.items as Array<{ rank: number; name: string; value: number; valueFormatted?: string; subtitle?: string; color?: string; image?: string }>) || [];

  const updateItem = (itemIndex: number, field: string, value: unknown) => {
    const newItems = [...items];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    updateBlock(index, { items: newItems });
  };

  const addItem = () => {
    const newRank = items.length + 1;
    updateBlock(index, { items: [...items, { rank: newRank, name: `Item ${newRank}`, value: 1000 * newRank, valueFormatted: `${newRank}K`, subtitle: 'Category' }] });
  };

  const removeItem = (itemIndex: number) => {
    const newItems = items.filter((_, i) => i !== itemIndex).map((item, i) => ({ ...item, rank: i + 1 }));
    updateBlock(index, { items: newItems });
  };

  const moveItem = (itemIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[itemIndex], newItems[newIndex]] = [newItems[newIndex], newItems[itemIndex]];
    const reordered = newItems.map((item, i) => ({ ...item, rank: i + 1 }));
    updateBlock(index, { items: reordered });
  };

  return (
    <>
      <CollapsibleSection title="Title" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Top Rankings" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Optional description" /></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={`Items (${items.length})`} icon={BarChart3} defaultOpen={true}>
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground">#{item.rank}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveItem(i, 'up')} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveItem(i, 'down')} disabled={i === items.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Name" />
                <Input value={item.value.toString()} onChange={(e) => updateItem(i, 'value', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" type="number" placeholder="Value" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={item.valueFormatted || ''} onChange={(e) => updateItem(i, 'valueFormatted', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="$1.5M" />
                <Input value={item.subtitle || ''} onChange={(e) => updateItem(i, 'subtitle', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Category" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex gap-1">
                  <input type="color" value={item.color || '#3B82F6'} onChange={(e) => updateItem(i, 'color', e.target.value)} className="w-8 h-8 rounded p-0.5 bg-transparent border-0" />
                  <Input value={item.color || ''} onChange={(e) => updateItem(i, 'color', e.target.value || undefined)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs flex-1" placeholder="Color" />
                </div>
                <Input value={item.image || ''} onChange={(e) => updateItem(i, 'image', e.target.value || undefined)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Image URL" />
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-3 bg-muted dark:bg-card border-border dark:border-border" onClick={addItem}>
          <Plus className="w-3 h-3 mr-1" /> Add Item
        </Button>
      </CollapsibleSection>

      <CollapsibleSection title="Colors" icon={Palette} defaultOpen={false}>
        <div className="space-y-3">
          <ColorPicker value={(block.gradientStart as string) || '#6366F1'} onChange={(v) => updateBlock(index, { gradientStart: v })} label="Gradient Start" />
          <ColorPicker value={(block.gradientEnd as string) || '#EC4899'} onChange={(v) => updateBlock(index, { gradientEnd: v })} label="Gradient End" />
          <div className="flex items-center gap-2"><Switch checked={(block.useGradientByRank as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { useGradientByRank: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Use Gradient by Rank</Label></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Camera" icon={Move} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Animation Direction</Label>
            <Select value={(block.animationDirection as string) || 'top-to-bottom'} onValueChange={(v) => updateBlock(index, { animationDirection: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Select direction" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                <SelectItem value="top-to-bottom" className="text-foreground dark:text-white">Top to Bottom (Rank 1 → 10)</SelectItem>
                <SelectItem value="bottom-to-top" className="text-foreground dark:text-white">Bottom to Top (Rank 10 → 1)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderInput label="Camera Distance" value={(block.cameraDistance as number) || 25} onChange={(v) => updateBlock(index, { cameraDistance: v })} min={15} max={50} step={5} unit="" />
          <SliderInput label="Camera Angle" value={(block.cameraAngle as number) || 25} onChange={(v) => updateBlock(index, { cameraAngle: v })} min={0} max={60} step={5} unit="°" />
          <SliderInput label="Pause Duration" value={(block.cameraPauseDuration as number) || 0.5} onChange={(v) => updateBlock(index, { cameraPauseDuration: v })} min={0.2} max={2} step={0.1} unit="s" />
          <SliderInput label="Move Speed" value={(block.cameraMoveSpeed as number) || 0.6} onChange={(v) => updateBlock(index, { cameraMoveSpeed: v })} min={0.3} max={2} step={0.1} unit="s" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Scene" icon={Layers} defaultOpen={false}>
        <div className="space-y-3">
          {/* Background Preset Selector */}
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Background Environment</Label>
            <Select value={(block.backgroundPreset as string) || 'cyber-grid'} onValueChange={(v) => updateBlock(index, { backgroundPreset: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Select environment" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border max-h-64 overflow-y-auto">
                {/* Basic Presets */}
                <SelectItem value="none" className="text-foreground dark:text-white">✨ None (Stars only)</SelectItem>
                <SelectItem value="cyber-grid" className="text-foreground dark:text-white">🌟 Cyber Grid (Neon)</SelectItem>
                <SelectItem value="mountain-range" className="text-foreground dark:text-white">🏔️ Mountain Range</SelectItem>
                <SelectItem value="ocean-waves" className="text-foreground dark:text-white">🌊 Ocean Waves</SelectItem>
                <SelectItem value="forest-trees" className="text-foreground dark:text-white">🌲 Forest Trees</SelectItem>
                <SelectItem value="city-skyline" className="text-foreground dark:text-white">🏙️ City Skyline</SelectItem>
                <SelectItem value="abstract-waves" className="text-foreground dark:text-white">〰️ Abstract Waves</SelectItem>
                <SelectItem value="space-station" className="text-foreground dark:text-white">🚀 Space Station</SelectItem>
                {/* Advanced Presets */}
                <SelectItem value="aurora-borealis" className="text-foreground dark:text-white">🌌 Aurora Borealis</SelectItem>
                <SelectItem value="volcanic-inferno" className="text-foreground dark:text-white">🌋 Volcanic Inferno</SelectItem>
                <SelectItem value="crystal-caves" className="text-foreground dark:text-white">💎 Crystal Caves</SelectItem>
                <SelectItem value="desert-dunes" className="text-foreground dark:text-white">🏜️ Desert Dunes</SelectItem>
                <SelectItem value="neon-tokyo" className="text-foreground dark:text-white">🏯 Neon Tokyo</SelectItem>
                <SelectItem value="floating-islands" className="text-foreground dark:text-white">🏝️ Floating Islands</SelectItem>
                <SelectItem value="deep-ocean" className="text-foreground dark:text-white">🪸 Deep Ocean</SelectItem>
                <SelectItem value="galaxy-nebula" className="text-foreground dark:text-white">🌠 Galaxy Nebula</SelectItem>
                <SelectItem value="matrix-rain" className="text-foreground dark:text-white">💧 Matrix Rain</SelectItem>
                <SelectItem value="ice-glacier" className="text-foreground dark:text-white">❄️ Ice Glacier</SelectItem>
                <SelectItem value="steampunk-gears" className="text-foreground dark:text-white">⚙️ Steampunk Gears</SelectItem>
                <SelectItem value="alien-planet" className="text-foreground dark:text-white">👽 Alien Planet</SelectItem>
                <SelectItem value="tron-grid" className="text-foreground dark:text-white">🔷 Tron Grid</SelectItem>
                {/* Immersive Environments - Towers appear WITHIN these */}
                <SelectItem value="football-stadium" className="text-foreground dark:text-white">⚽ Football Stadium</SelectItem>
                <SelectItem value="race-track" className="text-foreground dark:text-white">🏎️ Race Track</SelectItem>
                <SelectItem value="concert-stage" className="text-foreground dark:text-white">🎸 Concert Stage</SelectItem>
                <SelectItem value="castle-grounds" className="text-foreground dark:text-white">🏰 Castle Grounds</SelectItem>
                <SelectItem value="airport-runway" className="text-foreground dark:text-white">✈️ Airport Runway</SelectItem>
                <SelectItem value="theme-park" className="text-foreground dark:text-white">🎢 Theme Park</SelectItem>
                <SelectItem value="ancient-ruins" className="text-foreground dark:text-white">🏛️ Ancient Ruins</SelectItem>
                <SelectItem value="zen-garden" className="text-foreground dark:text-white">🎋 Zen Garden</SelectItem>
                <SelectItem value="ski-resort" className="text-foreground dark:text-white">🎿 Ski Resort</SelectItem>
                <SelectItem value="vineyard" className="text-foreground dark:text-white">🍇 Vineyard</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ColorPicker value={(block.backgroundColor as string) || '#0d0d1a'} onChange={(v) => updateBlock(index, { backgroundColor: v })} label="Background" />
          <ColorPicker value={(block.groundColor as string) || '#1a1a2e'} onChange={(v) => updateBlock(index, { groundColor: v })} label="Ground" />
          <SliderInput label="Tower Spacing" value={(block.towerSpacing as number) || 5} onChange={(v) => updateBlock(index, { towerSpacing: v })} min={3} max={10} step={1} unit="" />
          <SliderInput label="Base Height" value={(block.baseHeight as number) || 2} onChange={(v) => updateBlock(index, { baseHeight: v })} min={1} max={5} step={1} unit="" />
          <SliderInput label="Max Height" value={(block.maxHeight as number) || 25} onChange={(v) => updateBlock(index, { maxHeight: v })} min={10} max={50} step={5} unit="" />
          <div className="flex items-center gap-2"><Switch checked={(block.showGround as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showGround: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Ground</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.showLabels3D as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showLabels3D: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Labels</Label></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Custom 3D Model" icon={Box} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Model Path (GLB file)</Label>
            <Input
              value={(block.customModelPath as string) || ''}
              onChange={(e) => updateBlock(index, { customModelPath: e.target.value || undefined })}
              className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1"
              placeholder="/models/your-model.glb"
            />
            <p className="text-[10px] text-muted-foreground dark:text-muted-foreground mt-1">Upload GLB files to /public/models/ folder</p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">X Position</Label>
              <Input
                type="number"
                value={((block.customModelPosition as { x?: number; y?: number; z?: number })?.x) ?? 0}
                onChange={(e) => updateBlock(index, {
                  customModelPosition: {
                    ...((block.customModelPosition as { x?: number; y?: number; z?: number }) || { x: 0, y: 35, z: -60 }),
                    x: parseFloat(e.target.value) || 0
                  }
                })}
                className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Y Position</Label>
              <Input
                type="number"
                value={((block.customModelPosition as { x?: number; y?: number; z?: number })?.y) ?? 35}
                onChange={(e) => updateBlock(index, {
                  customModelPosition: {
                    ...((block.customModelPosition as { x?: number; y?: number; z?: number }) || { x: 0, y: 35, z: -60 }),
                    y: parseFloat(e.target.value) || 35
                  }
                })}
                className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Z Position</Label>
              <Input
                type="number"
                value={((block.customModelPosition as { x?: number; y?: number; z?: number })?.z) ?? -60}
                onChange={(e) => updateBlock(index, {
                  customModelPosition: {
                    ...((block.customModelPosition as { x?: number; y?: number; z?: number }) || { x: 0, y: 35, z: -60 }),
                    z: parseFloat(e.target.value) || -60
                  }
                })}
                className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1"
              />
            </div>
          </div>

          <SliderInput
            label="Model Scale"
            value={(block.customModelScale as number) || 2}
            onChange={(v) => updateBlock(index, { customModelScale: v })}
            min={0.5} max={10} step={0.5} unit=""
          />

          <SliderInput
            label="Model Rotation"
            value={(block.customModelRotation as number) || 0}
            onChange={(v) => updateBlock(index, { customModelRotation: v })}
            min={0} max={360} step={15} unit="°"
          />
        </div>
      </CollapsibleSection>
    </>
  );
}

function BarRace3DEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const items = (block.items as Array<{ rank: number; name: string; value: number; valueFormatted?: string; subtitle?: string; color?: string }>) || [];

  const updateItem = (itemIndex: number, field: string, value: unknown) => {
    const newItems = [...items];
    newItems[itemIndex] = { ...newItems[itemIndex], [field]: value };
    updateBlock(index, { items: newItems });
  };

  const addItem = () => {
    const newRank = items.length + 1;
    updateBlock(index, { items: [...items, { rank: newRank, name: `Item ${newRank}`, value: 100 * newRank, valueFormatted: `${newRank * 100}`, subtitle: 'Category' }] });
  };

  const removeItem = (itemIndex: number) => {
    const newItems = items.filter((_, i) => i !== itemIndex).map((item, i) => ({ ...item, rank: i + 1 }));
    updateBlock(index, { items: newItems });
  };

  const moveItem = (itemIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? itemIndex - 1 : itemIndex + 1;
    if (newIndex < 0 || newIndex >= items.length) return;
    const newItems = [...items];
    [newItems[itemIndex], newItems[newIndex]] = [newItems[newIndex], newItems[itemIndex]];
    const reordered = newItems.map((item, i) => ({ ...item, rank: i + 1 }));
    updateBlock(index, { items: reordered });
  };

  return (
    <>
      <CollapsibleSection title="Title" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Market Share Battle" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Optional description" /></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={`Items (${items.length})`} icon={BarChart3} defaultOpen={true}>
        <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
          {items.map((item, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground dark:text-muted-foreground">#{item.rank}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveItem(i, 'up')} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => moveItem(i, 'down')} disabled={i === items.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => removeItem(i)}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={item.name} onChange={(e) => updateItem(i, 'name', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Name" />
                <Input value={item.value.toString()} onChange={(e) => updateItem(i, 'value', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" type="number" placeholder="Value" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={item.valueFormatted || ''} onChange={(e) => updateItem(i, 'valueFormatted', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="$1.5M" />
                <Input value={item.subtitle || ''} onChange={(e) => updateItem(i, 'subtitle', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Category" />
              </div>
              <div className="flex gap-1">
                <input type="color" value={item.color || '#10B981'} onChange={(e) => updateItem(i, 'color', e.target.value)} className="w-8 h-8 rounded p-0.5 bg-transparent border-0" />
                <Input value={item.color || ''} onChange={(e) => updateItem(i, 'color', e.target.value || undefined)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs flex-1" placeholder="Color" />
              </div>
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-3 bg-muted dark:bg-card border-border dark:border-border" onClick={addItem}>
          <Plus className="w-3 h-3 mr-1" /> Add Item
        </Button>
      </CollapsibleSection>

      <CollapsibleSection title="Colors" icon={Palette} defaultOpen={false}>
        <div className="space-y-3">
          <ColorPicker value={(block.backgroundColor as string) || '#0a0a1a'} onChange={(v) => updateBlock(index, { backgroundColor: v })} label="Background" />
          <ColorPicker value={(block.groundColor as string) || '#151525'} onChange={(v) => updateBlock(index, { groundColor: v })} label="Ground" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Camera" icon={Move} defaultOpen={false}>
        <div className="space-y-3">
          <SliderInput label="Camera Distance" value={(block.cameraDistance as number) || 35} onChange={(v) => updateBlock(index, { cameraDistance: v })} min={20} max={60} step={5} unit="" />
          <SliderInput label="Camera Angle" value={(block.cameraAngle as number) || 30} onChange={(v) => updateBlock(index, { cameraAngle: v })} min={0} max={60} step={5} unit="°" />
          <SliderInput label="Animation Speed" value={(block.animationSpeed as number) || 1} onChange={(v) => updateBlock(index, { animationSpeed: v })} min={0.5} max={3} step={0.1} unit="x" />
          <SliderInput label="Rank Change Speed" value={(block.rankChangeSpeed as number) || 0.8} onChange={(v) => updateBlock(index, { rankChangeSpeed: v })} min={0.3} max={2} step={0.1} unit="s" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Bars" icon={BarChart3} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Bar Style</Label>
            <Select value={(block.barStyle as string) || 'rounded'} onValueChange={(v) => updateBlock(index, { barStyle: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                <SelectItem value="rounded" className="text-foreground dark:text-white">Rounded</SelectItem>
                <SelectItem value="square" className="text-foreground dark:text-white">Square</SelectItem>
                <SelectItem value="cylindrical" className="text-foreground dark:text-white">Cylindrical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderInput label="Bar Spacing" value={(block.barSpacing as number) || 3.5} onChange={(v) => updateBlock(index, { barSpacing: v })} min={2} max={6} step={0.5} unit="" />
          <SliderInput label="Bar Height" value={(block.barHeight as number) || 2.5} onChange={(v) => updateBlock(index, { barHeight: v })} min={1} max={5} step={0.5} unit="" />
          <SliderInput label="Bar Depth" value={(block.barDepth as number) || 2} onChange={(v) => updateBlock(index, { barDepth: v })} min={1} max={4} step={0.5} unit="" />
          <SliderInput label="Max Bar Width" value={(block.maxBarWidth as number) || 30} onChange={(v) => updateBlock(index, { maxBarWidth: v })} min={15} max={50} step={5} unit="" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Scene" icon={Layers} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex items-center gap-2"><Switch checked={(block.showGround as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showGround: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Ground</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.showLabels3D as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showLabels3D: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Labels</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.showValueLabels as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showValueLabels: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Values</Label></div>
          <div className="flex items-center gap-2"><Switch checked={(block.showRankNumbers as boolean) ?? true} onCheckedChange={(v) => updateBlock(index, { showRankNumbers: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Show Ranks</Label></div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function ParallaxStoryEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const layers = (block.layers as Array<{
    id?: string;
    name: string;
    image: string;
    depth: number;
    parallaxFactor: number;
    cameraIntensity?: number;
    scale: number;
    opacity: number;
    positionX: number;
    positionY: number;
    rotation: number;
    blur: number;
    blendMode: string;
    motionEnabled?: boolean;
    motionDirection?: string;
    motionSpeed?: number;
    motionIntensity?: number;
    motionOscillate?: boolean;
    motionOscillateSpeed?: number;
    animationIn?: string;
    animationOut?: string;
    animationDelay?: number;
    animationDuration?: number;
    animationEasing?: string;
  }>) || [];

  const [expandedLayer, setExpandedLayer] = useState<number | null>(0);

  const updateLayer = (layerIndex: number, field: string, value: unknown) => {
    const newLayers = [...layers];
    newLayers[layerIndex] = { ...newLayers[layerIndex], [field]: value };
    updateBlock(index, { layers: newLayers });
  };

  const addLayer = () => {
    const newLayer = {
      id: `layer-${Date.now()}`,
      name: `Layer ${layers.length + 1}`,
      image: '',
      depth: 50,
      parallaxFactor: 1,
      cameraIntensity: 1,
      scale: 1,
      opacity: 1,
      positionX: 0,
      positionY: 0,
      rotation: 0,
      blur: 0,
      blendMode: 'normal',
      motionEnabled: true,
      motionDirection: 'right',
      motionSpeed: 1,
      motionIntensity: 1,
      motionOscillate: false,
      motionOscillateSpeed: 1,
      animationIn: 'fade',
      animationOut: 'fade',
      animationDelay: 0,
      animationDuration: 1,
      animationEasing: 'ease-out',
    };
    updateBlock(index, { layers: [...layers, newLayer] });
  };

  const removeLayer = (layerIndex: number) => {
    const newLayers = layers.filter((_, i) => i !== layerIndex);
    updateBlock(index, { layers: newLayers });
  };

  const duplicateLayer = (layerIndex: number) => {
    const newLayer = { ...layers[layerIndex], id: `layer-${Date.now()}`, name: `${layers[layerIndex].name} (copy)` };
    updateBlock(index, { layers: [...layers, newLayer] });
  };

  const textOverlays = (block.textOverlays as Array<{
    text: string;
    position: string;
    customX?: number;
    customY?: number;
    fontSize?: string;
    fontWeight?: string;
    color?: string;
    startTime?: number;
    duration?: number;
  }>) || [];

  const addTextOverlay = () => {
    const newText = {
      text: 'New Text',
      position: 'center',
      customX: 50,
      customY: 50,
      fontSize: 'large',
      fontWeight: 'bold',
      color: '#FFFFFF',
      startTime: 0,
      duration: 3,
    };
    updateBlock(index, { textOverlays: [...textOverlays, newText] });
  };

  const updateTextOverlay = (textIndex: number, field: string, value: unknown) => {
    const newTexts = [...textOverlays];
    newTexts[textIndex] = { ...newTexts[textIndex], [field]: value };
    updateBlock(index, { textOverlays: newTexts });
  };

  const removeTextOverlay = (textIndex: number) => {
    const newTexts = textOverlays.filter((_, i) => i !== textIndex);
    updateBlock(index, { textOverlays: newTexts });
  };

  const motionDirections = [
    { value: 'none', label: 'None' },
    { value: 'left', label: '← Left' },
    { value: 'right', label: '→ Right' },
    { value: 'up', label: '↑ Up' },
    { value: 'down', label: '↓ Down' },
    { value: 'diagonal-tl-br', label: '↘ TL→BR' },
    { value: 'diagonal-tr-bl', label: '↙ TR→BL' },
    { value: 'diagonal-bl-tr', label: '↗ BL→TR' },
    { value: 'diagonal-br-tl', label: '↖ BR→TL' },
    { value: 'zoom-in', label: '🔍 Zoom In' },
    { value: 'zoom-out', label: '🔎 Zoom Out' },
    { value: 'rotate-cw', label: '↻ Rotate CW' },
    { value: 'rotate-ccw', label: '↺ Rotate CCW' },
    { value: 'float', label: '🎈 Float' },
    { value: 'pulse', label: '💓 Pulse' },
  ];

  const animationInOptions = [
    { value: 'none', label: 'None' },
    { value: 'fade', label: 'Fade' },
    { value: 'slide-left', label: '← Slide Left' },
    { value: 'slide-right', label: '→ Slide Right' },
    { value: 'slide-up', label: '↑ Slide Up' },
    { value: 'slide-down', label: '↓ Slide Down' },
    { value: 'zoom-in', label: '🔍 Zoom In' },
    { value: 'zoom-out', label: '🔎 Zoom Out' },
    { value: 'rotate-in', label: '↻ Rotate In' },
    { value: 'flip-x', label: '↕ Flip X' },
    { value: 'flip-y', label: '↔ Flip Y' },
    { value: 'bounce', label: '⬆ Bounce' },
    { value: 'blur-in', label: '🌫 Blur In' },
  ];

  const easingOptions = [
    { value: 'linear', label: 'Linear' },
    { value: 'ease', label: 'Ease' },
    { value: 'ease-in', label: 'Ease In' },
    { value: 'ease-out', label: 'Ease Out' },
    { value: 'ease-in-out', label: 'Ease In Out' },
    { value: 'bounce', label: 'Bounce' },
    { value: 'elastic', label: 'Elastic' },
  ];

  const cameraMovements = [
    { value: 'none', label: 'None' },
    { value: 'pan-left', label: 'Pan Left' },
    { value: 'pan-right', label: 'Pan Right' },
    { value: 'pan-up', label: 'Pan Up' },
    { value: 'pan-down', label: 'Pan Down' },
    { value: 'zoom-in', label: 'Zoom In' },
    { value: 'zoom-out', label: 'Zoom Out' },
    { value: 'diagonal-tl-br', label: 'Diagonal TL→BR' },
    { value: 'diagonal-tr-bl', label: 'Diagonal TR→BL' },
    { value: 'orbit', label: 'Orbit' },
    { value: 'breathing', label: 'Breathing' },
  ];

  const effects = [
    { value: 'none', label: 'None' },
    { value: 'particles', label: 'Particles' },
    { value: 'light-rays', label: 'Light Rays' },
    { value: 'fog', label: 'Fog' },
    { value: 'rain', label: 'Rain' },
    { value: 'snow', label: 'Snow' },
    { value: 'bokeh', label: 'Bokeh' },
    { value: 'vignette', label: 'Vignette' },
    { value: 'film-grain', label: 'Film Grain' },
    { value: 'chromatic', label: 'Chromatic' },
    { value: 'glow', label: 'Glow' },
  ];

  const colorGrades = [
    { value: 'none', label: 'None' },
    { value: 'cinematic', label: 'Cinematic' },
    { value: 'vintage', label: 'Vintage' },
    { value: 'cold', label: 'Cold' },
    { value: 'warm', label: 'Warm' },
    { value: 'noir', label: 'Noir' },
    { value: 'sepia', label: 'Sepia' },
    { value: 'neon', label: 'Neon' },
  ];

  const selectedEffects = (block.effects as string[]) || [];

  const toggleEffect = (effect: string) => {
    if (selectedEffects.includes(effect)) {
      updateBlock(index, { effects: selectedEffects.filter(e => e !== effect) });
    } else {
      updateBlock(index, { effects: [...selectedEffects, effect] });
    }
  };

  return (
    <>
      <CollapsibleSection title="Title" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Story title" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Optional description" /></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={`Layers (${layers.length})`} icon={Layers} defaultOpen={true}>
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {layers.map((layer, i) => (
            <div key={layer.id || i} className="bg-muted dark:bg-card/50 rounded-sm border border-border dark:border-border/30 overflow-hidden">
              {/* Layer Header - Clickable */}
              <button
                className="w-full flex items-center justify-between p-3 hover:bg-gray-700/30"
                onClick={() => setExpandedLayer(expandedLayer === i ? null : i)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-muted-foreground">{layer.name || `Layer ${i + 1}`}</span>
                  <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">Depth: {layer.depth}</span>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground dark:text-muted-foreground hover:text-foreground dark:text-white" onClick={(e) => { e.stopPropagation(); duplicateLayer(i); }}><Copy className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={(e) => { e.stopPropagation(); removeLayer(i); }}><Trash2 className="w-3 h-3" /></Button>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground dark:text-muted-foreground  ${expandedLayer === i ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {/* Expanded Content */}
              {expandedLayer === i && (
                <div className="p-3 pt-0 space-y-3 border-t border-border dark:border-border/30">
                  {/* Image URL */}
                  <div>
                    <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Image URL</Label>
                    <Input value={layer.image} onChange={(e) => updateLayer(i, 'image', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="https://..." />
                    {layer.image && <img src={layer.image} alt="preview" className="mt-1 w-full h-16 object-cover rounded" />}
                  </div>

                  {/* Image Fit Options */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Image Fit</Label>
                      <Select value={(layer as Record<string, unknown>).imageFit as string || 'cover'} onValueChange={(v) => updateLayer(i, 'imageFit', v)}>
                        <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                          <SelectItem value="cover" className="text-foreground dark:text-white">Cover (Crop)</SelectItem>
                          <SelectItem value="contain" className="text-foreground dark:text-white">Contain (No Crop)</SelectItem>
                          <SelectItem value="fill" className="text-foreground dark:text-white">Fill (Stretch)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Position</Label>
                      <Select value={(layer as Record<string, unknown>).imagePosition as string || 'center'} onValueChange={(v) => updateLayer(i, 'imagePosition', v)}>
                        <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                          <SelectItem value="center" className="text-foreground dark:text-white">Center</SelectItem>
                          <SelectItem value="top" className="text-foreground dark:text-white">Top</SelectItem>
                          <SelectItem value="bottom" className="text-foreground dark:text-white">Bottom</SelectItem>
                          <SelectItem value="left" className="text-foreground dark:text-white">Left</SelectItem>
                          <SelectItem value="right" className="text-foreground dark:text-white">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Basic Settings Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Layer Name</Label>
                      <Input value={layer.name} onChange={(e) => updateLayer(i, 'name', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Depth (0-100)</Label>
                      <Input type="number" value={layer.depth} onChange={(e) => updateLayer(i, 'depth', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                  </div>

                  {/* Transform Row */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Scale</Label>
                      <Input type="number" step="0.1" value={layer.scale} onChange={(e) => updateLayer(i, 'scale', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Opacity</Label>
                      <Input type="number" step="0.1" min="0" max="1" value={layer.opacity} onChange={(e) => updateLayer(i, 'opacity', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Blur</Label>
                      <Input type="number" value={layer.blur} onChange={(e) => updateLayer(i, 'blur', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                  </div>

                  {/* Position Row */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Offset X (%)</Label>
                      <Input type="number" value={layer.positionX} onChange={(e) => updateLayer(i, 'positionX', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Offset Y (%)</Label>
                      <Input type="number" value={layer.positionY} onChange={(e) => updateLayer(i, 'positionY', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                  </div>

                  {/* Camera Response Section */}
                  <div className="pt-2 border-t border-border dark:border-border/30">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-muted-foreground">Camera Response</span>
                      <span className="text-[10px] text-muted-foreground dark:text-muted-foreground">{((layer.cameraIntensity ?? 1) * 100).toFixed(0)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={layer.cameraIntensity ?? 1}
                      onChange={(e) => updateLayer(i, 'cameraIntensity', parseFloat(e.target.value))}
                      className="w-full h-1.5 bg-gray-700 rounded-sm appearance-none cursor-pointer accent-pink-500"
                    />
                    <div className="flex justify-between text-[9px] text-muted-foreground dark:text-muted-foreground mt-1">
                      <span>Static</span>
                      <span>Normal</span>
                      <span>Double</span>
                    </div>
                  </div>

                  {/* Motion Section */}
                  <div className="pt-2 border-t border-border dark:border-border/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Motion</span>
                      <Switch checked={layer.motionEnabled ?? true} onCheckedChange={(v) => updateLayer(i, 'motionEnabled', v)} />
                    </div>

                    {layer.motionEnabled !== false && (
                      <div className="space-y-2">
                        <div>
                          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Direction</Label>
                          <Select value={layer.motionDirection || 'right'} onValueChange={(v) => updateLayer(i, 'motionDirection', v)}>
                            <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-muted dark:bg-card border-border dark:border-border max-h-48 overflow-y-auto">
                              {motionDirections.map(m => (
                                <SelectItem key={m.value} value={m.value} className="text-foreground dark:text-white">{m.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Speed</Label>
                            <Input type="number" step="0.1" min="0" max="5" value={layer.motionSpeed || 1} onChange={(e) => updateLayer(i, 'motionSpeed', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                          </div>
                          <div>
                            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Intensity</Label>
                            <Input type="number" step="0.1" min="0" max="3" value={layer.motionIntensity || 1} onChange={(e) => updateLayer(i, 'motionIntensity', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch checked={layer.motionOscillate || false} onCheckedChange={(v) => updateLayer(i, 'motionOscillate', v)} />
                          <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Oscillate (back & forth)</Label>
                        </div>

                        {layer.motionOscillate && (
                          <div>
                            <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Oscillate Speed</Label>
                            <Input type="number" step="0.1" min="0.5" max="5" value={layer.motionOscillateSpeed || 1} onChange={(e) => updateLayer(i, 'motionOscillateSpeed', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Animation Section */}
                  <div className="pt-2 border-t border-border dark:border-border/30">
                    <span className="text-xs font-medium text-muted-foreground">Entrance Animation</span>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Type</Label>
                        <Select value={layer.animationIn || 'fade'} onValueChange={(v) => updateLayer(i, 'animationIn', v)}>
                          <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-muted dark:bg-card border-border dark:border-border max-h-48 overflow-y-auto">
                            {animationInOptions.map(a => (
                              <SelectItem key={a.value} value={a.value} className="text-foreground dark:text-white">{a.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Easing</Label>
                        <Select value={layer.animationEasing || 'ease-out'} onValueChange={(v) => updateLayer(i, 'animationEasing', v)}>
                          <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                            {easingOptions.map(e => (
                              <SelectItem key={e.value} value={e.value} className="text-foreground dark:text-white">{e.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Delay (s)</Label>
                        <Input type="number" step="0.1" min="0" max="5" value={layer.animationDelay || 0} onChange={(e) => updateLayer(i, 'animationDelay', parseFloat(e.target.value) || 0)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Duration (s)</Label>
                        <Input type="number" step="0.1" min="0.1" max="5" value={layer.animationDuration || 1} onChange={(e) => updateLayer(i, 'animationDuration', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-3 bg-muted dark:bg-card border-border dark:border-border" onClick={addLayer}>
          <Plus className="w-3 h-3 mr-1" /> Add Layer
        </Button>
      </CollapsibleSection>

      <CollapsibleSection title="Camera" icon={Move} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Movement</Label>
            <Select value={(block.cameraMovement as string) || 'pan-right'} onValueChange={(v) => updateBlock(index, { cameraMovement: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Select movement" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border max-h-48 overflow-y-auto">
                {cameraMovements.map(m => (
                  <SelectItem key={m.value} value={m.value} className="text-foreground dark:text-white">{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderInput label="Speed" value={(block.cameraSpeed as number) || 1} onChange={(v) => updateBlock(index, { cameraSpeed: v })} min={0.1} max={5} step={0.1} unit="x" />
          <SliderInput label="Intensity" value={(block.cameraIntensity as number) || 1} onChange={(v) => updateBlock(index, { cameraIntensity: v })} min={0.1} max={2} step={0.1} unit="" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Effects" icon={Sparkles} defaultOpen={false}>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1">
            {effects.filter(e => e.value !== 'none').map(e => (
              <button
                key={e.value}
                onClick={() => toggleEffect(e.value)}
                className={`px-2 py-1 rounded text-xs  ${
                  selectedEffects.includes(e.value)
                    ? 'bg-pink-500/30 text-pink-300 border border-pink-500/50'
                    : 'bg-muted dark:bg-card/50 text-muted-foreground dark:text-muted-foreground border border-border dark:border-border/30'
                }`}
              >
                {e.label}
              </button>
            ))}
          </div>
          <SliderInput label="Effect Intensity" value={(block.effectIntensity as number) || 0} onChange={(v) => updateBlock(index, { effectIntensity: v })} min={0} max={1} step={0.1} unit="" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Color Grade" icon={Palette} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Preset</Label>
            <Select value={(block.colorGrade as string) || 'none'} onValueChange={(v) => updateBlock(index, { colorGrade: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Select grade" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border max-h-48 overflow-y-auto">
                {colorGrades.map(g => (
                  <SelectItem key={g.value} value={g.value} className="text-foreground dark:text-white">{g.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <SliderInput label="Color Intensity" value={(block.colorIntensity as number) || 1} onChange={(v) => updateBlock(index, { colorIntensity: v })} min={0} max={1} step={0.1} unit="" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Text" icon={Type} defaultOpen={false}>
        <div className="space-y-3">
          {/* Text Mode Selector */}
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text Mode</Label>
            <Select value={(block.textMode as string) || 'none'} onValueChange={(v) => updateBlock(index, { textMode: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Select text mode" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                <SelectItem value="none" className="text-foreground dark:text-white">None</SelectItem>
                <SelectItem value="overlays" className="text-foreground dark:text-white">Text Overlays (Timed)</SelectItem>
                <SelectItem value="overall" className="text-foreground dark:text-white">Overall Text (Styled)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Overall Text Settings */}
          {(block.textMode as string) === 'overall' && (
            <div className="space-y-3 pt-2 border-t border-border dark:border-border/30">
              <div>
                <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text Content</Label>
                <textarea
                  value={(block.text as string) || ''}
                  onChange={(e) => updateBlock(index, { text: e.target.value })}
                  className="w-full bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white p-2 rounded-sm min-h-[60px]"
                  placeholder="Enter your text..."
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Text Style</Label>
                <Select value={(block.textStyle as string) || 'default'} onValueChange={(v) => updateBlock(index, { textStyle: v })}>
                  <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                    <SelectItem value="default" className="text-foreground dark:text-white">Default (Fade)</SelectItem>
                    <SelectItem value="shorts" className="text-foreground dark:text-white">Shorts (Word Groups)</SelectItem>
                    <SelectItem value="three-line" className="text-foreground dark:text-white">Three Line</SelectItem>
                    <SelectItem value="karaoke" className="text-foreground dark:text-white">Karaoke</SelectItem>
                    <SelectItem value="karaoke-full" className="text-foreground dark:text-white">Karaoke Full</SelectItem>
                    <SelectItem value="cinematic" className="text-foreground dark:text-white">Cinematic</SelectItem>
                    <SelectItem value="neon" className="text-foreground dark:text-white">Neon</SelectItem>
                    <SelectItem value="typing" className="text-foreground dark:text-white">Typewriter</SelectItem>
                    <SelectItem value="words" className="text-foreground dark:text-white">Word by Word</SelectItem>
                    <SelectItem value="quote" className="text-foreground dark:text-white">Quote (Italic)</SelectItem>
                    <SelectItem value="glow" className="text-foreground dark:text-white">Glow</SelectItem>
                    <SelectItem value="outline" className="text-foreground dark:text-white">Outline</SelectItem>
                    <SelectItem value="bold-glow" className="text-foreground dark:text-white">Bold Glow</SelectItem>
                    <SelectItem value="shadow" className="text-foreground dark:text-white">Shadow</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {['shorts', 'three-line', 'words', 'typing', 'karaoke', 'karaoke-full'].includes((block.textStyle as string)) && (
                <div className="space-y-2 p-2 bg-background dark:bg-card/30 rounded-sm border border-border dark:border-border/30">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Words/Group</Label>
                      <Select value={String((block as any).wordsPerGroup ?? 3)} onValueChange={(v) => updateBlock(index, { wordsPerGroup: parseInt(v) })}>
                        <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                          {[1,2,3,4,5].map(n => <SelectItem key={n} value={String(n)} className="text-foreground dark:text-white">{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Words/Sec</Label>
                      <Input type="number" step="0.5" min="0.5" max="8" value={(block as any).wordsPerSecond ?? 3} onChange={(e) => updateBlock(index, { wordsPerSecond: parseFloat(e.target.value) || 3 })} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Highlight Color</Label>
                      <input type="color" value={(block as any).highlightColor ?? '#00FF88'} onChange={(e) => updateBlock(index, { highlightColor: e.target.value })} className="w-full h-8 rounded cursor-pointer bg-transparent border border-border" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Background</Label>
                      <Select value={(block as any).subtitleBackground ?? 'none'} onValueChange={(v) => updateBlock(index, { subtitleBackground: v })}>
                        <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                          <SelectItem value="none" className="text-foreground dark:text-white">None</SelectItem>
                          <SelectItem value="pill" className="text-foreground dark:text-white">Pill</SelectItem>
                          <SelectItem value="bar" className="text-foreground dark:text-white">Bar</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Font Family</Label>
                <Select value={(block as any).fontFamily || 'inter'} onValueChange={(v) => updateBlock(index, { fontFamily: v })}>
                  <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="inter">Inter (Default)</SelectItem>
                    <SelectItem value="roboto">Roboto</SelectItem>
                    <SelectItem value="montserrat">Montserrat</SelectItem>
                    <SelectItem value="oswald">Oswald (Condensed)</SelectItem>
                    <SelectItem value="playfair">Playfair Display (Serif)</SelectItem>
                    <SelectItem value="bebas">Bebas Neue (Display)</SelectItem>
                    <SelectItem value="poppins">Poppins</SelectItem>
                    <SelectItem value="raleway">Raleway</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Font Size</Label>
                  <Select value={(block.textFontSize as string) || 'xlarge'} onValueChange={(v) => updateBlock(index, { textFontSize: v })}>
                    <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                      <SelectItem value="small" className="text-foreground dark:text-white">Small</SelectItem>
                      <SelectItem value="medium" className="text-foreground dark:text-white">Medium</SelectItem>
                      <SelectItem value="large" className="text-foreground dark:text-white">Large</SelectItem>
                      <SelectItem value="xlarge" className="text-foreground dark:text-white">X-Large</SelectItem>
                      <SelectItem value="xxlarge" className="text-foreground dark:text-white">XX-Large</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Weight</Label>
                  <Select value={(block.textFontWeight as string) || 'bold'} onValueChange={(v) => updateBlock(index, { textFontWeight: v })}>
                    <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                      <SelectItem value="normal" className="text-foreground dark:text-white">Normal</SelectItem>
                      <SelectItem value="bold" className="text-foreground dark:text-white">Bold</SelectItem>
                      <SelectItem value="black" className="text-foreground dark:text-white">Black</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Align</Label>
                  <Select value={(block.textAlign as string) || 'center'} onValueChange={(v) => updateBlock(index, { textAlign: v })}>
                    <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                      <SelectItem value="left" className="text-foreground dark:text-white">Left</SelectItem>
                      <SelectItem value="center" className="text-foreground dark:text-white">Center</SelectItem>
                      <SelectItem value="right" className="text-foreground dark:text-white">Right</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Position</Label>
                  <Select value={(block.textPosition as string) || 'center'} onValueChange={(v) => updateBlock(index, { textPosition: v })}>
                    <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                      <SelectItem value="top" className="text-foreground dark:text-white">Top</SelectItem>
                      <SelectItem value="center" className="text-foreground dark:text-white">Center</SelectItem>
                      <SelectItem value="bottom" className="text-foreground dark:text-white">Bottom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <ColorPicker
                value={(block.textColor as string) || '#FFFFFF'}
                onChange={(v) => updateBlock(index, { textColor: v })}
                label="Text Color"
              />

              <div>
                <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Animation Delay (s)</Label>
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  max="5"
                  value={(block.textAnimationDelay as number) || 0.3}
                  onChange={(e) => updateBlock(index, { textAnimationDelay: parseFloat(e.target.value) || 0 })}
                  className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"
                />
              </div>
            </div>
          )}

          {/* Text Overlays (when mode is 'overlays') */}
          {(block.textMode as string) === 'overlays' && (
            <>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {textOverlays.map((text, i) => (
                  <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground dark:text-muted-foreground">Text {i + 1}</span>
                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => removeTextOverlay(i)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                    <Input value={text.text} onChange={(e) => updateTextOverlay(i, 'text', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Text content" />
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Start (s)</Label>
                        <Input type="number" step="0.5" value={text.startTime || 0} onChange={(e) => updateTextOverlay(i, 'startTime', parseFloat(e.target.value) || 1)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                      </div>
                      <div>
                        <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Duration (s)</Label>
                        <Input type="number" step="0.5" value={text.duration || 3} onChange={(e) => updateTextOverlay(i, 'duration', parseFloat(e.target.value) || 3)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" className="w-full h-8 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={addTextOverlay}>
                <Plus className="w-3 h-3 mr-1" /> Add Text
              </Button>
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Scene" icon={Layers} defaultOpen={false}>
        <div className="space-y-3">
          <ColorPicker value={(block.backgroundColor as string) || '#000000'} onChange={(v) => updateBlock(index, { backgroundColor: v })} label="Background" />
          <div className="flex items-center gap-2"><Switch checked={(block.dofEnabled as boolean) ?? false} onCheckedChange={(v) => updateBlock(index, { dofEnabled: v })} /><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Depth of Field</Label></div>
          {block.dofEnabled && (
            <>
              <SliderInput label="Focus Depth" value={(block.dofFocusDepth as number) || 50} onChange={(v) => updateBlock(index, { dofFocusDepth: v })} min={0} max={100} step={5} unit="" />
              <SliderInput label="Blur Amount" value={(block.dofBlurAmount as number) || 2} onChange={(v) => updateBlock(index, { dofBlurAmount: v })} min={0} max={10} step={0.5} unit="" />
            </>
          )}
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Audio" icon={Music} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Audio URL</Label>
            <Input
              value={(block.audioSrc as string) || ''}
              onChange={(e) => updateBlock(index, { audioSrc: e.target.value })}
              className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1"
              placeholder="https://...mp3 or /audio/file.mp3"
            />
            {(block.audioSrc as string) && (
              <div className="mt-2 p-2 bg-muted dark:bg-card/50 rounded-sm border border-border dark:border-border/30">
                <div className="flex items-center gap-2 text-xs text-muted-foreground dark:text-muted-foreground">
                  <Volume2 className="w-3 h-3" />
                  <span className="truncate">{(block.audioSrc as string).split('/').pop()}</span>
                </div>
                <audio
                  src={block.audioSrc as string}
                  controls
                  className="w-full h-6 mt-2 opacity-75"
                  style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                />
              </div>
            )}
          </div>

          <SliderInput
            label="Volume"
            value={(block.audioVolume as number) ?? 0.7}
            onChange={(v) => updateBlock(index, { audioVolume: v })}
            min={0}
            max={1}
            step={0.1}
            unit="%"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Fade In (s)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={(block.audioFadeIn as number) ?? 0.5}
                onChange={(e) => updateBlock(index, { audioFadeIn: parseFloat(e.target.value) || 0 })}
                className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Fade Out (s)</Label>
              <Input
                type="number"
                step="0.1"
                min="0"
                max="5"
                value={(block.audioFadeOut as number) ?? 0.5}
                onChange={(e) => updateBlock(index, { audioFadeOut: parseFloat(e.target.value) || 0 })}
                className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Start Time (s)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={(block.audioStartTime as number) ?? 0}
                onChange={(e) => updateBlock(index, { audioStartTime: parseFloat(e.target.value) || 0 })}
                className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"
              />
            </div>
            <div>
              <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Delay (s)</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={(block.audioDelay as number) ?? 0}
                onChange={(e) => updateBlock(index, { audioDelay: parseFloat(e.target.value) || 0 })}
                className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs"
              />
            </div>
            <div className="flex items-end pb-1">
              <div className="flex items-center gap-2">
                <Switch
                  checked={(block.audioLoop as boolean) ?? true}
                  onCheckedChange={(v) => updateBlock(index, { audioLoop: v })}
                />
                <Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Loop</Label>
              </div>
            </div>
          </div>
        </div>
      </CollapsibleSection>
    </>
  );
}

function PricingTableEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const plans = (block.plans as Array<{ name: string; price: string; period?: string; features: string[]; highlighted?: boolean; ctaText?: string }>) || [];
  return (
    <CollapsibleSection title="Pricing Plans" icon={DollarSign} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div className="space-y-2">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { plans: [...plans, { name: 'New Plan', price: '$0', period: '/mo', features: ['Feature 1'], highlighted: false, ctaText: 'Get Started' }] })}><Plus className="w-3 h-3 mr-1" /> Add Plan</Button></div>
          {plans.map((plan, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex gap-2 items-center">
                <Input value={plan.name} onChange={(e) => { const n = [...plans]; n[i] = { ...n[i], name: e.target.value }; updateBlock(index, { plans: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" placeholder="Plan Name" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { plans: plans.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Price</Label><Input value={plan.price} onChange={(e) => { const n = [...plans]; n[i] = { ...n[i], price: e.target.value }; updateBlock(index, { plans: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" /></div>
                <div><Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Period</Label><Input value={plan.period || ''} onChange={(e) => { const n = [...plans]; n[i] = { ...n[i], period: e.target.value }; updateBlock(index, { plans: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="/mo" /></div>
              </div>
              <div><Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Features (comma-separated)</Label><Input value={plan.features.join(', ')} onChange={(e) => { const n = [...plans]; n[i] = { ...n[i], features: e.target.value.split(',').map(f => f.trim()).filter(Boolean) }; updateBlock(index, { plans: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" /></div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">CTA Text</Label><Input value={plan.ctaText || 'Get Started'} onChange={(e) => { const n = [...plans]; n[i] = { ...n[i], ctaText: e.target.value }; updateBlock(index, { plans: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" /></div>
                <div className="flex items-end pb-1"><div className="flex items-center gap-2"><Switch checked={plan.highlighted ?? false} onCheckedChange={(v) => { const n = [...plans]; n[i] = { ...n[i], highlighted: v }; updateBlock(index, { plans: n }); }} /><Label className="text-[10px] text-muted-foreground dark:text-muted-foreground">Highlight</Label></div></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function LogoWallEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const logos = (block.logos as Array<{ src: string; name: string }>) || [];
  return (
    <CollapsibleSection title="Logo Wall" icon={Globe} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Columns</Label>
          <Select value={((block.columns as number) || 4).toString()} onValueChange={(v) => updateBlock(index, { columns: parseInt(v) })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2">2</SelectItem>
              <SelectItem value="3">3</SelectItem>
              <SelectItem value="4">4</SelectItem>
              <SelectItem value="5">5</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { logos: [...logos, { src: '', name: 'New Logo' }] })}><Plus className="w-3 h-3 mr-1" /> Add Logo</Button></div>
          {logos.map((logo, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex gap-2">
                <Input value={logo.name} onChange={(e) => { const n = [...logos]; n[i] = { ...n[i], name: e.target.value }; updateBlock(index, { logos: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" placeholder="Logo Name" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => updateBlock(index, { logos: logos.filter((_, idx) => idx !== i) })}><X className="w-4 h-4" /></Button>
              </div>
              <Input value={logo.src} onChange={(e) => { const n = [...logos]; n[i] = { ...n[i], src: e.target.value }; updateBlock(index, { logos: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Image URL (optional)" />
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function ProcessStepsEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const steps = (block.steps as Array<{ number: number; title: string; description?: string; icon?: string }>) || [];
  return (
    <CollapsibleSection title="Process Steps" icon={GitBranch} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" /></div>
        <div className="space-y-2">
          <div className="flex justify-end"><Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { steps: [...steps, { number: steps.length + 1, title: 'New Step', description: '' }] })}><Plus className="w-3 h-3 mr-1" /> Add Step</Button></div>
          {steps.map((step, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex gap-2 items-center">
                <Input value={step.icon || ''} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], icon: e.target.value }; updateBlock(index, { steps: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white w-12 h-9 text-sm text-center" placeholder="🔢" />
                <Input value={step.title} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], title: e.target.value }; updateBlock(index, { steps: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-9 text-sm" placeholder="Step Title" />
                <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-red-400" onClick={() => {
                  const filtered = steps.filter((_, idx) => idx !== i).map((s, idx) => ({ ...s, number: idx + 1 }));
                  updateBlock(index, { steps: filtered });
                }}><X className="w-4 h-4" /></Button>
              </div>
              <Input value={step.description || ''} onChange={(e) => { const n = [...steps]; n[i] = { ...n[i], description: e.target.value }; updateBlock(index, { steps: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-sm" placeholder="Description (optional)" />
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}

function HtmlBlockEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  return (
    <CollapsibleSection title="HTML Block" icon={FileCode2} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Block title" /></div>
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">HTML Content</Label>
          <p className="text-[10px] text-muted-foreground dark:text-muted-foreground mb-1">Write HTML with inline &lt;style&gt; and &lt;script&gt; tags. Use <code className="text-muted-foreground dark:text-muted-foreground">window.__remotionFrame</code> and <code className="text-muted-foreground dark:text-muted-foreground">window.__remotionTime</code> to sync with video.</p>
          <Textarea
            value={(block.htmlContent as string) || ''}
            onChange={(e) => updateBlock(index, { htmlContent: e.target.value })}
            className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs min-h-[300px]"
            placeholder={'<!DOCTYPE html>\n<html>\n<head>\n<style>\n  body { ... }\n</style>\n</head>\n<body>\n  <h1>Hello</h1>\n  <script>\n    const frame = window.__remotionFrame || 0;\n  </script>\n</body>\n</html>'}
          />
        </div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Background Color</Label><Input value={(block.backgroundColor as string) || ''} onChange={(e) => updateBlock(index, { backgroundColor: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="#0a0a1a (optional)" /></div>
      </div>
    </CollapsibleSection>
  );
}

function TopPlayersEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const players = (block.players as Array<{ rank: number; name: string; subtitle?: string; image?: string; audioSrc?: string; text?: string }>) || [];

  const updatePlayer = (playerIndex: number, field: string, value: unknown) => {
    const newPlayers = [...players];
    newPlayers[playerIndex] = { ...newPlayers[playerIndex], [field]: value };
    updateBlock(index, { players: newPlayers });
  };

  const addPlayer = () => {
    const newRank = players.length + 1;
    updateBlock(index, { players: [...players, { rank: newRank, name: `Player ${newRank}`, subtitle: '' }] });
  };

  const removePlayer = (playerIndex: number) => {
    const newPlayers = players.filter((_, i) => i !== playerIndex).map((p, i) => ({ ...p, rank: i + 1 }));
    updateBlock(index, { players: newPlayers });
  };

  const movePlayer = (playerIndex: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? playerIndex - 1 : playerIndex + 1;
    if (newIndex < 0 || newIndex >= players.length) return;
    const newPlayers = [...players];
    [newPlayers[playerIndex], newPlayers[newIndex]] = [newPlayers[newIndex], newPlayers[playerIndex]];
    const reordered = newPlayers.map((p, i) => ({ ...p, rank: i + 1 }));
    updateBlock(index, { players: reordered });
  };

  return (
    <>
      <CollapsibleSection title="Title" icon={Type} defaultOpen={true}>
        <div className="space-y-3">
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Top 10 Players" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Subtitle</Label><Input value={(block.subtitle as string) || ''} onChange={(e) => updateBlock(index, { subtitle: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Greatest of All Time" /></div>
          <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Background Image URL</Label><Input value={(block.backgroundImage as string) || ''} onChange={(e) => updateBlock(index, { backgroundImage: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Stadium / ground image URL" /></div>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Settings" icon={Settings} defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Reveal Order</Label>
            <Select value={(block.revealOrder as string) || 'top-last'} onValueChange={(v) => updateBlock(index, { revealOrder: v })}>
              <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white text-xs mt-1">
                <SelectValue placeholder="Reveal order" />
              </SelectTrigger>
              <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                <SelectItem value="top-last" className="text-foreground dark:text-white">Countdown (#10 → #1)</SelectItem>
                <SelectItem value="top-first" className="text-foreground dark:text-white">#1 First</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <SliderInput label="Seconds per Player" value={(block.defaultPerPlayerSeconds as number) || 3} onChange={(v) => updateBlock(index, { defaultPerPlayerSeconds: v })} min={1} max={10} step={0.5} unit="s" />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title={`Players (${players.length})`} icon={Crown} defaultOpen={true}>
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
          {players.map((player, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-3 space-y-2 border border-border dark:border-border/30">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-400">#{player.rank}</span>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => movePlayer(i, 'up')} disabled={i === 0}><ChevronUp className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => movePlayer(i, 'down')} disabled={i === players.length - 1}><ChevronDown className="w-3 h-3" /></Button>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400" onClick={() => removePlayer(i)} disabled={players.length <= 3}><Trash2 className="w-3 h-3" /></Button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input value={player.name} onChange={(e) => updatePlayer(i, 'name', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Name" />
                <Input value={player.subtitle || ''} onChange={(e) => updatePlayer(i, 'subtitle', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="India • 13K runs" />
              </div>
              <Input value={player.image || ''} onChange={(e) => updatePlayer(i, 'image', e.target.value)} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Image URL (cutout)" />
              <Input value={player.text || ''} onChange={(e) => { updatePlayer(i, 'text', e.target.value); updatePlayer(i, 'audioSrc', e.target.value); }} className="bg-gray-700/50 border-border text-foreground dark:text-white text-xs" placeholder="Narration text" />
            </div>
          ))}
        </div>
        {players.length < 10 && (
          <Button variant="outline" size="sm" className="w-full h-8 text-xs mt-3 bg-muted dark:bg-card border-border dark:border-border" onClick={addPlayer}>
            <Plus className="w-3 h-3 mr-1" /> Add Player
          </Button>
        )}
      </CollapsibleSection>
    </>
  );
}

function DiagramBlockEditor({ block, index }: EditorProps) {
  const { updateBlock } = useEditorStore();
  const nodes = (block.nodes as Array<{ id: string; label: string; type?: string; color?: string }>) || [];
  const edges = (block.edges as Array<{ from: string; to: string; label?: string; style?: string }>) || [];

  return (
    <CollapsibleSection title="Diagram" icon={Network} defaultOpen={true}>
      <div className="space-y-3">
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Title</Label><Input value={(block.title as string) || ''} onChange={(e) => updateBlock(index, { title: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="Diagram title" /></div>
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Diagram Type</Label>
          <Select value={(block.diagramType as string) || 'flowchart'} onValueChange={(v) => updateBlock(index, { diagramType: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
              <SelectItem value="flowchart">Flowchart</SelectItem>
              <SelectItem value="hierarchy">Hierarchy / Org Chart</SelectItem>
              <SelectItem value="sequence">Sequence Diagram</SelectItem>
              <SelectItem value="mindmap">Mind Map</SelectItem>
              <SelectItem value="network">Network Diagram</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Layout</Label>
          <Select value={(block.layout as string) || 'vertical'} onValueChange={(v) => updateBlock(index, { layout: v })}>
            <SelectTrigger className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
              <SelectItem value="vertical">Vertical</SelectItem>
              <SelectItem value="horizontal">Horizontal</SelectItem>
              <SelectItem value="radial">Radial</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground dark:text-muted-foreground">Primary Color</Label><Input value={(block.primaryColor as string) || ''} onChange={(e) => updateBlock(index, { primaryColor: e.target.value })} className="bg-muted dark:bg-card/50 border-border dark:border-border/50 text-foreground dark:text-white" placeholder="#3B82F6" /></div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Nodes ({nodes.length})</Label>
            <Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { nodes: [...nodes, { id: `n${nodes.length + 1}`, label: 'New Node' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
          </div>
          {nodes.map((node, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-2 space-y-1.5 border border-border dark:border-border/30">
              <div className="flex gap-1.5 items-center">
                <Input value={node.id} onChange={(e) => { const n = [...nodes]; n[i] = { ...n[i], id: e.target.value }; updateBlock(index, { nodes: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-8 text-xs font-mono" placeholder="id" />
                <Input value={node.label} onChange={(e) => { const n = [...nodes]; n[i] = { ...n[i], label: e.target.value }; updateBlock(index, { nodes: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-8 text-xs" placeholder="Label" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400" onClick={() => { const n = nodes.filter((_, idx) => idx !== i); updateBlock(index, { nodes: n }); }}><X className="w-3.5 h-3.5" /></Button>
              </div>
              <div className="flex gap-1.5">
                <Select value={node.type || 'default'} onValueChange={(v) => { const n = [...nodes]; n[i] = { ...n[i], type: v }; updateBlock(index, { nodes: n }); }}>
                  <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                    <SelectItem value="default">Default</SelectItem>
                    <SelectItem value="start">Start</SelectItem>
                    <SelectItem value="end">End</SelectItem>
                    <SelectItem value="process">Process</SelectItem>
                    <SelectItem value="decision">Decision</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                  </SelectContent>
                </Select>
                <Input value={node.color || ''} onChange={(e) => { const n = [...nodes]; n[i] = { ...n[i], color: e.target.value }; updateBlock(index, { nodes: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white w-20 h-7 text-xs" placeholder="#color" />
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground dark:text-muted-foreground">Edges ({edges.length})</Label>
            <Button variant="outline" size="sm" className="h-7 text-xs bg-muted dark:bg-card border-border dark:border-border" onClick={() => updateBlock(index, { edges: [...edges, { from: nodes[0]?.id || '', to: nodes[1]?.id || '' }] })}><Plus className="w-3 h-3 mr-1" /> Add</Button>
          </div>
          {edges.map((edge, i) => (
            <div key={i} className="bg-muted dark:bg-card/50 rounded-sm p-2 space-y-1.5 border border-border dark:border-border/30">
              <div className="flex gap-1.5 items-center">
                <Input value={edge.from} onChange={(e) => { const n = [...edges]; n[i] = { ...n[i], from: e.target.value }; updateBlock(index, { edges: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-8 text-xs font-mono" placeholder="from" />
                <span className="text-muted-foreground dark:text-muted-foreground text-xs">→</span>
                <Input value={edge.to} onChange={(e) => { const n = [...edges]; n[i] = { ...n[i], to: e.target.value }; updateBlock(index, { edges: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-8 text-xs font-mono" placeholder="to" />
                <Input value={edge.label || ''} onChange={(e) => { const n = [...edges]; n[i] = { ...n[i], label: e.target.value }; updateBlock(index, { edges: n }); }} className="bg-gray-700/50 border-border text-foreground dark:text-white h-8 text-xs" placeholder="Label" />
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-red-400" onClick={() => { const n = edges.filter((_, idx) => idx !== i); updateBlock(index, { edges: n }); }}><X className="w-3.5 h-3.5" /></Button>
              </div>
              <Select value={edge.style || 'arrow'} onValueChange={(v) => { const n = [...edges]; n[i] = { ...n[i], style: v }; updateBlock(index, { edges: n }); }}>
                <SelectTrigger className="bg-gray-700/50 border-border text-foreground dark:text-white h-7 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-muted dark:bg-card border-border dark:border-border">
                  <SelectItem value="arrow">Arrow</SelectItem>
                  <SelectItem value="solid">Solid</SelectItem>
                  <SelectItem value="dashed">Dashed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
    </CollapsibleSection>
  );
}
