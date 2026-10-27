'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, ChevronRight, UserCheck } from '@/components/ui/studio-icons';

const STATUS_TABS = ['all', 'open', 'in_progress', 'resolved', 'closed'];

const STATUS_COLORS: Record<string, string> = {
  open: 'bg-blue-500/20 text-blue-300',
  in_progress: 'bg-yellow-500/20 text-yellow-300',
  resolved: 'bg-green-500/20 text-green-300',
  closed: 'bg-gray-500/20 text-gray-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'text-gray-400',
  normal: 'text-blue-400',
  high: 'text-orange-400',
  urgent: 'text-red-400',
};

interface Ticket {
  id: string;
  email: string;
  name: string | null;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  assigned_name: string | null;
  last_message: string | null;
  last_sender_role: string | null;
  message_count: number;
}

export default function AdminSupportPage() {
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState('open');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickingUp, setPickingUp] = useState<string | null>(null);

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') { router.push('/'); return; }
    if ((session?.user as { role?: string })?.role !== 'ADMIN') { router.push('/'); return; }
  }, [session, sessionStatus]);

  async function loadTickets() {
    setLoading(true);
    const url = activeTab === 'all' ? '/api/admin/support' : `/api/admin/support?status=${activeTab}`;
    const res = await fetch(url);
    const data = await res.json();
    setTickets(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { loadTickets(); }, [activeTab]);

  async function handlePickup(ticketId: string) {
    setPickingUp(ticketId);
    await fetch(`/api/admin/support/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickup: true }),
    });
    setPickingUp(null);
    loadTickets();
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">Support Tickets</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-card rounded-sm p-1 w-fit">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 rounded-sm text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'bg-gray-700 text-white'
                : 'text-muted-foreground hover:text-white'
            }`}
          >
            {tab.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : tickets.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No tickets found</div>
      ) : (
        <div className="bg-card border border-border rounded-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-muted-foreground text-xs uppercase">
                <th className="text-left px-4 py-3">User</th>
                <th className="text-left px-4 py-3">Subject</th>
                <th className="text-left px-4 py-3">Priority</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Assigned</th>
                <th className="text-left px-4 py-3">Updated</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t, i) => (
                <tr key={t.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${i === tickets.length - 1 ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white truncate max-w-[140px]">{t.name || t.email}</p>
                    <p className="text-xs text-muted-foreground truncate max-w-[140px]">{t.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white truncate max-w-[200px]">{t.subject}</p>
                    {t.last_message && (
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {t.last_sender_role === 'admin' ? '↩ ' : ''}{t.last_message}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`capitalize font-medium ${PRIORITY_COLORS[t.priority] ?? 'text-muted-foreground'}`}>
                      {t.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[t.status] ?? 'bg-gray-700 text-muted-foreground'}`}>
                      {t.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {t.assigned_name ?? <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                    {new Date(t.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {(t.status === 'open') && (
                        <button
                          onClick={() => handlePickup(t.id)}
                          disabled={pickingUp === t.id}
                          className="flex items-center gap-1 text-xs px-2 py-1 rounded-sm bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 disabled:opacity-50"
                        >
                          {pickingUp === t.id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : <UserCheck className="w-3 h-3" />}
                          Pick up
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/admin/support/${t.id}`)}
                        className="p-1.5 rounded-sm hover:bg-gray-700 text-muted-foreground hover:text-white"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
