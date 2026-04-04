/**
 * Real exam storage — persists attempt + answers in Supabase.
 * Maintains localStorage as fast write-through cache for UX (debounced sync to DB).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { simuladosApi } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import type { ExamState, ExamAnswer } from '@/types/exam';

const STORAGE_PREFIX = 'enamed_exam_';

function getLocalKey(simuladoId: string): string {
  return `${STORAGE_PREFIX}${simuladoId}`;
}

export interface LoadStateResult {
  state: ExamState | null;
  fromCache: boolean;
}

export function useExamStorageReal(simuladoId: string) {
  const { user } = useAuth();
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  const pendingAnswersRef = useRef<Record<string, ExamAnswer>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Clear pending debounced save on unmount to avoid writing to an unmounted component
  useEffect(() => {
    return () => {
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    };
  }, []);

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const withRetry = useCallback(async <T,>(
    operation: () => Promise<T>,
    label: string,
    attempts = 3,
    baseDelayMs = 350,
  ): Promise<T> => {
    let lastError: unknown = null;
    for (let i = 0; i < attempts; i += 1) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        const isLast = i === attempts - 1;
        logger.warn(`[ExamStorageReal] ${label} failed (attempt ${i + 1}/${attempts})`);
        if (!isLast) {
          await sleep(baseDelayMs * (i + 1));
        }
      }
    }
    throw lastError instanceof Error ? lastError : new Error(String(lastError));
  }, []);

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
      logger.error('[ExamStorageReal] Local save failed:', e);
    }
  }, [simuladoId]);

  // ── Load from Supabase (or local cache as fallback) ──
  const loadState = useCallback(async (): Promise<LoadStateResult> => {
    if (!user) return { state: loadLocalState(), fromCache: true };

    try {
      const attempt = await simuladosApi.getAttempt(simuladoId, user.id, 'online');
      if (!attempt) {
        // No online attempt in DB — clear any orphan local cache
        localStorage.removeItem(getLocalKey(simuladoId));
        return { state: null, fromCache: false };
      }

      attemptIdRef.current = attempt.id;

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

      saveLocalState(state);
      logger.log('[ExamStorageReal] Loaded from Supabase, status:', state.status);
      return { state, fromCache: false };
    } catch (err) {
      logger.error('[ExamStorageReal] DB load failed, using local cache');
      toast({
        title: 'Dados carregados do cache local',
        description: 'Algumas respostas podem não estar sincronizadas.',
        variant: 'destructive',
      });
      return { state: loadLocalState(), fromCache: true };
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

    if (user) {
      try {
        const attempt = await simuladosApi.createAttempt(
          simuladoId,
          user.id,
          effectiveDeadline.toISOString(),
        );
        attemptIdRef.current = attempt.id;
        // Use server deadline (authoritative)
        state.effectiveDeadline = attempt.effective_deadline;
        state.startedAt = attempt.started_at;
        trackEvent('simulado_started', {
          simuladoId,
          attemptId: attempt.id,
        });
        logger.log('[ExamStorageReal] Created DB attempt:', attempt.id);
      } catch (err) {
        logger.error('[ExamStorageReal] Failed to create DB attempt:', err);
        toast({
          title: 'Erro ao criar tentativa',
          description: 'Não foi possível registrar sua prova no servidor. Tente novamente.',
          variant: 'destructive',
        });
        // Abort: do NOT save local state without a valid DB attempt
        throw err;
      }
    }

    saveLocalState(state);
    return state;
  }, [simuladoId, user, saveLocalState]);

  // ── Debounced sync to Supabase ──
  const syncToDb = useCallback(async (state: ExamState) => {
    if (!attemptIdRef.current || !user) return;

    await withRetry(async () => simuladosApi.updateAttempt(attemptIdRef.current!, {
        current_question_index: state.currentQuestionIndex,
        tab_exit_count: state.tabExitCount,
        fullscreen_exit_count: state.fullscreenExitCount,
      }),
      'Update attempt metadata',
    );

    const allAnswers = state.answers;
    if (Object.keys(allAnswers).length > 0) {
      await withRetry(
        async () => simuladosApi.bulkUpsertAnswers(attemptIdRef.current!, allAnswers),
        'Bulk upsert answers',
      );
      logger.log('[ExamStorageReal] Synced', Object.keys(allAnswers).length, 'answers to DB');
    }
  }, [user, withRetry]);

  // ── Save state (write-through: local immediately, DB debounced) ──
  const saveStateDebounced = useCallback((state: ExamState) => {
    saveLocalState(state);
    setIsSaving(true);

    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    debouncedSaveRef.current = setTimeout(() => {
      syncToDb(state).catch(() => {
        logger.error('[ExamStorageReal] Debounced DB sync failed');
      }).finally(() => {
        setIsSaving(false);
      });
    }, 2000);
  }, [saveLocalState, syncToDb]);

  const saveStateSync = useCallback((state: ExamState) => {
    saveLocalState(state);
    syncToDb(state);
  }, [saveLocalState, syncToDb]);

  // ── Track answer changes for batch sync ──
  const trackAnswer = useCallback(async (questionId: string, answer: ExamAnswer) => {
    pendingAnswersRef.current[questionId] = answer;
    if (!attemptIdRef.current || !user) return;
    try {
      await withRetry(
        async () => simuladosApi.upsertAnswer(attemptIdRef.current!, questionId, {
          selectedOptionId: answer.selectedOption,
          markedForReview: answer.markedForReview,
          highConfidence: answer.highConfidence,
          eliminatedOptions: answer.eliminatedAlternatives || [],
        }),
        `Immediate upsert answer ${questionId}`,
      );
      delete pendingAnswersRef.current[questionId];
    } catch {
      logger.error('[ExamStorageReal] Immediate answer save failed');
    }
  }, [user, withRetry]);

  // ── Flush before finalize ──
  const flushPendingState = useCallback(async (state?: ExamState) => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const stateToSync = state || loadLocalState();
    if (stateToSync) await syncToDb(stateToSync);

    const pending = pendingAnswersRef.current;
    if (attemptIdRef.current && Object.keys(pending).length > 0) {
      await withRetry(
        async () => simuladosApi.bulkUpsertAnswers(attemptIdRef.current!, pending),
        'Flush pending answers',
      );
      pendingAnswersRef.current = {};
    }
  }, [loadLocalState, syncToDb, withRetry]);

  const ensureAllAnswersPersisted = useCallback(async (finalState: ExamState) => {
    if (!attemptIdRef.current || !user) return;

    if (Object.keys(finalState.answers).length > 0) {
      await withRetry(
        async () => simuladosApi.bulkUpsertAnswers(attemptIdRef.current!, finalState.answers),
        'Final answers upsert',
      );
    }

    const persistedAnswers = await withRetry(
      async () => simuladosApi.getAnswers(attemptIdRef.current!),
      'Load persisted answers for integrity check',
    );
    const persistedQuestionIds = new Set(persistedAnswers.map(a => a.question_id));
    const missing = Object.keys(finalState.answers).filter(questionId => !persistedQuestionIds.has(questionId));
    if (missing.length > 0) {
      throw new Error(`Respostas pendentes de persistencia: ${missing.length}`);
    }
  }, [user, withRetry]);

  // ── Submit (finalize) ──
  const submitAttempt = useCallback(async (finalState: ExamState): Promise<void> => {
    await flushPendingState(finalState);
    await ensureAllAnswersPersisted(finalState);

    if (!attemptIdRef.current) {
      throw new Error('Tentativa nao inicializada para finalizacao.');
    }
    try {
      await withRetry(
        async () => simuladosApi.submitAttempt(attemptIdRef.current!),
        'Finalize attempt server-side',
      );
    } catch (error) {
      // Fail-safe path: enqueue for server-side reprocessing and bubble a clear error.
      await withRetry(
        async () => simuladosApi.enqueueAttemptReprocessing(
          attemptIdRef.current!,
          'Finalizacao falhou no client; tentativa enfileirada para reprocessamento.',
        ),
        'Enqueue attempt reprocessing',
      );
      throw error;
    }

    const submitted: ExamState = { ...finalState, status: 'submitted', lastSavedAt: new Date().toISOString() };
    saveLocalState(submitted);
    logger.log('[ExamStorageReal] Attempt submitted');
  }, [flushPendingState, ensureAllAnswersPersisted, withRetry, saveLocalState]);

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

  const setResultNotification = useCallback(async (enabled: boolean) => {
    if (!attemptIdRef.current || !user) return;
    await simuladosApi.setAttemptResultNotification(attemptIdRef.current, enabled);
  }, [user]);

  const getResultNotificationPreference = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    const attempt = await simuladosApi.getAttempt(simuladoId, user.id, 'online');
    return Boolean(attempt?.notify_result_email);
  }, [simuladoId, user]);

  return {
    isSaving,
    loadState,
    loadLocalState,
    saveStateSync,
    saveStateDebounced,
    flushPendingState,
    initializeState,
    submitAttempt,
    ensureAllAnswersPersisted,
    trackAnswer,
    registerTabExit,
    registerFullscreenExit,
    setResultNotification,
    getResultNotificationPreference,
    clearState,
    attemptId: attemptIdRef,
  };
}
