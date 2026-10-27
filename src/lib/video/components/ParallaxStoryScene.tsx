// ============================================================================
// PARALLAX STORY SCENE - Cinematic Multi-layer Parallax Storytelling
// ============================================================================

import React, { useMemo, useEffect, useState, useRef } from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Easing, Sequence } from 'remotion';
import { Audio } from '@remotion/media';
import type { ParallaxStoryBlock, ParallaxLayer, StoryText, CameraMovement, ParallaxEffect } from '../schemas';
import type { MotionProfileType } from '../utils/animations';
import { TextLayer } from './TextOverlaySystem';

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// Get easing function by name
function getEasingFunction(easing: string): (t: number) => number {
  switch (easing) {
    case 'linear': return (t) => t;
    case 'ease': return easeInOutCubic;
    case 'ease-in': return (t) => t * t * t;
    case 'ease-out': return (t) => 1 - Math.pow(1 - t, 3);
    case 'ease-in-out': return (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    case 'bounce': return (t) => {
      const n1 = 7.5625;
      const d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    };
    case 'elastic': return (t) => {
      if (t === 0 || t === 1) return t;
      return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1;
    };
    default: return easeInOutCubic;
  }
}

// Calculate individual layer motion
function calculateLayerMotion(
  motionDirection: string,
  progress: number,
  intensity: number,
  speed: number,
  oscillate: boolean,
  oscillateSpeed: number,
  frame: number,
  fps: number
): { x: number; y: number; scale: number; rotation: number } {
  let x = 0;
  let y = 0;
  let scale = 1;
  let rotation = 0;

  let effectiveProgress = progress;
  if (oscillate) {
    const oscillation = Math.sin((frame / fps) * oscillateSpeed * Math.PI * 2);
    effectiveProgress = (oscillation + 1) / 2;
  }

  const moveAmount = effectiveProgress * intensity * speed * 20;

  switch (motionDirection) {
    case 'left':
      x = -moveAmount;
      break;
    case 'right':
      x = moveAmount;
      break;
    case 'up':
      y = -moveAmount;
      break;
    case 'down':
      y = moveAmount;
      break;
    case 'diagonal-tl-br':
      x = moveAmount;
      y = moveAmount;
      break;
    case 'diagonal-tr-bl':
      x = -moveAmount;
      y = moveAmount;
      break;
    case 'diagonal-bl-tr':
      x = moveAmount;
      y = -moveAmount;
      break;
    case 'diagonal-br-tl':
      x = -moveAmount;
      y = -moveAmount;
      break;
    case 'zoom-in':
      scale = 1 + effectiveProgress * intensity * 0.3;
      break;
    case 'zoom-out':
      scale = 1.3 - effectiveProgress * intensity * 0.3;
      break;
    case 'rotate-cw':
      rotation = effectiveProgress * intensity * 10;
      break;
    case 'rotate-ccw':
      rotation = -effectiveProgress * intensity * 10;
      break;
    case 'float':
      const floatY = Math.sin((frame / fps) * speed) * intensity * 5;
      y = floatY;
      break;
    case 'pulse':
      const pulseScale = 1 + Math.sin((frame / fps) * speed * 2) * intensity * 0.1;
      scale = pulseScale;
      break;
    case 'none':
    default:
      break;
  }

  return { x, y, scale, rotation };
}

// Calculate parallax offset based on camera movement
function calculateParallaxOffset(
  movement: CameraMovement,
  progress: number,
  depth: number,
  intensity: number,
  speed: number
): { x: number; y: number; scale: number } {
  const depthFactor = 1 - (depth / 100);
  const parallaxMultiplier = depthFactor * intensity * speed;

  let x = 0;
  let y = 0;
  let scale = 1;

  switch (movement) {
    case 'pan-left':
      x = progress * 20 * parallaxMultiplier;
      break;
    case 'pan-right':
      x = -progress * 20 * parallaxMultiplier;
      break;
    case 'pan-up':
      y = progress * 15 * parallaxMultiplier;
      break;
    case 'pan-down':
      y = -progress * 15 * parallaxMultiplier;
      break;
    case 'zoom-in':
      scale = 1 + (progress * 0.3 * depthFactor * intensity);
      break;
    case 'zoom-out':
      scale = 1 + ((1 - progress) * 0.3 * depthFactor * intensity);
      break;
    case 'diagonal-tl-br':
      x = -progress * 15 * parallaxMultiplier;
      y = -progress * 10 * parallaxMultiplier;
      break;
    case 'diagonal-tr-bl':
      x = progress * 15 * parallaxMultiplier;
      y = -progress * 10 * parallaxMultiplier;
      break;
    case 'orbit':
      const angle = progress * Math.PI * 2;
      x = Math.sin(angle) * 10 * parallaxMultiplier;
      y = Math.cos(angle) * 5 * parallaxMultiplier;
      break;
    case 'breathing':
      const breatheProgress = Math.sin(progress * Math.PI * 2) * 0.5 + 0.5;
      scale = 1 + (breatheProgress * 0.1 * depthFactor * intensity);
      x = breatheProgress * 3 * parallaxMultiplier;
      break;
    case 'none':
    default:
      break;
  }

  return { x, y, scale };
}

// Get color grade filter
function getColorGradeFilter(grade: string, intensity: number): string {
  const filters: Record<string, string> = {
    'none': '',
    'cinematic': `contrast(1.1) saturate(${1.2 - intensity * 0.3}) sepia(${intensity * 0.1})`,
    'vintage': `sepia(${intensity * 0.4}) saturate(${1 - intensity * 0.2}) contrast(1.1)`,
    'cold': `saturate(${1 - intensity * 0.2}) hue-rotate(${intensity * 20}deg) brightness(1.05)`,
    'warm': `saturate(${1.2 + intensity * 0.2}) sepia(${intensity * 0.2}) brightness(1.05)`,
    'noir': `grayscale(${0.5 + intensity * 0.5}) contrast(${1.2 + intensity * 0.3}) brightness(0.9)`,
    'sepia': `sepia(${intensity * 0.6}) saturate(${1 - intensity * 0.3})`,
    'neon': `saturate(${1.5 + intensity * 0.5}) contrast(1.2) brightness(1.1)`,
  };
  return filters[grade] || '';
}

// Get animation transform based on type
function getAnimationTransform(
  animationType: string,
  progress: number,
  easing: string
): { transform: string; opacity: number; filter: string } {
  const ease = getEasingFunction(easing);
  const t = ease(progress);

  let transform = '';
  let opacity = 1;
  let filter = '';

  switch (animationType) {
    case 'fade':
      opacity = progress;
      break;
    case 'slide-left':
      transform = `translateX(${(1 - t) * -100}%)`;
      opacity = progress;
      break;
    case 'slide-right':
      transform = `translateX(${(1 - t) * 100}%)`;
      opacity = progress;
      break;
    case 'slide-up':
      transform = `translateY(${(1 - t) * 100}%)`;
      opacity = progress;
      break;
    case 'slide-down':
      transform = `translateY(${(1 - t) * -100}%)`;
      opacity = progress;
      break;
    case 'zoom-in':
      transform = `scale(${0.5 + t * 0.5})`;
      opacity = progress;
      break;
    case 'zoom-out':
      transform = `scale(${1.5 - t * 0.5})`;
      opacity = progress;
      break;
    case 'rotate-in':
      transform = `rotate(${(1 - t) * -180}deg) scale(${0.5 + t * 0.5})`;
      opacity = progress;
      break;
    case 'rotate-out':
      transform = `rotate(${(1 - t) * 180}deg)`;
      opacity = progress;
      break;
    case 'flip-x':
      transform = `perspective(400px) rotateX(${(1 - t) * 90}deg)`;
      opacity = progress;
      break;
    case 'flip-y':
      transform = `perspective(400px) rotateY(${(1 - t) * 90}deg)`;
      opacity = progress;
      break;
    case 'bounce':
      const bounceT = getEasingFunction('bounce')(progress);
      transform = `translateY(${(1 - bounceT) * -30}px)`;
      opacity = progress;
      break;
    case 'blur-in':
      filter = `blur(${(1 - t) * 20}px)`;
      opacity = progress;
      break;
    case 'none':
    default:
      break;
  }

  return { transform, opacity, filter };
}

// ============================================================================
// PARALLAX LAYER COMPONENT
// ============================================================================

interface ParallaxLayerComponentProps {
  layer: ParallaxLayer;
  cameraOffset: { x: number; y: number; scale: number };
  frame: number;
  fps: number;
  introDuration: number;
  outroDuration: number;
  totalDuration: number;
  dofBlur: number;
}

function ParallaxLayerComponent({
  layer,
  cameraOffset,
  frame,
  fps,
  introDuration,
  outroDuration,
  totalDuration,
  dofBlur,
}: ParallaxLayerComponentProps) {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!layer.image) {
      setLoaded(true);
      return;
    }

    const img = new Image();
    img.onload = () => setLoaded(true);
    img.onerror = () => setLoaded(true);
    img.src = layer.image;
  }, [layer.image]);

  const introFrames = introDuration * fps;
  const outroFrames = outroDuration * fps;
  const totalFrames = totalDuration * fps;

  const baseOpacity = interpolate(
    frame,
    [0, introFrames, totalFrames - outroFrames, totalFrames],
    [0, 1, 1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const delayFrames = (layer.animationDelay || 0) * fps;
  const animationDuration = (layer.animationDuration || 1) * fps;
  const animationStart = delayFrames;
  const animationEnd = animationStart + animationDuration;

  const animationProgress = interpolate(
    frame,
    [animationStart, animationEnd],
    [0, 1],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  const animationTransform = getAnimationTransform(
    layer.animationIn || 'fade',
    animationProgress,
    layer.animationEasing || 'ease-out'
  );

  const layerMotion = layer.motionEnabled !== false
    ? calculateLayerMotion(
        layer.motionDirection || 'none',
        frame / totalFrames,
        layer.motionIntensity || 1,
        layer.motionSpeed || 1,
        layer.motionOscillate || false,
        layer.motionOscillateSpeed || 1,
        frame,
        fps
      )
    : { x: 0, y: 0, scale: 1, rotation: 0 };

  if (!loaded) return null;

  const combinedX = cameraOffset.x + layerMotion.x + (layer.positionX || 0);
  const combinedY = cameraOffset.y + layerMotion.y + (layer.positionY || 0);
  const combinedScale = cameraOffset.scale * layerMotion.scale * (layer.scale || 1);
  const combinedRotation = (layer.rotation || 0) + layerMotion.rotation;

  const imagePositionMap: Record<string, string> = {
    center: 'center',
    top: 'top center',
    bottom: 'bottom center',
    left: 'center left',
    right: 'center right',
  };

  const layerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    backgroundImage: `url(${layer.image})`,
    backgroundSize: layer.imageFit || 'cover',
    backgroundPosition: imagePositionMap[layer.imagePosition || 'center'],
    backgroundRepeat: 'no-repeat',
    transform: `
      translateX(calc(${combinedX}%))
      translateY(calc(${combinedY}%))
      scale(${combinedScale})
      rotate(${combinedRotation}deg)
      ${animationTransform.transform}
    `,
    opacity: baseOpacity * (layer.opacity || 1) * animationTransform.opacity,
    filter: `blur(${(layer.blur || 0) + dofBlur}px) ${animationTransform.filter}`,
    mixBlendMode: layer.blendMode as React.CSSProperties['mixBlendMode'],
    zIndex: 100 - (layer.depth || 50),
    transition: 'none',
  };

  return <div style={layerStyle} />;
}

// ============================================================================
// VISUAL EFFECTS COMPONENTS
// ============================================================================

function ParticlesEffect({ count, color, speed, frame }: { count: number; color: string; speed: number; frame: number }) {
  const particles = useMemo(() => {
    return Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 3,
      speedMultiplier: 0.5 + Math.random() * 1.5,
      opacity: 0.3 + Math.random() * 0.5,
    }));
  }, [count]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 200 }}>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: `${p.x}%`,
            top: `${((p.y + frame * 0.02 * speed * p.speedMultiplier) % 110) - 5}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            backgroundColor: color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${color}`,
          }}
        />
      ))}
    </div>
  );
}

function LightRaysEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const rays = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: i * 45 + Math.random() * 20,
      width: 20 + Math.random() * 40,
      opacity: 0.1 + Math.random() * 0.2,
    }));
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 150 }}>
      {rays.map((ray) => (
        <div
          key={ray.id}
          style={{
            position: 'absolute',
            top: '-20%',
            left: '50%',
            width: `${ray.width}px`,
            height: '140%',
            background: `linear-gradient(${ray.angle}deg, 
              transparent 0%, 
              rgba(255, 255, 200, ${ray.opacity * intensity}) 30%, 
              rgba(255, 255, 200, ${ray.opacity * intensity * 0.5}) 50%, 
              transparent 70%)`,
            transform: `rotate(${ray.angle}deg) translateX(-50%)`,
            transformOrigin: 'top center',
          }}
        />
      ))}
    </div>
  );
}

function FogEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const shift = (frame * 0.1) % 100;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 180,
        background: `
          radial-gradient(ellipse 200% 100% at ${shift}% 80%, 
            rgba(200, 210, 220, ${intensity * 0.3}) 0%, 
            transparent 70%)
        `,
      }}
    />
  );
}

function RainEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const drops = useMemo(() => {
    return Array.from({ length: Math.floor(100 * intensity) }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      speed: 15 + Math.random() * 10,
      length: 10 + Math.random() * 20,
    }));
  }, [intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 170 }}>
      {drops.map((drop) => (
        <div
          key={drop.id}
          style={{
            position: 'absolute',
            left: `${drop.x}%`,
            top: `${((frame * drop.speed * 0.1) % 120) - 20}%`,
            width: '1px',
            height: `${drop.length}px`,
            backgroundColor: 'rgba(200, 220, 255, 0.6)',
            opacity: intensity,
          }}
        />
      ))}
    </div>
  );
}

function SnowEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const flakes = useMemo(() => {
    return Array.from({ length: Math.floor(80 * intensity) }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      startY: Math.random() * 100,
      size: 2 + Math.random() * 4,
      speed: 0.5 + Math.random() * 1.5,
      wobble: Math.random() * Math.PI * 2,
    }));
  }, [intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 170 }}>
      {flakes.map((flake) => {
        const y = ((flake.startY + frame * flake.speed * 0.05) % 110) - 5;
        const x = flake.x + Math.sin(frame * 0.02 + flake.wobble) * 2;

        return (
          <div
            key={flake.id}
            style={{
              position: 'absolute',
              left: `${x}%`,
              top: `${y}%`,
              width: `${flake.size}px`,
              height: `${flake.size}px`,
              borderRadius: '50%',
              backgroundColor: 'white',
              opacity: 0.8,
              boxShadow: '0 0 4px rgba(255,255,255,0.8)',
            }}
          />
        );
      })}
    </div>
  );
}

function BokehEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const bokehs = useMemo(() => {
    return Array.from({ length: Math.floor(20 * intensity) }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 30 + Math.random() * 80,
      color: `hsl(${Math.random() * 60 + 30}, 70%, 70%)`,
      opacity: 0.1 + Math.random() * 0.2,
      pulseSpeed: 0.5 + Math.random() * 1.5,
    }));
  }, [intensity]);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 160 }}>
      {bokehs.map((b) => {
        const pulse = Math.sin(frame * 0.05 * b.pulseSpeed) * 0.3 + 0.7;

        return (
          <div
            key={b.id}
            style={{
              position: 'absolute',
              left: `${b.x}%`,
              top: `${b.y}%`,
              width: `${b.size}px`,
              height: `${b.size}px`,
              borderRadius: '50%',
              backgroundColor: b.color,
              opacity: b.opacity * pulse,
              filter: 'blur(10px)',
            }}
          />
        );
      })}
    </div>
  );
}

