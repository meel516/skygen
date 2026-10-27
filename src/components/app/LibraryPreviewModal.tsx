'use client';

import { Copy, Map as MapIcon, MessageSquare, Play, Sparkles, Wand2, X, Trash2 } from '@/components/ui/studio-icons';
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
  accent = 'var(--primary)',
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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/20 dark:bg-black/70 p-4 duration-300" onClick={handleClose}>
      <div
        className="w-full max-w-4xl overflow-hidden rounded-sm border border-black/5 dark:border-white/[0.08] bg-white/70 dark:bg-[var(--card)]/80 shadow-none ring-1 ring-white/20 dark:ring-white/5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="relative aspect-video overflow-hidden bg-muted dark:bg-[var(--background)]">
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
                  background: 'var(--studio-accent-wash)',
                }}
              />
              <div className="absolute inset-0 bg-muted bg-muted library-preview-sweep" />
              <div className="absolute inset-8 rounded-sm border border-black/5 dark:border-white/[0.08] bg-white/30 dark:bg-black/20" />
              <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center">
                <div
                  className="mb-5 flex h-20 w-20 items-center justify-center rounded-sm text-white shadow-none dark:shadow-none library-preview-float"
                  style={{ background: 'var(--studio-accent-wash)' }}
                >
                  <Play className="h-9 w-9 fill-current drop-shadow-none" />
                </div>
                <div className="max-w-xl px-6">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--primary)]/20 dark:border-white/[0.12] bg-[var(--primary)]/10 dark:bg-white/[0.06] px-3 py-1 text-xs font-medium text-[var(--primary)] dark:text-[var(--primary)]">
                    <Sparkles className="h-3.5 w-3.5" />
                    Looping preview
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-foreground dark:text-[var(--foreground)] drop-shadow-none dark:drop-shadow-none">{title}</h2>
                  {subtitle && <p className="mt-2 text-sm font-medium text-muted-foreground dark:text-[var(--muted-foreground)]">{subtitle}</p>}
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/40 dark:bg-black/40 text-foreground dark:text-white hover:bg-white/60 dark:hover:bg-black/60 shadow-none"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-end border-t border-black/5 dark:border-white/[0.05]">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground dark:text-[var(--muted-foreground)]">{kind}</div>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground dark:text-[var(--muted-foreground)]">
              {description || `Reusable ${kind.toLowerCase()} for Skygen videos.`}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {tags.slice(0, 5).map((tag) => (
                <span key={tag} className="rounded-full bg-muted dark:bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-muted-foreground dark:text-[var(--muted-foreground)]">
                  {tag}
                </span>
              ))}
              {meta.map((item) => (
                <span key={item} className="rounded-full border border-border dark:border-white/[0.08] px-3 py-1.5 text-xs font-medium text-muted-foreground dark:text-[var(--muted-foreground)]">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 sm:flex-row md:flex-col">
            <button
              type="button"
              onClick={onUseInChat}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-sm bg-[var(--primary)] px-5 text-sm font-semibold text-primary-foreground shadow-none shadow-none hover:bg-[var(--primary)]"
            >
              <MessageSquare className="h-4 w-4" />
              Use in Chat
            </button>
            {onRemixSource ? (
              <button
                type="button"
                onClick={onRemixSource}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-border dark:border-white/[0.08] bg-background/50 dark:bg-white/[0.04] px-5 text-sm font-medium text-foreground dark:text-[var(--foreground)] hover:bg-muted dark:hover:bg-white/[0.08]"
              >
                <Wand2 className="h-4 w-4" />
                Remix Source Code
              </button>
            ) : (
              <button
                type="button"
                onClick={onUseInChat}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-sm border border-border dark:border-white/[0.08] bg-background/50 dark:bg-white/[0.04] px-5 text-sm font-medium text-foreground dark:text-[var(--foreground)] hover:bg-muted dark:hover:bg-white/[0.08]"
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
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-sm border border-[var(--primary)]/20 dark:border-[var(--primary)]/35 bg-[var(--primary)]/5 dark:bg-[var(--primary)]/10 px-4 text-xs font-medium text-[var(--primary)] dark:text-[var(--primary)] hover:bg-[var(--primary)]/10 dark:hover:bg-[var(--primary)]/20"
                >
                  <MapIcon className="h-3.5 w-3.5" />
                  Field map
                </button>
              )}
              {onCopyId && (
                <button
                  type="button"
                  onClick={onCopyId}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-sm border border-border dark:border-white/[0.08] bg-background/50 dark:bg-white/[0.04] px-4 text-xs font-medium text-muted-foreground dark:text-[var(--muted-foreground)] hover:bg-muted dark:hover:bg-white/[0.08] hover:text-foreground dark:hover:text-[var(--foreground)]"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy ID
                </button>
              )}
            </div>

            {onDelete && (
              <div className="mt-2 flex w-full">
                {confirmDelete ? (
                  <div className="flex w-full animate-in fade-in slide-in- gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDelete();
                        setConfirmDelete(false);
                      }}
                      className="inline-flex h-10 flex-1 items-center justify-center rounded-sm bg-red-500 px-3 text-xs font-bold text-white shadow-none hover:bg-red-600"
                    >
                      Confirm Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(false)}
                      className="inline-flex h-10 items-center justify-center rounded-sm bg-muted dark:bg-[var(--accent)] px-4 text-xs font-medium text-foreground dark:text-[var(--muted-foreground)] hover:bg-slate-300 dark:hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(true)}
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm border border-red-500/20 bg-red-50 dark:bg-red-500/10 px-5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20"
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

