/**
 * Keyboard shortcuts — ported from SanarFlix Academy's useKeyboardShortcuts.
 * Supports 1-5 for alternatives (A-E), arrows, F for review, H for high-confidence, Esc for finalize.
 */

import { useEffect, useRef } from 'react';

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
  options: UseKeyboardShortcutsOptions = {},
) {
  const { enabled = true, preventInInputs = true } = options;

  // Keep the latest shortcuts map in a ref so the keydown listener can read
  // fresh values without re-registering. This avoids add/removeEventListener
  // churn every time the parent rebuilds the shortcuts object (e.g. on every
  // question change during an exam).
  const shortcutsRef = useRef(shortcuts);
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (preventInInputs) {
        const target = event.target as HTMLElement | null;
        if (
          target &&
          (target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.isContentEditable)
        ) {
          return;
        }
      }

      const action = shortcutsRef.current[event.key];
      if (action) {
        event.preventDefault();
        action();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, preventInInputs]);
}

export const KEY_TO_OPTION_INDEX: Record<string, number> = {
  '1': 0, '2': 1, '3': 2, '4': 3, '5': 4,
};
