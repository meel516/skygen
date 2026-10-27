import { useRef, useEffect } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { Audio } from '@remotion/media';

interface HtmlBlockData {
  type: 'html';
  htmlContent: string;
  title?: string;
  backgroundColor?: string;
  audioSrc?: string;
  audioVolume?: number;
}

interface HtmlSceneProps {
  data: HtmlBlockData;
  theme: string;
  motionProfile: string;
  animation?: { enter: number; hold: number; exit: number };
}

export function HtmlScene({ data, theme, motionProfile, animation }: HtmlSceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const enterFrames = Math.round((animation?.enter ?? 0.4) * fps);
  const exitStartFrame = Math.round(((animation?.enter ?? 0.4) + (animation?.hold ?? 2.2)) * fps);
  const exitFrames = Math.round((animation?.exit ?? 0.2) * fps);

  const opacity = interpolate(
    frame,
    [0, enterFrames, exitStartFrame, exitStartFrame + exitFrames],
    [0, 1, 1, 0],
    { extrapolateRight: 'clamp' }
  );

  useEffect(() => {
    if (iframeRef.current) {
      try {
        const win = iframeRef.current.contentWindow;
        if (win) {
          (win as any).__remotionFrame = frame;
          (win as any).__remotionFps = fps;
          (win as any).__remotionTime = frame / fps;
          // Allow the embedded document to re-fit if its layout changes over time.
          if (typeof (win as any).__remotionApplyFit === 'function') {
            (win as any).__remotionApplyFit();
          }
        }
      } catch {}
    }
  }, [frame, fps]);

  const bg = theme === 'light_minimal' ? '#ffffff'
    : theme === 'corporate' ? '#f8fafc'
    : '#0a0a0f';

  const injectScript = `
    <style>
      /* Base constraints to avoid clipping in 1080x1920 frames */
      * { box-sizing: border-box; }
      html, body { width: 100%; height: 100%; margin: 0; padding: 0; overflow: hidden; background: transparent; }
      /* Safe-area padding so large content doesn't hit edges */
      #__remotion_safe {
        position: relative;
        width: 100%;
        height: 100%;
        padding: 64px 56px 96px 56px;
        overflow: hidden;
      }
      #__remotion_fit {
        position: absolute;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%) scale(1);
        transform-origin: center center;
        will-change: transform;
      }
    </style>
    <script>
      window.addEventListener('DOMContentLoaded', function() {
        Object.defineProperty(window, '__remotionFrame', {
          set: function(v) { this._rf = v; if (typeof onRemotionFrame === 'function') onRemotionFrame(v); },
          get: function() { return this._rf || 0; }
        });
        Object.defineProperty(window, '__remotionTime', {
          set: function(v) { this._rt = v; },
          get: function() { return this._rt || 0; }
        });

        // Wrap body content in a fit-to-frame container (once).
        try {
          var body = document.body;
          if (!body) return;
          if (!document.getElementById('__remotion_safe')) {
            var safe = document.createElement('div');
            safe.id = '__remotion_safe';
            var fit = document.createElement('div');
            fit.id = '__remotion_fit';
            // Move all existing body children into fit wrapper
            while (body.firstChild) fit.appendChild(body.firstChild);
            safe.appendChild(fit);
            body.appendChild(safe);
          }

          var lastScale = 1;
          function applyFit() {
            var safeEl = document.getElementById('__remotion_safe');
            var fitEl = document.getElementById('__remotion_fit');
            if (!safeEl || !fitEl) return;

            // Measure content size (use scroll to include overflow)
            var contentW = Math.max(fitEl.scrollWidth, fitEl.offsetWidth);
            var contentH = Math.max(fitEl.scrollHeight, fitEl.offsetHeight);
            var availW = safeEl.clientWidth;
            var availH = safeEl.clientHeight;

            if (!contentW || !contentH || !availW || !availH) return;
            var scale = Math.min(availW / contentW, availH / contentH, 1);
            if (Math.abs(scale - lastScale) > 0.001) {
              fitEl.style.transform = 'translate(-50%, -50%) scale(' + scale + ')';
              lastScale = scale;
            }
          }

          // Fit on load + on resize. Also refit when animations might change layout.
          applyFit();
          window.addEventListener('resize', applyFit);
          window.__remotionApplyFit = applyFit;
        } catch (e) {}
      });
    </script>
  `;

  let processedHtml = data.htmlContent || '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-family:sans-serif;">No HTML content</div>';

  if (processedHtml.includes('<html') || processedHtml.includes('<!DOCTYPE')) {
    processedHtml = processedHtml.replace('</head>', injectScript + '</head>');
  } else if (processedHtml.includes('<body')) {
    processedHtml = processedHtml.replace('<body', injectScript + '<body');
  } else {
    processedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; overflow: hidden; background: transparent; }
  </style>
  ${injectScript}
</head>
<body>
  ${processedHtml}
</body>
</html>`;
  }

  return (
    <AbsoluteFill style={{ opacity, backgroundColor: data.backgroundColor || bg }}>
      {data.title && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '8px 16px',
          fontSize: 12,
          color: theme === 'light_minimal' ? '#666' : '#888',
          fontFamily: 'sans-serif',
          zIndex: 10,
        }}>
          {data.title}
        </div>
      )}
      <iframe
        ref={iframeRef}
        srcDoc={processedHtml}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          backgroundColor: 'transparent',
        }}
        sandbox="allow-scripts"
      />
      {data.audioSrc && <Audio src={data.audioSrc} volume={data.audioVolume ?? 0.8} />}
    </AbsoluteFill>
  );
}
