'use client';

import { useEffect, useState } from 'react';
import { Download, Trash2, Video, AlertCircle } from 'lucide-react';

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
        <div className="w-5 h-5 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1" style={{ color: '#F1F1F8' }}>My Videos</h1>
        <p className="text-[13px]" style={{ color: '#8B8BAA' }}>
          {videos.length} rendered video{videos.length !== 1 ? 's' : ''}
        </p>
      </div>

      {videos.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 rounded-2xl text-center"
          style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'rgba(255,255,255,0.04)' }}
          >
            <Video className="w-7 h-7" style={{ color: '#55556A' }} />
          </div>
          <p className="text-[14px] font-medium mb-1" style={{ color: '#F1F1F8' }}>No videos yet</p>
          <p className="text-[12px] max-w-[220px]" style={{ color: '#55556A' }}>
            Go to the editor and export your first video to see it here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {videos.map((video) => (
            <div
              key={video.id}
              className="flex items-center gap-4 p-4 rounded-xl"
              style={{ background: '#13131C', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* Icon */}
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(124,58,237,0.15)' }}
              >
                <Video className="w-5 h-5" style={{ color: '#A78BFA' }} />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-medium truncate" style={{ color: '#F1F1F8' }}>{video.name}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px]" style={{ color: '#55556A' }}>{formatDate(video.createdAt)}</span>
                  {video.duration && (
                    <>
                      <span style={{ color: 'rgba(255,255,255,0.1)' }}>·</span>
                      <span className="text-[11px] font-mono" style={{ color: '#55556A' }}>
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
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors"
                    style={{ background: 'rgba(14,165,233,0.15)', color: '#0EA5E9', border: '1px solid rgba(14,165,233,0.2)' }}
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </a>
                ) : (
                  <span className="text-[11px] px-3 py-1.5" style={{ color: '#55556A' }}>No file</span>
                )}

                {confirmId === video.id ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px]" style={{ color: '#8B8BAA' }}>Delete?</span>
                    <button
                      onClick={() => handleDelete(video.id)}
                      disabled={deleting === video.id}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-medium text-slate-900 dark:text-white"
                      style={{ background: '#EF4444' }}
                    >
                      {deleting === video.id ? '…' : 'Yes'}
                    </button>
                    <button
                      onClick={() => setConfirmId(null)}
                      className="px-2.5 py-1 rounded-lg text-[11px]"
                      style={{ color: '#8B8BAA', border: '1px solid rgba(255,255,255,0.08)' }}
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmId(video.id)}
                    className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                    style={{ color: '#55556A' }}
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
        className="flex items-start gap-3 p-4 rounded-xl text-[12px]"
        style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: '#55556A' }}
      >
        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>Deleting a video removes it from your history but does not affect your render count.</p>
      </div>
    </div>
  );
}
