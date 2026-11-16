'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Module-level guard: install a permanent unhandledrejection listener that
// swallows the specific "Cannot write to a closing writable stream" error
// from mediabunny / @remotion/web-renderer. The muxer's late packet flush
// can race the stream close — the file is already produced and downloaded
// by then, so this rejection is purely cosmetic noise.
//
// Registered at module scope (not inside the hook) because the rejection
// often fires AFTER the render promise resolves, when a hook-scoped
// listener would already have been torn down in `finally`.
let muxerErrorGuardInstalled = false;
function installMuxerErrorGuard() {
  if (muxerErrorGuardInstalled || typeof window === 'undefined') return;
  muxerErrorGuardInstalled = true;
  const isLateMuxerFlush = (msg: string) =>
    msg.includes('closing writable stream') ||
    msg.includes('Cannot write to a closing');
  window.addEventListener('unhandledrejection', (ev) => {
    const msg = ev.reason?.message ?? String(ev.reason ?? '');
    if (isLateMuxerFlush(msg)) {
      ev.preventDefault();
      console.debug('[useClientRender] suppressed late muxer flush rejection:', msg);
    }
  });
  window.addEventListener('error', (ev) => {
    const msg = ev.error?.message ?? ev.message ?? '';
    if (isLateMuxerFlush(msg)) {
      ev.preventDefault();
      console.debug('[useClientRender] suppressed late muxer flush error:', msg);
    }
  });
}

export type ClientRenderStatus = 'idle' | 'rendering' | 'done' | 'error' | 'unsupported';

export interface ClientRenderParams {
  component: React.ComponentType<any>;
  inputProps: Record<string, unknown>;
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  filename?: string;
}

export function useClientRender() {
  const [status, setStatus] = useState<ClientRenderStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Detect the actual encoding API instead of relying on the browser name.
  const isSupported =
    typeof window !== 'undefined' &&
    typeof window.VideoEncoder !== 'undefined';

  const startRender = useCallback(async (params: ClientRenderParams): Promise<void> => {
    if (abortRef.current) return;
    if (!isSupported) {
      setStatus('unsupported');
      return;
    }

    abortRef.current = new AbortController();
    setStatus('rendering');
    setProgress(0);
    setError(null);

    installMuxerErrorGuard();

    console.log('[useClientRender] starting render', {
      width: params.width,
      height: params.height,
      fps: params.fps,
      durationInFrames: params.durationInFrames,
    });

    try {
      // Load the encoder only when the user requests an export.
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import('@remotion/web-renderer');
      const support = await canRenderMediaOnWeb({ width: params.width, height: params.height, container: 'webm' });
      if (!support.canRender) {
        throw new Error(support.issues.map((issue) => issue.message).join(' ') || 'This browser cannot export this video.');
      }
      abortRef.current.signal.throwIfAborted();

      const result = await renderMediaOnWeb({
        composition: {
          component: params.component,
          id: 'DynamicVideo',
          width: params.width,
          height: params.height,
          fps: params.fps,
          durationInFrames: params.durationInFrames,
        },
        inputProps: params.inputProps,
        // Allow slow remote media to load and decode before a frame times out.
        // This is a per-frame wait limit; the user can still cancel the export.
        delayRenderTimeoutInMilliseconds: 120_000,
        container: 'webm',
        signal: abortRef.current.signal,
        onProgress: ({ progress: p }) => setProgress(p),
        licenseKey: 'free-license',
      } as any);

      console.log('[useClientRender] render finished, getting blob…');
      const blob = await result.getBlob();
      abortRef.current.signal.throwIfAborted();
      if (!blob.size) throw new Error('The renderer produced an empty video. Please retry.');
      console.log('[useClientRender] blob ready', { size: blob.size, type: blob.type });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = params.filename ?? 'video.webm';
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Leave time for the browser to begin reading the download URL.
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);

      setStatus('done');
      setProgress(1);
    } catch (e: any) {
      // Always log — without this, "Render failed" surfaces in UI with no
      // diagnostic in DevTools.
      console.error('[useClientRender] render failed', {
        name: e?.name,
        message: e?.message,
        stack: e?.stack,
        raw: e,
      });

      if (e?.name === 'AbortError') {
        setStatus('idle');
        setProgress(0);
        return;
      }
      setError(e?.message ?? 'Client render failed');
      setStatus('error');
    } finally {
      abortRef.current = null;
    }
  }, [isSupported]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const reset = useCallback(() => {
    setStatus('idle');
    setProgress(0);
    setError(null);
  }, []);

  return { isSupported, status, progress, error, startRender, cancel, reset };
}
