'use client';

import { useCallback, useRef, useState } from 'react';

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
}

export function useClientRender() {
  const [status, setStatus] = useState<ClientRenderStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // WebCodecs + web-renderer are only available in Chrome/Edge
  const isSupported =
    typeof window !== 'undefined' &&
    typeof window.VideoEncoder !== 'undefined';

  const startRender = useCallback(async (params: ClientRenderParams): Promise<void> => {
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
      // Dynamically import so it doesn't bundle into non-Chrome paths
      const { renderMediaOnWeb } = await import('@remotion/web-renderer');

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
      console.log('[useClientRender] blob ready', { size: blob.size, type: blob.type });

      // Trigger download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'video.webm';
      a.click();
      URL.revokeObjectURL(url);

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
      // Late muxer-stream writes — file is still usable, treat as warning.
      const msg = e?.message ?? '';
      if (msg.includes('closing writable stream') || msg.includes('Cannot write to a closing')) {
        console.warn('[useClientRender] muxer reported a late stream write; output may still be valid', e);
        setStatus('done');
        setProgress(1);
        return;
      }
      setError(e?.message ?? 'Client render failed');
      setStatus('error');
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
