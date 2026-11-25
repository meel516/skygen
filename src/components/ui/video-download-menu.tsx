'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Download } from '@/components/ui/studio-icons';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  checkClientRenderFormat, CLIENT_RENDER_FORMATS, type ClientRenderFormat,
} from '@/hooks/useClientRender';
import { cn } from '@/lib/utils';

interface VideoDownloadMenuProps {
  width: number;
  height: number;
  disabled?: boolean;
  className?: string;
  onDownload: (format: ClientRenderFormat) => void;
}

const formatLabels = { mp4: 'MP4', webm: 'WebM' };

export function VideoDownloadMenu({ width, height, disabled, className, onDownload }: VideoDownloadMenuProps) {
  const [open, setOpen] = useState(false);
  const [support, setSupport] = useState<{
    size: string;
    formats: Record<ClientRenderFormat, boolean>;
  } | null>(null);
  const size = `${width}×${height}`;
  const availableFormats = support?.size === size ? support.formats : null;

  useEffect(() => {
    if (!open || availableFormats) return;
    let cancelled = false;
    Promise.all(CLIENT_RENDER_FORMATS.map(async (format) => {
      try {
        return (await checkClientRenderFormat(format, width, height)).canRender;
      } catch {
        return false;
      }
    })).then(([mp4, webm]) => {
      if (!cancelled) setSupport({ size, formats: { mp4, webm } });
    });
    return () => { cancelled = true; };
  }, [availableFormats, height, open, size, width]);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button type="button" disabled={disabled}
          className={cn('inline-flex items-center gap-1.5 rounded-sm bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-40', className)}>
          <Download className="size-3.5" />
          Download video
          <ChevronDown className="size-3" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {CLIENT_RENDER_FORMATS.map((format) => (
          <DropdownMenuItem key={format} disabled={disabled || !availableFormats?.[format]}
            onSelect={() => onDownload(format)}>
            <div>
              <div>{formatLabels[format]}</div>
              {availableFormats?.[format] === false && (
                <div className="text-xs text-muted-foreground">
                  {format === 'mp4' ? 'Requires H.264 and AAC encoding' : 'WebM encoding unavailable'}
                </div>
              )}
            </div>
          </DropdownMenuItem>
        ))}
        {!availableFormats && (
          <p role="status" className="px-2 py-1 text-xs text-muted-foreground">Checking browser support…</p>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
