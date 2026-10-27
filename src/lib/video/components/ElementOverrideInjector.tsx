import React, { useEffect, useLayoutEffect, useRef } from 'react';
import { useCurrentFrame } from 'remotion';
import {
  applyImperativeOverrides,
  buildOverrideCSS,
  tagDescendants,
} from '@/lib/editor/element-path';
import type { ElementOverride } from '@/lib/video/schemas';

// useLayoutEffect on the server (Next.js SSR) warns; fall back to useEffect there.
// In the headless render environment we ARE in the browser, so this is fine.
const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

/**
 * Wraps a scene's children, tags every descendant with a stable data-elem-id,
 * and emits a <style> tag with rules from `overrides`. Used by both built-in
 * scenes (via SceneRenderer) and custom plugin scenes (via PluginScene).
 *
 * The data-block-id attribute defines the scope inside which paths are
 * computed — so all elements inside one block share the same prefix and clicks
 * on the editor overlay can locate the right block + element.
 *
 * IMPORTANT: tagging runs in useLayoutEffect (synchronously before paint) so
 * that `renderMediaOnWeb`'s frame capture sees the data-elem-id attributes on
 * the very FIRST frame — useEffect would fire after the screenshot, leaving
 * frame 0 unstyled in the exported video.
 */
export function ElementOverrideInjector({
  blockIndex,
  overrides,
  children,
}: {
  blockIndex: number;
  overrides?: Record<string, ElementOverride>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // Subscribe to the current frame so this component re-renders every Remotion
  // frame — that ensures dynamically-mounted plugin children get tagged in
  // useLayoutEffect on every frame (otherwise the injector only re-renders
  // when its props change, missing late plugin mounts).
  useCurrentFrame();

  // Re-run synchronously before paint so the renderer captures the first frame
  // with all data-elem-id attributes already in place.
  useIsoLayoutEffect(() => {
    const root = ref.current;
    if (!root) return;
    tagDescendants(root);
    if (overrides) applyImperativeOverrides(root, overrides);
  });

  const css = overrides ? buildOverrideCSS(overrides) : '';

  return (
    <div
      ref={ref}
      data-block-id={`block-${blockIndex}`}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {css ? <style>{css}</style> : null}
      {children}
    </div>
  );
}
