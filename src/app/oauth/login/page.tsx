'use client';

import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

function OAuthLoginInner() {
  const params = useSearchParams();
  const clientId = params.get('client_id') ?? '';
  const redirectUri = params.get('redirect_uri') ?? '';
  const state = params.get('state') ?? '';
  const responseType = params.get('response_type') ?? 'code';
  const codeChallenge = params.get('code_challenge') ?? '';
  const codeChallengeMethod = params.get('code_challenge_method') ?? '';

  let callbackUrl = `/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}&response_type=${encodeURIComponent(responseType)}`;
  if (codeChallenge) callbackUrl += `&code_challenge=${encodeURIComponent(codeChallenge)}`;
  if (codeChallengeMethod) callbackUrl += `&code_challenge_method=${encodeURIComponent(codeChallengeMethod)}`;

  function handleGoogleSignIn() {
    signIn('google', { callbackUrl });
  }

  function handleCredentialsSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    signIn('credentials', {
      username: formData.get('email'),
      password: formData.get('password'),
      callbackUrl
    });
  }

  return (
    <div className="min-h-screen bg-card flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm bg-card border border-border rounded-sm shadow-none p-8 flex flex-col items-center gap-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-2">
          <div className="w-16 h-16 rounded-sm bg-muted   flex items-center justify-center shadow-none">
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
              <path d="M18 4L32 28H4L18 4Z" fill="white" fillOpacity="0.9" />
              <circle cx="18" cy="22" r="5" fill="white" fillOpacity="0.6" />
            </svg>
          </div>
          <span className="text-white text-2xl font-bold tracking-tight">SkyGen</span>
        </div>

        {/* Message */}
        <div className="text-center">
          <p className="text-muted-foreground font-semibold text-base leading-snug">
            ChatGPT is requesting access to your SkyGen account
          </p>
          <p className="text-muted-foreground text-sm mt-2">
            Sign in to grant permission.
          </p>
        </div>

        {/* Credentials Form (For Reviewers) */}
        <form onSubmit={handleCredentialsSignIn} className="w-full space-y-3">
          <input
            type="email"
            name="email"
            placeholder="Email address"
            className="w-full bg-card border border-border text-muted-foreground rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-teal-500 "
            required
          />
          <input
            type="password"
            name="password"
            placeholder="Password"
            className="w-full bg-card border border-border text-muted-foreground rounded-sm px-4 py-3 text-sm focus:outline-none focus:border-teal-500 "
            required
          />
          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-sm py-3 px-4   shadow-none"
          >
            Sign in
          </button>
        </form>

        <div className="flex items-center gap-3 w-full">
          <div className="flex-1 h-px bg-card" />
          <span className="text-muted-foreground text-xs font-medium">OR</span>
          <div className="flex-1 h-px bg-card" />
        </div>

        {/* Google sign-in button */}
        <button
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 bg-card hover:bg-muted active:bg-muted text-foreground font-semibold rounded-sm py-3 px-4   shadow-none"
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

        <p className="text-muted-foreground text-xs text-center">
          By continuing, you agree to SkyGen&apos;s{' '}
          <a href="https://skygen.salru.in/terms" className="underline hover:text-muted-foreground">
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
      <div className="min-h-screen bg-card flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    }>
      <OAuthLoginInner />
    </Suspense>
  );
}