function VignetteEffect({ intensity }: { intensity: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 190,
        background: `radial-gradient(ellipse at center, 
          transparent 40%, 
          rgba(0, 0, 0, ${intensity * 0.8}) 100%)`,
      }}
    />
  );
}

function FilmGrainEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const noise = useMemo(() => {
    return `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`;
  }, []);

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 195,
        backgroundImage: noise,
        opacity: intensity * 0.15,
        mixBlendMode: 'overlay',
        animation: 'grain 0.5s steps(10) infinite',
      }}
    />
  );
}

function ChromaticEffect({ intensity }: { intensity: number }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 185,
        background: `
          linear-gradient(90deg, 
            rgba(255, 0, 0, ${intensity * 0.1}) 0%, 
            transparent 10%, 
            transparent 90%, 
            rgba(0, 255, 255, ${intensity * 0.1}) 100%)
        `,
      }}
    />
  );
}

function GlowEffect({ intensity, frame }: { intensity: number; frame: number }) {
  const pulse = Math.sin(frame * 0.03) * 0.3 + 0.7;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        zIndex: 175,
        background: `radial-gradient(ellipse at 50% 50%, 
          rgba(255, 255, 255, ${intensity * 0.2 * pulse}) 0%, 
          transparent 50%)`,
      }}
    />
  );
}

// ============================================================================
// VISUAL EFFECTS WRAPPER
// ============================================================================

