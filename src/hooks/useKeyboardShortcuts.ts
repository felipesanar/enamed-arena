/**
 * Keyboard shortcuts — ported from SanarFlix Academy's useKeyboardShortcuts.
 * Dispatches the caller's map; R/H and numeric meanings belong to the exam flow.
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
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || event.keyCode === 229) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('[role="dialog"], [role="alertdialog"], dialog[open]') ||
        document.querySelector('[role="dialog"][aria-modal="true"], [role="alertdialog"], dialog[open]')) return;
      if (preventInInputs && target?.closest('input, textarea, select, [role="textbox"], [contenteditable]:not([contenteditable="false"])')) return;

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
