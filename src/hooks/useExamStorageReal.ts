/**
 * Real exam storage — persists attempt + answers in Supabase.
 * Maintains localStorage as fast write-through cache for UX (debounced sync to DB).
 * Architecture follows Academy's useSimuladoStorage with real persistence.
 */

import { useCallback, useRef } from 'react';
import { simuladosApi, type AttemptRow } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import type { ExamState, ExamAnswer } from '@/types/exam';

const STORAGE_PREFIX = 'enamed_exam_';

function getLocalKey(simuladoId: string): string {
  return `${STORAGE_PREFIX}${simuladoId}`;
}

export function useExamStorageReal(simuladoId: string) {
  const { user } = useAuth();
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const pendingAnswersRef = useRef<Record<string, ExamAnswer>>({});

  // ── Local cache read ──
  const loadLocalState = useCallback((): ExamState | null => {
    try {
      const raw = localStorage.getItem(getLocalKey(simuladoId));
      if (!raw) return null;
      return JSON.parse(raw) as ExamState;
    } catch {
      return null;
    }
  }, [simuladoId]);

  // ── Local cache write ──
  const saveLocalState = useCallback((state: ExamState) => {
    try {
      localStorage.setItem(getLocalKey(simuladoId), JSON.stringify({
        ...state,
        lastSavedAt: new Date().toISOString(),
      }));
    } catch (e) {
      console.error('[ExamStorageReal] Local save failed:', e);
    }
  }, [simuladoId]);

  // ── Load from Supabase (or local cache as fallback) ──
  const loadState = useCallback(async (): Promise<ExamState | null> => {
    if (!user) return loadLocalState();

    try {
      const attempt = await simuladosApi.getAttempt(simuladoId, user.id);
      if (!attempt) return loadLocalState(); // No DB attempt yet

      attemptIdRef.current = attempt.id;

      // Load answers from DB
      const answerRows = await simuladosApi.getAnswers(attempt.id);
      const answers: Record<string, ExamAnswer> = {};
      answerRows.forEach(a => {
        answers[a.question_id] = {
          questionId: a.question_id,
          selectedOption: a.selected_option_id,
          markedForReview: a.marked_for_review,
          highConfidence: a.high_confidence,
          eliminatedAlternatives: a.eliminated_options || [],
        };
      });

      const state: ExamState = {
        simuladoId: attempt.simulado_id,
        currentQuestionIndex: attempt.current_question_index,
        answers,
        tabExitCount: attempt.tab_exit_count,
        fullscreenExitCount: attempt.fullscreen_exit_count,
        startedAt: attempt.started_at,
        effectiveDeadline: attempt.effective_deadline,
        lastSavedAt: attempt.last_saved_at,
        status: attempt.status as ExamState['status'],
      };

      // Update local cache
      saveLocalState(state);
      console.log('[ExamStorageReal] Loaded from Supabase, status:', state.status);
      return state;
    } catch (err) {
      console.error('[ExamStorageReal] DB load failed, using local cache:', err);
      return loadLocalState();
    }
  }, [simuladoId, user, loadLocalState, saveLocalState]);

  // ── Initialize a new attempt ──
  const initializeState = useCallback(async (
    questionsCount: number,
    durationMinutes: number,
    windowEndISO: string,
  ): Promise<ExamState> => {
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

    // Create real attempt in Supabase
    if (user) {
      try {
        const attempt = await simuladosApi.createAttempt(
          simuladoId,
          user.id,
          effectiveDeadline.toISOString(),
        );
        attemptIdRef.current = attempt.id;
        console.log('[ExamStorageReal] Created DB attempt:', attempt.id);
      } catch (err) {
        console.error('[ExamStorageReal] Failed to create DB attempt:', err);
      }
    }

    saveLocalState(state);
    return state;
  }, [simuladoId, user, saveLocalState]);

  // ── Debounced sync to Supabase ──
  const syncToDb = useCallback(async (state: ExamState) => {
    if (!attemptIdRef.current || !user) return;

    try {
      // Sync attempt metadata
      await simuladosApi.updateAttempt(attemptIdRef.current, {
        current_question_index: state.currentQuestionIndex,
        tab_exit_count: state.tabExitCount,
        fullscreen_exit_count: state.fullscreenExitCount,
      });

      // Sync ALL answers from state (not just pending)
      const allAnswers = state.answers;
      if (Object.keys(allAnswers).length > 0) {
        await simuladosApi.bulkUpsertAnswers(attemptIdRef.current, allAnswers);
        console.log('[ExamStorageReal] Synced', Object.keys(allAnswers).length, 'answers to DB');
      }
    } catch (err) {
      console.error('[ExamStorageReal] DB sync failed (will retry):', err);
    }
  }, [user]);

  // ── Save state (write-through: local immediately, DB debounced) ──
  const saveStateDebounced = useCallback((state: ExamState) => {
    saveLocalState(state);

    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    debouncedSaveRef.current = setTimeout(() => syncToDb(state), 2000);
  }, [saveLocalState, syncToDb]);

  const saveStateSync = useCallback((state: ExamState) => {
    saveLocalState(state);
    // Don't await — fire and forget for sync saves
    syncToDb(state);
  }, [saveLocalState, syncToDb]);

  // ── Track answer changes for batch sync ──
  const trackAnswer = useCallback((questionId: string, answer: ExamAnswer) => {
    pendingAnswersRef.current[questionId] = answer;
  }, []);

  // ── Flush before finalize ──
  const flushPendingState = useCallback(async (state?: ExamState) => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const stateToSync = state || loadLocalState();
    if (stateToSync) await syncToDb(stateToSync);
  }, [loadLocalState, syncToDb]);

  // ── Submit (finalize) ──
  const submitAttempt = useCallback(async (
    scorePercentage: number,
    totalCorrect: number,
    totalAnswered: number,
    finalState: ExamState,
  ): Promise<void> => {
    // Sync finalState directly — not localStorage
    try {
      await syncToDb(finalState);
      console.log('[ExamStorageReal] Final sync succeeded');
    } catch (err) {
      console.warn('[ExamStorageReal] First sync failed, retrying...', err);
      try {
        await syncToDb(finalState);
      } catch (retryErr) {
        console.error('[ExamStorageReal] Retry also failed:', retryErr);
      }
    }

    if (attemptIdRef.current) {
      await simuladosApi.submitAttempt(
        attemptIdRef.current,
        scorePercentage,
        totalCorrect,
        totalAnswered,
      );
    }

    const submitted: ExamState = { ...finalState, status: 'submitted', lastSavedAt: new Date().toISOString() };
    saveLocalState(submitted);
    console.log('[ExamStorageReal] Attempt submitted');
  }, [syncToDb, saveLocalState]);

  // ── Integrity events ──
  const registerTabExit = useCallback(() => {
    const state = loadLocalState();
    if (!state) return;
    const updated = { ...state, tabExitCount: state.tabExitCount + 1 };
    saveStateSync(updated);
  }, [loadLocalState, saveStateSync]);

  const registerFullscreenExit = useCallback(() => {
    const state = loadLocalState();
    if (!state) return;
    const updated = { ...state, fullscreenExitCount: state.fullscreenExitCount + 1 };
    saveStateSync(updated);
  }, [loadLocalState, saveStateSync]);

  const clearState = useCallback(() => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    localStorage.removeItem(getLocalKey(simuladoId));
  }, [simuladoId]);

  return {
    loadState,
    loadLocalState,
    saveStateSync,
    saveStateDebounced,
    flushPendingState,
    initializeState,
    submitAttempt,
    trackAnswer,
    registerTabExit,
    registerFullscreenExit,
    clearState,
    attemptId: attemptIdRef,
  };
}
