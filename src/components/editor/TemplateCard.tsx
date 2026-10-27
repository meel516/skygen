'use client';

import { VideoTemplate } from '@/lib/video/templates/template-definitions';
import { Button } from '@/components/ui/button';
import { Play, Layout, Clock, Sparkles, Zap } from 'lucide-react';
import { motion } from 'framer-motion';

interface TemplateCardProps {
  template: VideoTemplate & { previewUrl?: string };
  onSelect?: () => void;
  onUse?: () => void;
}

const categoryColors: Record<string, string> = {
  motivation: 'from-red-500/20 via-orange-500/10 to-transparent',
  food: 'from-green-500/20 via-emerald-500/10 to-transparent',
  tutorial: 'from-blue-500/20 via-cyan-500/10 to-transparent',
  business: 'from-indigo-500/20 via-purple-500/10 to-transparent',
  lifestyle: 'from-pink-500/20 via-rose-500/10 to-transparent',
};

const categoryBorderColors: Record<string, string> = {
  motivation: 'group-hover:border-red-500/50',
  food: 'group-hover:border-green-500/50',
  tutorial: 'group-hover:border-blue-500/50',
  business: 'group-hover:border-indigo-500/50',
  lifestyle: 'group-hover:border-pink-500/50',
};

const categoryIcons: Record<string, string> = {
  motivation: '🔥',
  food: '🍔',
  tutorial: '📚',
  business: '💼',
  lifestyle: '🌟',
};

const themeStyles: Record<string, { bg: string; text: string }> = {
  dark_modern: { bg: 'bg-gray-800/60', text: 'text-gray-300' },
  light_clean: { bg: 'bg-gray-100/60', text: 'text-gray-700' },
  gradient_vibrant: { bg: 'bg-gradient-to-r from-orange-500/20 to-purple-500/20', text: 'text-orange-300' },
  minimal_bw: { bg: 'bg-gray-600/40', text: 'text-gray-200' },
};

export function TemplateCard({ template, onSelect, onUse }: TemplateCardProps) {
  const aspectRatioDisplay = template.videoMeta.aspectRatio.replace(':', '×');
  const blockCount = template.blocks.length;
  const variableCount = template.requiredVariables.length;
  const theme = template.videoMeta.theme || 'dark_modern';
  const themeStyle = themeStyles[theme] || themeStyles.dark_modern;
  const hasPreview = template.previewUrl;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      className={`group relative bg-gray-900/80 backdrop-blur-sm rounded-2xl overflow-hidden border border-gray-800 ${categoryBorderColors[template.category] || 'group-hover:border-purple-500/50'} transition-all duration-300`}
    >
      {/* Thumbnail / Preview */}
      <div className="relative h-44 bg-gray-950 overflow-hidden">
        {/* Video preview - shows on hover if available */}
        {hasPreview && (
          <img
            src={template.previewUrl}
            alt="Preview"
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-opacity duration-300 group-hover:animate-ken-burns"
          />
        )}

        {/* Animated gradient background - hidden when video is playing */}
        <div className={`absolute inset-0 bg-gradient-to-br ${categoryColors[template.category] || 'from-purple-500/20 to-pink-500/10'} animate-gradient-shift ${hasPreview ? 'group-hover:opacity-0' : ''} transition-opacity duration-300`} />

        {/* Grid pattern overlay - hidden when video playing */}
        <div className={`absolute inset-0 opacity-5 ${hasPreview ? 'group-hover:opacity-0' : ''} transition-opacity duration-300`} style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '20px 20px'
        }} />

        {/* Top badges */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <div className="px-2 py-1 bg-gray-900/70 backdrop-blur-md rounded-md text-xs font-medium text-gray-300 border border-gray-700/50">
            {aspectRatioDisplay}
          </div>
        </div>

        {/* Category icon */}
        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="text-3xl filter drop-shadow-lg">{categoryIcons[template.category]}</span>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1 text-gray-400">
              <Layout className="w-3 h-3" />
              <span>{blockCount} blocks</span>
            </div>
            <div className="flex items-center gap-1 text-gray-400">
              <Zap className="w-3 h-3 text-yellow-400" />
              <span>{variableCount} fields</span>
            </div>
          </div>
        </div>

        {/* Hover overlay with glow */}
        <div className="absolute inset-0 bg-white/50 dark:bg-black/50 opacity-0 group-hover:opacity-100 transition-all duration-300 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1 }}
            className="flex items-center gap-3"
          >
            <Button
              size="sm"
              variant="secondary"
              onClick={(e) => {
                e.stopPropagation();
                onSelect?.();
              }}
              className="bg-white/90 text-gray-900 hover:bg-white backdrop-blur-md shadow-lg"
            >
              <Play className="w-4 h-4 mr-1" />
              Preview
            </Button>
          </motion.div>
        </div>

        {/* Animated border on hover */}
        <div className="absolute inset-0 rounded-t-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <div className="absolute inset-0 rounded-t-2xl border-2 border-transparent bg-gradient-to-r from-purple-500/50 to-pink-500/50 blur-[2px]" />
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-3">
        <div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-purple-300 transition-colors line-clamp-1">
            {template.name}
          </h3>
          <p className="text-gray-400 text-sm line-clamp-2 mt-1">{template.description}</p>
        </div>

        {/* Meta badges */}
        <div className="flex items-center flex-wrap gap-2">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${themeStyle.bg} ${themeStyle.text} border-white/5`}>
            {template.videoMeta.theme?.replace('_', ' ') || 'dark'}
          </span>
          <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-800/60 text-gray-400 border border-white/5 capitalize">
            {template.category}
          </span>
          <div className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500">
            <Clock className="w-3 h-3" />
            {template.videoMeta.fps} FPS
          </div>
        </div>
      </div>

      {/* Use button */}
      <div className="px-4 pb-4">
        <Button
          onClick={(e) => {
            e.stopPropagation();
            onUse?.();
          }}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white font-medium shadow-lg shadow-purple-500/20 transition-all group-hover:shadow-purple-500/40"
        >
          <Sparkles className="w-4 h-4 mr-2" />
          Use Template
        </Button>
      </div>
    </motion.div>
  );
}
