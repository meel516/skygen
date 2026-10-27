'use client';

import { useRef } from 'react';

interface ChipRowProps<T> {
  label: string;
  icon: React.ReactNode;
  items: T[];
  selectedId: string | null;
  onSelect: (id: string | null, item: T) => void;
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  getIcon?: (item: T) => React.ReactNode;
  loading?: boolean;
}

export function ChipRow<T>({
  label,
  icon,
  items,
  selectedId,
  onSelect,
  getId,
  getLabel,
  getIcon,
  loading,
}: ChipRowProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);

  if (loading) {
    return (
      <div className="flex items-center gap-3 py-1.5">
        <span className="text-xs font-medium shrink-0 w-16 flex items-center gap-1.5" style={{ color: '#55556A' }}>
          {icon}
          {label}
        </span>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 w-20 rounded-lg animate-pulse"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className="flex items-center gap-3 py-1.5">
      {/* Label */}
      <span
        className="text-xs font-medium shrink-0 w-16 flex items-center gap-1.5"
        style={{ color: '#6B6B8A' }}
      >
        {icon}
        {label}
      </span>

      {/* Chips */}
      <div
        ref={scrollRef}
        className="flex gap-1.5 overflow-x-auto flex-1"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {/* Auto chip */}
        <button
          onClick={() => onSelect(null, null as T)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{
            background: selectedId === null ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
            border: selectedId === null ? '1px solid rgba(124,58,237,0.45)' : '1px solid rgba(255,255,255,0.07)',
            color: selectedId === null ? '#C4B5FD' : '#6B6B8A',
          }}
        >
          Auto
        </button>

        {items.map((item) => {
          const id = getId(item);
          const isSelected = selectedId === id;
          return (
            <button
              key={id}
              onClick={() => onSelect(isSelected ? null : id, item)}
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: isSelected ? 'rgba(124,58,237,0.18)' : 'rgba(255,255,255,0.04)',
                border: isSelected ? '1px solid rgba(124,58,237,0.45)' : '1px solid rgba(255,255,255,0.07)',
                color: isSelected ? '#C4B5FD' : '#9B9BBB',
              }}
            >
              {getIcon?.(item) && (
                <span className="opacity-80">{getIcon!(item)}</span>
              )}
              {getLabel(item)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
