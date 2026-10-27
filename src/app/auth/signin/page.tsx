'use client'

import { signIn } from "next-auth/react"
import Link from "next/link"
import { Video, Sparkles, BarChart3, Box, Download, Check } from "lucide-react"

const PERKS = [
  { icon: Sparkles, text: "AI generates full video scripts instantly" },
  { icon: BarChart3, text: "38+ animated blocks — charts, counters, timelines" },
  { icon: Box, text: "Cinematic 3D visualizations built in" },
  { icon: Download, text: "Export crisp MP4 — ready for every platform" },
]

export default function SignInPage() {
  return (
    <div
      className="min-h-screen flex"
      style={{ background: '#0A0A0F', color: '#F1F1F8' }}
    >
      {/* ── Left panel (hidden on small screens) ── */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 relative overflow-hidden"
        style={{ background: '#0D0D17' }}
      >
        {/* Background glow blobs */}
        <div
          className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
          }}
        />
        <div
          className="absolute -bottom-40 -right-40 w-[400px] h-[400px] rounded-full pointer-events-none"
          style={{
            background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)',
          }}
        />
        {/* Dot grid */}
        <div
          className="absolute inset-0 pointer-events-none opacity-40"
          style={{
            backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.06) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {/* Logo */}
        <div className="relative flex items-center gap-2.5">
          <img src="/logo.png" alt="SKYGEN" className="w-12 h-12 object-contain scale-[2.5]" />
          <span className="text-[17px] font-bold" style={{ color: '#F1F1F8' }}>SKYGEN</span>
        </div>

        {/* Hero copy */}
        <div className="relative space-y-8">
          <div>
            <h2
              className="text-4xl font-extrabold leading-tight mb-4"
              style={{ color: '#F1F1F8' }}
            >
              Your studio.
              <br />
              <span
                style={{
                  background: 'linear-gradient(135deg, #A78BFA 0%, #38BDF8 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                Powered by AI.
              </span>
            </h2>
            <p className="text-[15px] leading-relaxed" style={{ color: '#8B8BAA' }}>
              Build scroll-stopping videos from a library of animated blocks.
              No design skills needed.
            </p>
          </div>

          <ul className="space-y-3">
            {PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)' }}
                >
                  <Icon className="w-3.5 h-3.5" style={{ color: '#A78BFA' }} />
                </div>
                <span className="text-[13px]" style={{ color: '#8B8BAA' }}>{text}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom quote */}
        <div
          className="relative p-5 rounded-2xl"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <p className="text-[13px] leading-relaxed italic mb-3" style={{ color: '#8B8BAA' }}>
            "The 3D bar race chart blew up on TikTok — 2M views in 3 days.
            SKYGEN made it in under 5 minutes."
          </p>
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
              style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)', color: '#fff' }}
            >
              S
            </div>
            <div>
              <p className="text-[12px] font-medium" style={{ color: '#F1F1F8' }}>Saleem</p>
              <p className="text-[11px]" style={{ color: '#55556A' }}>Content Creator</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel — sign-in card ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2 mb-10">
          <img src="/logo.png" alt="SKYGEN" className="w-10 h-10 object-contain scale-[2.5]" />
          <span className="text-[15px] font-bold" style={{ color: '#F1F1F8' }}>SKYGEN</span>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-2xl p-8"
          style={{
            background: '#13131C',
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          }}
        >
          {/* Icon + heading */}
          <div className="text-center mb-8">
            <img src="/logo.png" alt="SKYGEN" className="w-16 h-16 object-contain scale-[2.5] mx-auto mb-5" />
            <h1 className="text-[22px] font-bold mb-1.5" style={{ color: '#F1F1F8' }}>
              Welcome back
            </h1>
            <p className="text-[13px]" style={{ color: '#8B8BAA' }}>
              Sign in to your SKYGEN account
            </p>
          </div>

          {/* Free badge */}
          <div
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg mb-6 text-[12px]"
            style={{
              background: 'rgba(124,58,237,0.1)',
              border: '1px solid rgba(124,58,237,0.2)',
              color: '#A78BFA',
            }}
          >
            <Check className="w-3.5 h-3.5" />
            Free to use — no credit card required
          </div>

          {/* Google button */}
          <button
            onClick={() => signIn("google", { callbackUrl: "/" })}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl font-semibold text-[14px] transition-all"
            style={{
              background: '#ffffff',
              color: '#1a1a2e',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f0f8';
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#ffffff';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.3)';
            }}
          >
            <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
            <span className="text-[11px]" style={{ color: '#55556A' }}>SECURE SIGN IN</span>
            <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.07)' }} />
          </div>

          <p className="text-[11px] text-center leading-relaxed" style={{ color: '#55556A' }}>
            By signing in you agree to our{' '}
            <Link
              href="/terms"
              className="underline transition-colors"
              style={{ color: '#8B8BAA' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F1F8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8B8BAA')}
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="/privacy"
              className="underline transition-colors"
              style={{ color: '#8B8BAA' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#F1F1F8')}
              onMouseLeave={(e) => (e.currentTarget.style.color = '#8B8BAA')}
            >
              Privacy Policy
            </Link>
            .
          </p>
        </div>

        {/* Back to home link */}
        <a
          href="/"
          className="mt-6 text-[12px] transition-colors"
          style={{ color: '#55556A' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#8B8BAA')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#55556A')}
        >
          ← Back to home
        </a>
      </div>
    </div>
  )
}
