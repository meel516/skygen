'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, LifeBuoy, ChevronRight } from 'lucide-react';

const PRIORITY_LABELS: Record<string, string> = {
  low: 'Low',
  normal: 'Normal',
  high: 'High',
  urgent: 'Urgent',
};

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-green-500/20 text-green-300',
  closed: 'bg-gray-500/20 text-gray-400',
};

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  last_message: string;
  last_sender_role: string;
}

export default function SupportPage() {
  const { data: session } = useSession();
  const router = useRouter();

  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState('normal');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestName, setGuestName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setLoadingTickets(true);
      fetch('/api/support')
        .then(r => r.json())
        .then(data => setTickets(Array.isArray(data) ? data : []))
        .finally(() => setLoadingTickets(false));
    }
  }, [session]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const res = await fetch('/api/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          message,
          priority,
          email: guestEmail || undefined,
          name: guestName || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to submit ticket');
      router.push(`/support/${data.id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-purple-600/20 flex items-center justify-center">
            <LifeBuoy className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Support</h1>
            <p className="text-gray-400 text-sm">Submit a ticket and we'll get back to you</p>
          </div>
        </div>

        {/* Create ticket form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4">New Ticket</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Guest fields */}
            {!session?.user && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Your Email *</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={e => setGuestEmail(e.target.value)}
                    required
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    placeholder="you@example.com"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">Your Name</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={e => setGuestName(e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                    placeholder="Optional"
                  />
                </div>
              </div>
            )}

            {session?.user && (
              <div className="text-sm text-gray-400 bg-gray-800/50 rounded-lg px-3 py-2">
                Submitting as <span className="text-white font-medium">{session.user.email}</span>
              </div>
            )}

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Subject *</label>
              <input
                type="text"
                value={subject}
                onChange={e => setSubject(e.target.value)}
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
                placeholder="Brief description of your issue"
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Message *</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                required
                rows={5}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500 resize-none"
                placeholder="Describe your issue in detail..."
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">Priority</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-purple-500"
              >
                {Object.entries(PRIORITY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {submitting ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </form>
        </div>

        {/* Past tickets */}
        {session?.user && (
          <div>
            <h2 className="text-lg font-semibold mb-3">Your Tickets</h2>
            {loadingTickets ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-gray-500" />
              </div>
            ) : tickets.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">No tickets yet</p>
            ) : (
              <div className="space-y-2">
                {tickets.map(t => (
                  <button
                    key={t.id}
                    onClick={() => router.push(`/support/${t.id}`)}
                    className="w-full bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-4 text-left transition-colors flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm truncate">{t.subject}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[t.status] ?? 'bg-gray-700 text-gray-300'}`}>
                          {t.status.replace('_', ' ')}
                        </span>
                      </div>
                      {t.last_message && (
                        <p className="text-xs text-gray-500 truncate">
                          {t.last_sender_role === 'admin' ? '💬 Support: ' : ''}{t.last_message}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-600 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
