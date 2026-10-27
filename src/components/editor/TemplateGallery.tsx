'use client';

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useEditorStore, UserTemplate } from '@/store/editor-store';
import { ApiKeySettings } from './ApiKeySettings';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Sparkles, Globe, User, RefreshCw, Loader2, CheckCircle, ChevronRight, Edit2, Play, Square, Upload, Crown, Lock, Music, VolumeX, LogOut, Settings, Copy, LifeBuoy, Link } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Player } from '@remotion/player';
import { DynamicVideo, getCompositionConfig } from '@/lib/video/compositions/DynamicVideo';
import { COMPONENT_IDS } from '@/lib/video/schemas';
import type { NarrativeBrief, WizardImageItem, WizardVideoItem } from '@/lib/video/ai';
import type { TTSVoice } from '@/lib/video/ai/deepgram-tts';
import { useSiteConfig } from '@/lib/use-site-config';
import { LoopingCarousel } from '@/components/ui/looping-carousel';
import { useSession } from 'next-auth/react';
import { containsPremiumBlocks, hasPremiumAccess } from '@/lib/roles';
import { usePremiumConfig, getUpgradeUrl } from '@/lib/use-premium-config';
import { getSelectedModel } from '@/lib/video/ai/template-ai';
import { MOOD_META, ALL_MOODS, formatDuration, type MusicTrack, type MusicMood } from '@/lib/music/music-catalog';

// ============================================================================
// STATIC DATA
// ============================================================================

const LANGUAGES = [
  { code: 'en', label: 'English',    flag: '🇺🇸' },
  { code: 'es', label: 'Spanish',    flag: '🇪🇸' },
  { code: 'fr', label: 'French',     flag: '🇫🇷' },
  { code: 'de', label: 'German',     flag: '🇩🇪' },
  { code: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'ar', label: 'Arabic',     flag: '🇸🇦' },
  { code: 'hi', label: 'Hindi',      flag: '🇮🇳' },
  { code: 'ja', label: 'Japanese',   flag: '🇯🇵' },
  { code: 'ko', label: 'Korean',     flag: '🇰🇷' },
  { code: 'zh', label: 'Chinese',    flag: '🇨🇳' },
  { code: 'it', label: 'Italian',    flag: '🇮🇹' },
  { code: 'nl', label: 'Dutch',      flag: '🇳🇱' },
  { code: 'tr', label: 'Turkish',    flag: '🇹🇷' },
  { code: 'ru', label: 'Russian',    flag: '🇷🇺' },
  { code: 'pl', label: 'Polish',     flag: '🇵🇱' },
];

// Fallback — shown instantly while API voices load
const FALLBACK_VOICES: TTSVoice[] = [
  { id: 'aura-2-thalia-en',    name: 'Thalia',    gender: 'F', style: 'Natural · Conversational',  provider: 'deepgram' },
  { id: 'aura-2-andromeda-en', name: 'Andromeda', gender: 'F', style: 'Professional · Clear',      provider: 'deepgram' },
  { id: 'aura-2-helena-en',    name: 'Helena',    gender: 'F', style: 'Warm · Friendly',           provider: 'deepgram' },
  { id: 'aura-2-stella-en',    name: 'Stella',    gender: 'F', style: 'Bright · Energetic',        provider: 'deepgram' },
  { id: 'aura-2-luna-en',      name: 'Luna',      gender: 'F', style: 'Soft · Calm',               provider: 'deepgram' },
  { id: 'aura-2-aurora-en',    name: 'Aurora',    gender: 'F', style: 'Smooth · Engaging',         provider: 'deepgram' },
  { id: 'aura-2-odysseus-en',  name: 'Odysseus',  gender: 'M', style: 'Deep · Authoritative',      provider: 'deepgram' },
  { id: 'aura-2-orion-en',     name: 'Orion',     gender: 'M', style: 'Clear · Professional',      provider: 'deepgram' },
  { id: 'aura-2-helios-en',    name: 'Helios',    gender: 'M', style: 'Warm · Confident',          provider: 'deepgram' },
  { id: 'aura-2-zeus-en',      name: 'Zeus',      gender: 'M', style: 'Strong · Commanding',       provider: 'deepgram' },
  { id: 'aura-2-apollo-en',    name: 'Apollo',    gender: 'M', style: 'Smooth · Charismatic',      provider: 'deepgram' },
];

interface ArcCard { id: string; label: string; emoji: string; desc: string; is_premium?: boolean }
interface StyleCard { id: string; label: string; emoji: string; desc: string; is_premium?: boolean }

// Fallbacks shown while DB loads
const FALLBACK_arcCards: ArcCard[] = [
  { id: '', label: 'Auto-detect', emoji: '✨', desc: 'AI picks the best arc for your story (recommended)', is_premium: false },
];
const FALLBACK_STYLE_CARDS: StyleCard[] = [
  { id: '', label: 'Auto-detect', emoji: '✨', desc: 'AI picks the best style for your story', is_premium: false },
];

// ============================================================================
// TYPES
// ============================================================================

type WizardStep =
  | 'source' | 'start' | 'voice' | 'music' | 'arc' | 'story'
  | 'generating_story' | 'review_story'
  | 'generating_images' | 'review_images'
  | 'finalizing' | 'preview';

type TemplateSource = 'public' | 'user';
type GenderFilter = 'all' | 'F' | 'M';
type ProviderFilter = 'all' | 'deepgram' | 'elevenlabs';

const STEP_LABELS = ['Template', 'Voice', 'Music', 'Arc', 'Story', 'Review', 'Images', 'Preview'];

// ============================================================================
// HELPERS
// ============================================================================

function getDefaultDuration(type: string): number {
  const d: Record<string, number> = {
    'stat': 3, 'comparison': 4, 'text': 3, 'image': 4, 'quote': 4, 'list': 5,
    'timeline': 6, 'callout': 3, 'icon-list': 5, 'line-chart': 5, 'pie-chart': 5,
    'code': 6, 'testimonial': 5, 'whatsapp-chat': 8, 'motivational-image': 6,
    'counter': 4, 'progress-bar': 3, 'qr-code': 4, 'video': 5,
    'avatar-grid': 5, 'social-stats': 4, 'cta': 3, 'gradient-text': 4,
    'animated-bg': 5, 'countdown': 4, 'weather-block': 4,
    'tower-chart-3d': 20, 'bar-race-3d': 15, 'parallax-story': 10,
  };
  return d[type] || 4;
}

function buildPlanFromBlocks(contentBlocks: Array<{ type: string; duration?: number }>) {
  const typeToId: Record<string, string> = {
    'stat': COMPONENT_IDS.STAT, 'comparison': COMPONENT_IDS.COMPARISON,
    'text': COMPONENT_IDS.TEXT, 'image': COMPONENT_IDS.IMAGE,
    'quote': COMPONENT_IDS.QUOTE, 'list': COMPONENT_IDS.LIST,
    'timeline': COMPONENT_IDS.TIMELINE, 'callout': COMPONENT_IDS.CALLOUT,
    'icon-list': COMPONENT_IDS.ICON_LIST, 'line-chart': COMPONENT_IDS.LINE_CHART,
    'pie-chart': COMPONENT_IDS.PIE_CHART, 'code': COMPONENT_IDS.CODE,
    'testimonial': COMPONENT_IDS.TESTIMONIAL, 'whatsapp-chat': COMPONENT_IDS.WHATSAPP_CHAT,
    'motivational-image': COMPONENT_IDS.MOTIVATIONAL_IMAGE,
    'counter': COMPONENT_IDS.COUNTER, 'progress-bar': COMPONENT_IDS.PROGRESS_BAR,
    'qr-code': COMPONENT_IDS.QR_CODE, 'video': COMPONENT_IDS.VIDEO,
    'avatar-grid': COMPONENT_IDS.AVATAR_GRID, 'social-stats': COMPONENT_IDS.SOCIAL_STATS,
    'cta': COMPONENT_IDS.CTA, 'gradient-text': COMPONENT_IDS.GRADIENT_TEXT,
    'animated-bg': COMPONENT_IDS.ANIMATED_BG, 'countdown': COMPONENT_IDS.COUNTDOWN,
    'weather-block': COMPONENT_IDS.WEATHER, 'tower-chart-3d': COMPONENT_IDS.TOWER_CHART_3D,
    'bar-race-3d': COMPONENT_IDS.BAR_RACE_3D, 'parallax-story': COMPONENT_IDS.PARALLAX_STORY,
  };
  const decisions = contentBlocks.map(b => {
    const duration = b.duration || getDefaultDuration(b.type);
    return {
      componentId: typeToId[b.type] || COMPONENT_IDS.TEXT,
      motionProfile: 'dynamic' as const,
      duration,
      animation: { enter: 0.4, hold: duration - 0.6, exit: 0.2 },
    };
  });
  return {
    decisions,
    totalDuration: decisions.reduce((s, d) => s + d.duration, 0),
    suggestedTransitions: decisions.map(() => 'fade' as const),
  };
}

