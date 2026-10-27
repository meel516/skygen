'use client';

import React, { useRef, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from '@/components/ui/studio-icons';

interface LoopingCarouselProps {
  children: React.ReactNode[];
  cardWidth?: number;
  gap?: number;
}

export function LoopingCarousel({ children, cardWidth = 150, gap = 12 }: LoopingCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateScrollState();
    el.addEventListener('scroll', updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState, children.length]);

  // Non-passive wheel handler to convert vertical scroll to horizontal
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    function handleWheel(this: HTMLDivElement, e: WheelEvent) {
      if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        e.preventDefault();
        this.scrollLeft += e.deltaY;
      }
    }
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const scrollAmount = (cardWidth + gap) * 3;

  const scrollLeftFn = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft <= 1) {
      // Loop to end
      el.scrollTo({ left: el.scrollWidth - el.clientWidth, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollRightFn = () => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollLeft >= el.scrollWidth - el.clientWidth - 1) {
      // Loop to start
      el.scrollTo({ left: 0, behavior: 'smooth' });
    } else {
      el.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const hasOverflow = canScrollLeft || canScrollRight;

  return (
    <div
      className="relative group"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Left gradient + arrow */}
      {hasOverflow && (
        <div
          className="absolute left-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200"
          style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none' }}
        >
          <div
            className="absolute left-0 top-0 bottom-0 w-16 pointer-events-none"
            style={{ background: 'var(--primary)' }}
          />
          <button
            onClick={scrollLeftFn}
            className="relative z-10 ml-1 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--foreground)',
              boxShadow: 'none',
            }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Right gradient + arrow */}
      {hasOverflow && (
        <div
          className="absolute right-0 top-0 bottom-0 z-10 flex items-center transition-opacity duration-200"
          style={{ opacity: isHovered ? 1 : 0, pointerEvents: isHovered ? 'auto' : 'none' }}
        >
          <div
            className="absolute right-0 top-0 bottom-0 w-16 pointer-events-none"
            style={{ background: 'var(--primary)' }}
          />
          <button
            onClick={scrollRightFn}
            className="relative z-10 mr-1 w-9 h-9 rounded-full flex items-center justify-center"
            style={{
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'none',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'var(--foreground)',
              boxShadow: 'none',
            }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className="flex overflow-x-auto looping-carousel"
        style={{
          gap,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          paddingLeft: 4,
          paddingRight: 4,
          paddingBottom: 8,
        }}
      >
        <style>{`.looping-carousel::-webkit-scrollbar { display: none; }`}</style>
        {children.map((child, i) => (
          <div key={i} className="flex-shrink-0" style={{ width: cardWidth }}>
            {child}
          </div>
        ))}
      </div>
    </div>
  );
}
