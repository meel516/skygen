import { NextRequest, NextResponse } from 'next/server';
import { generateTTS, fetchAllVoices, getVoiceProvider } from '@/lib/video/ai/deepgram-tts';
import { enforceRateLimit, requireAuthenticatedSession } from '@/lib/api-security';
import { hasPremiumAccess } from '@/lib/roles';

const PREVIEW_TEXTS: Record<string, string> = {
  en: "Here's a preview of how I sound. Ready to tell your story?",
  es: "Aquí tienes una muestra de cómo sueno. ¿Listo para contar tu historia?",
  fr: "Voici un aperçu de ma voix. Prêt à raconter votre histoire ?",
  de: "So klinge ich. Bereit, Ihre Geschichte zu erzählen?",
  pt: "Aqui está uma amostra da minha voz. Pronto para contar sua história?",
  ar: "هذه معاينة لصوتي. هل أنت مستعد لسرد قصتك؟",
  hi: "यह मेरी आवाज़ की एक झलक है। क्या आप अपनी कहानी सुनाने के लिए तैयार हैं?",
  ja: "これが私の声のプレビューです。あなたの物語を語る準備はできていますか？",
  ko: "제 목소리의 미리듣기입니다. 당신의 이야기를 들려줄 준비가 되셨나요?",
  zh: "这是我的声音预览。准备好讲述你的故事了吗？",
  it: "Ecco un'anteprima della mia voce. Pronto a raccontare la tua storia?",
  nl: "Hier is een voorbeeld van hoe ik klink. Klaar om je verhaal te vertellen?",
  tr: "Sesimin bir önizlemesi. Hikâyenizi anlatmaya hazır mısınız?",
  ru: "Вот превью моего голоса. Готовы рассказать свою историю?",
  pl: "Oto podgląd mojego głosu. Gotowy opowiedzieć swoją historię?",
};

// In-memory cache — key is "voiceId:lang" so same voice in different languages caches separately
const audioCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuthenticatedSession();
    if ('response' in authResult) {
      return authResult.response;
    }

    const { session } = authResult;
    const rateLimitResult = enforceRateLimit({
      request: req,
      userId: session.user.id,
      scope: 'ai-tts-preview',
      limit: 8,
      windowMs: 60_000,
    });
    if ('response' in rateLimitResult) {
      return rateLimitResult.response;
    }

    const rateLimitHeaders = rateLimitResult.headers;
    const { voiceId, language } = await req.json();
    if (!voiceId || typeof voiceId !== 'string') {
      return NextResponse.json({ error: 'voiceId required' }, { status: 400, headers: rateLimitHeaders });
    }

    // ElevenLabs voices are premium-only
    if (getVoiceProvider(voiceId) === 'elevenlabs' && !hasPremiumAccess(session.user.role)) {
      return NextResponse.json(
        { error: 'ElevenLabs voices require a Premium subscription' },
        { status: 403, headers: rateLimitHeaders }
      );
    }

    const lang = language || 'en';
    const cacheKey = `${voiceId}:${lang}`;

    // Return cached if available
    const cached = audioCache.get(cacheKey);
    if (cached) {
      return NextResponse.json({ audio: cached }, { headers: rateLimitHeaders });
    }

    // For English, use provider's previewUrl if available (pre-generated, fast)
    if (lang === 'en') {
      const voices = await fetchAllVoices();
      const voice = voices.find(v => v.id === voiceId);
      if (voice?.previewUrl) {
        audioCache.set(cacheKey, voice.previewUrl);
        return NextResponse.json({ audio: voice.previewUrl }, { headers: rateLimitHeaders });
      }
    }

    // Generate via TTS with localized preview text
    const previewText = PREVIEW_TEXTS[lang] || PREVIEW_TEXTS.en;
    const dataUrl = await generateTTS(previewText, voiceId);

    audioCache.set(cacheKey, dataUrl);
    return NextResponse.json({ audio: dataUrl }, { headers: rateLimitHeaders });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