function VisualEffects({
  effects,
  intensity,
  frame,
}: {
  effects: ParallaxEffect[];
  intensity: number;
  frame: number;
}) {
  return (
    <>
      {effects.includes('particles') && (
        <ParticlesEffect count={80} color="#ffffff" speed={1} frame={frame} />
      )}
      {effects.includes('light-rays') && (
        <LightRaysEffect intensity={intensity} frame={frame} />
      )}
      {effects.includes('fog') && (
        <FogEffect intensity={intensity} frame={frame} />
      )}
      {effects.includes('rain') && (
        <RainEffect intensity={intensity} frame={frame} />
      )}
      {effects.includes('snow') && (
        <SnowEffect intensity={intensity} frame={frame} />
      )}
      {effects.includes('bokeh') && (
        <BokehEffect intensity={intensity} frame={frame} />
      )}
      {effects.includes('vignette') && (
        <VignetteEffect intensity={intensity} />
      )}
      {effects.includes('film-grain') && (
        <FilmGrainEffect intensity={intensity} frame={frame} />
      )}
      {effects.includes('chromatic') && (
        <ChromaticEffect intensity={intensity} />
      )}
      {effects.includes('glow') && (
        <GlowEffect intensity={intensity} frame={frame} />
      )}
    </>
  );
}

// ============================================================================
// TEXT OVERLAY COMPONENT
// ============================================================================

function TextOverlayComponent({
  text,
  frame,
  fps,
}: {
  text: StoryText;
  frame: number;
  fps: number;
}) {
  const startFrame = (text.startTime || 0) * fps;
  const durationFrames = (text.duration || 3) * fps;
  const delayFrames = (text.animationDelay || 0) * fps;

  const isVisible = frame >= startFrame && frame <= startFrame + durationFrames;
  if (!isVisible) return null;

  const animFrame = frame - startFrame - delayFrames;
  const animProgress = Math.min(1, Math.max(0, animFrame / (fps * 0.5)));

  let animStyle: React.CSSProperties = {};

  switch (text.animation) {
    case 'fade':
      animStyle = { opacity: animProgress };
      break;
    case 'slide-up':
      animStyle = {
        opacity: animProgress,
        transform: `translateY(${(1 - animProgress) * 30}px)`,
      };
      break;
    case 'slide-down':
      animStyle = {
        opacity: animProgress,
        transform: `translateY(${-(1 - animProgress) * 30}px)`,
      };
      break;
    case 'typewriter':
      const chars = Math.floor(animProgress * text.text.length);
      return (
        <div
          style={{
            position: 'absolute',
            left: text.position === 'custom' ? `${text.customX}%` : '50%',
            top: text.position === 'custom' ? `${text.customY}%` :
                 text.position === 'top' ? '10%' :
                 text.position === 'bottom' ? '80%' : '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: text.textAlign,
            zIndex: 250,
          }}
        >
          <span
            style={{
              fontSize: text.fontSize === 'small' ? '1rem' :
                       text.fontSize === 'medium' ? '1.5rem' :
                       text.fontSize === 'large' ? '2rem' :
                       text.fontSize === 'xlarge' ? '2.5rem' : '3rem',
              fontWeight: text.fontWeight,
              color: text.color,
              textShadow: text.shadow ? `2px 2px 4px ${text.shadowColor}` : 'none',
            }}
          >
            {text.text.substring(0, chars)}
            <span style={{ opacity: 0.5 }}>|</span>
          </span>
        </div>
      );
    case 'glow':
      const glowIntensity = Math.sin(animProgress * Math.PI) * 10 + 5;
      animStyle = {
        opacity: animProgress,
        textShadow: `0 0 ${glowIntensity}px ${text.color}, 0 0 ${glowIntensity * 2}px ${text.color}`,
      };
      break;
    case 'pulse':
      const scale = 1 + Math.sin(animProgress * Math.PI * 4) * 0.05;
      animStyle = {
        opacity: animProgress,
        transform: `translate(-50%, -50%) scale(${scale})`,
      };
      break;
    default:
      break;
  }

  const positionStyle: React.CSSProperties = {
    position: 'absolute',
    left: text.position === 'custom' ? `${text.customX}%` : '50%',
    top: text.position === 'custom' ? `${text.customY}%` :
         text.position === 'top' ? '10%' :
         text.position === 'bottom' ? '80%' : '50%',
    transform: text.animation === 'pulse' ? undefined : 'translate(-50%, -50%)',
    textAlign: text.textAlign,
    zIndex: 250,
  };

  return (
    <div style={positionStyle}>
      <div
        style={{
          fontSize: text.fontSize === 'small' ? '1rem' :
                   text.fontSize === 'medium' ? '1.5rem' :
                   text.fontSize === 'large' ? '2rem' :
                   text.fontSize === 'xlarge' ? '2.5rem' : '3rem',
          fontWeight: text.fontWeight,
          color: text.color,
          textShadow: text.shadow ? `2px 2px 4px ${text.shadowColor}` : 'none',
          ...animStyle,
        }}
      >
        {text.text}
      </div>
    </div>
  );
}

