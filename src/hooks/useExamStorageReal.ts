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
import type { FinalizedAttemptResult } from '@/services/simuladosApi';

const STORAGE_PREFIX = 'enamed_exam_';

// Tuning knobs in one place so behaviour is greppable & adjustable without
// hunting through the file.
const STORAGE_CONFIG = {
  /** Wait this long after the last user input before flushing to the DB. */
  DEBOUNCE_MS: 2000,
  /** Total attempts (including the first) for transient write retries. */
  RETRY_ATTEMPTS: 3,
  /** Linear backoff base; effective wait = base × attempt #. */
  RETRY_BASE_DELAY_MS: 350,
} as const;

function getLocalKey(simuladoId: string): string {
  return `${STORAGE_PREFIX}${simuladoId}`;
}

export interface LoadStateResult {
  state: ExamState | null;
  fromCache: boolean;
  /** Pre-fetched in the same round trip as the attempt — saves a query. */
  notifyResultEmail: boolean;
}

export function useExamStorageReal(simuladoId: string) {
  const { user } = useAuth();
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  // Dirty set: question IDs whose answer changed since the last DB sync.
  // bulkUpsertAnswers only writes these, instead of re-sending every answer
  // every debounce tick — keeps payloads small even on 200+ question exams.
  const dirtyQuestionIdsRef = useRef<Set<string>>(new Set());
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
    attempts = STORAGE_CONFIG.RETRY_ATTEMPTS,
    baseDelayMs = STORAGE_CONFIG.RETRY_BASE_DELAY_MS,
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
    if (!user) return { state: loadLocalState(), fromCache: true, notifyResultEmail: false };

    try {
      const attempt = await simuladosApi.getAttempt(simuladoId, user.id, 'online');
      if (!attempt) {
        // No online attempt in DB — clear any orphan local cache
        localStorage.removeItem(getLocalKey(simuladoId));
        return { state: null, fromCache: false, notifyResultEmail: false };
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
          confidence: (a as any).confidence ?? null,
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
      // notify_result_email already comes with the attempt row; expose it so
      // callers don't need a follow-up getAttempt() to read it.
      return {
        state,
        fromCache: false,
        notifyResultEmail: Boolean(attempt.notify_result_email),
      };
    } catch (err) {
      logger.error('[ExamStorageReal] DB load failed, using local cache');
      trackEvent('exam_storage_fallback', {
        simulado_id: simuladoId,
        attempt_id: attemptIdRef.current ?? undefined,
        error_message: err instanceof Error ? err.message : 'unknown',
        fallback_source: 'localStorage',
      });
      toast({
        title: 'Dados carregados do cache local',
        description: 'Algumas respostas podem não estar sincronizadas.',
        variant: 'destructive',
      });
      return { state: loadLocalState(), fromCache: true, notifyResultEmail: false };
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
          simulado_id: simuladoId,
          attempt_id: attempt.id,
          mode: 'online',
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
  // Writes only the answers marked dirty since the last successful sync,
  // not the entire answer map. Cuts ~98% of payload on long exams.
  const syncToDb = useCallback(async (state: ExamState) => {
    if (!attemptIdRef.current || !user) return;

    await withRetry(
      async () => simuladosApi.updateAttempt(attemptIdRef.current!, {
        current_question_index: state.currentQuestionIndex,
        tab_exit_count: state.tabExitCount,
        fullscreen_exit_count: state.fullscreenExitCount,
      }),
      'Update attempt metadata',
    );

    // Snapshot the dirty set and clear it BEFORE the request, so any new
    // changes made while the request is in flight are not lost (they go into
    // a fresh dirty set for the next debounce tick).
    const dirty = Array.from(dirtyQuestionIdsRef.current);
    dirtyQuestionIdsRef.current = new Set();

    if (dirty.length === 0) return;

    const subset: Record<string, ExamAnswer> = {};
    for (const id of dirty) {
      const ans = state.answers[id];
      if (ans) subset[id] = ans;
    }

    try {
      await withRetry(
        async () => simuladosApi.bulkUpsertAnswers(attemptIdRef.current!, subset),
        'Bulk upsert dirty answers',
      );
      logger.log('[ExamStorageReal] Synced', dirty.length, 'dirty answer(s) to DB');
    } catch (err) {
      // Restore the dirty set so the next debounce tick (or flush) retries.
      // Without this, transient failures silently drop answers.
      for (const id of dirty) dirtyQuestionIdsRef.current.add(id);
      throw err;
    }
  }, [user, withRetry]);

  // ── Save state (write-through: local immediately, DB debounced) ──
  // Caller must mark which answers changed via markDirty() so syncToDb knows
  // what to send. Metadata-only changes (currentQuestionIndex, exit counters)
  // are still synced because updateAttempt runs unconditionally.
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
    }, STORAGE_CONFIG.DEBOUNCE_MS);
  }, [saveLocalState, syncToDb]);

  const saveStateSync = useCallback((state: ExamState) => {
    saveLocalState(state);
    syncToDb(state);
  }, [saveLocalState, syncToDb]);

  // Mark a specific answer as dirty (needs flushing next sync). Called from
  // useExamFlow when the user picks an option / toggles a flag.
  const markAnswerDirty = useCallback((questionId: string) => {
    dirtyQuestionIdsRef.current.add(questionId);
  }, []);

  // ── Flush before finalize ──
  // Before submitting we want EVERY answer in the DB, not just the dirty
  // ones — covers any answer that was persisted long ago and is correct in
  // the DB, but also catches drift bugs cheaply. The integrity check below
  // (ensureAllAnswersPersisted) gives us strong post-conditions.
  const flushPendingState = useCallback(async (state?: ExamState) => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const stateToSync = state || loadLocalState();
    if (!stateToSync || !attemptIdRef.current || !user) return;

    // Force the entire answer set on flush — overrides dirty-only behaviour.
    await withRetry(
      async () => simuladosApi.updateAttempt(attemptIdRef.current!, {
        current_question_index: stateToSync.currentQuestionIndex,
        tab_exit_count: stateToSync.tabExitCount,
        fullscreen_exit_count: stateToSync.fullscreenExitCount,
      }),
      'Update attempt metadata (flush)',
    );

    if (Object.keys(stateToSync.answers).length > 0) {
      await withRetry(
        async () => simuladosApi.bulkUpsertAnswers(attemptIdRef.current!, stateToSync.answers),
        'Bulk upsert ALL answers (flush)',
      );
    }
    dirtyQuestionIdsRef.current = new Set();
    pendingAnswersRef.current = {};
  }, [loadLocalState, user, withRetry]);

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
  // Returns the finalize RPC payload so callers can read score and
  // is_within_window without a follow-up SELECT (avoids race vs. replicas).
  const submitAttempt = useCallback(async (finalState: ExamState): Promise<FinalizedAttemptResult | null> => {
    await flushPendingState(finalState);
    await ensureAllAnswersPersisted(finalState);

    if (!attemptIdRef.current) {
      throw new Error('Tentativa nao inicializada para finalizacao.');
    }
    let finalizeResult: FinalizedAttemptResult | null = null;
    try {
      finalizeResult = await withRetry(
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
    return finalizeResult;
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
    /** Mark an answer changed; next debounced sync will include it. */
    markAnswerDirty,
    registerTabExit,
    registerFullscreenExit,
    setResultNotification,
    clearState,
    attemptId: attemptIdRef,
  };
}
