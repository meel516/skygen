/**
 * Shared DOM-path utility for the sub-element editor overlay.
 *
 * The editor overlay (click handler) and the render-time injector (which assigns
 * data-elem-id attributes) both compute IDs from this single source of truth, so
 * IDs match across the click→override→render cycle.
 *
 * Path format: `block-3>div:nth-of-type(2)>span:nth-of-type(1)`
 *
 * `nth-of-type` is preferred over `nth-child` so the path is resilient to a
 * different-tag sibling being inserted by a plugin's conditional render.
 */

const SKIP_TAGS = new Set(['STYLE', 'SCRIPT']);

export function computePathFromBlockRoot(target: Element, blockRoot: Element): string | null {
  if (target === blockRoot || !blockRoot.contains(target)) return null;

  const segments: string[] = [];
  let node: Element | null = target;
  while (node && node !== blockRoot) {
    const parent: Element | null = node.parentElement;
    if (!parent) return null;
    const tag = node.tagName;
    let idx = 0;
    for (const sib of Array.from(parent.children)) {
      if (sib.tagName === tag) {
        idx += 1;
        if (sib === node) break;
      }
    }
    segments.unshift(`${tag.toLowerCase()}:nth-of-type(${idx})`);
    node = parent;
  }

  const blockId = (blockRoot as HTMLElement).dataset?.blockId;
  if (!blockId) return null;
  return `${blockId}>${segments.join('>')}`;
}

/**
 * Walk every descendant of blockRoot and stamp a data-elem-id matching the
 * path the click handler will compute. Idempotent — safe to run after every
 * render.
 */
export function tagDescendants(blockRoot: HTMLElement): void {
  const blockId = blockRoot.dataset.blockId;
  if (!blockId) return;

  const walker = document.createTreeWalker(blockRoot, NodeFilter.SHOW_ELEMENT);
  let el = walker.nextNode() as HTMLElement | null;
  while (el) {
    if (el !== blockRoot && !SKIP_TAGS.has(el.tagName)) {
      const path = computePathFromBlockRoot(el, blockRoot);
      if (path && el.dataset.elemId !== path) {
        el.dataset.elemId = path;
      }
    }
    el = walker.nextNode() as HTMLElement | null;
  }
}

/**
 * Classify a DOM element for the popover so it knows which controls to show.
 * Reads data-original-tag for proxied elements (e.g. VideoCanvasProxy renders
 * a <canvas> with data-original-tag="VIDEO" so we still treat it as a video).
 */
export type ElementKind = 'text' | 'img' | 'video' | 'other';

export function classifyElement(el: Element): ElementKind {
  const original = (el as HTMLElement).dataset?.originalTag;
  if (original === 'VIDEO') return 'video';
  if (original === 'IMG') return 'img';

  const tag = el.tagName;
  if (tag === 'IMG') return 'img';
  if (tag === 'VIDEO') return 'video';

  // Treat any element whose direct content is text as a text element.
  if (
    tag === 'SPAN' || tag === 'P' || tag === 'H1' || tag === 'H2' ||
    tag === 'H3' || tag === 'H4' || tag === 'H5' || tag === 'H6' ||
    tag === 'STRONG' || tag === 'EM' || tag === 'LABEL'
  ) {
    return 'text';
  }
  // A DIV with only text node children counts as text.
  if (tag === 'DIV') {
    const onlyText = Array.from(el.childNodes).every(
      (n) => n.nodeType === Node.TEXT_NODE,
    );
    if (onlyText && (el.textContent ?? '').trim().length > 0) return 'text';
  }
  return 'other';
}

/**
 * Build the contents of a <style> tag from the override map of a single block.
 * Selectors are scoped to elements with the matching data-elem-id attribute.
 */
export function buildOverrideCSS(
  overrides: Record<string, {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    color?: string;
    fontSize?: number;
    fontWeight?: string | number;
    textAlign?: string;
    src?: string;
  }>,
): string {
  const rules: string[] = [];
  for (const [id, ov] of Object.entries(overrides)) {
    if (!ov) continue;
    const decls: string[] = [];
    if (ov.color) decls.push(`color: ${ov.color} !important`);
    if (ov.fontSize !== undefined) decls.push(`font-size: ${ov.fontSize}px !important`);
    if (ov.fontWeight !== undefined) decls.push(`font-weight: ${ov.fontWeight} !important`);
    if (ov.textAlign) decls.push(`text-align: ${ov.textAlign} !important`);
    if (ov.width !== undefined) decls.push(`width: ${ov.width}px !important`);
    if (ov.height !== undefined) decls.push(`height: ${ov.height}px !important`);
    if (ov.x !== undefined || ov.y !== undefined) {
      const x = ov.x ?? 0;
      const y = ov.y ?? 0;
      decls.push(`transform: translate(${x}px, ${y}px) !important`);
    }
    if (decls.length === 0) continue;
    // CSS attribute selectors don't allow `>` in the value without escaping.
    // Escape `>` with `\3E ` so the selector parses.
    const escaped = id.replace(/>/g, '\\3E ');
    rules.push(`[data-elem-id="${escaped}"] { ${decls.join('; ')}; }`);
  }
  return rules.join('\n');
}

/**
 * Apply imperative overrides that CSS can't express reliably (e.g. <img src>).
 */
export function applyImperativeOverrides(
  blockRoot: HTMLElement,
  overrides: Record<string, { src?: string }>,
): void {
  for (const [id, ov] of Object.entries(overrides)) {
    if (!ov?.src) continue;
    const escaped = id.replace(/"/g, '\\"');
    const el = blockRoot.querySelector(`[data-elem-id="${escaped}"]`) as HTMLElement | null;
    if (!el) continue;
    if (el.tagName === 'IMG' && (el as HTMLImageElement).src !== ov.src) {
      (el as HTMLImageElement).src = ov.src;
    } else if (el.tagName === 'VIDEO' && (el as HTMLVideoElement).src !== ov.src) {
      (el as HTMLVideoElement).src = ov.src;
    }
  }
}
