/**
 * Real exam storage — persists attempt + answers in Supabase.
 * Maintains localStorage as fast write-through cache for UX (debounced sync to DB).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { simuladosApi } from '@/services/simuladosApi';
import { answerRows, assertAnswerRowsAccepted, examAnswersApi } from '@/services/examAnswersApi';
import type { ExamRuntimePersistence } from '@/types/exam-runtime';
import { pendingAnswerWins } from '@/lib/exam-answer-version';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import type { ExamState, ExamAnswer } from '@/types/exam';
import type { FinalizedAttemptResult } from '@/services/simuladosApi';
import type { ServerClock } from '@/hooks/useServerClock';
import { isExamState, readExamCache, readActiveExamCache, writeExamCache, removeExamCache } from '@/lib/exam-cache';

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

export interface LoadStateResult {
  state: ExamState | null;
  fromCache: boolean;
  /** Pre-fetched in the same round trip as the attempt — saves a query. */
  notifyResultEmail: boolean;
}

interface StorageScope {
  simuladoId: string;
  userId?: string;
  active: boolean;
  queue?: Promise<unknown>;
  syncingSnapshot?: string;
}

interface AttemptOperation {
  readonly attemptId: string;
  readonly simuladoId: string;
  readonly userId: string;
  readonly scope: StorageScope;
}

function snapshotState(state: ExamState, simuladoId: string): ExamState {
  if (state.simuladoId !== simuladoId) throw new Error('Estado de outro simulado.');
  return {
    ...state,
    answers: Object.fromEntries(Object.entries(state.answers).map(([id, answer]) => [id, {
      ...answer, eliminatedAlternatives: [...answer.eliminatedAlternatives],
    }])),
  };
}

const syncKey = (state: ExamState, attemptId: string) => JSON.stringify({ ...state, lastSavedAt: '', attemptId });

