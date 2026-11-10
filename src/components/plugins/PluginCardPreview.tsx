'use client';

import { useEffect, useRef, useState } from 'react';
import { Puzzle } from '@/components/ui/studio-icons';

interface PluginCardPreviewProps {
  pluginId: string;
  src: string;
  isActive: boolean;
  onVisibilityChange: (pluginId: string, ratio: number) => void;
}

export function PluginCardPreview({ src, pluginId, isActive, onVisibilityChange }: PluginCardPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !('IntersectionObserver' in window)) return;

    const observer = new IntersectionObserver(([entry]) => {
      const visible = entry.isIntersecting && entry.intersectionRatio >= 0.25;
      setIsVisible(visible);
      onVisibilityChange(pluginId, visible ? entry.intersectionRatio : 0);
    }, { threshold: [0, 0.25, 0.5, 0.75, 1] });

    observer.observe(container);
    return () => {
      observer.disconnect();
      onVisibilityChange(pluginId, 0);
    };
  }, [onVisibilityChange, pluginId]);

  useEffect(() => {
    setIsReady(false);
    setHasError(false);
  }, [src]);

  useEffect(() => {
    if (!isVisible || !isActive) setIsReady(false);
  }, [isActive, isVisible]);

  return (
    <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      {isVisible && isActive && !hasError && (
        <video
          src={src}
          autoPlay
          muted
          loop
          playsInline
          preload="none"
          tabIndex={-1}
          onLoadedData={() => setIsReady(true)}
          onError={() => setHasError(true)}
          className={`h-full w-full object-cover transition-opacity duration-300 ${isReady ? 'opacity-100' : 'opacity-0'}`}
        />
      )}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center text-white/60">
          <Puzzle className="h-8 w-8" />
        </div>
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/40 to-transparent" />
    </div>
  );
}
