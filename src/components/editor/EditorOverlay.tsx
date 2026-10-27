'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditorStore } from '@/store/editor-store';
import {
  classifyElement,
  computePathFromBlockRoot,
  type ElementKind,
} from '@/lib/editor/element-path';
import type { ElementOverride } from '@/lib/video/schemas';
import { SubElementPopover, type PopoverSelection } from './SubElementPopover';
import { LayersTree } from './LayersTree';

interface Props {
  /** Ref to the wrapper around the Remotion <Player> — overlay coords resolve against this rect. */
  playerWrapRef: React.RefObject<HTMLDivElement | null>;
  compositionWidth: number;
  compositionHeight: number;
}

type DragMode =
  | { kind: 'idle' }
  | { kind: 'move'; startX: number; startY: number; baseX: number; baseY: number }
  | {
      kind: 'resize';
      startX: number;
      startY: number;
      baseW: number;
      baseH: number;
      handle: 'br';
    };

/**
 * Sits over the Remotion Player. Captures clicks to identify which element
 * the user clicked on, draws a selection box + corner handles, opens a
 * popover with quick-edit controls, and updates `block.elementOverrides`
 * via the existing `updateBlock` store mutation (one history entry per drag).
 */
export function EditorOverlay({ playerWrapRef, compositionWidth, compositionHeight }: Props) {
  const { videoInput, updateBlock } = useEditorStore();

  const [selection, setSelection] = useState<PopoverSelection | null>(null);
  const selectionRef = useRef<PopoverSelection | null>(null);
  useEffect(() => { selectionRef.current = selection; }, [selection]);
  const [drag, setDrag] = useState<DragMode>({ kind: 'idle' });
  const overlayRef = useRef<HTMLDivElement>(null);
  // Live override during drag — applied as inline style on the target so the
  // user sees the change immediately without going through the store on every
  // pointermove (would explode the undo history).
  const [optimistic, setOptimistic] = useState<ElementOverride | null>(null);

  // Scale converts screen pixels → composition pixels. We measure the actual
  // first block-root inside the wrap (each block fills 100% of the composition,
  // so its on-screen rect IS the composition's rendered area). This is correct
  // even when the player is letterboxed (e.g., fullscreen with a different
  // aspect ratio container) because we measure the rendered composition itself.
  const getScale = useCallback(() => {
    const wrap = playerWrapRef.current;
    if (!wrap) return { x: 1, y: 1, rect: null as DOMRect | null };
    const blockRoot = wrap.querySelector('[data-block-id]') as HTMLElement | null;
    const rect = (blockRoot ?? wrap).getBoundingClientRect();
    return {
      x: compositionWidth / rect.width,
      y: compositionHeight / rect.height,
      rect,
    };
  }, [playerWrapRef, compositionWidth, compositionHeight]);

  const remeasureSelection = useCallback(() => {
    if (!selection) return;
    const escaped = selection.elementId.replace(/"/g, '\\"');
    const el = document.querySelector(`[data-elem-id="${escaped}"]`) as HTMLElement | null;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSelection((prev) =>
      prev ? { ...prev, bbox: { left: r.left, top: r.top, width: r.width, height: r.height } } : prev,
    );
  }, [selection]);

  // Click-to-select on the player.
  // We block Player's own click→play/pause by stopImmediatePropagation on
  // pointerdown/mousedown/click whenever the click would hit an editable
  // element (i.e. a descendant of a [data-block-id] node). Clicks on the
  // Remotion controls bar (no data-block-id ancestor) pass through normally.
  useEffect(() => {
    const wrap = playerWrapRef.current;
    if (!wrap) return;

    /**
     * Returns the editable target info if the click is on an editable element,
     * or null if it's on chrome (Remotion controls, overlay UI, etc).
     */
    const resolveTarget = (e: MouseEvent | PointerEvent) => {
      const path = e.composedPath();
      // Ignore events on our own overlay UI (selection box, popover, layers panel)
      if (overlayRef.current && path.includes(overlayRef.current)) return null;
      // Ignore events on portaled UI (popover/layers — appended to body)
      const portalRoot = (typeof document !== 'undefined' ? document.getElementById('sub-element-editor-portal') : null);
      if (portalRoot && path.includes(portalRoot)) return null;

      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!target) return null;

      let node: HTMLElement | null = target;
      let blockRoot: HTMLElement | null = null;
      while (node && wrap.contains(node)) {
        if (node.dataset.blockId) {
          blockRoot = node;
          break;
        }
        node = node.parentElement;
      }
      if (!blockRoot) return null;

      const elementId = computePathFromBlockRoot(target, blockRoot);
      if (!elementId) return null;
      const blockIndex = parseInt(blockRoot.dataset.blockId!.replace(/^block-/, ''), 10);
      if (Number.isNaN(blockIndex)) return null;

      return { target, blockRoot, elementId, blockIndex };
    };

    // Block Player's own play/pause on pointerdown/mousedown when the press
    // lands on an editable element.
    const blockIfEditable = (e: PointerEvent | MouseEvent) => {
      const info = resolveTarget(e);
      if (!info) return;
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const handleClick = (e: MouseEvent) => {
      const info = resolveTarget(e);
      if (!info) return;

      e.stopPropagation();
      e.stopImmediatePropagation();
      e.preventDefault();

      // Toggle: clicking the SAME element again deselects.
      const prev = selectionRef.current;
      if (prev && prev.blockIndex === info.blockIndex && prev.elementId === info.elementId) {
        setSelection(null);
        setOptimistic(null);
        return;
      }

      const r = info.target.getBoundingClientRect();
      const cs = getComputedStyle(info.target);
      const initial: PopoverSelection['initial'] = {
        color: cs.color,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: cs.fontWeight,
        textAlign: cs.textAlign,
      };

      setSelection({
        blockIndex: info.blockIndex,
        elementId: info.elementId,
        kind: classifyElement(info.target) as ElementKind,
        bbox: { left: r.left, top: r.top, width: r.width, height: r.height },
        initial,
      });
      setOptimistic(null);
    };

    wrap.addEventListener('pointerdown', blockIfEditable, true);
    wrap.addEventListener('mousedown', blockIfEditable, true);
    wrap.addEventListener('click', handleClick, true);
    return () => {
      wrap.removeEventListener('pointerdown', blockIfEditable, true);
      wrap.removeEventListener('mousedown', blockIfEditable, true);
      wrap.removeEventListener('click', handleClick, true);
    };
  }, [playerWrapRef]);

  // Re-measure selection bbox on scroll/resize/animation (Remotion frame change).
  useEffect(() => {
    if (!selection) return;
    const id = window.setInterval(remeasureSelection, 200);
    window.addEventListener('resize', remeasureSelection);
    window.addEventListener('scroll', remeasureSelection, true);
    return () => {
      window.clearInterval(id);
      window.removeEventListener('resize', remeasureSelection);
      window.removeEventListener('scroll', remeasureSelection, true);
    };
  }, [selection, remeasureSelection]);

  // Pointer drag/resize handlers
  useEffect(() => {
    if (drag.kind === 'idle') return;

    const handleMove = (e: PointerEvent) => {
      if (!selection) return;
      const scale = getScale();
      if (drag.kind === 'move') {
        const dx = (e.clientX - drag.startX) * scale.x;
        const dy = (e.clientY - drag.startY) * scale.y;
        setOptimistic({ x: drag.baseX + dx, y: drag.baseY + dy });
      } else if (drag.kind === 'resize') {
        const dw = (e.clientX - drag.startX) * scale.x;
        const dh = (e.clientY - drag.startY) * scale.y;
        setOptimistic({
          width: Math.max(20, drag.baseW + dw),
          height: Math.max(20, drag.baseH + dh),
        });
      }
    };

    const handleUp = () => {
      if (!selection || !optimistic) {
        setDrag({ kind: 'idle' });
        return;
      }
      const block = videoInput.contentBlocks[selection.blockIndex] as {
        elementOverrides?: Record<string, ElementOverride>;
      };
      const prev = block.elementOverrides ?? {};
      const prevForId = prev[selection.elementId] ?? {};
      const merged: ElementOverride = { ...prevForId, ...optimistic };
      updateBlock(selection.blockIndex, {
        elementOverrides: { ...prev, [selection.elementId]: merged },
      } as never);
      setOptimistic(null);
      setDrag({ kind: 'idle' });
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [drag, selection, optimistic, videoInput.contentBlocks, updateBlock, getScale]);

  // Apply optimistic preview to the actual element so the user sees changes
  // immediately. Cleared when drag ends and the store update takes over.
  useEffect(() => {
    if (!selection || !optimistic) return;
    const escaped = selection.elementId.replace(/"/g, '\\"');
    const el = document.querySelector(`[data-elem-id="${escaped}"]`) as HTMLElement | null;
    if (!el) return;
    const prev = {
      transform: el.style.transform,
      width: el.style.width,
      height: el.style.height,
    };
    if (optimistic.x !== undefined || optimistic.y !== undefined) {
      el.style.transform = `translate(${optimistic.x ?? 0}px, ${optimistic.y ?? 0}px)`;
    }
    if (optimistic.width !== undefined) el.style.width = `${optimistic.width}px`;
    if (optimistic.height !== undefined) el.style.height = `${optimistic.height}px`;
    return () => {
      el.style.transform = prev.transform;
      el.style.width = prev.width;
      el.style.height = prev.height;
    };
  }, [selection, optimistic]);

  const startMove = (e: React.PointerEvent) => {
    if (!selection) return;
    const block = videoInput.contentBlocks[selection.blockIndex] as {
      elementOverrides?: Record<string, ElementOverride>;
    };
    const cur = block.elementOverrides?.[selection.elementId] ?? {};
    e.stopPropagation();
    e.preventDefault();
    setDrag({
      kind: 'move',
      startX: e.clientX,
      startY: e.clientY,
      baseX: cur.x ?? 0,
      baseY: cur.y ?? 0,
    });
  };

  const startResize = (e: React.PointerEvent) => {
    if (!selection) return;
    const block = videoInput.contentBlocks[selection.blockIndex] as {
      elementOverrides?: Record<string, ElementOverride>;
    };
    const cur = block.elementOverrides?.[selection.elementId] ?? {};
    e.stopPropagation();
    e.preventDefault();
    setDrag({
      kind: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      baseW: cur.width ?? selection.bbox.width * getScale().x,
      baseH: cur.height ?? selection.bbox.height * getScale().y,
      handle: 'br',
    });
  };

  const applyChange = (patch: Partial<ElementOverride>) => {
    if (!selection) return;
    const block = videoInput.contentBlocks[selection.blockIndex] as {
      elementOverrides?: Record<string, ElementOverride>;
    };
    const prev = block.elementOverrides ?? {};
    const prevForId = prev[selection.elementId] ?? {};
    updateBlock(selection.blockIndex, {
      elementOverrides: {
        ...prev,
        [selection.elementId]: { ...prevForId, ...patch },
      },
    } as Partial<typeof block>);
  };

  const reset = () => {
    if (!selection) return;
    const block = videoInput.contentBlocks[selection.blockIndex] as {
      elementOverrides?: Record<string, ElementOverride>;
    };
    const prev = { ...(block.elementOverrides ?? {}) };
    delete prev[selection.elementId];
    updateBlock(selection.blockIndex, { elementOverrides: prev } as Partial<typeof block>);
  };

  const close = () => {
    setSelection(null);
    setOptimistic(null);
  };

  // Press Escape to deselect — only when something is selected, and we
  // stopPropagation so the Remotion Player doesn't also exit its own state
  // (e.g. fullscreen) on the same keypress.
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // If we're in fullscreen, let Esc exit fullscreen — don't deselect.
      if (document.fullscreenElement) return;
      e.stopPropagation();
      e.preventDefault();
      close();
    };
    // Capture phase so we beat the Player's own Escape handler.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selection]);

  // Layers panel — opens automatically when a selection is made; user can toggle.
  const [layersOpen, setLayersOpen] = useState(false);
  useEffect(() => {
    if (selection) setLayersOpen(true);
  }, [selection]);

  // Find the block-root in the live DOM for the LayersTree to walk.
  const blockRoot = selection
    ? (playerWrapRef.current?.querySelector(`[data-block-id="block-${selection.blockIndex}"]`) as HTMLElement | null)
    : null;

  const handleLayerSelect = (elementId: string, info: {
    kind: ElementKind;
    bbox: { left: number; top: number; width: number; height: number };
    initial: { color?: string; fontSize?: number; fontWeight?: string; textAlign?: string };
  }) => {
    if (!selection) return;
    setSelection({ ...selection, elementId, kind: info.kind, bbox: info.bbox, initial: info.initial });
    setOptimistic(null);
  };

  // Render selection box + handles in overlay-local coords
  const wrapRect = playerWrapRef.current?.getBoundingClientRect();
  const overlayRect = overlayRef.current?.getBoundingClientRect();
  const baseRect = overlayRect ?? wrapRect;

  const currentOverride = selection
    ? ((videoInput.contentBlocks[selection.blockIndex] as { elementOverrides?: Record<string, ElementOverride> })
        .elementOverrides?.[selection.elementId])
    : undefined;

  return (
    <div
      ref={overlayRef}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none', // the player div underneath gets the click; we listen via its parent
        zIndex: 50,
      }}
    >
      {selection && baseRect && (
        <>
          <div
            onPointerDown={(e) => { e.stopPropagation(); startMove(e); }}
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => {
              // Double-click on the selection box deselects (and don't let
              // it reach the Player which would toggle fullscreen).
              e.stopPropagation();
              e.preventDefault();
              close();
            }}
            style={{
              position: 'absolute',
              left: selection.bbox.left - baseRect.left,
              top: selection.bbox.top - baseRect.top,
              width: selection.bbox.width,
              height: selection.bbox.height,
              border: '2px solid var(--primary)',
              borderRadius: 2,
              boxShadow: 'none',
              cursor: 'move',
              pointerEvents: 'auto',
              background: 'color-mix(in srgb, var(--primary) 4%, transparent)',
            }}
          />
          {/* deselect badge — top-right of selection box */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              close();
            }}
            title="Deselect (Esc)"
            style={{
              position: 'absolute',
              left: selection.bbox.left - baseRect.left + selection.bbox.width - 10,
              top: selection.bbox.top - baseRect.top - 10,
              width: 20,
              height: 20,
              background: 'var(--muted)',
              color: 'var(--primary)',
              border: '1px solid var(--primary)',
              borderRadius: '50%',
              cursor: 'pointer',
              fontSize: 12,
              lineHeight: 1,
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'auto',
              zIndex: 1,
            }}
          >
            ×
          </button>
          {/* bottom-right resize handle */}
          <div
            onPointerDown={startResize}
            style={{
              position: 'absolute',
              left: selection.bbox.left - baseRect.left + selection.bbox.width - 5,
              top: selection.bbox.top - baseRect.top + selection.bbox.height - 5,
              width: 10,
              height: 10,
              background: 'var(--primary)',
              border: '1px solid #fff',
              borderRadius: 2,
              cursor: 'nwse-resize',
              pointerEvents: 'auto',
            }}
          />
        </>
      )}
      {selection && (
        <SubElementPopover
          selection={selection}
          override={currentOverride}
          onChange={applyChange}
          onReset={reset}
          onClose={close}
        />
      )}
      {selection && layersOpen && (
        <LayersTree
          blockRoot={blockRoot}
          selectedId={selection.elementId}
          onSelectLayer={handleLayerSelect}
          onClose={() => setLayersOpen(false)}
        />
      )}
      {selection && !layersOpen && (
        <button
          onClick={() => setLayersOpen(true)}
          style={{
            position: 'fixed',
            top: 12,
            right: 12,
            zIndex: 9998,
            background: 'var(--muted)',
            border: '1px solid var(--border)',
            color: 'var(--primary)',
            padding: '6px 10px',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            pointerEvents: 'auto',
            boxShadow: 'none',
          }}
        >
          Layers
        </button>
      )}
    </div>
  );
}
