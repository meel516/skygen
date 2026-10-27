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
        <span className="text-xs font-medium shrink-0 w-16 flex items-center gap-1.5" style={{ color: 'var(--muted-foreground)' }}>
          {icon}
          {label}
        </span>
        <div className="flex gap-2 overflow-hidden">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-7 w-20 rounded-sm animate-pulse"
              style={{ background: 'var(--border)' }}
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
        style={{ color: 'var(--muted-foreground)' }}
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
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium"
          style={{
            background: selectedId === null ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--border)',
            border: selectedId === null ? '1px solid color-mix(in srgb, var(--primary) 45%, transparent)' : '1px solid var(--border)',
            color: selectedId === null ? 'var(--primary)' : 'var(--muted-foreground)',
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
              className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-medium"
              style={{
                background: isSelected ? 'color-mix(in srgb, var(--primary) 18%, transparent)' : 'var(--border)',
                border: isSelected ? '1px solid color-mix(in srgb, var(--primary) 45%, transparent)' : '1px solid var(--border)',
                color: isSelected ? 'var(--primary)' : '#9B9BBB',
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
