'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Type, Image as ImageIcon, Video as VideoIcon, Square, Layers as LayersIcon } from 'lucide-react';
import { classifyElement, computePathFromBlockRoot, type ElementKind } from '@/lib/editor/element-path';
import { usePortalContainer } from './SubElementPopover';

export interface LayerNode {
  elementId: string;
  tagName: string;
  kind: ElementKind;
  label: string;
  depth: number;
  hasChildren: boolean;
  childIds: string[];
}

interface Props {
  /** Block-root element of the currently selected block; tree is built from its descendants. */
  blockRoot: HTMLElement | null;
  /** Element-id of the currently-selected element, if any (gets highlighted in the tree). */
  selectedId: string | null;
  /** Called when the user clicks a layer. Hands back the elementId + the live DOMRect + computed style. */
  onSelectLayer: (
    elementId: string,
    info: {
      kind: ElementKind;
      bbox: { left: number; top: number; width: number; height: number };
      initial: { color?: string; fontSize?: number; fontWeight?: string; textAlign?: string };
    },
  ) => void;
  onClose: () => void;
}

export function LayersTree({ blockRoot, selectedId, onSelectLayer, onClose }: Props) {
  const portalEl = usePortalContainer();
  // Re-build the tree on every render so re-tagged DOM stays accurate. Cheap enough for
  // a single block (typically <50 elements).
  const [, force] = useState(0);
  useEffect(() => {
    if (!blockRoot) return;
    // Re-render every 500ms while open so dynamic plugins (which re-render every Remotion frame)
    // don't show stale data-elem-id paths.
    const id = window.setInterval(() => force((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [blockRoot]);

  const nodes = useMemo(() => buildLayerTree(blockRoot), [blockRoot]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Auto-expand ancestors of the selected element so it's visible.
  useEffect(() => {
    if (!selectedId) return;
    const ancestors: Record<string, boolean> = {};
    for (const n of nodes) {
      if (selectedId.startsWith(n.elementId + '>') || n.elementId === selectedId) {
        ancestors[n.elementId] = true;
      }
    }
    setExpanded((prev) => ({ ...prev, ...ancestors }));
  }, [selectedId, nodes]);

  const toggle = (id: string) => setExpanded((p) => ({ ...p, [id]: !p[id] }));

  const handleClick = (node: LayerNode) => {
    if (!blockRoot) return;
    const escaped = node.elementId.replace(/"/g, '\\"');
    const el = document.querySelector(`[data-elem-id="${escaped}"]`) as HTMLElement | null;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    onSelectLayer(node.elementId, {
      kind: node.kind,
      bbox: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      initial: {
        color: cs.color,
        fontSize: parseFloat(cs.fontSize),
        fontWeight: cs.fontWeight,
        textAlign: cs.textAlign,
      },
    });
  };

  // Visible nodes after collapse filter (recursive walk)
  const visible: LayerNode[] = [];
  if (nodes.length) {
    const byId = new Map(nodes.map((n) => [n.elementId, n]));
    const roots = nodes.filter((n) => n.depth === 0);
    const walk = (n: LayerNode) => {
      visible.push(n);
      if (!expanded[n.elementId]) return;
      for (const cid of n.childIds) {
        const child = byId.get(cid);
        if (child) walk(child);
      }
    };
    roots.forEach(walk);
  }

  if (!portalEl) return null;

  const tree = (
    <div
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        width: 240,
        maxHeight: 'calc(100vh - 24px)',
        background: '#1E1E2D',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 10,
        color: '#F1F1F8',
        fontSize: 11,
        zIndex: 9998,
        boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
        display: 'flex',
        flexDirection: 'column',
      }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <LayersIcon size={13} style={{ color: '#A78BFA' }} />
          <span style={{ fontWeight: 600 }}>Layers</span>
          <span style={{ color: '#8B8BAA', fontSize: 10 }}>({nodes.length})</span>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'transparent', border: 'none', color: '#8B8BAA', cursor: 'pointer', fontSize: 14, padding: 0 }}
          aria-label="Close layers"
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 4 }}>
        {!blockRoot && (
          <div style={{ padding: 16, textAlign: 'center', color: '#8B8BAA', fontSize: 11 }}>
            Click an element in the preview to see its layers.
          </div>
        )}
        {blockRoot && visible.length === 0 && (
          <div style={{ padding: 16, textAlign: 'center', color: '#8B8BAA', fontSize: 11 }}>
            No editable layers found.
          </div>
        )}
        {visible.map((n) => {
          const isSelected = n.elementId === selectedId;
          const Icon =
            n.kind === 'img' ? ImageIcon : n.kind === 'video' ? VideoIcon : n.kind === 'text' ? Type : Square;
          return (
            <div
              key={n.elementId}
              onClick={() => handleClick(n)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 6px',
                paddingLeft: 6 + n.depth * 12,
                cursor: 'pointer',
                borderRadius: 4,
                background: isSelected ? 'rgba(167,139,250,0.18)' : 'transparent',
                color: isSelected ? '#fff' : '#C8C8DA',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
              }}
              onMouseLeave={(e) => {
                if (!isSelected) e.currentTarget.style.background = 'transparent';
              }}
            >
              {n.hasChildren ? (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(n.elementId);
                  }}
                  style={{
                    width: 12,
                    display: 'inline-flex',
                    transform: expanded[n.elementId] ? 'rotate(90deg)' : 'none',
                    transition: 'transform 100ms',
                    color: '#8B8BAA',
                  }}
                >
                  <ChevronRight size={10} />
                </span>
              ) : (
                <span style={{ width: 12 }} />
              )}
              <Icon size={11} style={{ color: isSelected ? '#A78BFA' : '#8B8BAA', flexShrink: 0 }} />
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  flex: 1,
                  fontSize: 11,
                }}
              >
                {n.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );

  return createPortal(tree, portalEl);
}

/**
 * Build a flat list of layers (with depth + parent-child edges) from a block root.
 * Skips noise: empty wrappers, <style>, and uneditable element kinds with no useful info.
 */
function buildLayerTree(blockRoot: HTMLElement | null): LayerNode[] {
  if (!blockRoot) return [];
  const out: LayerNode[] = [];
  const walker = document.createTreeWalker(blockRoot, NodeFilter.SHOW_ELEMENT);
  let el = walker.nextNode() as HTMLElement | null;
  const childMap = new Map<string, string[]>();
  const idByElement = new Map<HTMLElement, string>();
  // Tag the root so depth calc works — its children sit at depth 0 relative to it.

  while (el) {
    if (el === blockRoot) {
      el = walker.nextNode() as HTMLElement | null;
      continue;
    }
    if (el.tagName === 'STYLE' || el.tagName === 'SCRIPT') {
      el = walker.nextNode() as HTMLElement | null;
      continue;
    }
    const elementId = computePathFromBlockRoot(el, blockRoot);
    if (!elementId) {
      el = walker.nextNode() as HTMLElement | null;
      continue;
    }
    idByElement.set(el, elementId);

    // depth = number of `>` segments in the path minus 1 (because path starts with block-i>)
    const depth = (elementId.match(/>/g)?.length ?? 1) - 1;

    // parent in our tree: nearest ancestor we already added
    let parent: HTMLElement | null = el.parentElement;
    let parentId: string | null = null;
    while (parent && parent !== blockRoot) {
      if (idByElement.has(parent)) {
        parentId = idByElement.get(parent)!;
        break;
      }
      parent = parent.parentElement;
    }

    out.push({
      elementId,
      tagName: el.tagName,
      kind: classifyElement(el),
      label: labelFor(el),
      depth,
      hasChildren: false, // patched below
      childIds: [],
    });

    if (parentId) {
      const arr = childMap.get(parentId) ?? [];
      arr.push(elementId);
      childMap.set(parentId, arr);
    }

    el = walker.nextNode() as HTMLElement | null;
  }

  // Patch hasChildren + childIds + recompute depth as graph depth (not path depth)
  // so collapsed wrappers don't bloat the indent.
  const byId = new Map(out.map((n) => [n.elementId, n]));
  for (const [pid, kids] of childMap.entries()) {
    const p = byId.get(pid);
    if (!p) continue;
    p.hasChildren = kids.length > 0;
    p.childIds = kids;
  }

  return out;
}

function labelFor(el: HTMLElement): string {
  // For text-bearing elements, prefer trimmed text content
  if (el.children.length === 0) {
    const text = (el.textContent ?? '').trim();
    if (text) return shorten(`"${text}"`, 28);
  }
  // Else fall back to tag + first class
  const cls = el.className && typeof el.className === 'string' ? el.className.split(/\s+/).find(Boolean) : '';
  return cls ? `${el.tagName.toLowerCase()}.${shorten(cls, 18)}` : el.tagName.toLowerCase();
}

function shorten(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}
