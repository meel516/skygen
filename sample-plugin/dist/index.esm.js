// Pre-built bundle for test-image-plugin
// This is a minimal stub — actual rendering uses the Scene.tsx source
import { AbsoluteFill, Img, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from 'react/jsx-runtime';

function TestImagePlugin({ data, theme, animation }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enterFrames = animation.enter * fps;
  const opacity = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: 'clamp' });

  return _jsxs(AbsoluteFill, {
    style: { opacity },
    children: [
      data.bg_image ? _jsx(Img, { src: data.bg_image, style: { width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' } }) : null,
      _jsx(AbsoluteFill, { style: { background: 'rgba(0,0,0,0.5)' } }),
      data.logo ? _jsx(Img, { src: data.logo, style: { position: 'absolute', top: 40, right: 40, width: 80, height: 80, objectFit: 'contain' } }) : null,
      data.narration ? _jsx(Audio, { src: data.narration }) : null,
      _jsxs(AbsoluteFill, {
        style: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 40, textAlign: 'center' },
        children: [
          _jsx('h1', { style: { color: '#ffffff', fontSize: 48, fontWeight: 700, margin: 0, borderBottom: `4px solid ${data.accent_color}`, paddingBottom: 12 }, children: data.headline }),
          _jsx('p', { style: { color: '#cccccc', fontSize: 22, marginTop: 20 }, children: data.subtext }),
        ],
      }),
    ],
  });
}

export { TestImagePlugin as default };
