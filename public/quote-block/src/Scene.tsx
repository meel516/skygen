import {
  AbsoluteFill,
  useCurrentFrame,
  useVideoConfig,
  interpolate,
  spring,
} from 'remotion';

interface QuoteData {
  quote?: string;
  author?: string;
  accentColor?: string;
  textAlign?: 'left' | 'center' | 'right';
}

interface SceneProps {
  data?: QuoteData;
  theme?: string;
  animation?: { enter: number; hold: number; exit: number };
}

const THEMES: Record<string, { bg: string; bgSecondary: string; text: string; textSecondary: string }> = {
  dark_modern:  { bg: '#0A0A0A', bgSecondary: '#1A1A1A', text: '#FFFFFF',  textSecondary: '#9CA3AF' },
  light_clean:  { bg: '#FFFFFF', bgSecondary: '#F5F5F5', text: '#111111',  textSecondary: '#6B7280' },
  bold_vibrant: { bg: '#1A0533', bgSecondary: '#2D1B69', text: '#FFFFFF',  textSecondary: '#C4B5FD' },
  corporate:    { bg: '#F8F9FA', bgSecondary: '#E9ECEF', text: '#212529',  textSecondary: '#6C757D' },
};

export default function QuoteScene({ data = {}, theme = 'dark_modern', animation = { enter: 1, hold: 4, exit: 0.5 } }: SceneProps) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const quote      = data.quote      ?? 'The best way to predict the future is to create it.';
  const author     = data.author     ?? 'Peter Drucker';
  const accent     = data.accentColor ?? '#0EA5E9';
  const textAlign  = data.textAlign  ?? 'center';

  const colors = THEMES[theme] ?? THEMES.dark_modern;

  const enterFrames = animation.enter * fps;

  // Quotation mark bounces in
  const quoteMarkScale = spring({ frame, fps, config: { damping: 12, stiffness: 120 } });

  // Accent line expands
  const lineWidth = interpolate(frame, [enterFrames * 0.3, enterFrames * 0.8], [0, 100], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Quote text fades + rises
  const textOpacity = interpolate(frame, [enterFrames * 0.4, enterFrames * 0.9], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const textY = interpolate(frame, [enterFrames * 0.4, enterFrames * 0.9], [30, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  // Author slides up later
  const authorOpacity = interpolate(frame, [enterFrames * 0.7, enterFrames * 1.1], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const authorY = interpolate(frame, [enterFrames * 0.7, enterFrames * 1.1], [20, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: colors.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 80,
        fontFamily: "'Georgia', 'Times New Roman', serif",
      }}
    >
      <div style={{ maxWidth: 900, width: '100%', textAlign }}>

        {/* Big quotation mark */}
        <div
          style={{
            fontSize: 120,
            lineHeight: 1,
            color: accent,
            transform: `scale(${quoteMarkScale})`,
            transformOrigin: textAlign === 'right' ? 'right center' : textAlign === 'center' ? 'center' : 'left center',
            marginBottom: -20,
            opacity: 0.9,
          }}
        >
          &ldquo;
        </div>

        {/* Quote text */}
        <div
          style={{
            fontSize: 38,
            fontWeight: 400,
            color: colors.text,
            lineHeight: 1.5,
            letterSpacing: '-0.01em',
            opacity: textOpacity,
            transform: `translateY(${textY}px)`,
            marginBottom: 40,
          }}
        >
          {quote}
        </div>

        {/* Accent line */}
        <div
          style={{
            display: 'flex',
            justifyContent: textAlign === 'right' ? 'flex-end' : textAlign === 'center' ? 'center' : 'flex-start',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              height: 3,
              width: `${lineWidth}%`,
              maxWidth: 120,
              backgroundColor: accent,
              borderRadius: 2,
            }}
          />
        </div>

        {/* Author */}
        <div
          style={{
            fontSize: 22,
            fontWeight: 600,
            color: colors.textSecondary,
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            opacity: authorOpacity,
            transform: `translateY(${authorY}px)`,
          }}
        >
          — {author}
        </div>

      </div>
    </AbsoluteFill>
  );
}
