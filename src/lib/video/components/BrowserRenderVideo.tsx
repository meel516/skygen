import React, { useLayoutEffect, useRef } from 'react';
import { Video } from '@remotion/media';
import { useCurrentFrame, useDelayRender, useRemotionEnvironment, useVideoConfig } from 'remotion';
import { ALL_FORMATS, CanvasSink, Input, UrlSource, type WrappedCanvas } from 'mediabunny';

type Props = React.ComponentProps<typeof Video> & { startFrom?: number; endAt?: number };
type Decoder = { input: Input; ready: Promise<{ read: (time: number, step: number) => Promise<WrappedCanvas | null>; duration: number }> };

function createFrameReader(sink: CanvasSink, duration: number) {
  let iterator: AsyncGenerator<WrappedCanvas | null, void, unknown> | null = null;
  let lastTime = -Infinity;
  let nextTime = -Infinity;
  let lastStep = 0;
  let lastCanvas: WrappedCanvas | null = null;
  let pending = Promise.resolve<WrappedCanvas | null>(null);
  return (time: number, step: number) => {
    pending = pending.then(async () => {
      if (Math.abs(time - lastTime) < 0.000001) return lastCanvas;
      if (!iterator || Math.abs(time - nextTime) > 0.000001 || step !== lastStep) {
        await iterator?.return();
        // The sink releases each decoded sample after copying it into its canvas.
        // Monotonic timestamp iteration avoids decoding from the keyframe every time.
        function* timestamps() {
          for (let index = 0; time + index * step < duration; index++) yield time + index * step;
        }
        iterator = sink.canvasesAtTimestamps(timestamps());
      }
      const result = await iterator.next();
      lastTime = time;
      nextTime = time + step;
      lastStep = step;
      lastCanvas = result.value ? result.value : null;
      return lastCanvas;
    });
    return pending;
  };
}

/** Export muted video through canvases so decoded VideoFrames are promptly released. */
export function BrowserRenderVideo(props: Props) {
  const { isClientSideRendering } = useRemotionEnvironment();
  // Preserve the regular player, server renderer, audio handling and effects pipeline.
  if (!isClientSideRendering || !props.muted || props.effects || props.onVideoFrame || props.requestInit) {
    return <Video {...props} />;
  }
  return <CanvasRenderVideo {...props} />;
}

function CanvasRenderVideo({ src, style, className, playbackRate = 1, loop = false,
  trimBefore, trimAfter, startFrom, endAt, credentials, objectFit,
  delayRenderTimeoutInMilliseconds, delayRenderRetries }: Props) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { delayRender, continueRender, cancelRender } = useDelayRender();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const decoderRef = useRef<Decoder | null>(null);

  useLayoutEffect(() => {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new UrlSource(src, { requestInit: { credentials: credentials ?? 'same-origin' } }),
    });
    const ready = (async () => {
      const track = await input.getPrimaryVideoTrack();
      if (!track || !(await track.canDecode())) throw new Error('Browser cannot decode this video.');
      const duration = await track.computeDuration();
      // CanvasSink copies pixels and closes the underlying sample after every frame.
      return { read: createFrameReader(new CanvasSink(track, { poolSize: 1 }), duration), duration };
    })();
    decoderRef.current = { input, ready };
    return () => { decoderRef.current = null; input.dispose(); };
  }, [src, credentials]);

  useLayoutEffect(() => {
    const decoder = decoderRef.current;
    if (!decoder) return;
    let cancelled = false;
    const handle = delayRender(`Drawing video frame ${frame}`, {
      timeoutInMilliseconds: delayRenderTimeoutInMilliseconds ?? undefined,
      retries: delayRenderRetries ?? undefined,
    });
    void (async () => {
      const { read, duration } = await decoder.ready;
      if (cancelled) return;
      const start = Math.max(0, (trimBefore ?? startFrom ?? 0) / fps);
      const end = Math.min(duration, (trimAfter ?? endAt ?? Infinity) / fps);
      if (!(end > start) || !(playbackRate > 0)) throw new Error('Invalid video trim range or playback rate.');
      const elapsed = Math.max(0, frame * playbackRate / fps);
      const time = loop ? start + elapsed % (end - start) : Math.min(start + elapsed, Math.max(start, end - 0.000001));
      const result = await read(time, playbackRate / fps);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (canvas) {
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not create video export canvas.');
        if (result) {
          canvas.width = result.canvas.width;
          canvas.height = result.canvas.height;
          context.drawImage(result.canvas, 0, 0);
        } else context.clearRect(0, 0, canvas.width, canvas.height);
      }
      continueRender(handle);
    })().catch(error => {
      if (!cancelled) cancelRender(new Error(`Video frame ${frame} could not be decoded: ${error instanceof Error ? error.message : String(error)}`));
    });
    return () => { cancelled = true; continueRender(handle); };
  }, [src, credentials, frame, fps, playbackRate, loop, trimBefore, trimAfter, startFrom, endAt,
    delayRender, continueRender, cancelRender, delayRenderTimeoutInMilliseconds, delayRenderRetries]);

  // Match @remotion/media: its objectFit prop takes precedence over style.objectFit.
  return <canvas ref={canvasRef} className={className} style={{ ...style, objectFit: objectFit ?? 'cover' }} />;
}