function setValueAtPath(target: Record<string, any>, fieldPath: string, value: unknown) {
  const root = fieldPath.match(/^[^[.]+/)?.[0] ?? fieldPath;
  const resolvedPath =
    target.type === 'custom-plugin' &&
    !fieldPath.startsWith('pluginData.') &&
    !['audioSrc', 'duration', 'audioLoop', 'title'].includes(root)
      ? `pluginData.${fieldPath}`
      : fieldPath;
  const parts = resolvedPath.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let cur: any = target;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const existing = cur[part];

    if (existing === undefined || existing === null || typeof existing !== 'object') {
      cur[part] = /^\d+$/.test(nextPart) ? [] : {};
    }

    cur = cur[part];
  }

  if (parts.length > 0) {
    cur[parts[parts.length - 1]] = value;
  }
}

function getPreviewDims(ratio: string) {
  switch (ratio) {
    case '9:16': return { width: 270, height: 480 };
    case '16:9': return { width: 480, height: 270 };
    case '1:1':  return { width: 360, height: 360 };
    case '4:5':  return { width: 360, height: 450 };
    default:     return { width: 270, height: 480 };
  }
}

// ============================================================================
// PROGRESS DOTS
// ============================================================================

function ProgressDots({ step }: { step: WizardStep }) {
  const stepIndex: Record<WizardStep, number> = {
    source: -1, start: -1,
    voice: 0, music: 1, arc: 2, story: 3,
    generating_story: 4, review_story: 4,
    generating_images: 5, review_images: 5,
    finalizing: 6, preview: 7,
  };
  const current = stepIndex[step];
  if (current < 0) return null;

  return (
    <div className="flex items-center gap-2 mb-8 flex-wrap">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < current ? 'bg-purple-500' : i === current ? 'bg-purple-400 ring-2 ring-purple-400/40' : 'bg-slate-200 dark:bg-gray-700'
            }`} />
            <span className={`text-xs font-medium transition-colors ${i <= current ? 'text-purple-300' : 'text-gray-600'}`}>
              {label}
            </span>
          </div>
          {i < STEP_LABELS.length - 1 && (
            <div className={`h-px w-6 ${i < current ? 'bg-purple-500' : 'bg-slate-100 dark:bg-gray-800'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// SPINNER STEP (reused for generating_story, generating_images, finalizing)
// ============================================================================

function SpinnerStep({ title, subtitle, phases }: { title: string; subtitle: string; phases?: string[] }) {
  const [currentPhase, setCurrentPhase] = useState(0);

  useEffect(() => {
    if (!phases?.length) return;
    const interval = setInterval(() => {
      setCurrentPhase(prev => (prev + 1) % phases.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [phases]);

  return (
    <motion.div
      key="spinner"
      variants={{ initial: { opacity: 0, x: 20 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -20 } }}
      initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}
      className="flex flex-col items-center justify-center min-h-[60vh] text-center"
    >
      <div className="relative w-24 h-24 mb-8">
        <div className="absolute inset-0 rounded-full border-4 border-slate-300 dark:border-gray-800" />
        <div className="absolute inset-0 rounded-full border-4 border-t-purple-500 border-r-pink-500 border-b-transparent border-l-transparent animate-spin" />
        <div className="absolute inset-3 rounded-full border-4 border-t-pink-400 border-r-transparent border-b-transparent border-l-transparent animate-spin [animation-direction:reverse] [animation-duration:1.2s]" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">🎬</div>
      </div>
      <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">{title}</h2>
      <p className="text-slate-500 dark:text-gray-400 mb-6">{subtitle}</p>
      {phases && phases.length > 0 && (
        <div className="flex flex-col items-center gap-2">
          {phases.map((phase, i) => (
            <motion.div
              key={phase}
              initial={{ opacity: 0.4 }}
              animate={{ opacity: i === currentPhase ? 1 : i < currentPhase ? 0.6 : 0.3 }}
              className="flex items-center gap-2 text-sm"
            >
              {i < currentPhase ? (
                <CheckCircle className="w-4 h-4 text-green-400" />
              ) : i === currentPhase ? (
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
              ) : (
                <div className="w-4 h-4 rounded-full border border-slate-300 dark:border-gray-700" />
              )}
              <span className={i <= currentPhase ? 'text-slate-700 dark:text-gray-300' : 'text-gray-600'}>{phase}</span>
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// CATEGORY EMOJI MAP
// ============================================================================

const CATEGORY_EMOJI: Record<string, string> = {
  motivation: '🔥', documentary: '🎬', tutorial: '📚', business: '💼',
  lifestyle: '🌟', sports: '🏆', food: '🍔', news: '📰',
  entertainment: '🎭', finance: '📈', religious: '🕌', educational: '📖',
  story: '📖', movie: '🎥',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function TemplateGallery({ embedded }: { embedded?: boolean } = {}) {
  const router = useRouter();
  const { data: session } = useSession();
  const { userTemplates, publicTemplates, loadDbTemplates, loadPublicTemplates, makeTemplatePublic } = useEditorStore();
  const { config } = useSiteConfig();
  const premiumConfig = usePremiumConfig();
  const stylePreviews: Record<string, string> = config.visual_style_previews || {};
  const arcPreviews: Record<string, string> = config.arc_previews || {};

  // ── Existing wizard state
  const [step, setStep] = useState<WizardStep>('source');
  const [templateSource, setTemplateSource] = useState<TemplateSource>('public');
  const [selectedTemplate, setSelectedTemplate] = useState<UserTemplate | null>(null);
  // niche removed — templates have descriptions
  const [selectedVoice, setSelectedVoice] = useState('aura-2-thalia-en');
  const [selectedLanguage, setSelectedLanguage] = useState('en');
  const [selectedArc, setSelectedArc] = useState('');
  const [selectedVisualStyle, setSelectedVisualStyle] = useState('');
  const [customVisualPrompt, setCustomVisualPrompt] = useState('');
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState<GenderFilter>('all');
  const [providerFilter, setProviderFilter] = useState<ProviderFilter>('all');
  const [selectedMusic, setSelectedMusic] = useState<MusicTrack | null>(null);
  const [moodFilter, setMoodFilter] = useState<MusicMood | 'all'>('all');
  const [playingMusicId, setPlayingMusicId] = useState<string | null>(null);
  const [musicTracks, setMusicTracks] = useState<MusicTrack[]>([]);
  const musicAudioRef = useRef<HTMLAudioElement | null>(null);
  const [voices, setVoices] = useState<TTSVoice[]>(FALLBACK_VOICES);
  const [arcCards, setArcCards] = useState<ArcCard[]>(FALLBACK_arcCards);
  const [styleCards, setStyleCards] = useState<StyleCard[]>(FALLBACK_STYLE_CARDS);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const isAdmin = hasPremiumAccess(session?.user?.role);

  // ── New wizard state
  const [wizardThreadId, setWizardThreadId]       = useState('');
  const [wizardVideoMeta, setWizardVideoMeta]     = useState<Record<string, any> | null>(null);
  const [narrativePlan, setNarrativePlan]         = useState<NarrativeBrief[]>([]);
  const [wizardArc, setWizardArc]                 = useState('');
  const [engagementScore, setEngagementScore]     = useState<number | null>(null);
  const [editedScripts, setEditedScripts]         = useState<Record<number, string>>({});
  const [wizardVisualStyleGuide, setWizardVisualStyleGuide] = useState('');
  const [blocksWithImages, setBlocksWithImages]   = useState<Record<string, any>[]>([]);
  const [imageItems, setImageItems]               = useState<WizardImageItem[]>([]);
  const [videoItems, setVideoItems]               = useState<WizardVideoItem[]>([]);
  const [finalPayload, setFinalPayload]           = useState<{ videoMeta: Record<string, any>; contentBlocks: Record<string, any>[]; sourceTemplateId?: string } | null>(null);
  const [regenLoading, setRegenLoading]           = useState<Record<string, boolean>>({});
  const [regenPrompts, setRegenPrompts]           = useState<Record<string, string>>({});
  const [regenOpen, setRegenOpen]                 = useState<string | null>(null);

  useEffect(() => {
    loadDbTemplates();
    loadPublicTemplates();
    // Fetch voices from all providers
    fetch('/api/ai/voices').then(r => r.json()).then(data => {
      if (data.voices?.length) setVoices(data.voices);
    }).catch(() => {});
    // Fetch music tracks from DB
    fetch('/api/music').then(r => r.json()).then(data => {
      if (data.tracks?.length) setMusicTracks(data.tracks);
    }).catch(() => {});
    // Fetch story arcs and visual styles from DB
    fetch('/api/story-arcs').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setArcCards(data.map((a: any) => ({ id: a.id, label: a.label, emoji: a.emoji, desc: a.description, is_premium: a.is_premium })));
    }).catch(() => {});
    fetch('/api/visual-styles').then(r => r.json()).then(data => {
      if (Array.isArray(data) && data.length) setStyleCards(data.map((s: any) => ({ id: s.id, label: s.label, emoji: s.emoji, desc: s.description, is_premium: s.is_premium })));
    }).catch(() => {});
  }, [loadDbTemplates, loadPublicTemplates]);

  const visibleTemplates = templateSource === 'public' ? publicTemplates : userTemplates;
  const hasPremium = hasPremiumAccess(session?.user?.role);

  const goToPremiumUpgrade = useCallback(() => {
    window.open(getUpgradeUrl(premiumConfig), '_blank');
  }, [premiumConfig]);

  // ── Preview player config
  const previewPlan = useMemo(() => {
    if (!finalPayload?.contentBlocks?.length) return null;
    return buildPlanFromBlocks(finalPayload.contentBlocks);
  }, [finalPayload]);

  const previewConfig = useMemo(() => {
    if (!finalPayload || !previewPlan) return null;
    return getCompositionConfig(finalPayload as any, previewPlan);
  }, [finalPayload, previewPlan]);

  // ── Voice preview ─────────────────────────────────────────────────────────
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const voiceCacheRef = useRef<Record<string, string>>({});

  const handleVoicePreview = useCallback(async (voiceId: string) => {
    // If already playing this voice, stop it
    if (playingVoice === voiceId) {
      voiceAudioRef.current?.pause();
      voiceAudioRef.current = null;
      setPlayingVoice(null);
      return;
    }
    // Stop any currently playing
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    setPlayingVoice(null);

    // Use cache, previewUrl, or fetch from TTS
    let audioUrl = voiceCacheRef.current[voiceId];
    if (!audioUrl) {
      // Check if the voice has a previewUrl from the provider (e.g. ElevenLabs)
      const voice = voices.find(v => v.id === voiceId);
      if (voice?.previewUrl) {
        audioUrl = voice.previewUrl;
        voiceCacheRef.current[voiceId] = audioUrl;
      } else {
        setLoadingVoice(voiceId);
        try {
          const res = await fetch('/api/ai/tts-preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ voiceId, language: selectedLanguage }),
          });
          const data = await res.json();
          if (!res.ok || !data.audio) throw new Error(data.error || 'Preview failed');
          audioUrl = data.audio;
          voiceCacheRef.current[voiceId] = audioUrl;
        } catch {
          setLoadingVoice(null);
          return;
        }
        setLoadingVoice(null);
      }
    }

    const audio = new Audio(audioUrl);
    audio.onended = () => { setPlayingVoice(null); voiceAudioRef.current = null; };
    voiceAudioRef.current = audio;
    setPlayingVoice(voiceId);
    audio.play();
  }, [playingVoice, voices]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => { voiceAudioRef.current?.pause(); musicAudioRef.current?.pause(); };
  }, []);

  // Stop music preview when leaving music step
  useEffect(() => {
    if (step !== 'music') {
      musicAudioRef.current?.pause();
      musicAudioRef.current = null;
      setPlayingMusicId(null);
    }
  }, [step]);

  const handleMusicPreview = useCallback((track: MusicTrack) => {
    if (playingMusicId === track.id) {
      musicAudioRef.current?.pause();
      musicAudioRef.current = null;
      setPlayingMusicId(null);
      return;
    }
    musicAudioRef.current?.pause();
    musicAudioRef.current = null;

    const audio = new Audio(track.src);
    audio.volume = 0.5;
    audio.onended = () => { setPlayingMusicId(null); musicAudioRef.current = null; };
    musicAudioRef.current = audio;
    setPlayingMusicId(track.id);
    audio.play().catch(() => setPlayingMusicId(null));
  }, [playingMusicId]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleSelectTemplate = (t: UserTemplate) => {
    const freeAccessible = Boolean(t.isFreeTier) || !containsPremiumBlocks(t.blocks);
    if (!hasPremium && containsPremiumBlocks(t.blocks) && !(templateSource === 'public' && freeAccessible)) {
      setError('Upgrade to Premium to use templates with advanced blocks like 3D Tower, 3D Race, Parallax, and Video.');
      goToPremiumUpgrade();
      return;
    }

    setSelectedTemplate(t);
    setStep('voice');
  };

  // Stage 1: start wizard graph — runs until story review interrupt
  const handleGenerate = async () => {
    if (!prompt.trim()) { setError('Please describe your video'); return; }
    const model = getSelectedModel();

    const threadId = `wizard-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    setWizardThreadId(threadId);
    setStep('generating_story');
    setError(null);
    setEditedScripts({});

    try {
      const res = await fetch('/api/ai/wizard/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          threadId,
          templateId: selectedTemplate?.id,
          userStory: [selectedTemplate?.description, prompt].filter(Boolean).join('\n\nUser story: '),
          templateBlocks: selectedTemplate!.blocks,
          partialVideoMeta: {
            audioTracks: selectedMusic ? [{
              id: `bg-${selectedMusic.id}`,
              name: selectedMusic.name,
              src: selectedMusic.src,
              volume: 0.2,
              startTime: 0,
              fadeIn: 2,
              fadeOut: 2,
              loop: true,
              muted: false,
            }] : [],
          },
          preferredArc: selectedArc || null,
          preferredVoice: selectedVoice,
          preferredVisualStyle: selectedVisualStyle || null,
          customVisualPrompt: selectedVisualStyle === 'custom' ? customVisualPrompt : null,
          language: selectedLanguage,
          model,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Story generation failed');
      }

      const data = await res.json();
      if (data.status === 'interrupted' && data.interrupt?.type === 'review_story') {
        setWizardVideoMeta(data.interrupt.videoMeta);
        setNarrativePlan(data.interrupt.narrativePlan);
        setWizardArc(data.interrupt.selectedArc);
        setEngagementScore(data.interrupt.engagementScore ?? null);
        setWizardVisualStyleGuide(data.interrupt.visualStyleGuide ?? '');
        setStep('review_story');
      } else {
        throw new Error('Unexpected wizard state');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setStep('story');
    }
  };

  // Stage 2: resume wizard graph with edited scripts — runs until image review interrupt
  const handleConfirmStory = async () => {
    setStep('generating_images');
    setError(null);

    try {
      const res = await fetch('/api/ai/wizard/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          threadId: wizardThreadId,
          value: { editedScripts },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Image generation failed');
      }

      const data = await res.json();
      if (data.status === 'interrupted' && data.interrupt?.type === 'review_images') {
        setBlocksWithImages(data.interrupt.blocks);
        setImageItems(data.interrupt.imageItems);
        setVideoItems(data.interrupt.videoItems ?? []);
        if (data.interrupt.visualStyleGuide) setWizardVisualStyleGuide(data.interrupt.visualStyleGuide);
        const prompts: Record<string, string> = {};
        (data.interrupt.imageItems as WizardImageItem[]).forEach(item => {
          prompts[`${item.blockIdx}:${item.fieldPath}`] = item.description;
        });
        (data.interrupt.videoItems as WizardVideoItem[] ?? []).forEach((item: WizardVideoItem) => {
          prompts[`video:${item.blockIdx}:${item.fieldPath}`] = item.description;
        });
        setRegenPrompts(prompts);
        setStep('review_images');
      } else {
        throw new Error('Unexpected wizard state');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setStep('review_story');
    }
  };

  // Stage 2b: regenerate one image
  const handleRegenerateImage = async (key: string) => {
    const item = imageItems.find(it => `${it.blockIdx}:${it.fieldPath}` === key);
    if (!item) return;

    const description = regenPrompts[key] ?? item.description;
    setRegenLoading(prev => ({ ...prev, [key]: true }));
    setRegenOpen(null);

    try {
      const res = await fetch('/api/ai/wizard/regenerate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, removeBackground: item.removeBackground, visualStyleGuide: wizardVisualStyleGuide }),
      });

      const data = await res.json();
      if (data.url) {
        // Update imageItems
        setImageItems(prev => prev.map(it =>
          `${it.blockIdx}:${it.fieldPath}` === key ? { ...it, url: data.url, description } : it
        ));
        // Update the URL in blocksWithImages via the field path
        setBlocksWithImages(prev => {
          const updated = [...prev];
          const copy = { ...updated[item.blockIdx] };
          setValueAtPath(copy, item.fieldPath, data.url);
          updated[item.blockIdx] = copy;
          return updated;
        });
      }
    } catch (e) {
      console.error('Regen failed', e);
    } finally {
      setRegenLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Stage 2c: regenerate one video
  const handleRegenerateVideo = async (key: string) => {
    const item = videoItems.find(it => `video:${it.blockIdx}:${it.fieldPath}` === key);
    if (!item) return;

    const prompt = regenPrompts[key] ?? item.description;
    setRegenLoading(prev => ({ ...prev, [key]: true }));
    setRegenOpen(null);

    // Derive aspect ratio from videoMeta dimensions
    const w = wizardVideoMeta?.width || 1080;
    const h = wizardVideoMeta?.height || 1920;
    const aspectRatio = w > h ? '16:9' : w === h ? '1:1' : '9:16';

    try {
      const res = await fetch('/api/ai/wizard/regenerate-video', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, aspectRatio, visualStyleGuide: wizardVisualStyleGuide }),
      });

      const data = await res.json();
      if (data.url) {
        setVideoItems(prev => prev.map(it =>
          `video:${it.blockIdx}:${it.fieldPath}` === key ? { ...it, url: data.url, description: prompt } : it
        ));
        setBlocksWithImages(prev => {
          const updated = [...prev];
          const copy = { ...updated[item.blockIdx] };
          setValueAtPath(copy, item.fieldPath, data.url);
          updated[item.blockIdx] = copy;
          return updated;
        });
      }
    } catch (e) {
      console.error('Video regen failed', e);
    } finally {
      setRegenLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Stage 2d: upload a video file for a video item
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const [uploadingVideoKey, setUploadingVideoKey] = useState<string | null>(null);
  const [videoUrlInputKey, setVideoUrlInputKey] = useState<string | null>(null);
  const [videoUrlInputValue, setVideoUrlInputValue] = useState('');

  const handleUploadVideo = async (key: string, file: File) => {
    const item = videoItems.find(it => `video:${it.blockIdx}:${it.fieldPath}` === key);
    if (!item) return;

    setRegenLoading(prev => ({ ...prev, [key]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/video/upload-s3', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (data.url) {
        setVideoItems(prev => prev.map(it =>
          `video:${it.blockIdx}:${it.fieldPath}` === key ? { ...it, url: data.url } : it
        ));
        setBlocksWithImages(prev => {
          const updated = [...prev];
          const copy = { ...updated[item.blockIdx] };
          setValueAtPath(copy, item.fieldPath, data.url);
          updated[item.blockIdx] = copy;
          return updated;
        });
      } else {
        console.error('Upload failed:', data.error);
      }
    } catch (e) {
      console.error('Video upload failed', e);
    } finally {
      setRegenLoading(prev => ({ ...prev, [key]: false }));
      setUploadingVideoKey(null);
    }
  };

  const handleSetVideoUrl = (key: string, url: string) => {
    const item = videoItems.find(it => `video:${it.blockIdx}:${it.fieldPath}` === key);
    if (!item || !url.trim()) return;
    setVideoItems(prev => prev.map(it =>
      `video:${it.blockIdx}:${it.fieldPath}` === key ? { ...it, url: url.trim() } : it
    ));
    setBlocksWithImages(prev => {
      const updated = [...prev];
      const copy = { ...updated[item.blockIdx] };
      setValueAtPath(copy, item.fieldPath, url.trim());
      updated[item.blockIdx] = copy;
      return updated;
    });
    setVideoUrlInputKey(null);
    setVideoUrlInputValue('');
  };

  const handleUploadImage = async (key: string, file: File) => {
    const item = imageItems.find(it => `${it.blockIdx}:${it.fieldPath}` === key);
    if (!item) return;

    setRegenLoading(prev => ({ ...prev, [key]: true }));
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/image/upload-s3', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        setImageItems(prev => prev.map(it =>
          `${it.blockIdx}:${it.fieldPath}` === key ? { ...it, url: data.url } : it
        ));
        setBlocksWithImages(prev => {
          const updated = [...prev];
          const copy = { ...updated[item.blockIdx] };
          setValueAtPath(copy, item.fieldPath, data.url);
          updated[item.blockIdx] = copy;
          return updated;
        });
      }
    } catch (e) {
      console.error('Image upload failed', e);
    } finally {
      setRegenLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  // Stage 3: resume wizard graph with (potentially updated) blocks — runs audio + assembles payload
  const handleConfirmImages = async () => {
    setStep('finalizing');
    setError(null);

    try {
      const res = await fetch('/api/ai/wizard/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'resume',
          threadId: wizardThreadId,
          value: { updatedBlocks: blocksWithImages },
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Finalization failed');
      }

      const data = await res.json();
      if (data.status === 'complete' && data.payload) {
        setFinalPayload({
          ...data.payload,
          sourceTemplateId: selectedTemplate?.id,
        });
        setStep('preview');
      } else if (data.status === 'interrupted' && data.interrupt?.type === 'review_audio') {
        // Auto-approve audio in web UI — resume immediately with no changes
        const resumeRes = await fetch('/api/ai/wizard/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resume', threadId: wizardThreadId, value: { approved: true } }),
        });
        if (!resumeRes.ok) throw new Error('Audio finalization failed');
        const resumeData = await resumeRes.json();
        if (resumeData.status === 'complete' && resumeData.payload) {
          setFinalPayload({ ...resumeData.payload, sourceTemplateId: selectedTemplate?.id });
          setStep('preview');
        } else {
          throw new Error('Unexpected wizard state after audio');
        }
      } else {
        throw new Error('Unexpected wizard state');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed');
      setStep('review_images');
    }
  };

  // Open in editor (final step)
  const handleOpenInEditor = () => {
    if (!finalPayload) return;
    try { sessionStorage.setItem('pending_video_input', JSON.stringify(finalPayload)); } catch {}
    const { setVideoInput } = useEditorStore.getState();
    setVideoInput(finalPayload as any);
    router.push('/editor');
  };

  // Start over from story step
  const handleStartOver = () => {
    setWizardThreadId('');
    setEditedScripts({});
    setNarrativePlan([]);
    setWizardVideoMeta(null);
    setBlocksWithImages([]);
    setImageItems([]);
    setVideoItems([]);
    setFinalPayload(null);
    setEngagementScore(null);
    setError(null);
    setStep('story');
  };

  // ── Step rendering ─────────────────────────────────────────────────────────

  const pageVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0 },
    exit:    { opacity: 0, x: -20 },
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-gray-950 text-slate-900 dark:text-white">
      {/* Header */}
      <div className="border-b border-slate-300 dark:border-gray-800 bg-gradient-to-r from-gray-900 via-purple-900/20 to-gray-900 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {!embedded && (
                <>
                  <Button
                    variant="ghost" size="sm"
                    onClick={() => router.push('/editor')}
                    className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white"
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back
                  </Button>
                  <div className="h-6 w-px bg-slate-200 dark:bg-gray-700" />
                </>
              )}
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                Create Video
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <ApiKeySettings />
              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setUserMenuOpen(p => !p)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 dark:bg-gray-800 transition-colors"
                >
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="" className="w-7 h-7 rounded-full object-cover" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-purple-500/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-purple-400" />
                    </div>
                  )}
                  <span className="text-sm text-slate-700 dark:text-gray-300 hidden sm:block max-w-[120px] truncate">
                    {session?.user?.name || session?.user?.email}
                  </span>
                </button>
                {userMenuOpen && (
                  <>
                    {/* backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-slate-300 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl z-50 overflow-hidden">
                      <div className="px-3 py-2.5 border-b border-slate-300 dark:border-gray-800">
                        <p className="text-xs font-medium text-slate-900 dark:text-white truncate">{session?.user?.name}</p>
                        <p className="text-[11px] text-slate-600 dark:text-gray-500 truncate">{session?.user?.email}</p>
                      </div>
                      <div className="py-1">
                        <a
                          href="/account"
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <Settings className="w-4 h-4" /> Account
                        </a>
                        <a
                          href="/support"
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-slate-700 dark:text-gray-300 hover:bg-slate-100 dark:bg-gray-800 hover:text-slate-900 dark:text-white transition-colors"
                          onClick={() => setUserMenuOpen(false)}
                        >
                          <LifeBuoy className="w-4 h-4" /> Support
                        </a>
                        <a
                          href="/api/auth/logout"
                          className="flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                        >
                          <LogOut className="w-4 h-4" /> Sign out
                        </a>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <AnimatePresence mode="wait">

          {/* ================================================================
              STEP: source
          ================================================================ */}
          {step === 'source' && (
            <motion.div key="source" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <div className="mb-10">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  Where do you want to start?
                </h2>
                <p className="text-slate-500 dark:text-gray-400">Choose a template source to continue.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
                <motion.div
                  whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.98 }}
                  onClick={() => { setTemplateSource('public'); setStep('start'); }}
                  className="group cursor-pointer bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-800 hover:border-purple-500/60 rounded-2xl p-8 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-5">
                    <Globe className="w-7 h-7 text-purple-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-purple-200 transition-colors mb-2">Public Templates</h3>
                  <p className="text-slate-600 dark:text-gray-500 text-sm leading-relaxed">Browse curated templates published by the team. Great starting point for any niche.</p>
                  <div className="mt-5 text-xs text-purple-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                    Browse {publicTemplates.length} template{publicTemplates.length !== 1 ? 's' : ''} →
                  </div>
                </motion.div>
                <motion.div
                  whileHover={{ scale: 1.02, y: -3 }} whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (!hasPremium) {
                      goToPremiumUpgrade();
                      return;
                    }
                    setTemplateSource('user');
                    setStep('start');
                  }}
                  className="group cursor-pointer bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-800 hover:border-pink-500/60 rounded-2xl p-8 transition-all"
                >
                  <div className="w-14 h-14 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center justify-center mb-5">
                    {hasPremium ? <User className="w-7 h-7 text-pink-400" /> : <Lock className="w-7 h-7 text-pink-300" />}
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white group-hover:text-pink-200 transition-colors mb-2">My Templates</h3>
                  <p className="text-slate-600 dark:text-gray-500 text-sm leading-relaxed">
                    {hasPremium
                      ? 'Templates you have saved from the editor. Reuse your own structures with fresh AI content.'
                      : 'Premium-only workspace for saving and reusing your own templates.'}
                  </p>
                  <div className="mt-5">
                    {hasPremium ? (
                      <div className="text-xs text-pink-400 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                        {userTemplates.length > 0 ? `${userTemplates.length} saved template${userTemplates.length !== 1 ? 's' : ''} →` : 'None saved yet →'}
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                        <Crown className="w-3.5 h-3.5" />
                        Upgrade to Premium
                      </div>
                    )}
                  </div>
                </motion.div>
              </div>
            </motion.div>
          )}

          {/* ================================================================
              STEP: start — template grid
          ================================================================ */}
          {step === 'start' && (
            <motion.div key="start" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <button onClick={() => setStep('source')} className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white text-sm mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">
                  {templateSource === 'public' ? 'Public Templates' : 'My Templates'}
                </h2>
                <p className="text-slate-500 dark:text-gray-400">
                  {templateSource === 'public' ? 'Pick a template — AI will fill it with your story.' : 'Your saved templates. Select one to generate fresh content.'}
                </p>
              </div>
              {templateSource === 'user' && !hasPremium ? (
                <div className="text-center py-24">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10">
                    <Crown className="h-8 w-8 text-amber-300" />
                  </div>
                  <p className="mb-2 text-lg font-medium text-slate-900 dark:text-white">My Templates is a Premium feature</p>
                  <p className="mx-auto mb-6 max-w-md text-sm text-slate-500 dark:text-gray-400">
                    Upgrade to save your own templates and reuse them later. Free users can still browse public templates.
                  </p>
                  <Button onClick={goToPremiumUpgrade} className="bg-purple-600 hover:bg-purple-700">
                    Upgrade to Premium
                  </Button>
                </div>
              ) : visibleTemplates.length === 0 ? (
                <div className="text-center py-24 text-slate-600 dark:text-gray-500">
                  {templateSource === 'user' ? (
                    <>
                      <User className="w-14 h-14 mx-auto mb-4 text-gray-700" />
                      <p className="text-lg font-medium text-slate-500 dark:text-gray-400 mb-2">No saved templates yet</p>
                      <p className="text-sm mb-6">Build a video in the editor and click "Save as Template" to see it here.</p>
                      <Button onClick={() => router.push('/editor')} className="bg-purple-600 hover:bg-purple-700">Go to Editor</Button>
                    </>
                  ) : (
                    <>
                      <Globe className="w-14 h-14 mx-auto mb-4 text-gray-700" />
                      <p className="text-lg font-medium text-slate-500 dark:text-gray-400 mb-2">No public templates yet</p>
                      <p className="text-sm">Admins can publish templates from My Templates.</p>
                    </>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {visibleTemplates.map((t, idx) => {
                    const emoji = CATEGORY_EMOJI[t.category ?? ''] ?? 'T';
                    const isFreeTemplate = templateSource === 'public' && (Boolean(t.isFreeTier) || !containsPremiumBlocks(t.blocks));
                    const isLockedTemplate = !hasPremium && containsPremiumBlocks(t.blocks) && !isFreeTemplate;
                    return (
                      <motion.div
                        key={t.id}
                        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        onClick={() => handleSelectTemplate(t)}
                        className="group cursor-pointer"
                      >
                        <div className="rounded-3xl overflow-hidden border border-slate-300 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-[0_10px_30px_rgba(0,0,0,0.35)] transition-all group-hover:-translate-y-1 group-hover:shadow-[0_18px_40px_rgba(0,0,0,0.45)] group-hover:border-purple-500/60">
                          <div className="relative aspect-[3/4] bg-slate-100 dark:bg-gray-800">
                            {t.previewUrl ? (
                              t.previewUrl.match(/\.(mp4|webm|mov)(\?|$)/i) ? (
                                <video src={t.previewUrl} muted loop playsInline autoPlay className="w-full h-full object-cover" />
                              ) : (
                                <img src={t.previewUrl} alt={t.name} className="w-full h-full object-cover" />
                              )
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-gray-800 via-gray-900 to-gray-800">
                                <span className="text-5xl">{emoji}</span>
                                <span className="text-xs text-slate-600 dark:text-gray-500">{t.blocks.length} blocks</span>
                              </div>
                            )}
                            {t.previewUrl && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity">
                                <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                                  <Play className="w-6 h-6 fill-white text-gray-900 ml-1" />
                                </div>
                              </div>
                            )}
                            <div className="absolute left-3 top-3 flex items-center gap-2">
                              {templateSource === 'public' && (
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[11px] border ${
                                    isFreeTemplate
                                      ? 'border-sky-500/20 bg-sky-500/10 text-sky-200'
                                      : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
                                  }`}
                                >
                                  {isFreeTemplate ? 'Free' : 'Premium'}
                                </span>
                              )}
                              {isAdmin && templateSource === 'user' && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); makeTemplatePublic(t.id); }}
                                  className="text-[11px] text-green-300 hover:text-green-200 transition-colors px-2 py-0.5 rounded-full bg-green-500/15 border border-green-500/30"
                                >
                                  Publish
                                </button>
                              )}
                            </div>
                            {isLockedTemplate && (
                              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 px-4 text-center">
                                <Crown className="h-8 w-8 text-amber-300" />
                                <p className="text-sm font-medium text-slate-900 dark:text-white">Premium template</p>
                                <p className="text-xs text-slate-800 dark:text-gray-200">This template uses advanced blocks.</p>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 text-center">
                          <div className="text-base font-semibold text-slate-900 dark:text-white group-hover:text-purple-200 transition-colors truncate">
                            {t.name}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-gray-500 mt-1">
                            {t.category || 'General'} - {t.blocks.length} blocks
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}

          {/* ================================================================
              STEP: voice
          ================================================================ */}
          {step === 'voice' && (
            <motion.div key="voice" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <button onClick={() => { setSelectedTemplate(null); setStep('start'); }} className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white text-sm mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <ProgressDots step="voice" />
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Language & Voice</h2>
                <p className="text-slate-500 dark:text-gray-400">Choose your language, then pick a voice.</p>
              </div>
              {/* Language selector */}
              <div className="flex flex-wrap gap-2 mb-4">
                {LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => {
                      setSelectedLanguage(l.code);
                      voiceCacheRef.current = {}; // clear preview cache — audio is language-specific
                      // Non-English: force ElevenLabs (Deepgram is English-only)
                      if (l.code !== 'en') {
                        setProviderFilter('elevenlabs');
                        if (selectedVoice.startsWith('aura-')) {
                          const firstEL = voices.find(v => v.provider === 'elevenlabs');
                          if (firstEL) setSelectedVoice(firstEL.id);
                        }
                      } else {
                        setProviderFilter('all');
                      }
                    }}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      selectedLanguage === l.code
                        ? 'bg-purple-600 text-slate-900 dark:text-white'
                        : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-gray-700'
                    }`}
                  >
                    {l.flag} {l.label}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mb-6">
                {(['all', 'F', 'M'] as GenderFilter[]).map(f => (
                  <button
                    key={f} onClick={() => setGenderFilter(f)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      genderFilter === f ? 'bg-purple-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-gray-700'
                    }`}
                  >
                    {f === 'all' ? 'All' : f === 'F' ? '♀ Female' : '♂ Male'}
                  </button>
                ))}
                <div className="w-px bg-slate-200 dark:bg-gray-700 mx-1" />
                {(['all', ...Array.from(new Set(voices.map(v => v.provider)))] as ProviderFilter[]).map(p => (
                  <button
                    key={p} onClick={() => setProviderFilter(p)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      providerFilter === p ? 'bg-purple-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-gray-700'
                    }`}
                  >
                    {p === 'all' ? 'All Providers' : p.charAt(0).toUpperCase() + p.slice(1)}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {voices.filter(v => {
                  if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
                  if (providerFilter !== 'all' && v.provider !== providerFilter) return false;
                  if (selectedLanguage !== 'en' && v.provider === 'deepgram') return false;
                  return true;
                }).map(v => {
                  const isLockedVoice = v.premium && !hasPremium;
                  return (
                  <motion.div
                    key={v.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      if (isLockedVoice) { goToPremiumUpgrade(); return; }
                      setSelectedVoice(v.id);
                    }}
                    className={`cursor-pointer rounded-xl p-4 border transition-all relative ${
                      selectedVoice === v.id
                        ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                        : isLockedVoice
                          ? 'border-slate-300 dark:border-gray-800 bg-white dark:bg-gray-900/60 opacity-75 hover:border-yellow-500/40'
                          : 'border-slate-300 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-purple-500/60'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${
                        v.gender === 'F' ? 'bg-pink-500/20 text-pink-300' : 'bg-blue-500/20 text-blue-300'
                      }`}>
                        {v.gender === 'F' ? '♀' : '♂'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-900 dark:text-white">{v.name}</span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            v.provider === 'elevenlabs' ? 'bg-emerald-500/15 text-emerald-400'
                              : v.provider === 'gemini' ? 'bg-amber-500/15 text-amber-400'
                              : 'bg-sky-500/15 text-sky-400'
                          }`}>{v.provider === 'elevenlabs' ? 'EL' : v.provider === 'gemini' ? 'GM' : 'DG'}</span>
                          {isLockedVoice && <Lock className="w-3.5 h-3.5 text-yellow-400" />}
                        </div>
                        <div className="text-slate-500 dark:text-gray-400 text-xs mt-0.5">
                          {v.style}{v.accent ? ` · ${v.accent}` : ''}
                          {isLockedVoice && <span className="ml-1 text-yellow-400/80">Premium</span>}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (isLockedVoice) { goToPremiumUpgrade(); return; }
                          handleVoicePreview(v.id);
                        }}
                        className={`ml-auto w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                          playingVoice === v.id
                            ? 'bg-purple-500 text-slate-900 dark:text-white'
                            : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:bg-gray-700 hover:text-slate-900 dark:text-white'
                        }`}
                      >
                        {loadingVoice === v.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : playingVoice === v.id ? (
                          <Square className="w-3 h-3 fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 fill-current" />
                        )}
                      </button>
                      {selectedVoice === v.id && <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
                    </div>
                  </motion.div>
                  );
                })}
              </div>
              <Button onClick={() => setStep('music')} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white px-8">Continue</Button>
            </motion.div>
          )}

          {/* ================================================================
              STEP: music
          ================================================================ */}
          {step === 'music' && (
            <motion.div key="music" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <button onClick={() => setStep('voice')} className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white text-sm mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <ProgressDots step="music" />
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Background Music</h2>
                <p className="text-slate-500 dark:text-gray-400">Pick a track to play softly under your narration. You can skip this or adjust later.</p>
              </div>

              {/* Mood filter pills */}
              <div className="flex flex-wrap gap-2 mb-6">
                <button
                  onClick={() => setMoodFilter('all')}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    moodFilter === 'all' ? 'bg-purple-600 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-gray-700'
                  }`}
                >All</button>
                {ALL_MOODS.map(mood => (
                  <button
                    key={mood}
                    onClick={() => setMoodFilter(mood)}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      moodFilter === mood ? MOOD_META[mood].color.replace('/15', '/30') + ' ring-1 ring-current' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white hover:bg-slate-200 dark:bg-gray-700'
                    }`}
                  >{MOOD_META[mood].emoji} {MOOD_META[mood].label}</button>
                ))}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 mb-8">
                {/* No Music option */}
                <motion.div
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedMusic(null)}
                  className={`cursor-pointer rounded-xl p-4 border-2 border-dashed transition-all ${
                    selectedMusic === null
                      ? 'border-purple-500 bg-purple-500/10'
                      : 'border-slate-300 dark:border-gray-700 bg-white dark:bg-gray-900 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-gray-800 flex items-center justify-center">
                      <VolumeX className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                    </div>
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-white">No Music</span>
                      <div className="text-slate-600 dark:text-gray-500 text-xs">Narration only</div>
                    </div>
                    {selectedMusic === null && <div className="ml-auto w-2 h-2 rounded-full bg-purple-400" />}
                  </div>
                </motion.div>

                {/* Track cards */}
                {musicTracks
                  .filter(t => moodFilter === 'all' || t.mood === moodFilter)
                  .map(track => {
                    const isSelected = selectedMusic?.id === track.id;
                    const isPlaying = playingMusicId === track.id;
                    const mood = MOOD_META[track.mood];
                    return (
                      <motion.div
                        key={track.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                        onClick={() => setSelectedMusic(track)}
                        className={`cursor-pointer rounded-xl p-4 border transition-all ${
                          isSelected
                            ? 'border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20'
                            : 'border-slate-300 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-purple-500/60'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleMusicPreview(track); }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                              isPlaying ? 'bg-purple-500 text-slate-900 dark:text-white' : 'bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:bg-gray-700 hover:text-slate-900 dark:text-white'
                            }`}
                          >
                            {isPlaying ? <Square className="w-3 h-3 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                          </button>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900 dark:text-white">{track.name}</span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${mood.color}`}>
                                {mood.emoji} {mood.label}
                              </span>
                            </div>
                            <div className="text-slate-600 dark:text-gray-500 text-xs mt-0.5">
                              {track.artist} &middot; {formatDuration(track.duration)}
                            </div>
                          </div>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-purple-400 flex-shrink-0" />}
                        </div>
                      </motion.div>
                    );
                  })}
              </div>

              {musicTracks.length === 0 && (
                <p className="text-slate-600 dark:text-gray-500 text-sm mb-4">No music tracks available yet. A content manager can upload tracks in the admin panel.</p>
              )}

              <Button onClick={() => setStep('arc')} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white px-8">Continue</Button>
            </motion.div>
          )}

          {/* ================================================================
              STEP: arc
          ================================================================ */}
          {step === 'arc' && (
            <motion.div key="arc" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <button onClick={() => setStep('music')} className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white text-sm mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <ProgressDots step="arc" />
              <div className="mb-8">
                <div className="flex items-center gap-3">
                  <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Choose your narrative arc</h2>
                  {!hasPremium && arcCards.some(a => a.is_premium) && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                      <Crown className="w-3 h-3" /> Premium
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-gray-400">Pick the storytelling structure that fits your content best.</p>
              </div>
              <div className="mb-8">
                <LoopingCarousel cardWidth={150} gap={12}>
                  {arcCards.map(a => {
                    const preview = arcPreviews[a.id || '_auto'];
                    const isSelected = selectedArc === a.id;
                    const isDefaultSelected = a.id === '' && selectedArc === '';
                    const isLocked = !hasPremium && a.is_premium;
                    return (
                      <motion.div
                        key={a.id} whileHover={{ scale: isLocked ? 1 : 1.03 }} whileTap={{ scale: isLocked ? 1 : 0.97 }}
                        onClick={() => {
                          if (isLocked) { goToPremiumUpgrade(); return; }
                          setSelectedArc(a.id);
                        }}
                        className={isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}
                      >
                        <div className={`aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all relative ${
                          isSelected
                            ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                            : isDefaultSelected
                              ? 'border-purple-500/50'
                              : isLocked
                                ? 'border-transparent opacity-50'
                                : 'border-transparent hover:border-purple-500/40'
                        }`}>
                          {preview ? (
                            <img src={preview} alt={a.label} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${
                              isSelected ? 'bg-purple-500/10' : 'bg-white dark:bg-gray-900'
                            }`}>
                              <span className="text-4xl">{a.emoji}</span>
                              <span className="text-slate-600 dark:text-gray-500 text-[10px] text-center px-2 leading-tight">{a.desc}</span>
                            </div>
                          )}
                          {isLocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                              <Lock className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className={`mt-2 text-center text-sm font-medium transition-colors ${
                          isSelected ? 'text-purple-300' : isLocked ? 'text-gray-600' : 'text-slate-900 dark:text-white'
                        }`}>{a.label}</div>
                      </motion.div>
                    );
                  })}
                </LoopingCarousel>
              </div>
              {/* Visual Style Picker */}
              <div className="mb-8 mt-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Choose visual style</h2>
                  {!hasPremium && styleCards.some(s => s.is_premium) && (
                    <span className="flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">
                      <Crown className="w-3 h-3" /> Premium
                    </span>
                  )}
                </div>
                <p className="text-slate-500 dark:text-gray-400 text-sm mt-2">
                  {hasPremium
                    ? 'Pick an art style for consistent visuals across all images.'
                    : 'Auto-detect is free. Upgrade to Premium to unlock premium visual styles.'}
                </p>
              </div>
              <div className="mb-4">
                <LoopingCarousel cardWidth={150} gap={12}>
                  {styleCards.map(s => {
                    const preview = stylePreviews[s.id || '_auto'];
                    const isSelected = selectedVisualStyle === s.id;
                    const isDefaultSelected = s.id === '' && selectedVisualStyle === '';
                    const isLocked = !hasPremium && s.is_premium;
                    return (
                      <motion.div
                        key={s.id} whileHover={{ scale: isLocked ? 1 : 1.03 }} whileTap={{ scale: isLocked ? 1 : 0.97 }}
                        onClick={() => {
                          if (isLocked) { goToPremiumUpgrade(); return; }
                          setSelectedVisualStyle(s.id);
                        }}
                        className={isLocked ? 'cursor-not-allowed' : 'cursor-pointer'}
                      >
                        <div className={`aspect-[3/4] rounded-2xl overflow-hidden border-2 transition-all relative ${
                          isSelected
                            ? 'border-purple-500 shadow-lg shadow-purple-500/20'
                            : isDefaultSelected
                              ? 'border-purple-500/50'
                              : isLocked
                                ? 'border-transparent opacity-50'
                                : 'border-transparent hover:border-purple-500/40'
                        }`}>
                          {preview ? (
                            <img src={preview} alt={s.label} className="w-full h-full object-cover" />
                          ) : (
                            <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${
                              isSelected ? 'bg-purple-500/10' : 'bg-white dark:bg-gray-900'
                            }`}>
                              <span className="text-4xl">{s.emoji}</span>
                              <span className="text-slate-600 dark:text-gray-500 text-[10px] text-center px-2 leading-tight">{s.desc}</span>
                            </div>
                          )}
                          {isLocked && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-2xl">
                              <Lock className="w-5 h-5 text-slate-500 dark:text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className={`mt-2 text-center text-sm font-medium transition-colors ${
                          isSelected ? 'text-purple-300' : isLocked ? 'text-gray-600' : 'text-slate-900 dark:text-white'
                        }`}>{s.label}</div>
                      </motion.div>
                    );
                  })}
                </LoopingCarousel>
              </div>
              {selectedVisualStyle === 'custom' && hasPremium && (
                <textarea
                  value={customVisualPrompt} onChange={e => setCustomVisualPrompt(e.target.value)}
                  placeholder="e.g. Dark gothic art with muted colors, cathedral-like architecture, stained glass lighting effects..."
                  rows={3}
                  className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder:text-gray-600 mb-4"
                />
              )}
              <Button onClick={() => setStep('story')} className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white px-8">Continue</Button>
            </motion.div>
          )}

          {/* ================================================================
              STEP: story
          ================================================================ */}
          {step === 'story' && (
            <motion.div key="story" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <button onClick={() => setStep('arc')} className="flex items-center gap-2 text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white text-sm mb-6 transition-colors">
                <ArrowLeft className="w-4 h-4" /> Back
              </button>
              <ProgressDots step="story" />
              <div className="mb-8">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Tell your story</h2>
                <p className="text-slate-500 dark:text-gray-400">Describe what your video should be about.</p>
              </div>
              <div className="max-w-2xl space-y-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">What should your video be about?</label>
                  <textarea
                    value={prompt} onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. The rise of Lionel Messi from a poor kid in Rosario to becoming the greatest footballer of all time..."
                    rows={6}
                    className="w-full bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-xl px-4 py-3 text-sm resize-none focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 placeholder:text-gray-600 min-h-[140px]"
                  />
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {selectedTemplate?.name && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700">📁 {selectedTemplate.name}</span>
                  )}
                  {selectedArc && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700">
                      {arcCards.find(a => a.id === selectedArc)?.emoji} {arcCards.find(a => a.id === selectedArc)?.label ?? selectedArc}
                    </span>
                  )}
                  <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700">
                    🎙 {voices.find(v => v.id === selectedVoice)?.name ?? selectedVoice}
                  </span>
                  {selectedVisualStyle && (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-gray-800 text-slate-500 dark:text-gray-400 border border-slate-300 dark:border-gray-700">
                      {styleCards.find(s => s.id === selectedVisualStyle)?.emoji} {styleCards.find(s => s.id === selectedVisualStyle)?.label ?? selectedVisualStyle}
                    </span>
                  )}
                </div>
                {error && (
                  <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>
                )}
                <Button
                  onClick={handleGenerate} disabled={!prompt.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white py-3 text-base font-semibold shadow-lg shadow-purple-500/30 disabled:opacity-50"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate Video
                </Button>
              </div>
            </motion.div>
          )}

          {/* ================================================================
              STEP: generating_story
          ================================================================ */}
          {step === 'generating_story' && (
            <SpinnerStep key="generating_story" title="Crafting your story..." subtitle="AI is writing and evaluating scripts for maximum engagement" phases={['Analyzing your prompt', 'Writing narrative scripts', 'Evaluating engagement', 'Refining if needed']} />
          )}

          {/* ================================================================
              STEP: review_story
          ================================================================ */}
          {step === 'review_story' && (
            <motion.div key="review_story" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <ProgressDots step="review_story" />
              <div className="mb-6">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Review your story</h2>
                <p className="text-slate-500 dark:text-gray-400">The AI planned {narrativePlan.length} blocks. Edit any narration script before generating images.</p>
                <div className="flex items-center gap-3 mt-3 flex-wrap">
                  {wizardArc && (
                    <span className="px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-medium">
                      Arc: {wizardArc}
                    </span>
                  )}
                  <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 text-slate-500 dark:text-gray-400 text-xs">
                    {narrativePlan.length} blocks
                  </span>
                  {engagementScore !== null && (
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      engagementScore >= 8 ? 'bg-green-500/10 border-green-500/20 text-green-300'
                        : engagementScore >= 7 ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-300'
                        : 'bg-orange-500/10 border-orange-500/20 text-orange-300'
                    }`}>
                      Engagement: {engagementScore.toFixed(1)}/10
                    </span>
                  )}
                </div>
              </div>

              <div className="space-y-4 mb-8 max-w-3xl">
                {narrativePlan.map((brief, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-800 rounded-xl p-5"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-xs font-bold text-slate-600 dark:text-gray-500">Block {i + 1}</span>
                      <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 text-xs font-medium border border-purple-500/20">
                        {brief.narrativeRole}
                      </span>
                    </div>
                    <p className="text-slate-900 dark:text-white font-semibold text-sm mb-3">{brief.keyMessage}</p>
                    <div className="relative">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Edit2 className="w-3 h-3 text-slate-600 dark:text-gray-500" />
                        <span className="text-xs text-slate-600 dark:text-gray-500">Narration script</span>
                      </div>
                      <textarea
                        value={editedScripts[i] !== undefined ? editedScripts[i] : brief.spokenScript}
                        onChange={e => setEditedScripts(prev => ({ ...prev, [i]: e.target.value }))}
                        rows={3}
                        className="w-full bg-slate-100 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 focus:border-purple-500 text-slate-800 dark:text-gray-200 text-sm rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-purple-500"
                      />
                    </div>
                  </motion.div>
                ))}
              </div>

              {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmStory}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white px-8"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Confirm & Generate Images
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="ghost" onClick={() => setStep('story')} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Edit Story
                </Button>
              </div>
            </motion.div>
          )}

          {/* ================================================================
              STEP: generating_images
          ================================================================ */}
          {step === 'generating_images' && (
            <SpinnerStep key="generating_images" title="Generating images & videos..." subtitle="Creating visuals for each block — this may take a few minutes" phases={['Classifying visual needs', 'Generating background images', 'Creating foreground elements', 'Generating video clips', 'Applying compositions']} />
          )}

          {/* ================================================================
              STEP: review_images
          ================================================================ */}
          {step === 'review_images' && (
            <motion.div key="review_images" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <ProgressDots step="review_images" />
              <div className="mb-6">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Review media</h2>
                <div className="flex items-center gap-3 mt-1">
                  {imageItems.length > 0 && (
                    <span className="px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-300 text-xs font-medium">
                      {imageItems.length} image{imageItems.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  {videoItems.length > 0 && (
                    <span className="px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs font-medium">
                      {videoItems.length} video{videoItems.length !== 1 ? 's' : ''}
                    </span>
                  )}
                  <span className="text-slate-600 dark:text-gray-500 text-xs">Click any item to edit its prompt and regenerate</span>
                </div>
              </div>

              {/* Video items */}
              {videoItems.length > 0 && (
                <div className="mb-6">
                  <h3 className="text-sm font-medium text-blue-300 mb-3">Video clips</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    {videoItems.map((item) => {
                      const key = `video:${item.blockIdx}:${item.fieldPath}`;
                      const isLoading = regenLoading[key];
                      const isOpen = regenOpen === key;
                      return (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: videoItems.indexOf(item) * 0.04 }}
                          className="bg-white dark:bg-gray-900 border border-blue-800/30 rounded-xl overflow-hidden"
                        >
                          <div className="relative aspect-video bg-slate-100 dark:bg-gray-800">
                            {item.url ? (
                              <video src={item.url} controls className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs text-center p-2">
                                No video generated
                              </div>
                            )}
                            {isLoading && (
                              <div className="absolute inset-0 bg-white dark:bg-gray-900/80 flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
                                <span className="text-xs text-blue-300">Generating video (may take a few minutes)...</span>
                              </div>
                            )}
                            <span className="absolute top-1.5 left-1.5 text-xs bg-blue-600/80 text-slate-900 dark:text-white px-1.5 py-0.5 rounded-full">video</span>
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs text-slate-600 dark:text-gray-500 truncate mb-2">Block {item.blockIdx + 1} · {item.fieldPath}</p>
                            {/* Scene prompt — always visible, editable */}
                            <textarea
                              value={regenPrompts[key] ?? item.description}
                              onChange={e => setRegenPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                              rows={3}
                              className="w-full bg-slate-100 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 text-slate-800 dark:text-gray-200 text-xs rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-blue-500 mb-1.5"
                            />
                            {/* Visual style guide — read-only, shown when available */}
                            {wizardVisualStyleGuide && (
                              <div className="mb-2">
                                <p className="text-xs text-purple-400/70 mb-0.5">Visual style (auto-prepended):</p>
                                <div className="w-full bg-white dark:bg-gray-900 border border-purple-800/30 text-slate-500 dark:text-gray-400 text-xs rounded-lg px-2 py-1.5 max-h-16 overflow-y-auto leading-relaxed">
                                  {wizardVisualStyleGuide}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-1.5">
                              <button
                                onClick={() => {
                                  const prompt = regenPrompts[key] ?? item.description;
                                  const full = wizardVisualStyleGuide ? `${wizardVisualStyleGuide}. ${prompt}` : prompt;
                                  navigator.clipboard.writeText(full);
                                }}
                                disabled={isLoading}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                title="Copy full prompt (style + scene)"
                              >
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                              <button
                                onClick={() => handleRegenerateVideo(key)}
                                disabled={isLoading}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                                Regen
                              </button>
                              <button
                                onClick={() => {
                                  setUploadingVideoKey(key);
                                  videoUploadRef.current?.click();
                                }}
                                disabled={isLoading}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <Upload className="w-3 h-3" />
                                Upload
                              </button>
                              <button
                                onClick={() => {
                                  setVideoUrlInputKey(videoUrlInputKey === key ? null : key);
                                  setVideoUrlInputValue('');
                                }}
                                disabled={isLoading}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <Link className="w-3 h-3" />
                                URL
                              </button>
                            </div>
                            {videoUrlInputKey === key && (
                              <div className="flex gap-1 mt-1">
                                <input
                                  type="url"
                                  value={videoUrlInputValue}
                                  onChange={e => setVideoUrlInputValue(e.target.value)}
                                  onKeyDown={e => e.key === 'Enter' && handleSetVideoUrl(key, videoUrlInputValue)}
                                  placeholder="Paste video URL…"
                                  className="flex-1 text-xs px-2 py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 border border-gray-600 text-slate-900 dark:text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                                />
                                <button
                                  onClick={() => handleSetVideoUrl(key, videoUrlInputValue)}
                                  className="text-xs px-2.5 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 transition-colors"
                                >
                                  Set
                                </button>
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Hidden file input for video upload */}
              <input
                ref={videoUploadRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file && uploadingVideoKey) {
                    handleUploadVideo(uploadingVideoKey, file);
                  }
                  e.target.value = '';
                }}
              />

              {/* Image items */}
              {imageItems.length > 0 && (
                <div className="mb-6">
                  {videoItems.length > 0 && <h3 className="text-sm font-medium text-green-300 mb-3">Images</h3>}
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {imageItems.map((item) => {
                      const key = `${item.blockIdx}:${item.fieldPath}`;
                      const isLoading = regenLoading[key];
                      const isOpen = regenOpen === key;
                      return (
                        <motion.div
                          key={key}
                          initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: imageItems.indexOf(item) * 0.04 }}
                          className="bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-800 rounded-xl overflow-hidden"
                        >
                          <div className="relative aspect-[3/4] bg-slate-100 dark:bg-gray-800">
                            {item.url && !item.url.includes('picsum') ? (
                              <img src={item.url} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-600 text-xs text-center p-2">
                                {item.url.includes('picsum') ? 'Placeholder' : 'No image'}
                              </div>
                            )}
                            {isLoading && (
                              <div className="absolute inset-0 bg-white dark:bg-gray-900/80 flex items-center justify-center">
                                <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
                              </div>
                            )}
                            {item.removeBackground && (
                              <span className="absolute top-1.5 right-1.5 text-xs bg-blue-500/80 text-slate-900 dark:text-white px-1.5 py-0.5 rounded-full">no bg</span>
                            )}
                          </div>
                          <div className="p-2.5">
                            <p className="text-xs text-slate-600 dark:text-gray-500 truncate mb-2">Block {item.blockIdx + 1} · {item.fieldPath}</p>
                            {/* Scene prompt — always visible, editable */}
                            <textarea
                              value={regenPrompts[key] ?? item.description}
                              onChange={e => setRegenPrompts(prev => ({ ...prev, [key]: e.target.value }))}
                              rows={3}
                              className="w-full bg-slate-100 dark:bg-gray-800 border border-slate-300 dark:border-gray-700 text-slate-800 dark:text-gray-200 text-xs rounded-lg px-2 py-1.5 resize-none focus:outline-none focus:border-purple-500 mb-1.5"
                            />
                            {/* Visual style guide — read-only, shown when available */}
                            {wizardVisualStyleGuide && (
                              <div className="mb-2">
                                <p className="text-xs text-purple-400/70 mb-0.5">Visual style (auto-prepended):</p>
                                <div className="w-full bg-white dark:bg-gray-900 border border-purple-800/30 text-slate-500 dark:text-gray-400 text-xs rounded-lg px-2 py-1.5 max-h-16 overflow-y-auto leading-relaxed">
                                  {wizardVisualStyleGuide}
                                </div>
                              </div>
                            )}
                            <div className="flex gap-1.5 mb-1.5">
                              <button
                                onClick={() => {
                                  const prompt = regenPrompts[key] ?? item.description;
                                  const full = wizardVisualStyleGuide ? `${wizardVisualStyleGuide}. ${prompt}` : prompt;
                                  navigator.clipboard.writeText(full);
                                }}
                                disabled={isLoading}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-slate-100 dark:bg-gray-800 hover:bg-slate-200 dark:bg-gray-700 text-slate-700 dark:text-gray-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                                title="Copy full prompt (style + scene)"
                              >
                                <Copy className="w-3 h-3" />
                                Copy
                              </button>
                              <button
                                onClick={() => handleRegenerateImage(key)}
                                disabled={isLoading}
                                className="flex-1 text-xs py-1.5 rounded-lg bg-purple-600/20 hover:bg-purple-600/40 text-purple-300 transition-colors disabled:opacity-50 flex items-center justify-center gap-1"
                              >
                                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                                Regen
                              </button>
                              <label
                                className={`flex-1 text-xs py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 transition-colors flex items-center justify-center gap-1 cursor-pointer ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}
                                title="Upload your own image"
                              >
                                <Upload className="w-3 h-3" />
                                Upload
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadImage(key, f); e.target.value = ''; }}
                                />
                              </label>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {error && <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">{error}</div>}

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmImages}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white px-8"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Looks good, continue
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
                <Button variant="ghost" onClick={() => setStep('review_story')} className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Back
                </Button>
              </div>
            </motion.div>
          )}

          {/* ================================================================
              STEP: finalizing
          ================================================================ */}
          {step === 'finalizing' && (
            <SpinnerStep key="finalizing" title="Adding audio..." subtitle="Generating voice narration and finalizing your video" phases={['Generating voice narration', 'Processing audio', 'Assembling final video']} />
          )}

          {/* ================================================================
              STEP: preview
          ================================================================ */}
          {step === 'preview' && finalPayload && (
            <motion.div key="preview" variants={pageVariants} initial="initial" animate="animate" exit="exit" transition={{ duration: 0.2 }}>
              <ProgressDots step="preview" />
              <div className="mb-6">
                <h2 className="text-3xl font-bold mb-2 bg-gradient-to-r from-white to-purple-200 bg-clip-text text-transparent">Your video is ready!</h2>
                <p className="text-slate-500 dark:text-gray-400">Preview below. Open in the editor to make adjustments, or start over.</p>
              </div>

              <div className="flex flex-col items-center gap-6 mb-8">
                {/* Remotion Player */}
                {previewConfig && previewPlan ? (
                  <div className="rounded-2xl overflow-hidden shadow-2xl shadow-purple-500/20 border border-slate-300 dark:border-gray-800">
                    <Player
                      component={DynamicVideo}
                      inputProps={{ input: finalPayload, plan: previewPlan } as any}
                      durationInFrames={previewConfig.durationInFrames}
                      compositionWidth={previewConfig.width}
                      compositionHeight={previewConfig.height}
                      fps={previewConfig.fps}
                      style={getPreviewDims(finalPayload.videoMeta?.aspectRatio ?? '9:16')}
                      controls
                      loop
                    />
                  </div>
                ) : (
                  <div className="w-[270px] h-[480px] rounded-2xl bg-white dark:bg-gray-900 border border-slate-300 dark:border-gray-800 flex items-center justify-center text-slate-600 dark:text-gray-500 text-sm">
                    Preview unavailable
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleOpenInEditor}
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-slate-900 dark:text-white px-8 py-3 text-base font-semibold"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Open in Editor
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={handleStartOver}
                    className="text-slate-500 dark:text-gray-400 hover:text-slate-900 dark:text-white px-6"
                  >
                    Start Over
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}
