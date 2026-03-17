/**
 * usePersistedState — sessionStorage-backed useState for UI state resilience.
 * Survives tab switches and soft remounts without leaking across sessions.
 * 
 * Usage:
 *   const [step, setStep] = usePersistedState('onboarding:step', 0);
 *   const [filters, setFilters] = usePersistedState('ranking:filters', defaultFilters);
 * 
 * Call clearPersistedState(key) when a flow completes to clean up.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_PREFIX = 'enamed_ui_';

function getStorageKey(key: string): string {
  return `${STORAGE_PREFIX}${key}`;
}

function readFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = sessionStorage.getItem(getStorageKey(key));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeToStorage<T>(key: string, value: T): void {
  try {
    sessionStorage.setItem(getStorageKey(key), JSON.stringify(value));
  } catch (e) {
    console.warn('[usePersistedState] Write failed for key:', key, e);
  }
}

export function clearPersistedState(key: string): void {
  try {
    sessionStorage.removeItem(getStorageKey(key));
  } catch {}
}

export function clearPersistedStateByPrefix(prefix: string): void {
  try {
    const fullPrefix = getStorageKey(prefix);
    const keysToRemove: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(fullPrefix)) keysToRemove.push(k);
    }
    keysToRemove.forEach(k => sessionStorage.removeItem(k));
  } catch {}
}

export function usePersistedState<T>(
  key: string,
  initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize from storage on first mount only
  const [state, setStateRaw] = useState<T>(() => readFromStorage(key, initialValue));
  const keyRef = useRef(key);
  keyRef.current = key;

  const setState = useCallback((value: T | ((prev: T) => T)) => {
    setStateRaw(prev => {
      const next = typeof value === 'function' ? (value as (prev: T) => T)(prev) : value;
      writeToStorage(keyRef.current, next);
      return next;
    });
  }, []);

  // Sync to storage if key changes (rare but safe)
  useEffect(() => {
    writeToStorage(key, state);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  return [state, setState];
}
