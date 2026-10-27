import { AbsoluteFill, Img, Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';

interface SceneData {
  bg_image:     string;
  logo:         string;
  narration:    string;
  headline:     string;
  subtext:      string;
  accent_color: string;
}

export default function TestImagePlugin({
  data,
  theme,
  animation,
}: {
  data:      SceneData;
  theme:     string;
  animation: { enter: number; hold: number; exit: number };
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enterFrames = animation.enter * fps;
  const opacity = interpolate(frame, [0, enterFrames], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ opacity }}>
      {/* Background image — data-ai-type tells the wizard to generate this */}
      <Img
        src={data.bg_image}
        data-ai-type="image"
        data-ai-prompt="dark abstract background representing {narrativeRole}"
        style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute' }}
      />

      {/* Overlay */}
      <AbsoluteFill style={{ background: 'rgba(0,0,0,0.5)' }} />

      {/* Logo — separate image field, no bg removal hint here */}
      {data.logo ? (
        <Img
          src={data.logo}
          data-ai-type="image"
          data-ai-prompt="clean product logo or icon on transparent background"
          style={{
            position: 'absolute',
            top: 40,
            right: 40,
            width: 80,
            height: 80,
            objectFit: 'contain',
          }}
        />
      ) : null}

      {/* Audio narration */}
      {data.narration ? (
        <Audio
          src={data.narration}
          data-ai-type="audio"
          data-ai-prompt="explain {keyMessage} in a professional tone"
        />
      ) : null}

      {/* Text content */}
      <AbsoluteFill
        style={{
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'center',
          alignItems:     'center',
          padding:        40,
          textAlign:      'center',
        }}
      >
        <h1
          style={{
            color:      '#ffffff',
            fontSize:   48,
            fontWeight: 700,
            margin:     0,
            borderBottom: `4px solid ${data.accent_color}`,
            paddingBottom: 12,
          }}
        >
          {data.headline}
        </h1>
        <p
          style={{
            color:     '#cccccc',
            fontSize:  22,
            marginTop: 20,
          }}
        >
          {data.subtext}
        </p>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
