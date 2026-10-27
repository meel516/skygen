'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ArrowLeft, CheckCircle, XCircle } from 'lucide-react';

const STATUS_OPTIONS = ['open', 'in_progress', 'resolved', 'closed'];
const PRIORITY_OPTIONS = ['low', 'normal', 'high', 'urgent'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-green-500/20 text-green-300',
  closed: 'bg-gray-500/20 text-gray-400',
};

interface Message {
  id: string;
  sender_role: string;
  message: string;
  created_at: string;
  sender_name: string | null;
}

interface Ticket {
  id: string;
  subject: string;
  status: string;
  priority: string;
  email: string;
  name: string | null;
  assigned_name: string | null;
}

export default function AdminSupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') { router.push('/'); return; }
    if ((session?.user as { role?: string })?.role !== 'ADMIN') { router.push('/'); return; }
  }, [session, sessionStatus]);

  async function loadMessages() {
    const res = await fetch(`/api/support/${id}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setTicket(data.ticket);
    setMessages(data.messages);
    setLoading(false);
  }

  useEffect(() => {
    if (sessionStatus === 'authenticated') {
      loadMessages();
      const interval = setInterval(loadMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [sessionStatus, id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      await fetch(`/api/support/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      setNewMessage('');
      await loadMessages();
    } finally {
      setSending(false);
    }
  }

  async function updateTicket(patch: Record<string, string>) {
    setSaving(true);
    await fetch(`/api/admin/support/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    setSaving(false);
    await loadMessages();
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!ticket) {
    return <div className="p-6 text-gray-400">Ticket not found</div>;
  }

  return (
    <div className="flex flex-col h-screen">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900 px-4 py-3 flex items-center gap-3 shrink-0">
        <button onClick={() => router.push('/admin/support')} className="text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{ticket.subject}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[ticket.status] ?? 'bg-gray-700 text-gray-300'}`}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-500">{ticket.name || ticket.email} · #{id.slice(0, 8)}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 shrink-0">
          {saving && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
          <select
            value={ticket.priority}
            onChange={e => {
              setTicket(t => t ? { ...t, priority: e.target.value } : t);
              updateTicket({ priority: e.target.value });
            }}
            className="bg-gray-800 border border-gray-700 text-xs text-white rounded-lg px-2 py-1 focus:outline-none capitalize"
          >
            {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={ticket.status}
            onChange={e => {
              setTicket(t => t ? { ...t, status: e.target.value } : t);
              updateTicket({ status: e.target.value });
            }}
            className="bg-gray-800 border border-gray-700 text-xs text-white rounded-lg px-2 py-1 focus:outline-none capitalize"
          >
            {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <button
            onClick={() => updateTicket({ status: 'resolved' })}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-green-500/10 hover:bg-green-500/20 text-green-400 transition-colors"
          >
            <CheckCircle className="w-3 h-3" /> Resolve
          </button>
          <button
            onClick={() => updateTicket({ status: 'closed' })}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
          >
            <XCircle className="w-3 h-3" /> Close
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-3xl mx-auto w-full">
        {messages.map(m => {
          const isAdmin = m.sender_role === 'admin';
          return (
            <div key={m.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isAdmin ? 'bg-purple-600 text-white rounded-br-sm' : 'bg-gray-800 text-gray-100 rounded-bl-sm'}`}>
                {!isAdmin && (
                  <p className="text-xs font-semibold text-blue-400 mb-1">{m.sender_name || ticket.email}</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className={`text-xs mt-1 ${isAdmin ? 'text-purple-200' : 'text-gray-500'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto">
          {ticket.status === 'closed' ? (
            <p className="text-center text-sm text-gray-500">This ticket is closed.</p>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Reply as support..."
                disabled={sending}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-xl px-4 py-2 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl px-4 py-2 transition-colors"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
