/**
 * Exam storage service — ported from SanarFlix Academy's useSimuladoStorage.
 * Key patterns preserved:
 *   - Debounced saves (100ms) to avoid UI blocking
 *   - flushPendingState() for critical moments (finalize, beforeunload)
 *   - Immediate saves for integrity events (tab exit, fullscreen exit)
 *   - Centralized localStorage with typed contracts
 */

import type { ExamState, ExamAnswer } from '@/types/exam';
import { useCallback, useRef } from 'react';

const STORAGE_PREFIX = 'enamed_exam_';

function getKey(simuladoId: string): string {
  return `${STORAGE_PREFIX}${simuladoId}`;
}

export function useExamStorage(simuladoId: string) {
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingStateRef = useRef<ExamState | null>(null);

  const loadState = useCallback((): ExamState | null => {
    try {
      const raw = localStorage.getItem(getKey(simuladoId));
      if (!raw) return null;
      const state = JSON.parse(raw) as ExamState;
      console.log('[ExamStorage] Loaded state for', simuladoId, 'status:', state.status);
      return state;
    } catch (e) {
      console.error('[ExamStorage] Failed to load:', e);
      return null;
    }
  }, [simuladoId]);

  // Immediate save — used for integrity-critical events
  const saveStateSync = useCallback((state: ExamState) => {
    try {
      const updated = { ...state, lastSavedAt: new Date().toISOString() };
      localStorage.setItem(getKey(simuladoId), JSON.stringify(updated));
    } catch (e) {
      console.error('[ExamStorage] Sync save failed:', e);
    }
  }, [simuladoId]);

  // Debounced save — used for answer selections, navigation (doesn't block UI)
  const saveStateDebounced = useCallback((state: ExamState) => {
    pendingStateRef.current = { ...state, lastSavedAt: new Date().toISOString() };

    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }

    debouncedSaveRef.current = setTimeout(() => {
      if (pendingStateRef.current) {
        try {
          localStorage.setItem(getKey(simuladoId), JSON.stringify(pendingStateRef.current));
          console.log('[ExamStorage] Debounced save complete');
        } catch (e) {
          console.error('[ExamStorage] Debounced save failed:', e);
        }
      }
    }, 100);
  }, [simuladoId]);

  // Force flush any pending debounced state — critical before finalize/unload
  const flushPendingState = useCallback(() => {
    if (debouncedSaveRef.current) {
      clearTimeout(debouncedSaveRef.current);
    }
    if (pendingStateRef.current) {
      try {
        localStorage.setItem(getKey(simuladoId), JSON.stringify(pendingStateRef.current));
      } catch (e) {
        console.error('[ExamStorage] Flush failed:', e);
      }
    }
  }, [simuladoId]);

  const initializeState = useCallback((
    questionsCount: number,
    durationMinutes: number,
    windowEndISO: string,
  ): ExamState => {
    const now = new Date();
    const personalDeadline = new Date(now.getTime() + durationMinutes * 60 * 1000);
    const windowDeadline = new Date(windowEndISO);
    const effectiveDeadline = personalDeadline < windowDeadline ? personalDeadline : windowDeadline;

    const state: ExamState = {
      simuladoId,
      currentQuestionIndex: 0,
      answers: {},
      tabExitCount: 0,
      fullscreenExitCount: 0,
      startedAt: now.toISOString(),
      effectiveDeadline: effectiveDeadline.toISOString(),
      lastSavedAt: now.toISOString(),
      status: 'in_progress',
    };

    saveStateSync(state);
    console.log('[ExamStorage] Initialized new state, deadline:', effectiveDeadline.toISOString());
    return state;
  }, [simuladoId, saveStateSync]);

  const registerTabExit = useCallback(() => {
    const state = loadState();
    if (!state) return;
    saveStateSync({ ...state, tabExitCount: state.tabExitCount + 1 });
  }, [loadState, saveStateSync]);

  const registerFullscreenExit = useCallback(() => {
    const state = loadState();
    if (!state) return;
    saveStateSync({ ...state, fullscreenExitCount: state.fullscreenExitCount + 1 });
  }, [loadState, saveStateSync]);

  const clearState = useCallback(() => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    localStorage.removeItem(getKey(simuladoId));
    console.log('[ExamStorage] Cleared state for', simuladoId);
  }, [simuladoId]);

  return {
    loadState,
    saveStateSync,
    saveStateDebounced,
    flushPendingState,
    initializeState,
    registerTabExit,
    registerFullscreenExit,
    clearState,
  };
}
