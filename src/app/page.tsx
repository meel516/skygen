'use client';

import { ChatWizard } from '@/components/chat/ChatWizard';
import { AppShell } from '@/components/app/AppShell';
import { useEffect } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useSiteConfig } from '@/lib/use-site-config';
import {
  ArrowRight, Video, Check,
} from 'lucide-react';

// ─── Landing Page ────────────────────────────────────────────────────────────

function LandingPage() {
  const { config } = useSiteConfig();
  const branding = config.branding || {};
  const appName = branding.appName || 'SKYGEN';
  const logoUrl = branding.logoUrl;
  const primaryColor = branding.primaryColor || '#7C3AED';
  const secondaryColor = branding.secondaryColor || '#0EA5E9';

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: '#0A0A0F',
        color: '#F1F1F8',
        backgroundImage: 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124,58,237,0.15), transparent)',
      }}
    >
      {/* ── Navbar ── */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b"
        style={{
          background: 'rgba(10,10,15,0.85)',
          backdropFilter: 'blur(20px)',
          borderColor: 'rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt={appName} className="w-10 h-10 object-contain scale-[2.5]" />
          ) : (
            <img src="/logo.png" alt={appName} className="w-10 h-10 object-contain scale-[2.5]" />
          )}
          <span className="text-[15px] font-bold tracking-tight" style={{ color: '#F1F1F8' }}>
            {appName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.href = '/mcp'}
            className="text-[13px] font-medium transition-colors"
            style={{ color: '#8B8BAA' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F1F8')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#8B8BAA')}
          >
            For Developers (MCP)
          </button>
          <button
            onClick={() => signIn('google', { callbackUrl: '/' })}
            className="text-[13px] px-4 py-1.5 rounded-lg font-medium transition-all"
            style={{
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.35)',
              color: '#A78BFA',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,0.25)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(124,58,237,0.15)';
            }}
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-10 relative">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
        />

        <h1
          className="text-5xl sm:text-6xl md:text-7xl font-extrabold tracking-tight leading-[1.08] mb-6 max-w-4xl"
          style={{ color: '#F1F1F8' }}
        >
          Generate Cinematic{' '}
          <span className="bg-clip-text text-transparent bg-gradient-to-br from-[#7C3AED] via-[#0EA5E9] to-[#A78BFA]">
            Motion Graphics
          </span>
        </h1>

        <p className="text-lg sm:text-xl max-w-2xl leading-relaxed mb-10" style={{ color: '#8B8BAA' }}>
          Skip the timeline. Just type your idea, and our AI builds premium, code-driven motion graphics for you in seconds.
        </p>

        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="flex items-center gap-2 px-8 py-4 rounded-xl text-[16px] font-semibold text-white transition-all z-10"
          style={{
            background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
            boxShadow: '0 0 30px rgba(124,58,237,0.4), 0 4px 16px rgba(0,0,0,0.4)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 0 40px rgba(124,58,237,0.5), 0 8px 24px rgba(0,0,0,0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '0 0 30px rgba(124,58,237,0.4), 0 4px 16px rgba(0,0,0,0.4)';
          }}
        >
          Start for Free
          <ArrowRight className="w-5 h-5" />
        </button>
      </section>

      {/* ── How it works with Screenshots ── */}
      <section className="px-6 py-20 max-w-7xl mx-auto w-full space-y-32">
        
        {/* Step 1 */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/3 space-y-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xl border border-purple-500/30">
              1
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: '#F1F1F8' }}>
              Tell us your idea
            </h2>
            <p className="text-lg leading-relaxed" style={{ color: '#8B8BAA' }}>
              Just chat with our AI Wizard. Type what you want to create — a product demo, a motivational reel, or an educational short. The AI will instantly generate a story and visual layout for you.
            </p>
          </div>
          <div className="lg:w-2/3 w-full">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl relative group">
              <img src="/wizard.png" alt="AI Wizard Chat Interface" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>

        {/* Step 2 */}
        <div className="flex flex-col lg:flex-row-reverse items-center gap-12">
          <div className="lg:w-1/3 space-y-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xl border border-blue-500/30">
              2
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: '#F1F1F8' }}>
              Dynamic Generation & Templates
            </h2>
            <p className="text-lg leading-relaxed" style={{ color: '#8B8BAA' }}>
              Every video is powered by dynamic plugins built on the fly by the AI. For repetitive workflows, you can save your designs as Templates to create hundreds of consistent videos instantly. Plus, bring them to life by choosing from a massive library of professional voices.
            </p>
          </div>
          <div className="lg:w-2/3 w-full flex flex-col sm:flex-row gap-4">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex-1">
              <img src="/templates.png" alt="Templates Selection" className="w-full h-auto object-cover" />
            </div>
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl flex-1">
              <img src="/voice.png" alt="Voice Selection" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>

        {/* Step 3 */}
        <div className="flex flex-col lg:flex-row items-center gap-12">
          <div className="lg:w-1/3 space-y-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xl border border-emerald-500/30">
              3
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold" style={{ color: '#F1F1F8' }}>
              Edit & Export
            </h2>
            <p className="text-lg leading-relaxed" style={{ color: '#8B8BAA' }}>
              Jump into the full video editor to tweak texts, colors, and timing. When you're ready, hit export and share your masterpiece with the world.
            </p>
          </div>
          <div className="lg:w-2/3 w-full">
            <div className="rounded-2xl overflow-hidden border border-white/10 shadow-2xl">
              <img src="/editor.png" alt="Full Video Editor" className="w-full h-auto object-cover" />
            </div>
          </div>
        </div>

      </section>

      {/* ── Template Flow Section ── */}
      <section className="px-6 py-24 bg-black/40 border-y border-white/5 relative overflow-hidden">
        <div className="max-w-7xl mx-auto w-full mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#F1F1F8' }}>
            Scale up with Repetitive Workflows
          </h2>
          <p className="text-lg max-w-2xl" style={{ color: '#8B8BAA' }}>
            Need to produce hundreds of consistent videos for a marketing campaign or a social media channel? Our Template Builder gives you fine-grained control over every aspect of generation.
          </p>
        </div>

        <div className="max-w-7xl mx-auto w-full">
          <div className="flex overflow-x-auto gap-6 pb-8 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            <div className="shrink-0 w-[85vw] sm:w-[600px] snap-center flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-[#0A0A0F]">
                <img src="/template-arc.png" alt="Narrative Arc" className="w-full h-auto" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Pick your Narrative Arc</h3>
                <p className="text-sm text-gray-400">Choose the storytelling structure that fits your content best, from documentaries to quick tutorials.</p>
              </div>
            </div>

            <div className="shrink-0 w-[85vw] sm:w-[600px] snap-center flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-[#0A0A0F]">
                <img src="/template-music.png" alt="Background Music" className="w-full h-auto" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Set the Mood</h3>
                <p className="text-sm text-gray-400">Layer in background music to match the vibe, perfectly mixed beneath your narration.</p>
              </div>
            </div>

            <div className="shrink-0 w-[85vw] sm:w-[600px] snap-center flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-[#0A0A0F]">
                <img src="/template-story.png" alt="Story Prompt" className="w-full h-auto" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Tell your Story</h3>
                <p className="text-sm text-gray-400">Just drop in a topic or a script outline. The AI will flesh it out according to your chosen narrative arc.</p>
              </div>
            </div>

            <div className="shrink-0 w-[85vw] sm:w-[600px] snap-center flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-[#0A0A0F]">
                <img src="/template-review.png" alt="Review Script" className="w-full h-auto" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Review the Script</h3>
                <p className="text-sm text-gray-400">Check the AI-generated script block by block. Tweak the wording before rendering any media.</p>
              </div>
            </div>

            <div className="shrink-0 w-[85vw] sm:w-[600px] snap-center flex flex-col gap-4">
              <div className="rounded-xl overflow-hidden border border-white/10 shadow-xl bg-[#0A0A0F]">
                <img src="/template-media.png" alt="Review Media" className="w-full h-auto" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white mb-1">Review Media Assets</h3>
                <p className="text-sm text-gray-400">Swap out auto-generated images, tweak visual prompts, or upload your own b-roll for total control.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── CTA Banner ── */}
      <section className="px-6 py-20">
        <div
          className="max-w-3xl mx-auto rounded-3xl p-12 text-center relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(124,58,237,0.2) 0%, rgba(14,165,233,0.1) 100%)',
            border: '1px solid rgba(124,58,237,0.3)',
          }}
        >
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(124,58,237,0.15), transparent 70%)',
            }}
          />

          <div className="relative">
            <div
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-medium mb-6"
              style={{
                background: 'rgba(124,58,237,0.2)',
                border: '1px solid rgba(124,58,237,0.4)',
                color: '#A78BFA',
              }}
            >
              <Check className="w-3 h-3" />
              Free to start — no credit card
            </div>

            <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: '#F1F1F8' }}>
              Start creating videos today
            </h2>
            <p className="text-[15px] mb-8 max-w-md mx-auto" style={{ color: '#8B8BAA' }}>
              Sign in with Google and get access to the full editor instantly.
            </p>

            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="inline-flex items-center gap-2.5 px-8 py-3.5 rounded-xl text-[14px] font-semibold text-white transition-all z-10"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #6D28D9)',
                boxShadow: '0 0 30px rgba(124,58,237,0.5), 0 4px 16px rgba(0,0,0,0.4)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 0 45px rgba(124,58,237,0.6), 0 8px 24px rgba(0,0,0,0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(124,58,237,0.5), 0 4px 16px rgba(0,0,0,0.4)';
              }}
            >
              Continue with Google
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer
        className="mt-auto px-6 py-8 border-t text-center flex flex-col items-center gap-4"
        style={{ borderColor: 'rgba(255,255,255,0.06)' }}
      >
        <div className="flex items-center justify-center gap-2">
          <div
            className="w-6 h-6 rounded-md flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}
          >
            <Video className="w-3.5 h-3.5 text-white" />
          </div>
          <span className="text-[14px] font-bold" style={{ color: '#F1F1F8' }}>{appName}</span>
        </div>
        
        <div className="flex items-center justify-center gap-6 text-[12px]" style={{ color: '#8B8BAA' }}>
          <a href="/privacy" className="hover:text-[#F1F1F8] transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-[#F1F1F8] transition-colors">Terms of Service</a>
          <a href="/mcp" className="hover:text-[#F1F1F8] transition-colors font-semibold text-purple-400">Developer (MCP) Guide</a>
        </div>
        
        <span className="text-[11px]" style={{ color: '#55556A' }}>© 2026 {appName}</span>
      </footer>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data: session, status } = useSession();

  useEffect(() => {
    if (session?.user?.id) {
      const hasSynced = localStorage.getItem('userSynced');
      if (hasSynced) return;

      fetch('/api/user/sync', { method: 'POST' })
        .then(res => res.json())
        .then(data => {
          localStorage.setItem('userData', JSON.stringify(data));
          localStorage.setItem('userSynced', 'true');
        })
        .catch(err => console.error('[Auth] Sync error:', err));
    }
  }, [session]);

  // Loading state
  if (status === 'loading') {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        style={{ background: '#0A0A0F' }}
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}
          >
            <Video className="w-4 h-4 text-white" />
          </div>
          <div
            className="w-1.5 h-1.5 rounded-full animate-pulse"
            style={{ background: '#7C3AED' }}
          />
        </div>
      </div>
    );
  }

  // Unauthenticated — show landing page
  if (status === 'unauthenticated') {
    return <LandingPage />;
  }

  // Authenticated — show chat wizard as homepage
  return (
    <AppShell>
      <ChatWizard />
    </AppShell>
  );
}
