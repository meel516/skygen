'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function OAuthLoginInner() {
  const params = useSearchParams();
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? '';
  const responseType = params.get('response_type') ?? 'code';

  const callbackUrl = `/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&response_type=${encodeURIComponent(responseType)}`;

  function handleSignIn() {
    signIn('google', { callbackUrl });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-gray-900 border border-gray-800 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-blue-500 flex items-center justify-center shadow-lg">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path d="M18 4L32 28H4L18 4Z" fill="white" fillOpacity="0.9" />
              <circle cx="18" cy="22" r="5" fill="white" fillOpacity="0.6" />
            </svg>
          </div>
          <span className="text-white text-2xl font-bold tracking-tight">SkyGen</span>
        </div>

        {/* Divider with plugin icon */}
        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-gray-700" />
          <div className="w-8 h-8 rounded-lg bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 text-sm">
            🔌
          </div>
          <div className="flex-1 h-px bg-gray-700" />
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-gray-200 font-semibold text-base leading-snug">
            ChatGPT is requesting access to your SkyGen account
          </p>
          <p className="text-gray-500 text-sm mt-2">
            Sign in with Google to grant permission.
          </p>
        </div>

        {/* Scopes */}
        <div className="w-full bg-gray-800 rounded-xl px-4 py-3 text-sm text-gray-400 space-y-1">
          <p className="font-medium text-gray-300 mb-1">This will allow ChatGPT to:</p>
          <div className="flex items-center gap-2">
            <span className="text-teal-400">✓</span>
            <span>Create and preview video plugins</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-teal-400">✓</span>
            <span>Approve and save plugin compilations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-teal-400">✓</span>
            <span>Check job and generation status</span>
          </div>
        </div>

        {/* Google sign-in button */}
        <button
          onClick={handleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 active:bg-gray-200 text-gray-900 font-semibold rounded-xl py-3 px-4 transition-colors duration-150 shadow"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>

        <p className="text-gray-600 text-xs text-center">
          By continuing, you agree to SkyGen&apos;s{' '}
          <a href="https://skygen.salru.in/terms" className="underline hover:text-gray-400">
            Terms of Service
          </a>
          .
        </p>
      </div>
    </div>
  );
}

export default function OAuthLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 animate-pulse">Loading…</div>
      </div>
    }>
      <OAuthLoginInner />
    </Suspense>
  );
}
