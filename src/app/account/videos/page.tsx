'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2, Video, AlertCircle } from '@/components/ui/studio-icons';

interface VideoRecord {
  id: string;
  name: string;
  url: string | null;
  duration: number | null;
  createdAt: string;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(s: number | null) {
  if (!s) return null;
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/user/videos')
      .then((r) => r.json())
      .then((data) => setVideos(data.videos ?? []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      await fetch(`/api/user/videos/${id}`, { method: 'DELETE' });
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } finally {
      setDeleting(null);
      setConfirmId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-5 h-5 rounded-full border-2 border-[var(--primary)] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--foreground)' }}>My Videos</h1>
        <p className="text-[13px]" style={{ color: 'var(--muted-foreground)' }}>
          {videos.length} rendered video{videos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {videos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-sm text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-16 h-16 rounded-sm flex items-center justify-center mb-4"
            style={{ background: 'var(--border)' }}
          >
            <Video className="w-7 h-7" style={{ color: 'var(--muted-foreground)' }} />
          </div>
          <p className="text-[14px] font-medium mb-1" style={{ color: 'var(--foreground)' }}>No videos yet</p>
          <p className="text-[12px] max-w-[220px]" style={{ color: 'var(--muted-foreground)' }}>
            Go to the editor and export your first video to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-4 p-4 rounded-sm"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-sm flex items-center justify-center flex-shrink-0"
                style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)' }}
              >
                <Video className="w-5 h-5" style={{ color: 'var(--primary)' }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: 'var(--foreground)' }}>{video.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>{formatDate(video.createdAt)}</span>
                  {video.duration && (
                    <>
                      <span style={{ color: 'var(--border)' }}>·</span>
                      <span className="text-[11px] font-mono" style={{ color: 'var(--muted-foreground)' }}>
                        {formatDuration(video.duration)}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {video.url ? (
                  <a
                    href={video.url}
                    download
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-[11px] font-medium"
                    style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                ) : (
                  <span className="text-[11px] px-3 py-1.5" style={{ color: 'var(--muted-foreground)' }}>No file</span>
                )}

                {confirmId === video.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: 'var(--muted-foreground)' }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(video.id)}
                      disabled={deleting === video.id}
                      className="px-2.5 py-1 rounded-sm text-[11px] font-medium text-foreground dark:text-white"
                      style={{ background: '#EF4444' }}
                    >
                      {deleting === video.id ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-2.5 py-1 rounded-sm text-[11px]"
                      style={{ color: 'var(--muted-foreground)', border: '1px solid var(--border)' }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(video.id)}
                    className="w-7 h-7 rounded-sm flex items-center justify-center hover:bg-red-500/10"
                    style={{ color: 'var(--muted-foreground)' }}
                    title="Delete video"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div
        className="flex items-start gap-3 p-4 rounded-sm text-[12px]"
        style={{ background: 'var(--border)', border: '1px solid var(--border)', color: 'var(--muted-foreground)' }}
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Deleting a video removes it from your history but does not affect your render count.</p>
      </div>
    </div>
  );
}
