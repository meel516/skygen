// ═══════════════════════════════════════════════════════════════════════════════
// Composable TTS Provider System
// Add new providers by implementing TTSProvider and registering in TTS_PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

// ── Concurrency limiter ──────────────────────────────────────────────────────

function createSemaphore(max: number) {
  let active = 0;
  const queue: (() => void)[] = [];
  return {
    async acquire() {
      if (active < max) { active++; return; }
      await new Promise<void>(resolve => queue.push(resolve));
      active++;
    },
    release() {
      active--;
      if (queue.length > 0) queue.shift()!();
    },
  };
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TTSVoice {
  id:          string;           // unique voice id (used as model param for the provider)
  name:        string;
  gender:      'M' | 'F';
  style:       string;           // short description shown in UI
  provider:    string;           // must match a key in TTS_PROVIDERS
  accent?:     string;           // e.g. "american", "british"
  language?:   string;           // primary language code e.g. "en"
  previewUrl?: string;           // direct audio URL for voice preview (no TTS call needed)
  premium?:    boolean;          // true = requires premium subscription
}

export interface TTSProvider {
  name:        string;
  /** Generate audio from text, return base64 data URL */
  synthesize:  (text: string, voiceId: string) => Promise<string>;
  /** Fetch available voices from the provider API. Return empty array if no list API. */
  fetchVoices: () => Promise<TTSVoice[]>;
}

// ── Provider: Deepgram ───────────────────────────────────────────────────────

let DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '4df63a77e2307626aa8e020a6c0d3d912b3f51a1';
const DEEPGRAM_TTS_URL = 'https://api.deepgram.com/v1/speak';

// Deepgram has no list-voices API — these are the Aura 2 models (English only)
const DEEPGRAM_STATIC_VOICES: TTSVoice[] = [
  { id: 'aura-2-thalia-en',    name: 'Thalia',    gender: 'F', style: 'Natural · Conversational',  provider: 'deepgram', language: 'en' },
  { id: 'aura-2-andromeda-en', name: 'Andromeda', gender: 'F', style: 'Professional · Clear',      provider: 'deepgram', language: 'en' },
  { id: 'aura-2-helena-en',    name: 'Helena',    gender: 'F', style: 'Warm · Friendly',           provider: 'deepgram', language: 'en' },
  { id: 'aura-2-stella-en',    name: 'Stella',    gender: 'F', style: 'Bright · Energetic',        provider: 'deepgram', language: 'en' },
  { id: 'aura-2-luna-en',      name: 'Luna',      gender: 'F', style: 'Soft · Calm',               provider: 'deepgram', language: 'en' },
  { id: 'aura-2-aurora-en',    name: 'Aurora',    gender: 'F', style: 'Smooth · Engaging',         provider: 'deepgram', language: 'en' },
  { id: 'aura-2-odysseus-en',  name: 'Odysseus',  gender: 'M', style: 'Deep · Authoritative',      provider: 'deepgram', language: 'en' },
  { id: 'aura-2-orion-en',     name: 'Orion',     gender: 'M', style: 'Clear · Professional',      provider: 'deepgram', language: 'en' },
  { id: 'aura-2-helios-en',    name: 'Helios',    gender: 'M', style: 'Warm · Confident',          provider: 'deepgram', language: 'en' },
  { id: 'aura-2-zeus-en',      name: 'Zeus',      gender: 'M', style: 'Strong · Commanding',       provider: 'deepgram', language: 'en' },
  { id: 'aura-2-apollo-en',    name: 'Apollo',    gender: 'M', style: 'Smooth · Charismatic',      provider: 'deepgram', language: 'en' },
];

const deepgramProvider: TTSProvider = {
  name: 'Deepgram',
  async synthesize(text: string, voiceId: string): Promise<string> {
    const response = await fetch(`${DEEPGRAM_TTS_URL}?model=${voiceId}`, {
      method: 'POST',
      headers: {
        'Authorization': `Token ${DEEPGRAM_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error((errorData as any).err_msg || `Deepgram API error: ${response.status}`);
    }

    const buf = Buffer.from(await response.arrayBuffer());
    const mime = response.headers.get('content-type') || 'audio/wav';
    return `data:${mime};base64,${buf.toString('base64')}`;
  },
  async fetchVoices(): Promise<TTSVoice[]> {
    // No list API — return static catalog
    return DEEPGRAM_STATIC_VOICES;
  },
};

// ── Language normalizer ──────────────────────────────────────────────────────

const LANG_NAME_TO_CODE: Record<string, string> = {
  english: 'en', spanish: 'es', french: 'fr', german: 'de', portuguese: 'pt',
  arabic: 'ar', hindi: 'hi', japanese: 'ja', korean: 'ko', chinese: 'zh',
  italian: 'it', dutch: 'nl', turkish: 'tr', russian: 'ru', polish: 'pl',
  swedish: 'sv', norwegian: 'no', danish: 'da', finnish: 'fi', czech: 'cs',
  romanian: 'ro', greek: 'el', hungarian: 'hu', thai: 'th', vietnamese: 'vi',
  indonesian: 'id', malay: 'ms', tagalog: 'tl', filipino: 'fil', ukrainian: 'uk',
};

function normalizeLanguageCode(raw?: string): string | undefined {
  if (!raw) return undefined;
  const lower = raw.toLowerCase().trim();
  if (lower.length <= 3) return lower; // already a code
  return LANG_NAME_TO_CODE[lower] ?? lower;
}

// ── Provider: ElevenLabs ─────────────────────────────────────────────────────

let ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || 'sk_7ae1f6d1a8c36a76cb4df6d1e6175193c6444dd2544d8258';
const ELEVENLABS_TTS_URL = 'https://api.elevenlabs.io/v1/text-to-speech';
const elevenlabsSemaphore = createSemaphore(2); // free tier: max 2 concurrent

const elevenlabsProvider: TTSProvider = {
  name: 'ElevenLabs',
  async synthesize(text: string, voiceId: string): Promise<string> {
    await elevenlabsSemaphore.acquire();
    try {
      const response = await fetch(`${ELEVENLABS_TTS_URL}/${voiceId}`, {
        method: 'POST',
        headers: {
          'xi-api-key': ELEVENLABS_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_v3',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.0,
            use_speaker_boost: true,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error((errorData as any).detail?.message || `ElevenLabs API error: ${response.status}`);
      }

      const buf = Buffer.from(await response.arrayBuffer());
      const mime = response.headers.get('content-type') || 'audio/mpeg';
      return `data:${mime};base64,${buf.toString('base64')}`;
    } finally {
      elevenlabsSemaphore.release();
    }
  },
  async fetchVoices(): Promise<TTSVoice[]> {
    try {
      const res = await fetch('https://api.elevenlabs.io/v1/voices', {
        headers: { 'xi-api-key': ELEVENLABS_API_KEY },
      });
      if (!res.ok) throw new Error(`ElevenLabs voices API: ${res.status}`);

      const data = await res.json();
      const voices: TTSVoice[] = (data.voices ?? []).map((v: any) => ({
        id:         v.voice_id,
        name:       v.name,
        gender:     v.labels?.gender === 'female' ? 'F' as const : 'M' as const,
        style:      [v.labels?.description, v.labels?.use_case]
                      .filter(Boolean).join(' · ') || 'Versatile',
        provider:   'elevenlabs',
        accent:     v.labels?.accent || undefined,
        language:   normalizeLanguageCode(v.labels?.language || v.fine_tuning?.language),
        previewUrl: v.preview_url || undefined,
        premium:    true,
      }));

      console.log(`[TTS] Fetched ${voices.length} ElevenLabs voices`);
      return voices;
    } catch (e) {
      console.error('[TTS] Failed to fetch ElevenLabs voices:', e);
      return [];
    }
  },
};

// ── Provider: Cartesia ──────────────────────────────────────────────────────

let CARTESIA_API_KEY = process.env.CARTESIA_API_KEY || '';
const CARTESIA_TTS_URL = 'https://api.cartesia.ai/tts/bytes';

const CARTESIA_STATIC_VOICES: TTSVoice[] = [
  { id: '694f9389-aac1-45b6-b726-9d9369183238', name: 'Barbershop Man',   gender: 'M', style: 'Casual · Friendly',       provider: 'cartesia', language: 'en' },
  { id: 'a0e99841-438c-4a64-b679-ae501e7d6091', name: 'Helpful Woman',    gender: 'F', style: 'Clear · Professional',     provider: 'cartesia', language: 'en' },
  { id: 'bf991597-6c13-47e4-8411-91ec2de5c466', name: 'Movieman',         gender: 'M', style: 'Deep · Cinematic',         provider: 'cartesia', language: 'en' },
  { id: '79a125e8-cd45-4c13-8a67-188112f4dd22', name: 'British Lady',     gender: 'F', style: 'Refined · British',        provider: 'cartesia', language: 'en', accent: 'british' },
  { id: '95856005-0332-41b0-935f-352e296aa0df', name: 'Classy British Man',gender: 'M', style: 'Polished · British',       provider: 'cartesia', language: 'en', accent: 'british' },
  { id: '63ff761f-c1e8-414b-b969-d1833d1c870c', name: 'Southern Man',     gender: 'M', style: 'Warm · Southern',          provider: 'cartesia', language: 'en', accent: 'southern' },
  { id: 'b7d50908-b17c-442d-ad8d-810c63997ed9', name: 'California Girl',  gender: 'F', style: 'Bright · Conversational',  provider: 'cartesia', language: 'en', accent: 'american' },
  { id: '41534e16-2966-4c6b-9670-111411def906', name: 'Nonfiction Man',   gender: 'M', style: 'Authoritative · Clear',    provider: 'cartesia', language: 'en' },
  { id: '2ee87190-8f84-4925-97da-e52547f9462c', name: 'Newsman',          gender: 'M', style: 'Professional · News',      provider: 'cartesia', language: 'en' },
  { id: '156fb8d2-335b-4950-9cb3-a2d33befec77', name: 'Calm Lady',        gender: 'F', style: 'Soft · Calming',           provider: 'cartesia', language: 'en' },
];

const cartesiaSemaphore = createSemaphore(2); // free tier: max 2 concurrent

const cartesiaProvider: TTSProvider = {
  name: 'Cartesia',
  async synthesize(text: string, voiceId: string): Promise<string> {
    if (!CARTESIA_API_KEY) throw new Error('CARTESIA_API_KEY not configured');

    await cartesiaSemaphore.acquire();
    try {
      const response = await fetch(CARTESIA_TTS_URL, {
        method: 'POST',
        headers: {
          'X-API-Key': CARTESIA_API_KEY,
          'Cartesia-Version': '2024-06-10',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model_id: 'sonic-2',
          transcript: text,
          voice: { mode: 'id', id: voiceId },
          output_format: { container: 'mp3', encoding: 'mp3', sample_rate: 44100 },
          language: 'en',
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        throw new Error(`Cartesia TTS error ${response.status}: ${err}`);
      }

      const buf = Buffer.from(await response.arrayBuffer());
      return `data:audio/mpeg;base64,${buf.toString('base64')}`;
    } finally {
      cartesiaSemaphore.release();
    }
  },
  async fetchVoices(): Promise<TTSVoice[]> {
    if (!CARTESIA_API_KEY) return CARTESIA_STATIC_VOICES;
    try {
      const res = await fetch('https://api.cartesia.ai/voices', {
        headers: {
          'X-API-Key': CARTESIA_API_KEY,
          'Cartesia-Version': '2024-06-10',
        },
      });
      if (!res.ok) return CARTESIA_STATIC_VOICES;
      const data = await res.json();
      const voices: TTSVoice[] = (data ?? [])
        .filter((v: any) => v.is_public)
        .map((v: any) => ({
          id:       v.id,
          name:     v.name,
          gender:   (v.description?.toLowerCase().includes('female') || v.description?.toLowerCase().includes('woman') || v.description?.toLowerCase().includes('girl') || v.description?.toLowerCase().includes('lady')) ? 'F' as const : 'M' as const,
          style:    v.description || 'Natural',
          provider: 'cartesia',
          language: v.language || 'en',
        }));
      return voices.length > 0 ? voices : CARTESIA_STATIC_VOICES;
    } catch {
      return CARTESIA_STATIC_VOICES;
    }
  },
};

// ── Provider: Gemini TTS (Google Vertex AI) ─────────────────────────────────

const GOOGLE_API_KEY    = () => process.env.GOOGLE_API_KEY || '';
const GOOGLE_PROJECT_ID = () => process.env.GOOGLE_PROJECT_ID || '';
const GOOGLE_LOCATION   = () => process.env.GOOGLE_LOCATION || 'us-central1';

const GEMINI_TTS_VOICES: TTSVoice[] = [
  { id: 'Zephyr',         name: 'Zephyr',         gender: 'F', style: 'Bright',         provider: 'gemini', language: 'en' },
  { id: 'Puck',           name: 'Puck',           gender: 'M', style: 'Upbeat',         provider: 'gemini', language: 'en' },
  { id: 'Charon',         name: 'Charon',         gender: 'M', style: 'Informative',    provider: 'gemini', language: 'en' },
  { id: 'Kore',           name: 'Kore',           gender: 'F', style: 'Firm',           provider: 'gemini', language: 'en' },
  { id: 'Fenrir',         name: 'Fenrir',         gender: 'M', style: 'Excitable',      provider: 'gemini', language: 'en' },
  { id: 'Leda',           name: 'Leda',           gender: 'F', style: 'Youthful',       provider: 'gemini', language: 'en' },
  { id: 'Orus',           name: 'Orus',           gender: 'M', style: 'Firm',           provider: 'gemini', language: 'en' },
  { id: 'Aoede',          name: 'Aoede',          gender: 'F', style: 'Breezy',         provider: 'gemini', language: 'en' },
  { id: 'Callirrhoe',     name: 'Callirrhoe',     gender: 'F', style: 'Easy-going',     provider: 'gemini', language: 'en' },
  { id: 'Autonoe',        name: 'Autonoe',        gender: 'F', style: 'Bright',         provider: 'gemini', language: 'en' },
  { id: 'Enceladus',      name: 'Enceladus',      gender: 'M', style: 'Breathy',        provider: 'gemini', language: 'en' },
  { id: 'Iapetus',        name: 'Iapetus',        gender: 'M', style: 'Clear',          provider: 'gemini', language: 'en' },
  { id: 'Umbriel',        name: 'Umbriel',        gender: 'M', style: 'Easy-going',     provider: 'gemini', language: 'en' },
  { id: 'Algieba',        name: 'Algieba',        gender: 'M', style: 'Smooth',         provider: 'gemini', language: 'en' },
  { id: 'Despina',        name: 'Despina',        gender: 'F', style: 'Smooth',         provider: 'gemini', language: 'en' },
  { id: 'Erinome',        name: 'Erinome',        gender: 'F', style: 'Clear',          provider: 'gemini', language: 'en' },
  { id: 'Algenib',        name: 'Algenib',        gender: 'M', style: 'Gravelly',       provider: 'gemini', language: 'en' },
  { id: 'Rasalgethi',     name: 'Rasalgethi',     gender: 'M', style: 'Informative',    provider: 'gemini', language: 'en' },
  { id: 'Laomedeia',      name: 'Laomedeia',      gender: 'F', style: 'Upbeat',         provider: 'gemini', language: 'en' },
  { id: 'Achernar',       name: 'Achernar',       gender: 'F', style: 'Soft',           provider: 'gemini', language: 'en' },
  { id: 'Alnilam',        name: 'Alnilam',        gender: 'M', style: 'Firm',           provider: 'gemini', language: 'en' },
  { id: 'Schedar',        name: 'Schedar',        gender: 'M', style: 'Even',           provider: 'gemini', language: 'en' },
  { id: 'Gacrux',         name: 'Gacrux',         gender: 'M', style: 'Mature',         provider: 'gemini', language: 'en' },
  { id: 'Pulcherrima',    name: 'Pulcherrima',    gender: 'F', style: 'Forward',        provider: 'gemini', language: 'en' },
  { id: 'Achird',         name: 'Achird',         gender: 'M', style: 'Friendly',       provider: 'gemini', language: 'en' },
  { id: 'Zubenelgenubi',  name: 'Zubenelgenubi',  gender: 'M', style: 'Casual',         provider: 'gemini', language: 'en' },
  { id: 'Vindemiatrix',   name: 'Vindemiatrix',   gender: 'F', style: 'Gentle',         provider: 'gemini', language: 'en' },
  { id: 'Sadachbia',      name: 'Sadachbia',      gender: 'M', style: 'Lively',         provider: 'gemini', language: 'en' },
  { id: 'Sadaltager',     name: 'Sadaltager',     gender: 'M', style: 'Knowledgeable',  provider: 'gemini', language: 'en' },
  { id: 'Sulafat',        name: 'Sulafat',        gender: 'F', style: 'Warm',           provider: 'gemini', language: 'en' },
];

const geminiTtsProvider: TTSProvider = {
  name: 'Gemini',
  async synthesize(text: string, voiceId: string): Promise<string> {
    const apiKey = GOOGLE_API_KEY();
    const projectId = GOOGLE_PROJECT_ID();
    const location = GOOGLE_LOCATION();

    if (!apiKey && !projectId) {
      throw new Error('GOOGLE_API_KEY or GOOGLE_PROJECT_ID not configured for Gemini TTS');
    }

    // Use Vertex AI endpoint with API key (same pattern as Veo)
    const baseUrl = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/gemini-2.5-pro-tts:generateContent`;
    const url = `${baseUrl}?key=${apiKey}`;

    const body = {
      contents: [{
        role: 'user',
        parts: [{ text }],
      }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voiceId,
            },
          },
        },
      },
    };

    console.log(`[TTS:Gemini] generating voice=${voiceId} text="${text.slice(0, 60)}..."`);

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini TTS error ${res.status}: ${err}`);
    }

    const data = await res.json();
    const part = data?.candidates?.[0]?.content?.parts?.[0];

    if (!part?.inlineData?.data) {
      throw new Error('Gemini TTS returned no audio data');
    }

    const mime: string = part.inlineData.mimeType || '';
    const rawB64: string = part.inlineData.data;

    // Gemini returns raw PCM (audio/L16) which browsers can't play.
    // Wrap it in a WAV header so it becomes a standard WAV file.
    if (mime.includes('L16') || mime.includes('pcm')) {
      const pcmBuf = Buffer.from(rawB64, 'base64');
      const sampleRate = 24000; // Gemini default
      const numChannels = 1;
      const bitsPerSample = 16;
      const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
      const blockAlign = numChannels * (bitsPerSample / 8);
      const wavHeader = Buffer.alloc(44);
      wavHeader.write('RIFF', 0);
      wavHeader.writeUInt32LE(36 + pcmBuf.length, 4);
      wavHeader.write('WAVE', 8);
      wavHeader.write('fmt ', 12);
      wavHeader.writeUInt32LE(16, 16);           // subchunk1 size
      wavHeader.writeUInt16LE(1, 20);            // PCM format
      wavHeader.writeUInt16LE(numChannels, 22);
      wavHeader.writeUInt32LE(sampleRate, 24);
      wavHeader.writeUInt32LE(byteRate, 28);
      wavHeader.writeUInt16LE(blockAlign, 32);
      wavHeader.writeUInt16LE(bitsPerSample, 34);
      wavHeader.write('data', 36);
      wavHeader.writeUInt32LE(pcmBuf.length, 40);
      const wavBuf = Buffer.concat([wavHeader, pcmBuf]);
      console.log(`[TTS:Gemini] converted PCM → WAV (${(wavBuf.length / 1024).toFixed(0)}KB)`);
      return `data:audio/wav;base64,${wavBuf.toString('base64')}`;
    }

    return `data:${mime};base64,${rawB64}`;
  },
  async fetchVoices(): Promise<TTSVoice[]> {
    return GEMINI_TTS_VOICES;
  },
};

// ── Per-request key override (called by wizard before audio generation) ──────

export function setTtsApiKeys(keys: { deepgram?: string; elevenlabs?: string; cartesia?: string }) {
  if (keys.deepgram)   DEEPGRAM_API_KEY   = keys.deepgram;
  if (keys.elevenlabs) ELEVENLABS_API_KEY = keys.elevenlabs;
  if (keys.cartesia)   CARTESIA_API_KEY   = keys.cartesia;
}

// ── Provider Registry ────────────────────────────────────────────────────────

export const TTS_PROVIDERS: Record<string, TTSProvider> = {
  deepgram:   deepgramProvider,
  elevenlabs: elevenlabsProvider,
  cartesia:   cartesiaProvider,
};

// ── Voice cache ──────────────────────────────────────────────────────────────

let cachedVoices: TTSVoice[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

// Runtime map: voiceId → provider key. Populated by fetchAllVoices.
const voiceProviderMap = new Map<string, string>();

/**
 * Fetch all voices from all providers. Cached server-side for 10 min.
 */
export async function fetchAllVoices(): Promise<TTSVoice[]> {
  const now = Date.now();
  if (cachedVoices && now - cacheTimestamp < CACHE_TTL) {
    return cachedVoices;
  }

  const results = await Promise.all(
    Object.values(TTS_PROVIDERS).map(p => p.fetchVoices())
  );
  cachedVoices = results.flat();
  cacheTimestamp = now;

  // Rebuild provider lookup map
  voiceProviderMap.clear();
  for (const v of cachedVoices) voiceProviderMap.set(v.id, v.provider);

  return cachedVoices;
}

/** Look up voice by id, returns provider key */
const GEMINI_VOICE_IDS = new Set(GEMINI_TTS_VOICES.map(v => v.id));
const CARTESIA_VOICE_IDS = new Set(CARTESIA_STATIC_VOICES.map(v => v.id));
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function getVoiceProvider(voiceId: string): string {
  if (voiceProviderMap.has(voiceId)) return voiceProviderMap.get(voiceId)!;
  // Fallback heuristics
  if (voiceId.startsWith('aura-')) return 'deepgram';
  if (GEMINI_VOICE_IDS.has(voiceId)) return 'gemini';
  // Cartesia voice IDs are always UUIDs; ElevenLabs IDs are alphanumeric (no hyphens at pos 8)
  if (UUID_REGEX.test(voiceId)) return 'cartesia';
  return 'elevenlabs';
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate TTS audio using the correct provider for the given voice
 */
export async function generateTTS(text: string, voiceId?: string): Promise<string> {
  if (!text.trim()) return '';

  const vid = voiceId || 'aura-2-thalia-en';
  const providerKey = getVoiceProvider(vid);
  const provider = TTS_PROVIDERS[providerKey];

  if (!provider) throw new Error(`Unknown TTS provider: ${providerKey}`);

  console.log(`[TTS] ${provider.name} → ${vid}`);
  return provider.synthesize(text, vid);
}

/**
 * Generate TTS for multiple text segments
 */
export async function generateTTSBatch(
  segments: { id: string; text: string }[],
  voiceId?: string
): Promise<Record<string, string>> {
  const results: Record<string, string> = {};

  for (const segment of segments) {
    if (segment.text.trim()) {
      try {
        results[segment.id] = await generateTTS(segment.text, voiceId);
      } catch (error) {
        console.error(`TTS error for segment ${segment.id}:`, error);
        results[segment.id] = '';
      }
    }
  }

  return results;
}

export function getDefaultTTSModel(): string {
  return 'aura-2-thalia-en';
}