// ============================================================================
// OVERALL TEXT COMPONENT
// ============================================================================

const FONT_SIZES: Record<string, number> = {
  small: 32,
  medium: 48,
  large: 64,
  xlarge: 80,
  xxlarge: 100,
};

interface OverallTextComponentProps {
  text: string;
  textStyle: string;
  fontSize: string;
  fontWeight: string;
  textColor: string;
  textAlign: string;
  textPosition: string;
  animationDelay: number;
  frame: number;
  fps: number;
}

function OverallTextComponent({
  text,
  textStyle,
  fontSize,
  fontWeight,
  textColor,
  textAlign,
  textPosition,
  animationDelay,
  frame,
  fps,
}: OverallTextComponentProps) {
  const delayedFrame = Math.max(0, frame - animationDelay * fps);
  const animationDuration = 1 * fps;
  const progress = Math.min(1, delayedFrame / animationDuration);

  const positionStyles: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    justifyContent: textAlign === 'left' ? 'flex-start'
      : textAlign === 'right' ? 'flex-end'
      : 'center',
    alignItems: textPosition === 'top' ? 'flex-start'
      : textPosition === 'bottom' ? 'flex-end'
      : 'center',
    padding: '40px',
    zIndex: 250,
    pointerEvents: 'none',
  };

  const getStyleSpecifics = (style: string, color: string): React.CSSProperties => {
    switch (style) {
      case 'quote':
        return {
          fontStyle: 'italic',
          textShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 60px rgba(0,0,0,0.5)`,
          borderLeft: `4px solid ${color}`,
          paddingLeft: '30px',
        };
      case 'glow':
        return {
          textShadow: `0 0 10px ${color}, 0 0 20px ${color}, 0 0 40px ${color}, 0 0 80px ${color}`,
        };
      case 'outline':
        return {
          color: 'transparent',
          WebkitTextStroke: `2px ${color}`,
          textShadow: 'none',
        };
      case 'bold-glow':
        return {
          fontWeight: 900,
          textShadow: `0 0 10px ${color}, 0 4px 20px rgba(0,0,0,0.9)`,
        };
      case 'shadow':
        return {
          textShadow: `3px 3px 0 rgba(0,0,0,0.8), 6px 6px 0 rgba(0,0,0,0.5)`,
        };
      default:
        return {
          textShadow: `0 4px 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.5)`,
        };
    }
  };

  const getAnimation = (style: string, prog: number, fr: number, f: number): { opacity: number; transform: string } => {
    switch (style) {
      case 'typing':
      case 'words':
        return { opacity: 1, transform: 'none' };
      case 'quote':
        return {
          opacity: interpolate(prog, [0, 0.5, 1], [0, 0.8, 1]),
          transform: `translateX(${interpolate(prog, [0, 1], [-30, 0])}px)`,
        };
      case 'glow':
        const pulse = 0.8 + 0.2 * Math.sin(fr / f * Math.PI * 2);
        return {
          opacity: interpolate(prog, [0, 1], [0, 1]) * pulse,
          transform: 'none',
        };
      case 'outline':
        return {
          opacity: interpolate(prog, [0, 1], [0, 1]),
          transform: `scale(${interpolate(prog, [0, 1], [0.9, 1])})`,
        };
      case 'bold-glow':
        return {
          opacity: interpolate(prog, [0, 1], [0, 1]),
          transform: `scale(${spring({ frame: fr, fps: f, config: { damping: 12, stiffness: 100 } })})`,
        };
      case 'shadow':
        return {
          opacity: interpolate(prog, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(prog, [0, 1], [30, 0])}px)`,
        };
      default:
        return {
          opacity: interpolate(prog, [0, 1], [0, 1]),
          transform: 'none',
        };
    }
  };

  const animationStyles = getAnimation(textStyle, progress, delayedFrame, fps);
  const styleSpecifics = getStyleSpecifics(textStyle, textColor);
  const fontSizePx = FONT_SIZES[fontSize] || FONT_SIZES.xlarge;

  const baseStyles: React.CSSProperties = {
    fontSize: fontSizePx,
    fontWeight: fontWeight as React.CSSProperties['fontWeight'],
    color: textColor,
    textAlign: textAlign as React.CSSProperties['textAlign'],
    fontFamily: '"Inter", "SF Pro Display", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    maxWidth: '95%',
    opacity: animationStyles.opacity,
    transform: animationStyles.transform,
    ...styleSpecifics,
  };

  // Typewriter effect
  if (textStyle === 'typing') {
    const charsPerSecond = 20;
    const totalChars = text.length;
    const duration = totalChars / charsPerSecond;
    const typewriterProgress = Math.min(1, (delayedFrame / fps) / duration);
    const visibleChars = Math.floor(typewriterProgress * totalChars);
    const visibleText = text.slice(0, visibleChars);

    return (
      <div style={positionStyles}>
        <div style={baseStyles}>
          {visibleText}
          {typewriterProgress < 1 && <span style={{ opacity: 0.8 }}>|</span>}
        </div>
      </div>
    );
  }

  // Word by word effect
  if (textStyle === 'words') {
    const words = text.split(' ');
    const wordsPerSecond = 2;
    const duration = words.length / wordsPerSecond;
    const wordsProgress = Math.min(1, (delayedFrame / fps) / duration);
    const visibleWords = Math.floor(wordsProgress * words.length);

    return (
      <div style={positionStyles}>
        <div style={baseStyles}>
          {words.map((word, i) => (
            <span
              key={i}
              style={{
                opacity: i < visibleWords ? 1 : 0,
                marginRight: '0.3em',
              }}
            >
              {word}
            </span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={positionStyles}>
      <div style={baseStyles}>{text}</div>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export interface ParallaxStorySceneProps {
  data: ParallaxStoryBlock;
  theme?: string;
  motionProfile?: MotionProfileType;
}

export function ParallaxStoryScene({ data }: ParallaxStorySceneProps): React.ReactElement {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const totalDuration = durationInFrames / fps;

  const {
    title,
    subtitle,
    layers = [],
    cameraMovement = 'pan-right',
    cameraSpeed = 1,
    cameraIntensity = 1,
    effects = [],
    effectIntensity = 0.5,
    textOverlays = [],
    textMode = 'none',
    text,
    textStyle = 'default',
    textFontSize = 'xlarge',
    textFontWeight = 'bold',
    textColor = '#FFFFFF',
    textAlign = 'center',
    textPosition = 'center',
    textAnimationDelay = 0.3,
    wordsPerGroup = 3,
    wordsPerSecond = 3,
    highlightColor = '#00FF88',
    subtitleBackground = 'none',
    fontFamily = 'inter',
    colorGrade = 'none',
    colorIntensity = 0.5,
    backgroundColor = '#000000',
    introDuration = 1,
    outroDuration = 1,
    dofEnabled = false,
    dofFocusDepth = 50,
    dofBlurAmount = 2,
    perspective = 1000,
    perspectiveOriginX = 50,
    perspectiveOriginY = 50,
    // Audio settings
    audioSrc,
    audioVolume = 0.7,
    audioFadeIn = 0.5,
    audioFadeOut = 0.5,
    audioLoop = false,
    audioStartTime = 0,
    audioDelay = 0,
  } = data;

  // Calculate camera movement progress
  const movementProgress = easeInOutCubic(Math.min(1, frame / durationInFrames));

  // Sort layers by depth (farthest first)
  const sortedLayers = useMemo(() => {
    return [...layers].sort((a, b) => b.depth - a.depth);
  }, [layers]);

  // -------------------------------------------------------------------------
  // AUDIO
  // audioDelay     = timeline offset via <Sequence from> (true delay, no trim)
  // audioStartTime = where in the audio file to begin (trim via startFrom)
  //
  // Guards ensure fadeIn + fadeOut never exceeds audioDuration, which would
  // produce an inverted interpolate range and crash.
  // durationInFrames on <Sequence> cleanly unmounts <Audio> at clip end.
  // -------------------------------------------------------------------------
  const audioDelayFrames = Math.round(audioDelay * fps);
  const audioDuration = Math.max(0, durationInFrames - audioDelayFrames);
  const fadeInFrames = Math.min(Math.round(audioFadeIn * fps), audioDuration);
  const fadeOutFrames = Math.min(Math.round(audioFadeOut * fps), audioDuration - fadeInFrames);
  const audioEndFrame = audioDuration - fadeOutFrames;

  // Volume is calculated relative to the Sequence's local frame (0 = audio start)
  const audioVolumeModulated = useMemo(() => {
    if (!audioSrc || audioDuration <= 0) return 0;

    // Clamp local frame to valid range
    const localFrame = Math.min(frame, audioDuration);

    // Fade in
    if (fadeInFrames > 0 && localFrame < fadeInFrames) {
      return audioVolume * interpolate(
        localFrame,
        [0, fadeInFrames],
        [0, 1],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    }

    // Fade out
    if (fadeOutFrames > 0 && localFrame >= audioEndFrame) {
      return audioVolume * interpolate(
        localFrame,
        [audioEndFrame, audioDuration],
        [1, 0],
        { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
      );
    }

    return audioVolume;
  }, [frame, audioSrc, audioVolume, fadeInFrames, fadeOutFrames, audioEndFrame, audioDuration]);

  return (
    <AbsoluteFill style={{ backgroundColor, overflow: 'hidden' }}>
      {/* 3D Perspective Container */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          perspective: `${perspective}px`,
          perspectiveOrigin: `${perspectiveOriginX}% ${perspectiveOriginY}%`,
        }}
      >
        {/* Color grading filter wrapper */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            filter: getColorGradeFilter(colorGrade, colorIntensity),
          }}
        >
          {/* Parallax Layers */}
          {sortedLayers.map((layer) => {
            const layerCameraIntensity = (layer.cameraIntensity ?? 1) * cameraIntensity;

            const cameraOffset = calculateParallaxOffset(
              cameraMovement,
              movementProgress,
              layer.depth,
              layerCameraIntensity,
              cameraSpeed
            );

            const depthDiff = Math.abs(layer.depth - dofFocusDepth);
            const dofBlur = dofEnabled ? (depthDiff / 100) * dofBlurAmount : 0;

            return (
              <ParallaxLayerComponent
                key={layer.id || layer.name}
                layer={layer}
                cameraOffset={cameraOffset}
                frame={frame}
                fps={fps}
                introDuration={introDuration}
                outroDuration={outroDuration}
                totalDuration={totalDuration}
                dofBlur={dofBlur}
              />
            );
          })}

          {/* Visual Effects */}
          <VisualEffects effects={effects} intensity={effectIntensity} frame={frame} />
        </div>
      </div>

      {/* Title */}
      {title && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            textAlign: 'center',
            zIndex: 300,
            opacity: interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: 'clamp' }),
          }}
        >
          <h1
            style={{
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#fff',
              textShadow: '2px 2px 8px rgba(0,0,0,0.8)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              style={{
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.8)',
                textShadow: '1px 1px 4px rgba(0,0,0,0.8)',
                margin: '0.5rem 0 0',
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      )}

      {/* Text Overlays */}
      {textMode === 'overlays' && textOverlays.map((txt, index) => (
        <TextOverlayComponent
          key={index}
          text={txt}
          frame={frame}
          fps={fps}
        />
      ))}

      {/* Overall Text */}
      {textMode === 'overall' && text && (
        <TextLayer
          text={text}
          textStyle={textStyle}
          fontSize={textFontSize}
          fontWeight={textFontWeight}
          textColor={textColor}
          textAlign={textAlign}
          textPosition={textPosition}
          animationDelay={textAnimationDelay}
          frame={frame}
          fps={fps}
          enterDuration={1.5}
          holdDuration={Math.max(1, durationInFrames / fps - 3)}
          exitProgress={0}
          wordsPerGroup={wordsPerGroup}
          wordsPerSecond={wordsPerSecond}
          highlightColor={highlightColor}
          subtitleBackground={subtitleBackground}
          fontFamily={fontFamily}
        />
      )}

      {/* Audio
          - <Sequence from={audioDelayFrames}> defers playback (true delay, not muting)
          - durationInFrames cleanly unmounts <Audio> when the clip ends (fixes end error)
          - startFrom trims the audio file to begin at audioStartTime
          - fadeIn/fadeOut are clamped so their sum never exceeds audioDuration,
            preventing inverted interpolate ranges from crashing the render
      */}
      {audioSrc && audioDuration > 0 && (
        <Sequence from={audioDelayFrames} durationInFrames={audioDuration}>
          <Audio
            src={audioSrc}
            volume={audioVolumeModulated}
            startFrom={Math.round(audioStartTime * fps)}
            loop={audioLoop}
          />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

export default ParallaxStoryScene;