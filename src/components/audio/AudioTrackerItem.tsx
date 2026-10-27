'use client';

import { useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEditorStore } from '@/store/editor-store';
import { AudioTrack } from '@/lib/video/schemas';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Trash2,
  Volume2,
  VolumeX,
  GripVertical,
  Music,
  Clock,
  ChevronDown,
  ChevronUp,
  Play,
  Pause
} from 'lucide-react';

interface AudioTrackItemProps {
  track: AudioTrack;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPlayPreview: () => void;
  isPlaying: boolean;
}

export default function AudioTrackItem({
  track,
  index,
  isExpanded,
  onToggleExpand,
  onPlayPreview,
  isPlaying
}: AudioTrackItemProps) {
  const { updateAudioTrack, removeAudioTrack } = useEditorStore();

  /* ----------------------------- Handlers ----------------------------- */

  const handleVolumeChange = useCallback(
    (value: number[]) => {
      updateAudioTrack(track.id, { volume: value[0] / 100 });
    },
    [track.id, updateAudioTrack]
  );

  const handleStartTimeChange = useCallback(
    (value: number[]) => {
      updateAudioTrack(track.id, { startTime: value[0] });
    },
    [track.id, updateAudioTrack]
  );

  const handleFadeInChange = useCallback(
    (value: number[]) => {
      updateAudioTrack(track.id, { fadeIn: value[0] });
    },
    [track.id, updateAudioTrack]
  );

  const handleFadeOutChange = useCallback(
    (value: number[]) => {
      updateAudioTrack(track.id, { fadeOut: value[0] });
    },
    [track.id, updateAudioTrack]
  );

  const handleToggleMute = useCallback(() => {
    updateAudioTrack(track.id, { muted: !track.muted });
  }, [track.id, track.muted, updateAudioTrack]);

  const handleToggleLoop = useCallback(() => {
    updateAudioTrack(track.id, { loop: !track.loop });
  }, [track.id, track.loop, updateAudioTrack]);

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAudioTrack(track.id, { name: e.target.value });
    },
    [track.id, updateAudioTrack]
  );

  const handleSrcChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      updateAudioTrack(track.id, { src: e.target.value });
    },
    [track.id, updateAudioTrack]
  );

  const handleRemove = useCallback(() => {
    removeAudioTrack(track.id);
  }, [track.id, removeAudioTrack]);

  /* ============================== UI ============================== */

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="border border-gray-700/50 rounded-lg bg-gray-800/40 overflow-hidden"
    >
      {/* HEADER */}
      <div className="flex items-center gap-2 p-3 bg-gray-800/60">
        <GripVertical className="w-4 h-4 text-gray-500 cursor-grab active:cursor-grabbing" />

        {/* Preview */}
        <button
          onClick={onPlayPreview}
          disabled={!track.src}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 transition-colors disabled:opacity-40"
        >
          {isPlaying ? (
            <Pause className="w-3.5 h-3.5" />
          ) : (
            <Play className="w-3.5 h-3.5 ml-0.5" />
          )}
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Music className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <span className="text-sm text-white font-medium truncate">
              {track.name}
            </span>
          </div>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-1">
          {track.muted && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 border-red-500/50 text-red-400"
            >
              Muted
            </Badge>
          )}

          {track.loop && (
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 h-5 border-green-500/50 text-green-400"
            >
              Loop
            </Badge>
          )}

          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 h-5 border-gray-600 text-gray-400"
          >
            {Math.round(track.volume * 100)}%
          </Badge>
        </div>

        {/* Mute */}
        <button
          onClick={handleToggleMute}
          className={`w-7 h-7 flex items-center justify-center rounded transition-colors ${
            track.muted
              ? 'text-red-400 hover:text-red-300'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          {track.muted ? (
            <VolumeX className="w-4 h-4" />
          ) : (
            <Volume2 className="w-4 h-4" />
          )}
        </button>

        {/* Expand */}
        <button
          onClick={onToggleExpand}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {/* Delete */}
        <button
          onClick={handleRemove}
          className="w-7 h-7 flex items-center justify-center rounded text-gray-400 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* EXPANDED CONTENT */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-3 space-y-4 border-t border-gray-700/50">
              {/* Name */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Track Name</Label>
                <Input
                  value={track.name}
                  onChange={handleNameChange}
                  className="bg-gray-800/50 border-gray-700/50 text-white h-8 text-xs"
                />
              </div>

              {/* URL */}
              <div className="space-y-1.5">
                <Label className="text-xs text-gray-400">Audio URL</Label>
                <Input
                  value={track.src}
                  onChange={handleSrcChange}
                  className="bg-gray-800/50 border-gray-700/50 text-white h-8 text-xs"
                />
              </div>

              {/* Volume */}
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-xs text-gray-400">Volume</Label>
                  <span className="text-xs text-gray-500">
                    {Math.round(track.volume * 100)}%
                  </span>
                </div>
                <Slider
                  value={[track.volume * 100]}
                  min={0}
                  max={100}
                  step={1}
                  onValueChange={handleVolumeChange}
                />
              </div>

              {/* Start Time */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <Label className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Start Time
                  </Label>
                  <span className="text-xs text-gray-500">
                    {track.startTime}s
                  </span>
                </div>
                <Slider
                  value={[track.startTime]}
                  min={0}
                  max={120}
                  step={0.5}
                  onValueChange={handleStartTimeChange}
                />
              </div>

              {/* Fade Controls */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-400">Fade In</Label>
                  <Slider
                    value={[track.fadeIn]}
                    min={0}
                    max={10}
                    step={0.1}
                    onValueChange={handleFadeInChange}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-gray-400">Fade Out</Label>
                  <Slider
                    value={[track.fadeOut]}
                    min={0}
                    max={10}
                    step={0.1}
                    onValueChange={handleFadeOutChange}
                  />
                </div>
              </div>

              {/* Loop Toggle */}
              <div className="flex items-center justify-between pt-1">
                <Label className="text-xs text-gray-400">Loop Audio</Label>
                <Switch
                  checked={track.loop}
                  onCheckedChange={handleToggleLoop}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}