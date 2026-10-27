'use client';

import { Copy, Map as MapIcon, MessageSquare, Play, Sparkles, Wand2, X, Trash2 } from 'lucide-react';
import { useState } from 'react';

interface LibraryPreviewModalProps {
  open: boolean;
  title: string;
  subtitle?: string;
  description?: string;
  kind: 'Plugin' | 'Block' | 'Template';
  accent?: string;
  previewUrl?: string;
  tags?: string[];
  meta?: string[];
  onClose: () => void;
  onUseInChat: () => void;
  onRemixSource?: () => void;
  onCopyId?: () => void;
  /** Optional: open user-controlled wizard field map (plugins only). */
  onEditFieldMap?: () => void;
  /** Optional: delete action */
  onDelete?: () => void;
}

export function LibraryPreviewModal({
  open,
  title,
  subtitle,
  description,
  kind,
  accent = '#7C3AED',
  previewUrl,
  tags = [],
  meta = [],
  onClose,
  onUseInChat,
  onRemixSource,
  onCopyId,
  onEditFieldMap,
  onDelete,
}: LibraryPreviewModalProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!open) return null;

  const isVideoPreview = previewUrl?.match(/\.(mp4|webm|mov)(\?|$)/i);
  const isImagePreview = previewUrl?.match(/\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i);

  const handleClose = () => {
    setConfirmDelete(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 dark:bg-black/70 p-4 backdrop-blur-md transition-all duration-300" onClick={handleClose}>
      <div
        className="w-full max-w-4xl overflow-hidden rounded-3xl border border-black/5 dark:border-white/[0.08] bg-white/70 dark:bg-[#13131C]/80 shadow-2xl backdrop-blur-xl ring-1 ring-white/20 dark:ring-white/5 transition-all"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-video overflow-hidden bg-slate-100 dark:bg-[#0A0A0F]">
          {previewUrl ? (
            <>
              {isVideoPreview ? (
                <video src={previewUrl} className="h-full w-full object-cover" muted loop playsInline autoPlay />
              ) : isImagePreview ? (
                <img src={previewUrl} alt={title} className="h-full w-full object-cover" />
              ) : (
                <iframe
                  src={previewUrl}
                  title={`${title} preview`}
                  className="h-full w-full border-0"
                  loading="lazy"
                  allow="autoplay; fullscreen"
                />
              )}
              <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/5 dark:ring-white/[0.08]" />
            </>
          ) : (
            <>
              <div
                className="absolute inset-0 opacity-20 dark:opacity-40"
                style={{
                  background: `radial-gradient(circle at 30% 30%, ${accent}66, transparent 34%), radial-gradient(circle at 76% 68%, #0EA5E966, transparent 32%)`,
                }}
              />
              <div className="absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.4),transparent)] dark:bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.10),transparent)] library-preview-sweep" />
              <div className="absolute inset-8 rounded-2xl border border-black/5 dark:border-white/[0.08] bg-white/30 dark:bg-black/20 backdrop-blur-sm" />
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                <div
                  className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl text-white shadow-xl dark:shadow-2xl library-preview-float"
                  style={{ background: `linear-gradient(135deg, ${accent}, #0EA5E9)` }}
                >
                  <Play className="h-9 w-9 fill-current drop-shadow-md" />
                </div>
                <div className="max-w-xl px-6">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#7C3AED]/20 dark:border-white/[0.12] bg-[#7C3AED]/10 dark:bg-white/[0.06] px-3 py-1 text-xs font-medium text-[#7C3AED] dark:text-[#A78BFA] backdrop-blur-md">
                    <Sparkles className="h-3.5 w-3.5" />
                    Looping preview
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-[#F1F1F8] drop-shadow-sm dark:drop-shadow-none">{title}</h2>
                  {subtitle && <p className="mt-2 text-sm font-medium text-slate-500 dark:text-[#8B8BAA]">{subtitle}</p>}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/40 dark:bg-black/40 text-slate-700 dark:text-white backdrop-blur-md transition hover:bg-white/60 dark:hover:bg-black/60 shadow-sm"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end border-t border-black/5 dark:border-white/[0.05]">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-[#55556A]">{kind}</div>
            <p className="max-w-2xl text-sm leading-6 text-slate-600 dark:text-[#8B8BAA]">
              {description || `Reusable ${kind.toLowerCase()} for Skygen videos.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-slate-100 dark:bg-[#25253A] px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-[#8B8BAA]">
                  {tag}
                </span>
              ))}
              {meta.map((item) => (
                <span key={item} className="rounded-full border border-slate-200 dark:border-white/[0.08] px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-[#55556A]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col">
            <button
              type="button"
              onClick={onUseInChat}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#7C3AED] px-5 text-sm font-semibold text-white shadow-md shadow-[#7C3AED]/20 transition hover:bg-[#6D28D9] hover:shadow-lg hover:-translate-y-0.5"
            >
              <MessageSquare className="h-4 w-4" />
              Use in Chat
            </button>
            {onRemixSource ? (
              <button
                type="button"
                onClick={onRemixSource}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.04] px-5 text-sm font-medium text-slate-700 dark:text-[#F1F1F8] transition hover:bg-slate-100 dark:hover:bg-white/[0.08]"
              >
                <Wand2 className="h-4 w-4" />
                Remix Source Code
              </button>
            ) : (
              <button
                type="button"
                onClick={onUseInChat}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.04] px-5 text-sm font-medium text-slate-700 dark:text-[#F1F1F8] transition hover:bg-slate-100 dark:hover:bg-white/[0.08]"
              >
                <Wand2 className="h-4 w-4" />
                Remix manually
              </button>
            )}
            
            <div className="flex items-center gap-2 justify-end">
              {onEditFieldMap && (
                <button
                  type="button"
                  onClick={onEditFieldMap}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#7C3AED]/20 dark:border-[#7C3AED]/35 bg-[#7C3AED]/5 dark:bg-[#7C3AED]/10 px-4 text-xs font-medium text-[#7C3AED] dark:text-[#C4B5FD] transition hover:bg-[#7C3AED]/10 dark:hover:bg-[#7C3AED]/20"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Field map
                </button>
              )}
              {onCopyId && (
                <button
                  type="button"
                  onClick={onCopyId}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-white/[0.08] bg-slate-50/50 dark:bg-white/[0.04] px-4 text-xs font-medium text-slate-600 dark:text-[#8B8BAA] transition hover:bg-slate-100 dark:hover:bg-white/[0.08] hover:text-slate-900 dark:hover:text-[#F1F1F8]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy ID
                </button>
              )}
            </div>

            {onDelete && (
              <div className="mt-2 flex w-full">
                {confirmDelete ? (
                  <div className="flex w-full animate-in fade-in slide-in-from-right-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete();
                        setConfirmDelete(false);
                      }}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-xl bg-red-500 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-red-600"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="inline-flex h-10 items-center justify-center rounded-xl bg-slate-200 dark:bg-[#25253A] px-4 text-xs font-medium text-slate-700 dark:text-[#8B8BAA] transition hover:bg-slate-300 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-50 dark:bg-red-500/10 px-5 text-xs font-medium text-red-600 dark:text-red-400 transition hover:bg-red-100 dark:hover:bg-red-500/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete {kind}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

