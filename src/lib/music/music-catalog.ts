// ═══════════════════════════════════════════════════════════════════════════════
// Music Catalog — Types & Mood Metadata
// Tracks are managed by content managers via /api/content-manager/music
// and fetched by the wizard UI from /api/music
// ═══════════════════════════════════════════════════════════════════════════════

export type MusicMood =
  | 'upbeat'
  | 'calm'
  | 'dramatic'
  | 'cinematic'
  | 'inspiring'
  | 'corporate'
  | 'lofi'
  | 'dark';

export interface MusicTrack {
  id: string;
  name: string;
  artist: string;
  mood: MusicMood;
  duration: number; // seconds
  src: string;      // URL (served via /api/music/[filename])
  tags: string[];
}

export const MOOD_META: Record<MusicMood, { label: string; emoji: string; color: string }> = {
  upbeat:    { label: 'Upbeat',    emoji: '\u26A1', color: 'bg-yellow-500/15 text-yellow-400' },
  calm:      { label: 'Calm',      emoji: '\uD83C\uDF3F', color: 'bg-green-500/15 text-green-400' },
  dramatic:  { label: 'Dramatic',  emoji: '\uD83C\uDFAD', color: 'bg-red-500/15 text-red-400' },
  cinematic: { label: 'Cinematic', emoji: '\uD83C\uDFAC', color: 'bg-indigo-500/15 text-indigo-400' },
  inspiring: { label: 'Inspiring', emoji: '\u2728', color: 'bg-purple-500/15 text-purple-400' },
  corporate: { label: 'Corporate', emoji: '\uD83D\uDCBC', color: 'bg-blue-500/15 text-blue-400' },
  lofi:      { label: 'Lo-fi',     emoji: '\uD83C\uDFA7', color: 'bg-pink-500/15 text-pink-400' },
  dark:      { label: 'Dark',      emoji: '\uD83C\uDF11', color: 'bg-gray-500/15 text-gray-400' },
};

export const ALL_MOODS = Object.keys(MOOD_META) as MusicMood[];

/** Format seconds as m:ss */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