const allowPersistence = () => true;
const unknownRuntime = (): ExamRuntimePersistence => ({ mode: 'pending', onMismatch: () => {} });
export function useExamStorageReal(simuladoId: string, clock?: ServerClock, canWrite: () => boolean = allowPersistence,
  getRuntime: () => ExamRuntimePersistence = unknownRuntime) {
  const { user } = useAuth();
  const now = clock?.now ?? Date.now;
  const clockTrusted = !clock || clock.status === 'synced';
  const debouncedSaveRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptIdRef = useRef<string | null>(null);
  // Dirty set: question IDs whose answer changed since the last DB sync.
  // bulkUpsertAnswers only writes these, instead of re-sending every answer
  // every debounce tick — keeps payloads small even on 200+ question exams.
  const dirtyQuestionIdsRef = useRef({ attemptId: null as string | null, ids: new Set<string>(), revisions: new Map<string, number>() });
  const revisionRef = useRef(0);
  const latestRef = useRef<{ state: ExamState; operation: AttemptOperation } | null>(null);
  const cleanupFlushRef = useRef<() => void>(() => {});
  const scopeRef = useRef<StorageScope>({ simuladoId, active: true });
  const [isSaving, setIsSaving] = useState(false);
  const canWriteRef = useRef(canWrite);
  const runtimeRef = useRef(getRuntime);
  runtimeRef.current = getRuntime;
  canWriteRef.current = canWrite;
  const assertOwner = useCallback(() => {
    if (!canWriteRef.current()) throw new Error('TAB_NOT_OWNER');
  }, []);

  useEffect(() => {
    const scope = { simuladoId, userId: user?.id, active: true };
    scopeRef.current = scope;
    attemptIdRef.current = null;
    dirtyQuestionIdsRef.current = { attemptId: null, ids: new Set(), revisions: new Map() };
    latestRef.current = null;
    setIsSaving(false);
    return () => {
      cleanupFlushRef.current();
      scope.active = false;
      if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
      debouncedSaveRef.current = null;
    };
  }, [simuladoId, user?.id]);

  const captureOperation = useCallback((state?: ExamState): AttemptOperation | null => {
    const scope = scopeRef.current;
    if (!scope.active || scope.simuladoId !== simuladoId || scope.userId !== user?.id || (state && state.simuladoId !== simuladoId)) {
      throw new Error('Operacao de outro simulado ou encerrada.');
    }
    const attemptId = attemptIdRef.current;
    return attemptId && user ? { attemptId, simuladoId, userId: user.id, scope } : null;
  }, [simuladoId, user]);

  const isOperationActive = useCallback((operation: AttemptOperation) => (
    operation.scope.active && scopeRef.current === operation.scope && attemptIdRef.current === operation.attemptId
  ), []);

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
        assertOwner();
        const result = await operation();
        assertOwner();
        return result;
      } catch (error) {
        lastError = error;
        if (error instanceof Error && ['TAB_NOT_OWNER', 'ANSWER_WRITE_MISMATCH', 'EXAM_RUNTIME_PENDING', 'CLOCK_UNAVAILABLE'].includes(error.message)) throw error;
        const isLast = i === attempts - 1;
        logger.warn(`[ExamStorageReal] ${label} failed (attempt ${i + 1}/${attempts})`);
        if (!isLast) {
          await sleep(baseDelayMs * (i + 1));
        }
      }
    }
    // Keep PostgREST's structured code/message for finalization error mapping.
    throw lastError;
  }, [assertOwner]);

  const requireRuntime = useCallback(() => {
    const runtime = runtimeRef.current();
    if (runtime.mode !== 'legacy' && runtime.mode !== 'v1') throw new Error('EXAM_RUNTIME_PENDING');
    if (runtime.mode === 'v1' && !clockTrusted) throw new Error('CLOCK_UNAVAILABLE');
    return { ...runtime, mode: runtime.mode };
  }, [clockTrusted]);

  const persistAnswers = useCallback(async (operation: AttemptOperation, answers: Record<string, ExamAnswer>) => {
    const runtime = requireRuntime();
    try {
      await examAnswersApi.bulkUpsertAnswers(operation.attemptId, answers, runtime.mode);
    } catch (error) {
      if (error instanceof Error && error.message === 'ANSWER_WRITE_MISMATCH' && isOperationActive(operation)) runtime.onMismatch();
      throw error;
    }
  }, [requireRuntime, isOperationActive]);

  // ── Local cache read ──
  const loadLocalState = useCallback((): ExamState | null => {
    if (!user || scopeRef.current.userId !== user.id) return null;
    const cache = attemptIdRef.current
      ? readExamCache({ userId: user.id, attemptId: attemptIdRef.current, simuladoId })
      : readActiveExamCache(user.id, simuladoId);
    return cache?.state ?? null;
  }, [simuladoId, user]);

  // ── Local cache write ──
  const saveLocalState = useCallback((state: ExamState) => {
    if (state.simuladoId !== simuladoId) throw new Error('Estado de outro simulado.');
    const operation = captureOperation(state);
    if (!operation) return;
    const latest = latestRef.current;
    const previous = latest?.operation.attemptId === operation.attemptId && latest.operation.scope === operation.scope ? latest.state : null;
    const snapshot = snapshotState({ ...state,
      tabExitCount: Math.max(state.tabExitCount, previous?.tabExitCount ?? 0),
      fullscreenExitCount: Math.max(state.fullscreenExitCount, previous?.fullscreenExitCount ?? 0),
      lastSavedAt: clockTrusted
      ? new Date(now()).toISOString() : state.lastSavedAt }, simuladoId);
    latestRef.current = { state: snapshot, operation };
    const bucket = dirtyQuestionIdsRef.current;
    if (canWriteRef.current()) writeExamCache(operation, snapshot, snapshot.status === 'in_progress' && bucket.attemptId === operation.attemptId ? [...bucket.ids] : []);
  }, [simuladoId, captureOperation, now, clockTrusted]);

  // ── Load from Supabase (or local cache as fallback) ──
  const loadState = useCallback(async (requireRemote = false, signal?: AbortSignal): Promise<LoadStateResult> => {
    const scope = scopeRef.current;
    const initialAttemptId = attemptIdRef.current;
    if (!scope.active || scope.simuladoId !== simuladoId) throw new Error('Operacao de outro simulado ou encerrada.');
    if (!user) return { state: null, fromCache: false, notifyResultEmail: false };
    let knownAttempt: Awaited<ReturnType<typeof simuladosApi.getAttempt>> = null;

    try {
      const attempt = await simuladosApi.getAttempt(simuladoId, user.id, 'online');
      if (signal?.aborted) throw new Error('Ownership sync cancelled');
      knownAttempt = attempt;
      if (!attempt) {
        // Preserve pending cache from another attempt; no identity can be inferred.
        return { state: null, fromCache: false, notifyResultEmail: false };
      }

      if (scope.active && scopeRef.current === scope) attemptIdRef.current = attempt.id;

      const answerRows = await simuladosApi.getAnswers(attempt.id);
      if (signal?.aborted) throw new Error('Ownership sync cancelled');
      const answers: Record<string, ExamAnswer> = {};
      answerRows.forEach(a => {
        answers[a.question_id] = {
          questionId: a.question_id,
          selectedOption: a.selected_option_id,
          markedForReview: a.marked_for_review,
          highConfidence: a.high_confidence,
          eliminatedAlternatives: a.eliminated_options || [],
          confidence: (a as any).confidence ?? null,
          clientUpdatedAt: (a as typeof a & { client_updated_at?: string | null }).client_updated_at ?? null,
          answeredAt: a.answered_at ?? null,
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

      if (scope.active && scopeRef.current === scope && attemptIdRef.current === attempt.id) {
        const cache = readExamCache({ userId: user.id, attemptId: attempt.id, simuladoId });
        // A remote version wins ties and prevents stale offline cache replay.
        if (state.status === 'in_progress' && cache?.state.status === 'in_progress' && cache.dirtyQuestionIds.length) {
          const bucket = dirtyQuestionIdsRef.current;
          if (bucket.attemptId !== attempt.id) {
            dirtyQuestionIdsRef.current = { attemptId: attempt.id, ids: new Set(), revisions: new Map() };
          }
          for (const id of cache.dirtyQuestionIds) {
            const pending = cache.state.answers[id];
            if (!pending || !pendingAnswerWins(pending.clientUpdatedAt, state.answers[id]?.clientUpdatedAt)) {
              dirtyQuestionIdsRef.current.ids.delete(id);
              dirtyQuestionIdsRef.current.revisions.delete(id);
              continue;
            }
            state.answers[id] = pending;
            dirtyQuestionIdsRef.current.ids.add(id);
            dirtyQuestionIdsRef.current.revisions.set(id, ++revisionRef.current);
          }
          state.currentQuestionIndex = cache.state.currentQuestionIndex;
          state.tabExitCount = Math.max(state.tabExitCount, cache.state.tabExitCount);
          state.fullscreenExitCount = Math.max(state.fullscreenExitCount, cache.state.fullscreenExitCount);
        }
        saveLocalState(state);
        if (canWriteRef.current() && state.status === 'in_progress' && dirtyQuestionIdsRef.current.ids.size) cleanupFlushRef.current();
      }
      logger.log('[ExamStorageReal] Loaded from Supabase, status:', state.status);
      // notify_result_email already comes with the attempt row; expose it so
      // callers don't need a follow-up getAttempt() to read it.
      return {
        state,
        fromCache: false,
        notifyResultEmail: Boolean(attempt.notify_result_email),
      };
    } catch (err) {
      if (requireRemote) throw err;
      if (!scope.active) throw err;
      logger.error('[ExamStorageReal] DB load failed, using local cache');
      trackEvent('exam_storage_fallback', {
        simulado_id: simuladoId,
        attempt_id: initialAttemptId ?? undefined,
        error_message: err instanceof Error ? err.message : 'unknown',
        fallback_source: 'localStorage',
      });
      toast({
        title: 'Dados carregados do cache local',
        description: 'Algumas respostas podem não estar sincronizadas.',
        variant: 'destructive',
      });
      const cache = knownAttempt
        ? readExamCache({ userId: user.id, simuladoId, attemptId: knownAttempt.id })
        : readActiveExamCache(user.id, simuladoId);
      if (knownAttempt?.status === 'submitted' || knownAttempt?.status === 'expired') {
        const terminal: ExamState = { simuladoId, status: knownAttempt.status,
          answers: cache?.state.answers ?? {}, currentQuestionIndex: knownAttempt.current_question_index,
          tabExitCount: knownAttempt.tab_exit_count, fullscreenExitCount: knownAttempt.fullscreen_exit_count,
          startedAt: knownAttempt.started_at, effectiveDeadline: knownAttempt.effective_deadline, lastSavedAt: knownAttempt.last_saved_at };
        saveLocalState(terminal);
        return { state: terminal, fromCache: true, notifyResultEmail: Boolean(knownAttempt.notify_result_email) };
      }
      if (knownAttempt && !cache) throw err;
      if (cache && scopeRef.current === scope) {
        attemptIdRef.current = cache.attemptId;
        dirtyQuestionIdsRef.current = { attemptId: cache.attemptId, ids: new Set(cache.dirtyQuestionIds),
          revisions: new Map(cache.dirtyQuestionIds.map(id => [id, ++revisionRef.current])) };
        latestRef.current = { state: cache.state, operation: { ...cache, scope } };
      }
      return { state: cache?.state ?? null, fromCache: true, notifyResultEmail: false };
    }
  }, [simuladoId, user, saveLocalState]);

  // ── Initialize a new attempt ──
  const initializeState = useCallback(async (
    questionsCount: number,
    durationMinutes: number,
    windowEndISO: string,
  ): Promise<ExamState> => {
    const scope = scopeRef.current;
    if (!scope.active || scope.simuladoId !== simuladoId) throw new Error('Operacao de outro simulado ou encerrada.');
    const started = new Date(now());
    const personalDeadline = new Date(started.getTime() + durationMinutes * 60 * 1000);
    const windowDeadline = new Date(windowEndISO);
    const effectiveDeadline = personalDeadline < windowDeadline ? personalDeadline : windowDeadline;

    const state: ExamState = {
      simuladoId,
      currentQuestionIndex: 0,
      answers: {},
      tabExitCount: 0,
      fullscreenExitCount: 0,
      startedAt: started.toISOString(),
      effectiveDeadline: effectiveDeadline.toISOString(),
      lastSavedAt: started.toISOString(),
      status: 'in_progress',
    };

    if (user) {
      try {
        const attempt = await simuladosApi.createAttempt(
          simuladoId,
          user.id,
          effectiveDeadline.toISOString(),
        );
        if (scope.active) attemptIdRef.current = attempt.id;
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
        if (!scope.active) throw err;
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

    if (scope.active) saveLocalState(state);
    return state;
  }, [simuladoId, user, saveLocalState, now]);

  // ── Debounced sync to Supabase ──
  // Writes only the answers marked dirty since the last successful sync,
  // not the entire answer map. Cuts ~98% of payload on long exams.
  const syncToDb = useCallback(async (
    state: ExamState,
    operation = captureOperation(state),
    allAnswers = false,
  ) => {
    if (!operation || !canWriteRef.current()) return;
    const runtime = requireRuntime();
    const snapshot = snapshotState(state, operation.simuladoId);
    const bucket = dirtyQuestionIdsRef.current;
    // Capture revisions before awaiting, but retain dirty IDs until their ACK.
    const dirty = bucket.attemptId === operation.attemptId ? [...bucket.ids] : [];
    const revisions = new Map(dirty.map(id => [id, bucket.revisions.get(id)]));
    const sendAll = allAnswers && runtime.mode === 'legacy';
    const subset: Record<string, ExamAnswer> = sendAll ? snapshot.answers : {};
    if (!sendAll) {
      for (const id of dirty) {
        if (snapshot.answers[id]) subset[id] = snapshot.answers[id];
      }
    }

    const previous = operation.scope.queue;
    const key = syncKey(snapshot, operation.attemptId);
    operation.scope.syncingSnapshot = key;
    let release!: () => void;
    operation.scope.queue = new Promise<void>(resolve => { release = resolve; });
    try {
      if (previous) await previous;
      assertOwner();
      await withRetry(
        async () => simuladosApi.updateAttempt(operation.attemptId, {
          current_question_index: snapshot.currentQuestionIndex,
          tab_exit_count: snapshot.tabExitCount,
          fullscreen_exit_count: snapshot.fullscreenExitCount,
        }),
        'Update attempt metadata',
      );
      if (Object.keys(subset).length > 0) {
        await withRetry(
          async () => persistAnswers(operation, subset),
          allAnswers ? 'Bulk upsert ALL answers (flush)' : 'Bulk upsert dirty answers',
        );
        logger.log('[ExamStorageReal] Synced', Object.keys(subset).length, 'answer(s) to DB');
      }
      for (const id of dirty) {
        if (snapshot.answers[id] && bucket.revisions.get(id) === revisions.get(id)) {
          bucket.ids.delete(id);
          bucket.revisions.delete(id);
        }
      }
      const latest = latestRef.current;
      if (isOperationActive(operation) && latest?.operation.attemptId === operation.attemptId && latest.operation.scope === operation.scope) {
        writeExamCache(operation, latest.state, [...bucket.ids]);
      }
    } finally {
      if (operation.scope.syncingSnapshot === key) operation.scope.syncingSnapshot = undefined;
      release();
    }
  }, [captureOperation, isOperationActive, withRetry, assertOwner, persistAnswers, requireRuntime]);

  // ── Save state (write-through: local immediately, DB debounced) ──
  // Caller must mark which answers changed via markDirty() so syncToDb knows
  // what to send. Metadata-only changes (currentQuestionIndex, exit counters)
  // are still synced because updateAttempt runs unconditionally.
  const saveStateDebounced = useCallback((state: ExamState) => {
    if (!canWriteRef.current()) return;
    const operation = captureOperation(state);
    const snapshot = snapshotState(state, simuladoId);
    saveLocalState(snapshot);
    setIsSaving(!!operation);

    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const timer = setTimeout(() => {
      syncToDb(snapshot, operation).catch(() => {
        logger.error('[ExamStorageReal] Debounced DB sync failed');
      }).finally(() => {
        if (operation && isOperationActive(operation) && debouncedSaveRef.current === timer) setIsSaving(false);
      });
    }, STORAGE_CONFIG.DEBOUNCE_MS);
    debouncedSaveRef.current = timer;
  }, [captureOperation, simuladoId, saveLocalState, syncToDb, isOperationActive]);

  const saveStateSync = useCallback((state: ExamState) => {
    if (!canWriteRef.current()) return;
    const operation = captureOperation(state);
    saveLocalState(state);
    void syncToDb(state, operation).catch(() => logger.error('[ExamStorageReal] DB sync failed'));
  }, [captureOperation, saveLocalState, syncToDb]);

  // Mark a specific answer as dirty (needs flushing next sync). Called from
  // useExamFlow when the user picks an option / toggles a flag.
  const markAnswerDirty = useCallback((questionId: string) => {
    if (!canWriteRef.current()) return;
    if (!scopeRef.current.active || scopeRef.current.simuladoId !== simuladoId || scopeRef.current.userId !== user?.id) return;
    const attemptId = attemptIdRef.current;
    if (dirtyQuestionIdsRef.current.attemptId !== attemptId) {
      dirtyQuestionIdsRef.current = { attemptId, ids: new Set(), revisions: new Map() };
    }
    dirtyQuestionIdsRef.current.ids.add(questionId);
    dirtyQuestionIdsRef.current.revisions.set(questionId, ++revisionRef.current);
  }, [simuladoId, user?.id]);

  // ── Flush before finalize ──
  // Before submitting we want EVERY answer in the DB, not just the dirty
  // ones — covers any answer that was persisted long ago and is correct in
  // the DB, but also catches drift bugs cheaply. The integrity check below
  // (ensureAllAnswersPersisted) gives us strong post-conditions.
  const flushPendingState = useCallback(async (state?: ExamState, operation = captureOperation(state)) => {
    if (!operation) return;
    if (isOperationActive(operation) && debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const latest = latestRef.current;
    const stateToSync = state || (latest?.operation.scope === operation.scope && latest.operation.attemptId === operation.attemptId
      ? latest.state : loadLocalState());
    if (stateToSync) await syncToDb(stateToSync, operation, true);
  }, [captureOperation, isOperationActive, loadLocalState, syncToDb]);

  const flushLatest = useCallback(() => {
    const latest = latestRef.current;
    if (!latest || !isOperationActive(latest.operation) || latest.state.status !== 'in_progress') return;
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    if (latest.operation.scope.syncingSnapshot === syncKey(latest.state, latest.operation.attemptId)) return;
    void syncToDb(latest.state, latest.operation).catch(() => logger.error('[ExamStorageReal] Lifecycle flush failed'));
  }, [isOperationActive, syncToDb]);
  cleanupFlushRef.current = flushLatest;
  useEffect(() => {
    const hidden = () => { if (document.visibilityState === 'hidden') flushLatest(); };
    window.addEventListener('online', flushLatest);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('online', flushLatest);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, [flushLatest]);

  const getPersistenceSnapshot = useCallback(() => {
    if (!canWriteRef.current()) return null;
    const latest = latestRef.current;
    return latest && isOperationActive(latest.operation) && isExamState(latest.state) && latest.state.status === 'in_progress'
      ? { ...latest.operation, state: snapshotState(latest.state, latest.operation.simuladoId) } : null;
  }, [isOperationActive]);

  const ensureAllAnswersPersisted = useCallback(async (finalState: ExamState, operation = captureOperation(finalState)) => {
    if (!operation) return;
    const snapshot = snapshotState(finalState, operation.simuladoId);

    const runtime = requireRuntime();
    if (runtime.mode === 'legacy' && Object.keys(snapshot.answers).length > 0) {
      await withRetry(
        async () => persistAnswers(operation, snapshot.answers),
        'Final answers upsert',
      );
    }

    const persistedAnswers = await withRetry(
      async () => simuladosApi.getAnswers(operation.attemptId),
      'Load persisted answers for integrity check',
    );
    const persistedQuestionIds = new Set(persistedAnswers.map(a => a.question_id));
    if (runtime.mode === 'v1') {
      const expected = answerRows(operation.attemptId, snapshot.answers, 'v1');
      try { assertAnswerRowsAccepted(expected, persistedAnswers.filter(a => !!snapshot.answers[a.question_id])); }
      catch (error) { if (isOperationActive(operation)) runtime.onMismatch(); throw error; }
    }
    const missing = Object.keys(snapshot.answers).filter(questionId => !persistedQuestionIds.has(questionId));
    if (missing.length > 0) {
      throw new Error(`Respostas pendentes de persistencia: ${missing.length}`);
    }
  }, [captureOperation, withRetry, requireRuntime, persistAnswers, isOperationActive]);

  // ── Submit (finalize) ──
  // Returns the finalize RPC payload so callers can read score and
  // is_within_window without a follow-up SELECT (avoids race vs. replicas).
  const submitAttempt = useCallback(async (finalState: ExamState, isAutoSubmit = false): Promise<FinalizedAttemptResult> => {
    assertOwner();
    requireRuntime();
    if (!user) throw new Error('SESSION_EXPIRED');
    const operation = captureOperation(finalState);
    if (!operation) {
      throw new Error('Tentativa nao inicializada para finalizacao.');
    }
    if (isAutoSubmit && !clockTrusted) throw new Error('CLOCK_UNAVAILABLE');
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const snapshot = snapshotState(finalState, operation.simuladoId);
    const deadline = snapshot.effectiveDeadline ? new Date(snapshot.effectiveDeadline).getTime() : Infinity;
    const submittedAt = now();
    const expired = clockTrusted && submittedAt >= deadline;
    // After the write grace period, finalize persisted answers as-is. Rewriting
    // them would be rejected by the answer deadline guard, blocking the score.
    if (!clockTrusted || submittedAt <= deadline + 30_000) {
      if (isAutoSubmit || expired) {
        await syncToDb(snapshot, operation);
      } else {
        await flushPendingState(snapshot, operation);
        await ensureAllAnswersPersisted(snapshot, operation);
      }
    } else if (dirtyQuestionIdsRef.current.attemptId === operation.attemptId && dirtyQuestionIdsRef.current.ids.size) {
      // Do not convert an unacknowledged cache into a successful terminal state.
      // The server owns the deadline; late local intent remains for reconciliation.
      throw new Error(`Respostas pendentes de persistencia: ${dirtyQuestionIdsRef.current.ids.size}`);
    }
    let finalizeResult: FinalizedAttemptResult | null = null;
    assertOwner();
    try {
      finalizeResult = await withRetry(
        async () => simuladosApi.submitAttempt(operation.attemptId, isAutoSubmit),
        'Finalize attempt server-side',
      );
    } catch (error) {
      // Fail-safe path: enqueue for server-side reprocessing and bubble a clear error.
      // A rejected manual incomplete submission must not become an early auto-submit.
      if (canWriteRef.current() && (isAutoSubmit || expired)) {
        try {
          await simuladosApi.enqueueAttemptReprocessing(
            operation.attemptId,
            'Finalizacao automatica falhou no client; reprocessamento solicitado.',
          );
        } catch (queueError) {
          logger.error('[ExamStorageReal] Could not enqueue finalization:', queueError);
        }
      }
      throw error;
    }
    if (!finalizeResult) throw new Error('Finalizacao do simulado nao retornou resultado.');

    const submitted: ExamState = { ...snapshot, status: 'submitted', lastSavedAt: new Date(now()).toISOString() };
    if (isOperationActive(operation)) saveLocalState(submitted);
    logger.log('[ExamStorageReal] Attempt submitted');
    return finalizeResult;
  }, [user, captureOperation, syncToDb, flushPendingState, ensureAllAnswersPersisted, withRetry, saveLocalState, isOperationActive, now, clockTrusted, requireRuntime]);

  // ── Integrity events ──
  const registerIntegrityExit = useCallback((state: ExamState, field: 'tabExitCount' | 'fullscreenExitCount') => {
    if (!canWriteRef.current()) return null;
    const operation = captureOperation(state);
    if (!operation || state.status !== 'in_progress') return null;
    const latest = latestRef.current;
    const previous = latest?.operation.attemptId === operation.attemptId && latest.operation.scope === operation.scope ? latest.state : null;
    const updated = { ...state,
      tabExitCount: Math.max(state.tabExitCount, previous?.tabExitCount ?? 0),
      fullscreenExitCount: Math.max(state.fullscreenExitCount, previous?.fullscreenExitCount ?? 0),
    };
    updated[field] += 1;
    saveStateSync(updated);
    return updated;
  }, [captureOperation, saveStateSync]);
  const registerTabExit = useCallback((state: ExamState) => registerIntegrityExit(state, 'tabExitCount'), [registerIntegrityExit]);
  const registerFullscreenExit = useCallback((state: ExamState) => registerIntegrityExit(state, 'fullscreenExitCount'), [registerIntegrityExit]);

  const clearState = useCallback(() => {
    if (debouncedSaveRef.current) clearTimeout(debouncedSaveRef.current);
    const operation = captureOperation();
    if (operation) removeExamCache(operation);
    latestRef.current = null;
  }, [captureOperation]);

  const setResultNotification = useCallback(async (enabled: boolean) => {
    assertOwner();
    const operation = captureOperation();
    if (!operation) return;
    await simuladosApi.setAttemptResultNotification(operation.attemptId, enabled);
  }, [captureOperation]);

  return {
    isSaving,
    userId: user?.id,
    getPersistenceSnapshot,
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
