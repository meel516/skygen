'use client';

import { useState, useEffect, useRef, use } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Send, ArrowLeft } from '@/components/ui/studio-icons';

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
}

export default function SupportTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function loadMessages() {
    const res = await fetch(`/api/support/${id}/messages`);
    if (!res.ok) return;
    const data = await res.json();
    setTicket(data.ticket);
    setMessages(data.messages);
    setLoading(false);
  }

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') { router.push('/'); return; }
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
      const res = await fetch(`/api/support/${id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: newMessage }),
      });
      if (res.ok) {
        setNewMessage('');
        await loadMessages();
      }
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="min-h-screen bg-card flex items-center justify-center text-muted-foreground">
        Ticket not found
      </div>
    );
  }

  const isClosed = ticket.status === 'closed';

  return (
    <div className="min-h-screen bg-card text-white flex flex-col">
      {/* Header */}
      <div className="border-b border-border bg-card px-4 py-3 flex items-center gap-3">
        <button onClick={() => router.push('/support')} className="text-muted-foreground hover:text-white ">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{ticket.subject}</span>
            <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${STATUS_COLORS[ticket.status] ?? 'bg-gray-700 text-muted-foreground'}`}>
              {ticket.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">Ticket #{id.slice(0, 8)}</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl mx-auto w-full">
        {messages.map(m => {
          const isUser = m.sender_role === 'user';
          return (
            <div key={m.id} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-sm px-4 py-2.5 ${isUser ? 'bg-muted text-white rounded-br-sm' : 'bg-card text-muted-foreground rounded-bl-sm'}`}>
                {!isUser && (
                  <p className="text-xs font-semibold text-primary mb-1">Support</p>
                )}
                <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                <p className={`text-xs mt-1 ${isUser ? 'text-primary' : 'text-muted-foreground'}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card px-4 py-3">
        <div className="max-w-2xl mx-auto">
          {isClosed ? (
            <p className="text-center text-sm text-muted-foreground">This ticket is closed.</p>
          ) : (
            <form onSubmit={handleSend} className="flex gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={sending}
                className="flex-1 bg-card border border-border rounded-sm px-4 py-2 text-sm text-white focus:outline-none focus:border-primary disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="bg-primary hover:bg-primary disabled:opacity-50 text-white rounded-sm px-4 py-2  flex items-center gap-1"
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
