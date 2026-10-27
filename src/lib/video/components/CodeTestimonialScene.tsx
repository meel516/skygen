import React from 'react';
import { useCurrentFrame, useVideoConfig, AbsoluteFill, interpolate } from 'remotion';
import { BaseScene } from './BaseScene';
import { 
  useFadeIn, 
  useScaleIn, 
  useSlideIn,
  type MotionProfileType 
} from '../utils/animations';
import { getTheme } from '../utils/theme';
import type { CodeBlock, TestimonialBlock, AnimationPhase } from '../schemas';

// ============================================================================
// CODE SCENE COMPONENT
// ============================================================================

export interface CodeSceneProps {
  data: CodeBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function CodeScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'subtle',
  animation,
}: CodeSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 4;
  
  // Title animations
  const titleSlide = useSlideIn('up', 30, 0.4, 0, motionProfile);
  const titleOpacity = useFadeIn(0.3, 0, motionProfile);
  
  // Code block animation
  const codeOpacity = useFadeIn(0.5, 0.15, motionProfile);
  const codeScale = useScaleIn(0.3, 0.15, motionProfile);
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  // Simple syntax highlighting colors
  const syntaxColors: Record<string, string> = {
    keyword: '#c678dd',
    string: '#98c379',
    number: '#d19a66',
    comment: '#5c6370',
    function: '#61afef',
    default: colors.foreground,
  };
  
  return (
    <BaseScene theme={theme} opacity={exitOpacity} audioSrc={data.audioSrc}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          padding: '50px 60px',
          gap: 30,
        }}
      >
        {/* Title */}
        {data.title && (
          <div
            style={{
              transform: `translate(${titleSlide.x}px, ${titleSlide.y}px)`,
              opacity: titleOpacity,
            }}
          >
            <h2
              style={{
                fontSize: 36,
                fontWeight: 700,
                color: colors.foreground,
                margin: 0,
              }}
            >
              {data.title}
            </h2>
          </div>
        )}
        
        {/* Code Block */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: codeOpacity,
            transform: `scale(${codeScale})`,
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: 900,
              background: '#1e1e2e',
              borderRadius: 16,
              overflow: 'hidden',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '16px 20px',
                background: '#181825',
                borderBottom: '1px solid #313244',
              }}
            >
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f38ba8' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#f9e2af' }} />
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#a6e3a1' }} />
              <span
                style={{
                  marginLeft: 16,
                  fontSize: 14,
                  color: colors.muted,
                  fontFamily: 'monospace',
                }}
              >
                {data.language || 'javascript'}
              </span>
            </div>
            
            {/* Code */}
            <pre
              style={{
                padding: '24px 28px',
                margin: 0,
                fontSize: 18,
                fontFamily: 'monospace',
                lineHeight: 1.6,
                color: syntaxColors.default,
                overflow: 'hidden',
              }}
            >
              {data.code.split('\n').map((line, i) => (
                <div key={i} style={{ display: 'flex' }}>
                  <span
                    style={{
                      width: 40,
                      color: '#45475a',
                      textAlign: 'right',
                      marginRight: 20,
                      userSelect: 'none',
                    }}
                  >
                    {i + 1}
                  </span>
                  <span style={{ flex: 1 }}>{highlightSyntax(line, syntaxColors)}</span>
                </div>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </BaseScene>
  );
}

// Simple syntax highlighter
function highlightSyntax(line: string, colors: Record<string, string>): React.ReactNode {
  // Keywords
  const keywords = ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined'];
  
  let result = line;
  
  // Simple highlighting using spans
  // This is a basic implementation - a real one would use proper tokenization
  return <span dangerouslySetInnerHTML={{ __html: escapeHtml(line) }} />;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================================
// TESTIMONIAL SCENE COMPONENT
// ============================================================================

export interface TestimonialSceneProps {
  data: TestimonialBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
  animation?: AnimationPhase;
}

export function TestimonialScene({
  data,
  theme = 'dark_modern',
  motionProfile = 'dynamic',
  animation,
}: TestimonialSceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const colors = getTheme(theme);
  
  // Animation timings
  const enterDuration = animation?.enter ?? 0.5;
  const holdDuration = animation?.hold ?? 4;
  
  // Quote animation
  const quoteSlide = useSlideIn('up', 50, 0.6, 0, motionProfile);
  const quoteOpacity = useFadeIn(0.5, 0, motionProfile);
  
  // Author animation
  const authorSlide = useSlideIn('up', 30, 0.4, 0.3, motionProfile);
  const authorOpacity = useFadeIn(0.4, 0.3, motionProfile);
  
  // Quote mark animation
  const markScale = useScaleIn(0.4, 0, motionProfile);
  const markOpacity = useFadeIn(0.3, 0, motionProfile);
  
  // Exit animation
  const exitStart = (enterDuration + holdDuration) * fps;
  const exitProgress = frame > exitStart 
    ? Math.min(1, (frame - exitStart) / (fps * 0.4))
    : 0;
  const exitOpacity = 1 - exitProgress;
  
  return (
    <BaseScene theme={theme} opacity={exitOpacity}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 80,
          gap: 40,
        }}
      >
        {/* Quote mark */}
        <div
          style={{
            transform: `scale(${markScale})`,
            opacity: markOpacity,
          }}
        >
          <span
            style={{
              fontSize: 100,
              color: colors.primary,
              opacity: 0.5,
              lineHeight: 0.5,
            }}
          >
            "
          </span>
        </div>
        
        {/* Quote */}
        <div
          style={{
            transform: `translate(${quoteSlide.x}px, ${quoteSlide.y}px)`,
            opacity: quoteOpacity,
            textAlign: 'center',
            maxWidth: 900,
          }}
        >
          <p
            style={{
              fontSize: 38,
              fontWeight: 500,
              color: colors.foreground,
              fontStyle: 'italic',
              lineHeight: 1.5,
              margin: 0,
            }}
          >
            {data.quote}
          </p>
        </div>
        
        {/* Author */}
        <div
          style={{
            transform: `translate(${authorSlide.x}px, ${authorSlide.y}px)`,
            opacity: authorOpacity,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Avatar or placeholder */}
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: '50%',
              background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 24,
              fontWeight: 600,
              color: '#ffffff',
            }}
          >
            {data.author.charAt(0).toUpperCase()}
          </div>
          
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: colors.foreground,
              }}
            >
              {data.author}
            </div>
            {data.role && (
              <div
                style={{
                  fontSize: 16,
                  color: colors.muted,
                }}
              >
                {data.role}{data.company && `, ${data.company}`}
              </div>
            )}
          </div>
        </div>
      </div>
    </BaseScene>
  );
}
