'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Type, Image as ImageIcon, Video as VideoIcon, RotateCcw, Upload, X } from '@/components/ui/studio-icons';
import type { ElementKind } from '@/lib/editor/element-path';
import type { ElementOverride } from '@/lib/video/schemas';

export interface PopoverSelection {
  blockIndex: number;
  elementId: string;
  kind: ElementKind;
  /** screen-space rect of the selected DOM element when last measured */
  bbox: { left: number; top: number; width: number; height: number };
  /** computed style values read at click time, used as initial popover values */
  initial: {
    color?: string;
    fontSize?: number;
    fontWeight?: string;
    textAlign?: string;
  };
}

interface Props {
  selection: PopoverSelection;
  override: ElementOverride | undefined;
  onChange: (patch: Partial<ElementOverride>) => void;
  onReset: () => void;
  onClose: () => void;
}

export function SubElementPopover({ selection, override, onChange, onReset, onClose }: Props) {
  // Render into a body-level portal to escape the framer-motion `transform`
  // ancestor which would otherwise constrain `position: fixed` and clip the
  // popover (transforms create a containing block for fixed descendants).
  const portalEl = usePortalContainer();

  // Anchor 8px above the bbox, flip below if it'd clip the top.
  const POP_HEIGHT_ESTIMATE = 220;
  const flipBelow = selection.bbox.top - POP_HEIGHT_ESTIMATE - 8 < 8;
  const top = flipBelow
    ? selection.bbox.top + selection.bbox.height + 8
    : selection.bbox.top - 8;
  const left = selection.bbox.left + selection.bbox.width / 2;

  const style: React.CSSProperties = {
    position: 'fixed',
    top,
    left,
    transform: flipBelow ? 'translate(-50%, 0)' : 'translate(-50%, -100%)',
    zIndex: 9999,
    background: 'var(--popover)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 10,
    padding: 12,
    minWidth: 260,
    color: 'var(--foreground)',
    fontSize: 12,
    boxShadow: 'none',
  };

  const Icon = selection.kind === 'img' ? ImageIcon : selection.kind === 'video' ? VideoIcon : Type;
  const label = selection.kind === 'img' ? 'Image' : selection.kind === 'video' ? 'Video' : selection.kind === 'text' ? 'Text' : 'Element';

  if (!portalEl) return null;

  const popover = (
    <div
      style={style}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={14} style={{ color: 'var(--primary)' }} />
          <span style={{ fontWeight: 600 }}>{label}</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: 'var(--muted-foreground)', cursor: 'pointer', padding: 2 }}
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>

      {selection.kind === 'text' && (
        <TextControls override={override} initial={selection.initial} onChange={onChange} />
      )}
      {(selection.kind === 'img' || selection.kind === 'video') && (
        <MediaControls kind={selection.kind} override={override} onChange={onChange} />
      )}

      {/* position display */}
      {(override?.x !== undefined || override?.y !== undefined) && (
        <div style={{ marginTop: 10, padding: 8, background: 'color-mix(in srgb, var(--primary) 8%, transparent)', borderRadius: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--muted-foreground)', marginBottom: 2 }}>OFFSET</div>
          <div style={{ fontFamily: 'monospace', fontSize: 11 }}>
            x: {Math.round(override.x ?? 0)}px · y: {Math.round(override.y ?? 0)}px
          </div>
        </div>
      )}

      {/* footer actions */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        <button
          onClick={onReset}
          style={{
            flex: 1,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: '#FCA5A5',
            padding: '6px 10px',
            borderRadius: 6,
            fontSize: 11,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <RotateCcw size={11} /> Reset element
        </button>
      </div>
    </div>
  );

  return createPortal(popover, portalEl);
}

/**
 * Lazily creates (and caches) a body-level portal container shared by all
 * sub-element editor UI (popover, layers tree). Uses a stable id so the
 * EditorOverlay's click handler can detect "this click was on portaled UI".
 */
function usePortalContainer(): HTMLElement | null {
  const [el, setEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let node = document.getElementById('sub-element-editor-portal');
    if (!node) {
      node = document.createElement('div');
      node.id = 'sub-element-editor-portal';
      document.body.appendChild(node);
    }
    setEl(node);
  }, []);
  return el;
}

export { usePortalContainer };

function TextControls({
  override,
  initial,
  onChange,
}: {
  override: ElementOverride | undefined;
  initial: PopoverSelection['initial'];
  onChange: (patch: Partial<ElementOverride>) => void;
}) {
  const color = override?.color ?? initial.color ?? '#ffffff';
  const fontSize = override?.fontSize ?? initial.fontSize ?? 16;
  const fontWeight = String(override?.fontWeight ?? initial.fontWeight ?? '400');
  const textAlign = override?.textAlign ?? (initial.textAlign as ElementOverride['textAlign']) ?? 'left';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* color */}
      <Row label="Color">
        <input
          type="color"
          value={normalizeHex(color)}
          onChange={(e) => onChange({ color: e.target.value })}
          style={{ width: 36, height: 24, border: 'none', borderRadius: 4, background: 'transparent', cursor: 'pointer' }}
        />
        <input
          type="text"
          value={color}
          onChange={(e) => onChange({ color: e.target.value })}
          style={inputStyle}
        />
      </Row>

      {/* size */}
      <Row label="Size">
        <input
          type="range"
          min={12}
          max={200}
          step={1}
          value={fontSize}
          onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
          style={{ flex: 1 }}
        />
        <span style={{ width: 36, textAlign: 'right', fontFamily: 'monospace' }}>{fontSize}px</span>
      </Row>

      {/* weight */}
      <Row label="Weight">
        <select
          value={fontWeight}
          onChange={(e) => onChange({ fontWeight: e.target.value })}
          style={{ ...inputStyle, padding: '4px 6px' }}
        >
          <option value="300">Light (300)</option>
          <option value="400">Regular (400)</option>
          <option value="600">Semibold (600)</option>
          <option value="700">Bold (700)</option>
          <option value="900">Black (900)</option>
        </select>
      </Row>

      {/* align */}
      <Row label="Align">
        <div style={{ display: 'flex', gap: 4 }}>
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              onClick={() => onChange({ textAlign: a })}
              style={{
                padding: '4px 8px',
                background: textAlign === a ? 'var(--primary)' : 'var(--border)',
                color: textAlign === a ? '#0E0E18' : 'var(--foreground)',
                border: '1px solid var(--border)',
                borderRadius: 4,
                fontSize: 11,
                cursor: 'pointer',
                textTransform: 'capitalize',
              }}
            >
              {a}
            </button>
          ))}
        </div>
      </Row>
    </div>
  );
}

