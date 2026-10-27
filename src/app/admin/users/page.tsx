'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, RotateCcw, ChevronDown, Trash2 } from '@/components/ui/studio-icons';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  videoCount: number;
  videoLimit: number;
  aiCount: number;
  aiLimit: number;
  createdAt: string;
  _count: { templates: number; videos: number };
}

function UsageBar({ value, limit, color }: { value: number; limit: number; color: string }) {
  const pct = limit > 0 ? Math.min(100, Math.round((value / limit) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-[10px] mb-0.5" style={{ color: 'var(--muted-foreground)' }}>
        <span>{value}/{limit}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/auth/signin');
    else if (status === 'authenticated' && session?.user?.role !== 'ADMIN') router.push('/');
    else if (status === 'authenticated' && session?.user?.role === 'ADMIN') fetchUsers();
  }, [status, session, router]);

  async function fetchUsers() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users');
      setUsers(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function resetUsage(userId: string) {
    setResetting(userId);
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, action: 'resetUsage' }),
    });
    await fetchUsers();
    setResetting(null);
  }

  async function deleteUser(userId: string, email: string) {
    if (!confirm(`Delete ${email}? They will be banned from signing in again.`)) return;
    setDeleting(userId);
    await fetch('/api/admin/users', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, reason: 'Deleted by admin' }),
    });
    await fetchUsers();
    setDeleting(null);
  }

  async function updateRole(userId: string, role: string) {
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role, action: 'updateRole' }),
    });
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--foreground)' }}>Users</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--muted-foreground)' }}>{users.length} registered users</p>
      </div>

      <div
        className="rounded-sm overflow-hidden"
        style={{ border: '1px solid var(--border)' }}
      >
        <table className="w-full text-[13px]">
          <thead>
            <tr style={{ background: 'var(--border)', borderBottom: '1px solid var(--border)' }}>
              {['User', 'Role', 'Video Usage', 'AI Usage', 'Templates', 'Videos', 'Actions'].map(h => (
                <th key={h} className="px-4 py-3 text-left font-medium" style={{ color: 'var(--muted-foreground)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => (
              <tr
                key={user.id}
                style={{
                  borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                  background: i % 2 === 0 ? 'transparent' : 'var(--border)',
                }}
              >
                {/* User */}
                <td className="px-4 py-3">
                  <div className="font-medium" style={{ color: 'var(--foreground)' }}>{user.name || '—'}</div>
                  <div className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{user.email}</div>
                </td>

                {/* Role */}
                <td className="px-4 py-3">
                  <div className="relative inline-block">
                    <select
                      value={user.role}
                      onChange={e => updateRole(user.id, e.target.value)}
                      className="appearance-none pr-6 pl-2 py-1 rounded-sm text-[12px] cursor-pointer"
                      style={{
                        background: user.role === 'ADMIN' ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : user.role === 'CONTENT_MANAGER' ? 'color-mix(in srgb, var(--primary) 15%, transparent)' : 'var(--border)',
                        border: '1px solid var(--border)',
                        color: user.role === 'ADMIN' ? 'var(--primary)' : user.role === 'CONTENT_MANAGER' ? 'var(--primary)' : 'var(--foreground)',
                      }}
                    >
                      <option value="USER">User</option>
                      <option value="CONTENT_MANAGER">Content Manager</option>
                      <option value="ADMIN">Admin</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none" style={{ color: 'var(--muted-foreground)' }} />
                  </div>
                </td>

                {/* Video Usage */}
                <td className="px-4 py-3 w-36">
                  <UsageBar
                    value={user.videoCount}
                    limit={user.videoLimit}
                    color={user.videoCount / user.videoLimit >= 0.9 ? '#ef4444' : user.videoCount / user.videoLimit >= 0.7 ? '#f59e0b' : '#7c3aed'}
                  />
                </td>

                {/* AI Usage */}
                <td className="px-4 py-3 w-36">
                  <UsageBar
                    value={user.aiCount}
                    limit={user.aiLimit}
                    color={user.aiCount / user.aiLimit >= 0.9 ? '#ef4444' : user.aiCount / user.aiLimit >= 0.7 ? '#f59e0b' : '#0ea5e9'}
                  />
                </td>

                {/* Templates */}
                <td className="px-4 py-3 text-center" style={{ color: 'var(--muted-foreground)' }}>
                  {user._count.templates}
                </td>

                {/* Videos */}
                <td className="px-4 py-3 text-center" style={{ color: 'var(--muted-foreground)' }}>
                  {user._count.videos}
                </td>

                {/* Actions */}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => resetUsage(user.id)}
                      disabled={resetting === user.id}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] disabled:opacity-50"
                      style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {resetting === user.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RotateCcw className="w-3 h-3" />}
                      Reset
                    </button>
                    <button
                      onClick={() => deleteUser(user.id, user.email)}
                      disabled={deleting === user.id || user.role === 'ADMIN'}
                      title={user.role === 'ADMIN' ? 'Cannot delete admin' : 'Delete & ban user'}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm text-[11px] disabled:opacity-30 hover:bg-red-500/10 hover:text-red-400"
                      style={{ border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
                    >
                      {deleting === user.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <Trash2 className="w-3 h-3" />}
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
