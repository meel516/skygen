import { NextResponse } from 'next/server';
import { signOut } from '@/lib/auth';

/**
 * GET /api/auth/logout
 * Clears the NextAuth session, then redirects to Google's account logout URL.
 * This forces Google to show the account picker on next sign-in instead of
 * silently re-authenticating with the cached Google session.
 */
export async function GET() {
  await signOut({ redirect: false });

  // Redirect to Google's logout endpoint, then come back to our homepage.
  // `continue` tells Google where to send the user after logging out.
  const appUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || 'https://skygen.salru.in';
  const googleLogoutUrl =
    `https://accounts.google.com/logout?continue=` +
    encodeURIComponent(`https://appengine.google.com/_ah/logout?continue=${encodeURIComponent(appUrl)}`);

  return NextResponse.redirect(googleLogoutUrl);
}
