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
import type { ExamState } from '@/types/exam';
import type { Question, SimuladoStatus } from '@/types';

/** Subconjunto de useExamStorageReal necessário aqui. */
interface LifecycleStorage {
  loadState: () => Promise<{ state: ExamState | null; notifyResultEmail: boolean }>;
  initializeState: (
    numQuestions: number,
    durationMinutes: number,
    windowEnd: string | null | undefined,
  ) => Promise<ExamState>;
  submitAttempt: (state: ExamState) => Promise<{ is_within_window: boolean; score_percentage: number } | null>;
  setResultNotification: (enabled: boolean) => Promise<void>;
  attemptId: MutableRefObject<string | null>;
}

export interface UseExamLifecycleArgs {
  simulado: { id: string; status: SimuladoStatus; estimatedDurationMinutes: number; executionWindowEnd: string | null | undefined } | null | undefined;
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
}

export interface UseExamLifecycleReturn {
  submitting: boolean;
  initLoading: boolean;
  isWithinWindow: boolean;
  notifyResultByEmail: boolean;
  notificationSaving: boolean;
  hasFinalized: MutableRefObject<boolean>;
  finalize: (isAutoSubmit?: boolean) => Promise<void>;
  setNotifyResultByEmail: (enabled: boolean) => Promise<void>;
  timeRemaining: ReturnType<typeof useExamTimer>;
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
}: UseExamLifecycleArgs): UseExamLifecycleReturn {
  const queryClient = useQueryClient();

  const [submitting, setSubmitting] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notifyResultByEmail, setNotifyResultByEmailState] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const [isWithinWindow, setIsWithinWindow] = useState(true);
  const hasFinalized = useRef(false);
  const hasAutoSubmitTracked = useRef(false);

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
          if (existing.effectiveDeadline && new Date(existing.effectiveDeadline) <= new Date()) {
            logger.log('[useExamFlow] Deadline already passed, finalizing attempt');
            setState(existing);
            if (cancelled) return;
            const answeredBefore = Object.values(existing.answers).filter(a => !!a.selectedOption).length;
            trackEvent('exam_auto_submitted', {
              simulado_id: simulado.id,
              attempt_id: storage.attemptId.current ?? '',
              answered: answeredBefore,
              total: questions.length,
              reason: 'past_deadline_on_init',
            });
            // Will be finalized by handleTimeUp
          } else {
            setState(existing);
            if (cancelled) return;
            const answeredBefore = Object.values(existing.answers).filter(a => !!a.selectedOption).length;
            const timeElapsedMinutes = existing.startedAt
              ? Math.round((Date.now() - new Date(existing.startedAt).getTime()) / 60000)
              : 0;
            const timeRemainingSeconds = existing.effectiveDeadline
              ? Math.max(0, Math.round((new Date(existing.effectiveDeadline).getTime() - Date.now()) / 1000))
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
            logger.error('[useExamFlow] Failed to initialize exam:', initErr);
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
        logger.error('[useExamFlow] Init failed:', err);
        navigate(`/simulados/${id}`, { replace: true });
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // Intentionally re-run only on simulado identity change. Including
    // `questions.length` here previously caused redundant re-initialization
    // whenever the questions query cache refreshed mid-attempt — in the worst
    // case spawning a second `create_attempt_guarded` call. The questions
    // emptiness check is still inside the effect body, so the user still
    // bounces back to the detail page if no questions exist.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulado?.id, loadingSimulado]);

  useEffect(() => {
    setIsWithinWindow(true);
  }, [simulado?.id]);

  const finalize = useCallback(async (isAutoSubmit = false) => {
    if (hasFinalized.current || !state || !simulado) return;
    hasFinalized.current = true;
    setSubmitting(true);

    const answeredAtSubmit = Object.values(state.answers).filter((a) => !!a.selectedOption).length;

    if (!isAutoSubmit) {
      const timeRemainingAtSubmit = state.effectiveDeadline
        ? Math.max(0, Math.round((new Date(state.effectiveDeadline).getTime() - Date.now()) / 1000))
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
      const result = await storage.submitAttempt(state);
      setState(prev => prev ? { ...prev, status: 'submitted', lastSavedAt: new Date().toISOString() } : prev);

      const withinRankingWindow = result?.is_within_window ?? true;
      const scorePercentage = result?.score_percentage ?? 0;
      setIsWithinWindow(withinRankingWindow);

      const durationMinutes = state.startedAt
        ? Math.round((Date.now() - new Date(state.startedAt).getTime()) / 60000)
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
      toast({ title: 'Simulado finalizado', description: 'Suas respostas foram registradas com sucesso.' });

      // Invalidate caches so the user sees fresh data on next screen
      // (CorrecaoPage, SimuladoDetailPage, SimuladosPage list, performance summary).
      queryClient.invalidateQueries({ queryKey: ['simulado', simulado.id] });
      queryClient.invalidateQueries({ queryKey: ['simulados'] });
      queryClient.invalidateQueries({ queryKey: ['user-performance'] });
      queryClient.invalidateQueries({ queryKey: ['user-attempts'] });
    } catch (err) {
      trackEvent('exam_submit_failed', {
        simulado_id: simulado.id,
        attempt_id: storage.attemptId.current ?? '',
        error_message: err instanceof Error ? err.message : 'unknown',
        retry_count: 0,
      });
      toast({ title: 'Erro ao finalizar', description: 'Tente novamente.', variant: 'destructive' });
      hasFinalized.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [state, simulado, storage, questionIds.length, queryClient, setState, setShowSubmitModal]);

  const setNotifyResultByEmail = useCallback(async (enabled: boolean) => {
    setNotificationSaving(true);
    try {
      await storage.setResultNotification(enabled);
      setNotifyResultByEmailState(enabled);
      toast({
        title: enabled ? 'Notificação ativada' : 'Notificação desativada',
        description: enabled
          ? 'Vamos avisar por email quando o resultado for liberado.'
          : 'Você não receberá aviso por email para este simulado.',
      });
    } catch {
      toast({
        title: 'Erro ao atualizar notificação',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
    } finally {
      setNotificationSaving(false);
    }
  }, [storage]);

  const timeUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup the time-up delay timer on unmount to avoid calling finalize after unmount
  useEffect(() => {
    return () => {
      if (timeUpTimerRef.current) clearTimeout(timeUpTimerRef.current);
    };
  }, []);

  const handleTimeUp = useCallback(() => {
    toast({ title: 'Tempo esgotado!', description: 'Seu simulado foi finalizado automaticamente.' });
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
    timeUpTimerRef.current = setTimeout(() => finalize(true), 2000);
  }, [finalize, state, simulado, storage, questionIds.length]);

  const timeRemaining = useExamTimer({
    deadline: state?.effectiveDeadline ?? null,
    onTimeUp: handleTimeUp,
    paused: state?.status !== 'in_progress',
  });

  return {
    submitting,
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
