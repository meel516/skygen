'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useEditorStore } from '@/store/editor-store';
import { AudioTrack } from '@/lib/video/schemas';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Plus, Music } from '@/components/ui/studio-icons';
import { Reorder, AnimatePresence } from 'framer-motion';
import AudioTrackItem from '@/components/audio/AudioTrackerItem'; // keep your existing item component

export function AudioTracksPanel() {
  const { videoInput, addAudioTrack, moveAudioTrack } = useEditorStore();

  const audioTracks = videoInput.videoMeta.audioTracks || [];

  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [playingTrack, setPlayingTrack] = useState<string | null>(null);
  const [newTrackUrl, setNewTrackUrl] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* ----------------------------- CLEANUP ----------------------------- */

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
        audioRef.current = null;
      }
    };
  }, []);

  /* -------------------------- EXPAND TOGGLE -------------------------- */

  const handleToggleExpand = useCallback((trackId: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev);
      next.has(trackId) ? next.delete(trackId) : next.add(trackId);
      return next;
    });
  }, []);

  /* -------------------------- ADD BY URL -------------------------- */

  const isValidUrl = (url: string) => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  const handleAddTrack = useCallback(() => {
    if (!newTrackUrl.trim() || !isValidUrl(newTrackUrl)) return;

    addAudioTrack({
      name: `Audio Track ${audioTracks.length + 1}`,
      src: newTrackUrl,
      volume: 0.7,
      startTime: 0,
      fadeIn: 0,
      fadeOut: 0,
      loop: true,
      muted: false,
    });

    setNewTrackUrl('');
  }, [addAudioTrack, audioTracks.length, newTrackUrl]);

  /* -------------------------- PLAY PREVIEW -------------------------- */

  const handlePlayPreview = useCallback(
    (track: AudioTrack) => {
      if (!track.src) return;

      // Stop same track
      if (playingTrack === track.id && audioRef.current) {
        audioRef.current.pause();
        setPlayingTrack(null);
        return;
      }

      // Stop previous
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = '';
      }

      const audio = new Audio(track.src);
      audio.volume = track.muted ? 0 : track.volume;

      audio.onended = () => setPlayingTrack(null);
      audio.onerror = () => {
        console.error('Failed to load audio');
        setPlayingTrack(null);
      };

      audio.play().catch(() => {
        console.error('Failed to play audio');
        setPlayingTrack(null);
      });

      audioRef.current = audio;
      setPlayingTrack(track.id);
    },
    [playingTrack]
  );

  /* -------------------------- REORDER -------------------------- */

  const handleReorder = useCallback(
    (newOrder: AudioTrack[]) => {
      const currentTracks = audioTracks;

      for (let i = 0; i < newOrder.length; i++) {
        if (newOrder[i].id !== currentTracks[i].id) {
          const fromIndex = currentTracks.findIndex(
            t => t.id === newOrder[i].id
          );
          moveAudioTrack(fromIndex, i);
          break;
        }
      }
    },
    [audioTracks, moveAudioTrack]
  );

  /* ============================== UI ============================== */

  return (
    <div className="space-y-4">
      {/* Header + Add URL */}
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground font-medium">
          Audio Tracks ({audioTracks.length})
        </Label>

        <div className="flex gap-2">
          <Input
            value={newTrackUrl}
            onChange={(e) => setNewTrackUrl(e.target.value)}
            placeholder="Paste audio URL (https://...)"
            className="h-8 text-xs bg-card/50 border-border text-foreground dark:text-white"
          />

          <Button
            size="sm"
            onClick={handleAddTrack}
            disabled={!newTrackUrl.trim() || !isValidUrl(newTrackUrl)}
            className="h-8 text-xs"
          >
            <Plus className="w-3 h-3 mr-1" />
            Add
          </Button>
        </div>
      </div>

      {/* Track List */}
      {audioTracks.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-6 text-center">
          <Music className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">No audio tracks added</p>
          <p className="text-xs text-muted-foreground mt-1">
            Paste a URL above to add background music or sound effects
          </p>
        </div>
      ) : (
        <Reorder.Group
          axis="y"
          values={audioTracks}
          onReorder={handleReorder}
          className="space-y-2"
        >
          <AnimatePresence>
            {audioTracks.map((track, index) => (
              <Reorder.Item
                key={track.id}
                value={track}
                className="list-none"
              >
                <AudioTrackItem
                  track={track}
                  index={index}
                  isExpanded={expandedTracks.has(track.id)}
                  onToggleExpand={() =>
                    handleToggleExpand(track.id)
                  }
                  onPlayPreview={() =>
                    handlePlayPreview(track)
                  }
                  isPlaying={playingTrack === track.id}
                />
              </Reorder.Item>
            ))}
          </AnimatePresence>
        </Reorder.Group>
      )}

      {/* Help Text */}
      <div className="text-[10px] text-muted-foreground space-y-0.5">
        <p>Drag tracks to reorder. Click to expand for detailed controls.</p>
        <p>Supported formats: MP3, WAV, OGG, AAC</p>
      </div>
    </div>
  );
}
