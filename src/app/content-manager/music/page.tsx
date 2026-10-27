'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Upload, Trash2, Play, Pause, Music, Plus } from 'lucide-react';
import { ALL_MOODS, MOOD_META, formatDuration, type MusicMood, type MusicTrack } from '@/lib/music/music-catalog';

export default function MusicPage() {
  const [tracks, setTracks] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [artist, setArtist] = useState('');
  const [mood, setMood] = useState<MusicMood>('calm');
  const [duration, setDuration] = useState('');
  const [tags, setTags] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const fetchTracks = async () => {
    try {
      const res = await fetch('/api/content-manager/music');
      const data = await res.json();
      setTracks(data.tracks || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTracks();
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (!name) setName(f.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));

    // Auto-detect duration
    const audio = new Audio();
    audio.src = URL.createObjectURL(f);
    audio.addEventListener('loadedmetadata', () => {
      setDuration(Math.round(audio.duration).toString());
      URL.revokeObjectURL(audio.src);
    });
  };

  const handleUpload = async () => {
    if (!file || !name.trim()) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', name.trim());
      formData.append('artist', artist.trim() || 'Unknown');
      formData.append('mood', mood);
      formData.append('duration', duration || '120');
      formData.append('tags', tags);

      const res = await fetch('/api/content-manager/music', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Upload failed');
      }

      // Reset form
      setName('');
      setArtist('');
      setMood('calm');
      setDuration('');
      setTags('');
      setFile(null);
      setShowForm(false);
      await fetchTracks();
    } catch (err: any) {
      alert(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this track?')) return;
    try {
      await fetch(`/api/content-manager/music?id=${id}`, { method: 'DELETE' });
      setTracks(prev => prev.filter(t => t.id !== id));
      if (playingId === id) {
        audioRef.current?.pause();
        setPlayingId(null);
      }
    } catch {
      alert('Delete failed');
    }
  };

  const handlePlay = (track: MusicTrack) => {
    if (playingId === track.id) {
      audioRef.current?.pause();
      setPlayingId(null);
      return;
    }

    if (audioRef.current) audioRef.current.pause();

    const audio = new Audio(track.src);
    audio.play();
    audio.addEventListener('ended', () => setPlayingId(null));
    audioRef.current = audio;
    setPlayingId(track.id);
  };

  const inputClass =
    'w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-cyan-500';

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Music Library</h1>
          <p className="text-gray-400 text-sm mt-1">
            Upload royalty-free music tracks for the video wizard background music step.
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Track
        </button>
      </div>

      {/* Upload Form */}
      {showForm && (
        <div className="rounded-xl p-5 space-y-4 bg-gray-900/80 border border-gray-800">
          <h2 className="text-sm font-semibold text-gray-300">Upload New Track</h2>

          <div>
            <label className="block text-xs text-gray-400 mb-1">Audio File (MP3/WAV/OGG)</label>
            <input
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Track Name *</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Sunset Vibes"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Artist</label>
              <input
                type="text"
                value={artist}
                onChange={e => setArtist(e.target.value)}
                placeholder="e.g. SoundScapes"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Mood</label>
              <select
                value={mood}
                onChange={e => setMood(e.target.value as MusicMood)}
                className={inputClass}
              >
                {ALL_MOODS.map(m => (
                  <option key={m} value={m}>
                    {MOOD_META[m].emoji} {MOOD_META[m].label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Duration (sec)</label>
              <input
                type="number"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="Auto-detected"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={e => setTags(e.target.value)}
                placeholder="e.g. piano, soft, ambient"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={handleUpload}
              disabled={uploading || !file || !name.trim()}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {uploading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="w-4 h-4" /> Upload Track</>
              )}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Track List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
        </div>
      ) : tracks.length === 0 ? (
        <div className="text-center py-16">
          <Music className="w-12 h-12 mx-auto mb-3 text-gray-600" />
          <p className="text-gray-500">No music tracks yet.</p>
          <p className="text-gray-600 text-sm mt-1">Upload royalty-free tracks for the wizard music step.</p>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-500">{tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
          <div className="grid gap-2">
            {tracks.map(track => {
              const moodInfo = MOOD_META[track.mood as MusicMood] || MOOD_META.calm;
              const isPlaying = playingId === track.id;
              return (
                <div
                  key={track.id}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 bg-gray-900/60 border border-gray-800 hover:border-gray-700 transition-colors"
                >
                  {/* Play button */}
                  <button
                    onClick={() => handlePlay(track)}
                    className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
                    style={{
                      background: isPlaying ? 'rgba(6,182,212,0.2)' : 'rgba(255,255,255,0.06)',
                      color: isPlaying ? '#06b6d4' : '#9ca3af',
                    }}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-white truncate">{track.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${moodInfo.color}`}
                      >
                        {moodInfo.emoji} {moodInfo.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-gray-500">{track.artist}</span>
                      <span className="text-xs text-gray-600">{formatDuration(track.duration)}</span>
                      {track.tags && track.tags.length > 0 && (
                        <span className="text-[10px] text-gray-600 truncate">
                          {(Array.isArray(track.tags) ? track.tags : []).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Delete */}
                  <button
                    onClick={() => handleDelete(track.id)}
                    className="p-2 rounded-lg text-gray-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Delete track"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
