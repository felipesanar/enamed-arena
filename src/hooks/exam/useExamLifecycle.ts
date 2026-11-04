/**
 * useExamLifecycle — ciclo de vida da prova: gate/redirect, init/resume,
 * finalize, timer e notificação por email.
 *
 * Extraído de useExamFlow (Fase 3 / REFACTOR_ROADMAP). Encapsula os estados
 * internos voláteis (submitting, initLoading, isWithinWindow, notifyResultByEmail)
 * e as refs de controle (hasFinalized, hasAutoSubmitTracked, timeUpTimerRef).
 * Recebe deps explícitas — não acessa contexto por conta própria. NÃO muda
 * comportamento, ordem de hooks, textos de toast, nem eventos de analytics.
 */
import { useState, useEffect, useCallback, useRef, type MutableRefObject } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useExamTimer } from '@/hooks/useExamTimer';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { logger } from '@/lib/logger';
import { canAccessSimulado } from '@/lib/simulado-helpers';
import { examSubmissionErrorMessage } from '@/lib/examSubmissionErrors';
import { invalidateExamQueries } from '@/lib/exam-query-cache';
import type { ExamState } from '@/types/exam';
import type { Question, SimuladoStatus } from '@/types';
import type { ServerClock } from '@/hooks/useServerClock';

/** Subconjunto de useExamStorageReal necessário aqui. */
interface LifecycleStorage {
  userId?: string;
  loadState: () => Promise<{ state: ExamState | null; notifyResultEmail: boolean }>;
  initializeState: (
    numQuestions: number,
    durationMinutes: number,
    windowEnd: string | null | undefined,
  ) => Promise<ExamState>;
  submitAttempt: (state: ExamState, isAutoSubmit?: boolean) => Promise<{ is_within_window: boolean; score_percentage: number } | null>;
  setResultNotification: (enabled: boolean) => Promise<void>;
  attemptId: MutableRefObject<string | null>;
}

export interface UseExamLifecycleArgs {
  simulado: { id: string; status: SimuladoStatus; estimatedDurationMinutes: number; executionWindowEnd: string | null | undefined; resultsReleaseAt?: string } | null | undefined;
  questions: Question[];
  questionIds: string[];
  storage: LifecycleStorage;
  id: string | undefined;
  navigate: (to: string, opts?: { replace?: boolean }) => void;
  loadingSimulado: boolean;
  isOnboardingComplete: boolean;
  /** Reactive state value (for timer and finalize snapshot). */
  state: ExamState | null;
  setState: React.Dispatch<React.SetStateAction<ExamState | null>>;
  setShowSubmitModal: React.Dispatch<React.SetStateAction<boolean>>;
  clock?: ServerClock;
  ownershipBlocked?: boolean;
  canWrite?: () => boolean;
}

export interface UseExamLifecycleReturn {
  submitting: boolean;
  interactionLocked: boolean;
  initLoading: boolean;
  isWithinWindow: boolean;
  notifyResultByEmail: boolean;
  notificationSaving: boolean;
  hasFinalized: MutableRefObject<boolean>;
  finalize: (isAutoSubmit?: boolean) => Promise<void>;
  setNotifyResultByEmail: (enabled: boolean) => Promise<void>;
  timeRemaining: ReturnType<typeof useExamTimer>;
}

function resultsReleaseCopy(value: string | undefined, now: number): string {
  const release = value ? new Date(value) : null;
  if (!release || !Number.isFinite(release.getTime())) return 'Aguarde a liberação dos resultados.';
  if (release.getTime() <= now) return 'Consulte seu resultado na área de desempenho.';
  return `Seu resultado sai em ${release.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo', day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })} (horário de Brasília).`;
}

