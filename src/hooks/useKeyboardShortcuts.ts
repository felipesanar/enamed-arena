/**
 * Keyboard shortcuts — ported from SanarFlix Academy's useKeyboardShortcuts.
 * Supports 1-5 for alternatives (A-E), arrows, F for review, H for high-confidence, Esc for finalize.
 */

import { useEffect, useCallback } from 'react';

type KeyAction = () => void;

export interface KeyboardShortcuts {
  [key: string]: KeyAction | undefined;
}

interface UseKeyboardShortcutsOptions {
  enabled?: boolean;
  preventInInputs?: boolean;
}

export function useKeyboardShortcuts(
  shortcuts: KeyboardShortcuts,
  options: UseKeyboardShortcutsOptions = {}
) {
  const { enabled = true, preventInInputs = true } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    if (preventInInputs) {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
    }

    const action = shortcuts[event.key];
    if (action) {
      event.preventDefault();
      action();
    }
  }, [enabled, preventInInputs, shortcuts]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}

export const KEY_TO_OPTION_INDEX: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
};
