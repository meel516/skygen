import { Video } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy — SKYGEN',
  description: 'Privacy Policy for SKYGEN',
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen" style={{ background: '#0A0A0F', color: '#F1F1F8' }}>
      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4 border-b"
        style={{ background: 'rgba(10,10,15,0.9)', borderColor: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(12px)' }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #7C3AED, #0EA5E9)' }}
          >
            <Video className="w-4 h-4 text-white" />
          </div>
          <span className="text-[15px] font-bold">SKYGEN</span>
        </Link>
        <Link
          href="/"
          className="text-[13px] transition-colors"
          style={{ color: '#8B8BAA' }}
        >
          ← Back to home
        </Link>
      </nav>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-[13px] mb-10" style={{ color: '#55556A' }}>
          Last updated: March 18, 2026
        </p>

        <div className="space-y-10 text-[14px] leading-relaxed" style={{ color: '#8B8BAA' }}>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>1. Introduction</h2>
            <p>
              SKYGEN ("we", "us", or "our") is an AI-powered video creation platform operated by
              Saleem Mohammed (md.saleem516@gmail.com). This Privacy Policy explains how we collect,
              use, and protect your information when you use SKYGEN.
            </p>
            <p className="mt-3">
              By using SKYGEN, you agree to the collection and use of information in accordance
              with this policy.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>2. Information We Collect</h2>
            <p className="mb-3">We collect the following types of information:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong style={{ color: '#F1F1F8' }}>Google account information</strong> — When you sign in with Google,
                we receive your name, email address, and profile picture via Google OAuth.
              </li>
              <li>
                <strong style={{ color: '#F1F1F8' }}>YouTube account tokens</strong> — If you connect your YouTube
                account, we store OAuth tokens (access token and refresh token) securely in our
                database to enable video uploads on your behalf.
              </li>
              <li>
                <strong style={{ color: '#F1F1F8' }}>Video content and project data</strong> — The video scripts, block
                configurations, templates, and other content you create within SKYGEN.
              </li>
              <li>
                <strong style={{ color: '#F1F1F8' }}>Usage data</strong> — Basic usage information such as pages visited
                and features used, for improving the product.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>3. How We Use Your Information</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li>To authenticate you and maintain your session</li>
              <li>To save and retrieve your video projects and templates</li>
              <li>To upload videos to your YouTube channel when you request it</li>
              <li>To improve and develop SKYGEN features</li>
              <li>To communicate with you about your account if needed</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>4. YouTube API Data</h2>
            <p className="mb-3">
              SKYGEN integrates with the YouTube Data API v3. When you connect your YouTube account:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>We request permission to upload videos to your YouTube channel on your behalf.</li>
              <li>We store your YouTube OAuth tokens securely in an encrypted database. We do not share them with third parties.</li>
              <li>You can disconnect your YouTube account at any time from within SKYGEN, which immediately deletes your stored tokens.</li>
              <li>Our use of YouTube API data complies with the{' '}
                <a
                  href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  YouTube API Services Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  Google's Privacy Policy
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>5. Data Storage and Security</h2>
            <p>
              Your data is stored in a PostgreSQL database hosted on Amazon RDS (AWS, EU North region).
              We use SSL/TLS encryption for all data in transit. We do not sell your personal data to
              any third parties.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>6. Third-Party Services</h2>
            <p className="mb-3">SKYGEN uses the following third-party services:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                <strong style={{ color: '#F1F1F8' }}>Google OAuth</strong> — For authentication. Subject to{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#A78BFA' }} className="hover:underline">
                  Google's Privacy Policy
                </a>.
              </li>
              <li>
                <strong style={{ color: '#F1F1F8' }}>YouTube Data API</strong> — For video uploads. Subject to{' '}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#A78BFA' }} className="hover:underline">
                  Google's Privacy Policy
                </a>.
              </li>
              <li>
                <strong style={{ color: '#F1F1F8' }}>Amazon Web Services (AWS)</strong> — For database hosting.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>7. Your Rights</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Access the personal data we hold about you</li>
              <li>Request deletion of your account and associated data</li>
              <li>Disconnect your YouTube account at any time from within the app</li>
              <li>Revoke SKYGEN's access to your Google account via{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  Google Account Permissions
                </a>
              </li>
            </ul>
            <p className="mt-3">
              To exercise any of these rights, contact us at{' '}
              <a href="mailto:md.saleem516@gmail.com" style={{ color: '#A78BFA' }} className="hover:underline">
                md.saleem516@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>8. Cookies</h2>
            <p>
              SKYGEN uses session cookies to keep you signed in. We do not use advertising
              or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>9. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy from time to time. We will notify you of significant
              changes by updating the date at the top of this page. Continued use of SKYGEN after
              changes constitutes acceptance of the updated policy.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>10. Contact</h2>
            <p>
              If you have any questions about this Privacy Policy, please contact us at{' '}
              <a href="mailto:md.saleem516@gmail.com" style={{ color: '#A78BFA' }} className="hover:underline">
                md.saleem516@gmail.com
              </a>.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 flex items-center gap-6 text-[12px]" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: '#55556A' }}>
          <Link href="/" className="hover:text-[#8B8BAA] transition-colors">Home</Link>
          <Link href="/terms" className="hover:text-[#8B8BAA] transition-colors">Terms of Service</Link>
          <span>© 2026 SKYGEN</span>
        </div>
      </div>
    </div>
  );
}
