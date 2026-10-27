// ============================================================================
// PLUGIN HOOKS - Lifecycle hooks and utilities for plugins
// ============================================================================

import { useCallback, useMemo, useRef, useEffect } from 'react';

/**
 * Plugin lifecycle hook
 */
export function usePluginLifecycle(
  onMount?: () => void,
  onUnmount?: () => void
) {
  useEffect(() => {
    onMount?.();
    return () => onUnmount?.();
  }, [onMount, onUnmount]);
}

/**
 * Memoized data processing hook
 */
export function useProcessedData<T, R>(
  data: T,
  processor: (data: T) => R,
  deps: unknown[] = []
): R {
  return useMemo(() => processor(data), [data, ...deps]);
}

/**
 * Debounced callback hook
 */
export function useDebouncedCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  delay: number
): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  
  return useCallback(
    ((...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => callback(...args), delay);
    }) as T,
    [callback, delay]
  );
}

/**
 * Previous value hook
 */
export function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T>();
  
  useEffect(() => {
    ref.current = value;
  }, [value]);
  
  return ref.current;
}

/**
 * Data diff hook
 */
export function useDataDiff<T extends Record<string, unknown>>(
  data: T
): { changed: boolean; changes: Partial<Record<keyof T, { old: unknown; new: unknown }>> } {
  const prevData = usePrevious(data);
  
  return useMemo(() => {
    if (!prevData) {
      return { changed: false, changes: {} };
    }
    
    const changes: Partial<Record<keyof T, { old: unknown; new: unknown }>> = {};
    
    for (const key in data) {
      if (data[key] !== prevData[key]) {
        changes[key] = {
          old: prevData[key],
          new: data[key],
        };
      }
    }
    
    return {
      changed: Object.keys(changes).length > 0,
      changes,
    };
  }, [data, prevData]);
}

/**
 * Animation frame hook for custom animations
 */
export function useAnimationFrame(callback: (frame: number, delta: number) => void) {
  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();
  const frameCount = useRef(0);
  
  useEffect(() => {
    const animate = (time: number) => {
      if (previousTimeRef.current !== undefined) {
        const delta = time - previousTimeRef.current;
        callback(frameCount.current, delta);
      }
      
      previousTimeRef.current = time;
      frameCount.current++;
      requestRef.current = requestAnimationFrame(animate);
    };
    
    requestRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [callback]);
}

/**
 * Value interpolation hook
 */
export function useInterpolatedValue(
  inputRange: number[],
  outputRange: number[],
  current: number
): number {
  return useMemo(() => {
    // Clamp current value
    const clampedCurrent = Math.max(inputRange[0], Math.min(inputRange[inputRange.length - 1], current));
    
    // Find the segment
    let segmentIndex = 0;
    for (let i = 1; i < inputRange.length; i++) {
      if (clampedCurrent <= inputRange[i]) {
        segmentIndex = i - 1;
        break;
      }
    }
    
    // Interpolate
    const inputStart = inputRange[segmentIndex];
    const inputEnd = inputRange[segmentIndex + 1];
    const outputStart = outputRange[segmentIndex];
    const outputEnd = outputRange[segmentIndex + 1];
    
    const progress = (clampedCurrent - inputStart) / (inputEnd - inputStart);
    return outputStart + (outputEnd - outputStart) * progress;
  }, [inputRange, outputRange, current]);
}
