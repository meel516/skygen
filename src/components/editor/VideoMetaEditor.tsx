'use client';

import { useEditorStore } from '@/store/editor-store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { motion } from 'framer-motion';
import { Settings2, Maximize2, Palette, Gauge, Sparkles, Music, ArrowRightLeft } from '@/components/ui/studio-icons';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AudioTracksPanel } from './AudioTracksPanel';

export function VideoMetaEditor() {
  const { videoInput, updateVideoMeta } = useEditorStore();
  const { videoMeta } = videoInput;

  const aspectRatios = [
    { value: '9:16', label: '9:16', desc: 'Vertical' },
    { value: '16:9', label: '16:9', desc: 'Horizontal' },
    { value: '1:1', label: '1:1', desc: 'Square' },
    { value: '4:5', label: '4:5', desc: 'Portrait' },
  ];

  const themes = [
    { value: 'dark_modern', label: 'Dark Modern', color: 'bg-gray-900' },
    { value: 'light_minimal', label: 'Light Minimal', color: 'bg-white border' },
    { value: 'bold_vibrant', label: 'Bold Vibrant', color: 'bg-gradient-to-r from-purple-600 to-pink-600' },
    { value: 'corporate', label: 'Corporate', color: 'bg-slate-700' },
  ];

  const transitions = [
    { value: 'fade', label: 'Fade', desc: 'Smooth fade in/out' },
    { value: 'slide', label: 'Slide', desc: 'Slide transition' },
    { value: 'zoom', label: 'Zoom', desc: 'Zoom in/out' },
    { value: 'wipe', label: 'Wipe', desc: 'Wipe effect' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-3"
    >
      <Accordion type="multiple" defaultValue={['video', 'transitions']} className="space-y-2">
        {/* Video Settings */}
        <AccordionItem value="video" className="border border-border/50 rounded-sm bg-card/30 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card/50">
            <div className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-white">Video Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {/* Aspect Ratio */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Maximize2 className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground font-medium">Aspect Ratio</Label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {aspectRatios.map((ratio) => (
                  <button
                    key={ratio.value}
                    onClick={() => updateVideoMeta({ aspectRatio: ratio.value as '9:16' | '16:9' | '1:1' | '4:5' })}
                    className={`p-2 rounded-sm border text-left  ${
                      videoMeta.aspectRatio === ratio.value
                        ? 'border-primary bg-primary/20 text-foreground dark:text-white'
                        : 'border-border/50 bg-card/30 text-muted-foreground hover:border-border'
                    }`}
                  >
                    <span className="text-xs font-medium block">{ratio.label}</span>
                    <span className="text-[10px] opacity-60">{ratio.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Theme */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Palette className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground font-medium">Theme</Label>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                {themes.map((theme) => (
                  <button
                    key={theme.value}
                    onClick={() => updateVideoMeta({ theme: theme.value as 'dark_modern' | 'light_minimal' | 'bold_vibrant' | 'corporate' })}
                    className={`p-2 rounded-sm border flex items-center gap-2  ${
                      videoMeta.theme === theme.value
                        ? 'border-primary bg-primary/20'
                        : 'border-border/50 bg-card/30 hover:border-border'
                    }`}
                  >
                    <div className={`w-4 h-4 rounded ${theme.color}`} />
                    <span className={`text-xs ${videoMeta.theme === theme.value ? 'text-foreground dark:text-white' : 'text-muted-foreground'}`}>
                      {theme.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* FPS */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground font-medium">Frame Rate</Label>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[24, 30, 60].map((fps) => (
                  <button
                    key={fps}
                    onClick={() => updateVideoMeta({ fps })}
                    className={`p-2 rounded-sm border text-center  ${
                      videoMeta.fps === fps
                        ? 'border-primary bg-primary/20 text-foreground dark:text-white'
                        : 'border-border/50 bg-card/30 text-muted-foreground hover:border-border'
                    }`}
                  >
                    <span className="text-sm font-medium">{fps}</span>
                    <span className="text-[10px] ml-0.5 opacity-60">FPS</span>
                  </button>
                ))}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Transitions */}
        <AccordionItem value="transitions" className="border border-border/50 rounded-sm bg-card/30 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card/50">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-white">Transitions</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {/* Default Transition */}
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground font-medium">Default Transition</Label>
              <Select defaultValue="fade">
                <SelectTrigger className="bg-card/50 border-border/50 text-foreground dark:text-white h-9">
                  <SelectValue placeholder="Select transition" />
                </SelectTrigger>
                <SelectContent>
                  {transitions.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Transition Duration */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground font-medium">Duration</Label>
                <span className="text-xs text-muted-foreground">0.5s</span>
              </div>
              <Slider defaultValue={[0.5]} min={0.2} max={2} step={0.1} />
            </div>

            {/* Transition Options */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground font-medium">Auto Transitions</Label>
                <Switch defaultChecked />
              </div>
              <p className="text-[10px] text-muted-foreground">Automatically apply transitions between all blocks</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Audio */}
        <AccordionItem value="audio" className="border border-border/50 rounded-sm bg-card/30 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card/50">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-white">Audio Tracks</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            <AudioTracksPanel />
          </AccordionContent>
        </AccordionItem>

        {/* Effects */}
        <AccordionItem value="effects" className="border border-border/50 rounded-sm bg-card/30 overflow-hidden">
          <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-card/50">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground dark:text-white">Global Effects</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4 space-y-4">
            {/* Motion Blur */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground font-medium">Motion Blur</Label>
                <span className="text-xs text-muted-foreground">Off</span>
              </div>
              <Slider defaultValue={[0]} min={0} max={100} step={10} />
            </div>

            {/* Color Correction */}
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground font-medium">Brightness</Label>
                <span className="text-xs text-muted-foreground">0</span>
              </div>
              <Slider defaultValue={[50]} min={0} max={100} step={5} />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-xs text-muted-foreground font-medium">Contrast</Label>
                <span className="text-xs text-muted-foreground">0</span>
              </div>
              <Slider defaultValue={[50]} min={0} max={100} step={5} />
            </div>

            {/* Filters */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-medium">Vignette</Label>
              <Switch />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground font-medium">Film Grain</Label>
              <Switch />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  );
}