export function useExamLifecycle({
  simulado,
  questions,
  questionIds,
  storage,
  id,
  navigate,
  loadingSimulado,
  isOnboardingComplete,
  state,
  setState,
  setShowSubmitModal,
  clock,
  ownershipBlocked = false,
  canWrite = () => true,
}: UseExamLifecycleArgs): UseExamLifecycleReturn {
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [timeExpired, setTimeExpired] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notifyResultByEmail, setNotifyResultByEmailState] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [isWithinWindow, setIsWithinWindow] = useState(true);
  const hasFinalized = useRef(false);
  const hasAutoSubmitTracked = useRef(false);
  const timeUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scopeRef = useRef({ active: true });
  const attemptIdentity = storage.attemptId.current;
  const stateMatchesSimulado = !!simulado && state?.simuladoId === simulado.id;
  const clockReady = clock?.ready ?? true;
  const clockTrusted = !clock || clock.status === 'synced';
  const now = clock?.now ?? Date.now;

  useEffect(() => {
    const scope = { active: true };
    scopeRef.current = scope;
    hasFinalized.current = false;
    hasAutoSubmitTracked.current = false;
    setTimeExpired(false);
    setSubmitting(false);
    setNotificationSaving(false);
    return () => {
      scope.active = false;
      if (timeUpTimerRef.current) clearTimeout(timeUpTimerRef.current);
      timeUpTimerRef.current = null;
    };
  }, [simulado?.id, attemptIdentity, storage.userId]);

  // ── Gate: redirect if not eligible ──
  useEffect(() => {
    if (loadingSimulado) return;
    if (!simulado || !canAccessSimulado(simulado.status) || !isOnboardingComplete) {
      navigate(simulado ? `/simulados/${id}` : '/simulados', { replace: true });
    }
  }, [simulado, loadingSimulado, isOnboardingComplete, navigate, id]);

  // ── Init or resume attempt ──
  useEffect(() => {
    if (!simulado || !id || loadingSimulado) return;
    if (questions.length === 0) {
      logger.error('[useExamFlow] Simulado has no questions, redirecting');
      toast({
        title: 'Simulado indisponível',
        description: 'Este simulado ainda não tem questões cadastradas.',
        variant: 'destructive',
      });
      navigate(`/simulados/${id}`, { replace: true });
      setInitLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await storage.loadState();
        if (cancelled) return;
        const existing = result.state;

        // Reject offline_pending or any non-online state
        if (existing && (existing.status as string) === 'offline_pending') {
          logger.log('[useExamFlow] Loaded offline_pending state, redirecting');
          navigate(`/simulados/${id}`, { replace: true });
          return;
        }

        if (existing && existing.status === 'in_progress') {
          // Guard: if deadline already passed, finalize instead of resuming with 0 timer
          if (clockTrusted && existing.effectiveDeadline && new Date(existing.effectiveDeadline).getTime() <= now()) {
            logger.log('[useExamFlow] Deadline already passed, finalizing attempt');
            setState(existing);
            if (cancelled) return;
            // Only handleTimeUp announces/tracks automatic submission.
          } else {
            setState(existing);
            if (cancelled) return;
            const answeredBefore = Object.values(existing.answers).filter(a => !!a.selectedOption).length;
            const timeElapsedMinutes = existing.startedAt
              ? Math.round((now() - new Date(existing.startedAt).getTime()) / 60000)
              : 0;
            const timeRemainingSeconds = existing.effectiveDeadline
              ? Math.max(0, Math.round((new Date(existing.effectiveDeadline).getTime() - now()) / 1000))
              : 0;
            trackEvent('exam_resumed', {
              simulado_id: simulado.id,
              attempt_id: storage.attemptId.current ?? '',
              time_elapsed_since_start_minutes: timeElapsedMinutes,
              answered_before_resume: answeredBefore,
              time_remaining_seconds: timeRemainingSeconds,
            });
            toast({ title: 'Prova retomada', description: 'Suas respostas foram recuperadas automaticamente.' });
          }
        } else if (!existing || existing.status === 'not_started') {
          // Note: starting outside the official window is allowed (treino mode).
          // The RPC create_attempt_guarded sets is_within_window=false so it
          // does not enter the ranking. Blocking here would break the
          // documented business rule (constraints/regras-de-negocio-simulados).
          try {
            const fresh = await storage.initializeState(
              questions.length,
              simulado.estimatedDurationMinutes,
              simulado.executionWindowEnd,
            );
            if (!cancelled) setState(fresh);
          } catch (initErr) {
            if (cancelled) return;
            // create_attempt_guarded blocks the online exam once the student
            // has a presencial attempt for this simulado (pending or
            // submitted) — see migration 20260812100400. The generic error
            // toast from useExamStorageReal already fired; this specific one
            // (dispatched after) is the one the user actually sees, since
            // the toast hook keeps only the latest (TOAST_LIMIT=1).
            const initErrMessage = initErr instanceof Error ? initErr.message : '';
            if (initErrMessage.includes('PRESENCIAL_ATTEMPT_EXISTS')) {
              logger.log('[useExamFlow] Blocked: presencial attempt already exists for this simulado');
              toast({
                title: 'Simulado já realizado',
                description: `Você já fez este simulado presencialmente. ${resultsReleaseCopy(simulado.resultsReleaseAt, now())}`,
                variant: 'destructive',
              });
            } else {
              logger.error('[useExamFlow] Failed to initialize exam:', initErr);
            }
            navigate(`/simulados/${id}`, { replace: true });
            return;
          }
        } else {
          if (!cancelled) setState(existing);
        }

        // loadState already returns notifyResultEmail from the same DB row —
        // no follow-up query needed.
        if (!cancelled) setNotifyResultByEmailState(result.notifyResultEmail);
      } catch (err) {
        if (cancelled) return;
        logger.error('[useExamFlow] Init failed:', err);
        navigate(`/simulados/${id}`, { replace: true });
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // Re-run on exam/account identity changes, not answer/query refreshes. Including
    // `questions.length` here previously caused redundant re-initialization
    // whenever the questions query cache refreshed mid-attempt — in the worst
    // case spawning a second `create_attempt_guarded` call. The questions
    // emptiness check is still inside the effect body, so the user still
    // bounces back to the detail page if no questions exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulado?.id, loadingSimulado, storage.userId]);

  useEffect(() => {
    setIsWithinWindow(true);
  }, [simulado?.id]);

  const finalize = useCallback(async (isAutoSubmit = false) => {
    const scope = scopeRef.current;
    if (ownershipBlocked || !canWrite() || !scope.active || hasFinalized.current || !state || !simulado || !stateMatchesSimulado || (isAutoSubmit && !clockTrusted)) return;
    hasFinalized.current = true;
    setSubmitting(true);

    const answeredAtSubmit = Object.values(state.answers).filter((a) => !!a.selectedOption).length;

    if (!isAutoSubmit) {
      const timeRemainingAtSubmit = state.effectiveDeadline
        ? Math.max(0, Math.round((new Date(state.effectiveDeadline).getTime() - now()) / 1000))
        : 0;
      trackEvent('exam_submit_attempted', {
        simulado_id: simulado.id,
        attempt_id: storage.attemptId.current ?? '',
        answered: answeredAtSubmit,
        total: questionIds.length,
        unanswered: questionIds.length - answeredAtSubmit,
        time_remaining_seconds: timeRemainingAtSubmit,
      });
    }

    try {
      // submitAttempt now returns is_within_window + score_percentage in the
      // same payload (see migration 20260516000000), so we don't need a
      // follow-up SELECT against `attempts` — that eliminated a wasted round
      // trip and a read-after-write race with replicas.
      const result = await storage.submitAttempt(state, isAutoSubmit);
      if (!scope.active) return;
      if (!result) throw new Error('Finalizacao do simulado nao retornou resultado.');
      setState(prev => prev ? { ...prev, status: 'submitted', lastSavedAt: new Date(now()).toISOString() } : prev);

      const withinRankingWindow = result?.is_within_window ?? true;
      const scorePercentage = result?.score_percentage ?? 0;
      setIsWithinWindow(withinRankingWindow);

      const durationMinutes = state.startedAt
        ? Math.round((now() - new Date(state.startedAt).getTime()) / 60000)
        : 0;
      trackEvent('simulado_completed', {
        simulado_id: simulado.id,
        attempt_id: storage.attemptId.current ?? '',
        answered: answeredAtSubmit,
        total: questionIds.length,
        score_percentage: scorePercentage,
        duration_minutes: durationMinutes,
        tab_exit_count: state.tabExitCount,
        fullscreen_exit_count: state.fullscreenExitCount,
        is_within_window: withinRankingWindow,
      });
      setShowSubmitModal(false);
      toast({ title: 'Simulado finalizado', description: `Suas respostas foram registradas com sucesso. ${resultsReleaseCopy(simulado.resultsReleaseAt, now())}` });

      // Invalidate caches so the user sees fresh data on next screen
      // (CorrecaoPage, SimuladoDetailPage, SimuladosPage list, performance summary).
      invalidateExamQueries(queryClient, storage.userId, simulado.id, id);
    } catch (err) {
      if (!scope.active) return;
      trackEvent('exam_submit_failed', {
        simulado_id: simulado.id,
        attempt_id: storage.attemptId.current ?? '',
        error_message: err instanceof Error ? err.message : 'unknown',
        retry_count: 0,
      });
      hasFinalized.current = false;
      toast({
        title: 'Erro ao finalizar', description: examSubmissionErrorMessage(err), variant: 'destructive',
        duration: Infinity,
      });
    } finally {
      if (scope.active) setSubmitting(false);
    }
  }, [state, simulado, storage, questionIds.length, queryClient, setState, setShowSubmitModal, stateMatchesSimulado, now, clockTrusted, id, ownershipBlocked, canWrite]);

  const setNotifyResultByEmail = useCallback(async (enabled: boolean) => {
    const scope = scopeRef.current;
    if (!scope.active) return;
    setNotificationSaving(true);
    try {
      await storage.setResultNotification(enabled);
      if (!scope.active) return;
      setNotifyResultByEmailState(enabled);
      toast({
        title: enabled ? 'Notificação ativada' : 'Notificação desativada',
        description: enabled
          ? 'Vamos avisar por email quando o resultado for liberado.'
          : 'Você não receberá aviso por email para este simulado.',
      });
    } catch {
      if (!scope.active) return;
      toast({
        title: 'Erro ao atualizar notificação',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      if (scope.active) setNotificationSaving(false);
    }
  }, [storage]);

  const handleTimeUp = useCallback(() => {
    const scope = scopeRef.current;
    if (!clockTrusted || ownershipBlocked || !canWrite() || !scope.active || !stateMatchesSimulado) return;
    setTimeExpired(true);
    toast({ title: 'Tempo esgotado!', description: 'Aguarde a confirmação da finalização automática.' });
    if (!hasAutoSubmitTracked.current && state && simulado) {
      hasAutoSubmitTracked.current = true;
      const answeredCount = Object.values(state.answers).filter((a) => !!a.selectedOption).length;
      trackEvent('exam_auto_submitted', {
        simulado_id: simulado.id,
        attempt_id: storage.attemptId.current ?? '',
        answered: answeredCount,
        total: questionIds.length,
        reason: 'timer_expired',
      });
    }
    timeUpTimerRef.current = setTimeout(() => { if (scope.active) void finalize(true); }, 2000);
  }, [finalize, state, simulado, storage, questionIds.length, stateMatchesSimulado, ownershipBlocked, canWrite, clockTrusted]);

  const allowTimeUp = useCallback(() => clockTrusted && !ownershipBlocked && canWrite(),
    [clockTrusted, ownershipBlocked, canWrite]);

  const timeRemaining = useExamTimer({
    attemptKey: `${storage.userId ?? ''}:${simulado?.id ?? ''}:${attemptIdentity ?? ''}`,
    deadline: stateMatchesSimulado ? state?.effectiveDeadline ?? null : null,
    onTimeUp: handleTimeUp,
    paused: state?.status !== 'in_progress',
    now,
    clockReady,
    allowTimeUp,
  });

  return {
    submitting,
    interactionLocked: ownershipBlocked || !stateMatchesSimulado || !clockReady || timeExpired || submitting || (clockTrusted && state?.status === 'in_progress' && !!state.effectiveDeadline && new Date(state.effectiveDeadline).getTime() <= now()),
    initLoading,
    isWithinWindow,
    notifyResultByEmail,
    notificationSaving,
    hasFinalized,
    finalize,
    setNotifyResultByEmail,
    timeRemaining,
  };
}
