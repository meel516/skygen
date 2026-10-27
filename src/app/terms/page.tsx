import { Video } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service — SKYGEN',
  description: 'Terms of Service for SKYGEN',
};

export default function TermsOfService() {
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
        <h1 className="text-3xl font-bold mb-2">Terms of Service</h1>
        <p className="text-[13px] mb-10" style={{ color: '#55556A' }}>
          Last updated: March 18, 2026
        </p>

        <div className="space-y-10 text-[14px] leading-relaxed" style={{ color: '#8B8BAA' }}>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>1. Acceptance of Terms</h2>
            <p>
              By accessing or using SKYGEN ("the Service"), you agree to be bound by these Terms of
              Service. If you do not agree to these terms, please do not use SKYGEN.
            </p>
            <p className="mt-3">
              SKYGEN is operated by Saleem Mohammed. By using this Service, you confirm that you are
              at least 13 years of age and have the legal capacity to enter into these terms.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>2. Description of Service</h2>
            <p>
              SKYGEN is an AI-powered video creation platform that allows users to generate video
              scripts, build videos from animated content blocks, and export or publish them to
              platforms including YouTube. The Service is provided "as is" and may change or be
              discontinued at any time.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>3. Account and Authentication</h2>
            <p>
              SKYGEN uses Google OAuth for authentication. By signing in, you authorize us to
              access your basic Google profile information (name, email, profile picture). You are
              responsible for maintaining the security of your account.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>4. YouTube Integration</h2>
            <p className="mb-3">
              SKYGEN offers an optional integration with YouTube via the YouTube Data API v3. When
              you connect your YouTube account:
            </p>
            <ul className="space-y-2 list-disc list-inside">
              <li>
                You authorize SKYGEN to upload videos to your YouTube channel on your behalf.
              </li>
              <li>
                You remain solely responsible for all content uploaded to YouTube through SKYGEN,
                including compliance with{' '}
                <a
                  href="https://www.youtube.com/t/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  YouTube's Terms of Service
                </a>
                {' '}and{' '}
                <a
                  href="https://support.google.com/youtube/answer/2801973"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  YouTube's Community Guidelines
                </a>.
              </li>
              <li>
                You can disconnect YouTube access at any time from within the app or via{' '}
                <a
                  href="https://myaccount.google.com/permissions"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  Google Account Permissions
                </a>.
              </li>
              <li>
                SKYGEN's use of YouTube API data is subject to the{' '}
                <a
                  href="https://developers.google.com/youtube/terms/api-services-terms-of-service"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#A78BFA' }}
                  className="hover:underline"
                >
                  YouTube API Services Terms of Service
                </a>.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>5. Acceptable Use</h2>
            <p className="mb-3">You agree not to use SKYGEN to:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li>Create, distribute, or upload content that is illegal, harmful, threatening, abusive, defamatory, or otherwise objectionable</li>
              <li>Infringe on any intellectual property rights of others</li>
              <li>Upload content that violates YouTube's Terms of Service or Community Guidelines</li>
              <li>Attempt to gain unauthorized access to any part of the Service</li>
              <li>Use the Service in any way that could damage, disable, or impair it</li>
              <li>Misrepresent your identity or affiliation with any person or organization</li>
            </ul>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>6. Content Ownership</h2>
            <p>
              You retain full ownership of the videos and content you create using SKYGEN.
              By using the Service, you grant SKYGEN a limited, non-exclusive license to store
              and process your content solely for the purpose of providing the Service to you.
            </p>
            <p className="mt-3">
              SKYGEN does not claim ownership of your created content and will not use it for
              any purpose beyond delivering the Service.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>7. AI-Generated Content</h2>
            <p>
              SKYGEN uses artificial intelligence to generate video scripts and other content
              suggestions. AI-generated content may not always be accurate, appropriate, or
              suitable for your purposes. You are responsible for reviewing and approving all
              AI-generated content before publishing or distributing it.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>8. Disclaimer of Warranties</h2>
            <p>
              SKYGEN is provided "as is" without any warranties of any kind, either express or
              implied, including but not limited to warranties of merchantability, fitness for a
              particular purpose, or non-infringement. We do not guarantee that the Service will
              be uninterrupted, error-free, or completely secure.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>9. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by applicable law, SKYGEN and its operators shall
              not be liable for any indirect, incidental, special, consequential, or punitive damages
              arising from your use of the Service, including but not limited to loss of data,
              revenue, or business opportunities.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to SKYGEN at any time,
              with or without cause, and with or without notice. Upon termination, your right to
              use the Service will immediately cease.
            </p>
            <p className="mt-3">
              You may stop using the Service at any time. To request deletion of your account
              and data, contact us at{' '}
              <a href="mailto:md.saleem516@gmail.com" style={{ color: '#A78BFA' }} className="hover:underline">
                md.saleem516@gmail.com
              </a>.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>11. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms of Service at any time. We will indicate
              the date of the last update at the top of this page. Continued use of SKYGEN after
              changes constitutes acceptance of the updated terms.
            </p>
          </section>

          <section>
            <h2 className="text-[16px] font-semibold mb-3" style={{ color: '#F1F1F8' }}>12. Contact</h2>
            <p>
              If you have any questions about these Terms of Service, please contact us at{' '}
              <a href="mailto:md.saleem516@gmail.com" style={{ color: '#A78BFA' }} className="hover:underline">
                md.saleem516@gmail.com
              </a>.
            </p>
          </section>

        </div>

        {/* Footer links */}
        <div className="mt-16 pt-8 flex items-center gap-6 text-[12px]" style={{ borderTop: '1px solid rgba(255,255,255,0.07)', color: '#55556A' }}>
          <Link href="/" className="hover:text-[#8B8BAA] transition-colors">Home</Link>
          <Link href="/privacy" className="hover:text-[#8B8BAA] transition-colors">Privacy Policy</Link>
          <span>© 2026 SKYGEN</span>
        </div>
      </div>
    </div>
  );
}