function MediaControls({
  kind,
  override,
  onChange,
}: {
  kind: 'img' | 'video';
  override: ElementOverride | undefined;
  onChange: (patch: Partial<ElementOverride>) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/image/upload-s3', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Upload failed (${res.status})`);
      const data = (await res.json()) as { url?: string };
      if (!data.url) throw new Error('No URL in response');
      onChange({ src: data.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={kind === 'img' ? 'image/*' : 'video/*'}
        onChange={handleUpload}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        style={{
          background: 'var(--primary)',
          color: '#0E0E18',
          padding: '8px 12px',
          borderRadius: 6,
          fontSize: 11,
          fontWeight: 600,
          border: 'none',
          cursor: uploading ? 'wait' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          opacity: uploading ? 0.6 : 1,
        }}
      >
        <Upload size={12} />
        {uploading ? 'Uploading…' : `Replace ${kind === 'img' ? 'image' : 'video'}`}
      </button>
      {override?.src && (
        <div style={{ fontSize: 10, color: 'var(--muted-foreground)', wordBreak: 'break-all' }}>
          src: {override.src.length > 60 ? `${override.src.slice(0, 60)}…` : override.src}
        </div>
      )}
      {error && <div style={{ fontSize: 11, color: '#FCA5A5' }}>{error}</div>}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ width: 56, color: 'var(--muted-foreground)', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</span>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 4,
  padding: '4px 8px',
  color: 'var(--foreground)',
  fontSize: 11,
  fontFamily: 'monospace',
  outline: 'none',
};

/** Convert any CSS color (rgb, hsl, named) to a #rrggbb hex for <input type="color">. */
function normalizeHex(input: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(input)) return input.toLowerCase();
  if (typeof document === 'undefined') return '#ffffff';
  const probe = document.createElement('div');
  probe.style.color = input;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  document.body.removeChild(probe);
  const m = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!m) return '#ffffff';
  const toHex = (n: string) => Number(n).toString(16).padStart(2, '0');
  return `#${toHex(m[1])}${toHex(m[2])}${toHex(m[3])}`;
}
