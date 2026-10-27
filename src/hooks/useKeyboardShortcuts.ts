'use client';

import { useEffect, useCallback } from 'react';
import { useEditorStore } from '@/store/editor-store';

export function useKeyboardShortcuts() {
  const { 
    undo, 
    redo, 
    canUndo, 
    canRedo, 
    removeBlock, 
    duplicateBlock,
    selectedBlockIndex,
    videoInput
  } = useEditorStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore if typing in an input field
    const target = e.target as HTMLElement;
    const isInputField = target.tagName === 'INPUT' || 
                         target.tagName === 'TEXTAREA' || 
                         target.isContentEditable;
    
    if (isInputField) return;

    // Ctrl/Cmd + Z: Undo
    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      if (canUndo()) undo();
      return;
    }

    // Ctrl/Cmd + Shift + Z: Redo
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
      e.preventDefault();
      if (canRedo()) redo();
      return;
    }

    // Ctrl/Cmd + Y: Redo (alternative)
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      if (canRedo()) redo();
      return;
    }

    // Delete or Backspace: Remove selected block
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedBlockIndex !== null) {
      e.preventDefault();
      removeBlock(selectedBlockIndex);
      return;
    }

    // Ctrl/Cmd + D: Duplicate selected block
    if ((e.ctrlKey || e.metaKey) && e.key === 'd' && selectedBlockIndex !== null) {
      e.preventDefault();
      duplicateBlock(selectedBlockIndex);
      return;
    }

    // Arrow keys: Navigate blocks
    if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const newIndex = selectedBlockIndex === null ? 0 : Math.max(0, selectedBlockIndex - 1);
      useEditorStore.getState().selectBlock(newIndex);
      return;
    }

    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
      e.preventDefault();
      const maxIndex = videoInput.contentBlocks.length - 1;
      const newIndex = selectedBlockIndex === null ? 0 : Math.min(maxIndex, selectedBlockIndex + 1);
      useEditorStore.getState().selectBlock(newIndex);
      return;
    }

    // Escape: Deselect
    if (e.key === 'Escape') {
      e.preventDefault();
      useEditorStore.getState().selectBlock(null);
      return;
    }

  }, [undo, redo, canUndo, canRedo, removeBlock, duplicateBlock, selectedBlockIndex, videoInput.contentBlocks.length]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return {
    shortcuts: [
      { keys: ['Ctrl/Cmd', 'Z'], action: 'Undo' },
      { keys: ['Ctrl/Cmd', 'Shift', 'Z'], action: 'Redo' },
      { keys: ['Ctrl/Cmd', 'D'], action: 'Duplicate block' },
      { keys: ['Delete'], action: 'Remove block' },
      { keys: ['↑', '↓'], action: 'Navigate blocks' },
      { keys: ['Esc'], action: 'Deselect' },
    ]
  };
}
