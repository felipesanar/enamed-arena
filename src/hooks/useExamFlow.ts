/**
 * useExamFlow — orchestration hook for the exam page.
 * Encapsulates: init/resume attempt, finalize, timer, focus control, keyboard shortcuts,
 * state updates, and navigation. SimuladoExamPage only composes UI from this hook.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamStorageReal } from '@/hooks/useExamStorageReal';
import { canAccessSimulado } from '@/lib/simulado-helpers';
import { useExamTimer } from '@/hooks/useExamTimer';
import { useFocusControl } from '@/hooks/useFocusControl';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { computeExamSummary, type ExamState, type ExamAnswer } from '@/types/exam';
import type { Question } from '@/types';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { logger } from '@/lib/logger';
import { supabase } from '@/integrations/supabase/client';

export interface UseExamFlowReturn {
  // Data
  simulado: ReturnType<typeof useSimuladoDetail>['simulado'];
  questions: Question[];
  questionIds: string[];
  state: ExamState | null;

  // Loading & eligibility
  loading: boolean;
  isCompleted: boolean;

  // UI state
  showNavigator: boolean;
  setShowNavigator: (v: boolean | ((prev: boolean) => boolean)) => void;
  showSubmitModal: boolean;
  setShowSubmitModal: (v: boolean | ((prev: boolean) => boolean)) => void;
  submitting: boolean;
  notificationSaving: boolean;

  // Side effects (focus, timer, finalize)
  focusControl: ReturnType<typeof useFocusControl>;
  timeRemaining: ReturnType<typeof useExamTimer>;
  finalize: (isAutoSubmit?: boolean) => Promise<void>;
  setNotifyResultByEmail: (enabled: boolean) => Promise<void>;

  // State update (debounced persist)
  updateState: (updater: (prev: ExamState) => ExamState) => void;

  // Answer & navigation handlers
  handleSelectOption: (optionId: string) => void;
  handleEliminateOption: (optionId: string) => void;
  handleNavigate: (index: number) => void;
  handlePrev: () => void;
  handleNext: () => void;
  toggleReview: () => void;
  toggleHighConfidence: () => void;

  // Derived for current question
  summary: ReturnType<typeof computeExamSummary> | null;
  currentIndex: number;
  currentQuestion: Question | undefined;
  currentAnswer: ExamAnswer | undefined;
  isReviewFlagged: boolean;
  isHighConfFlagged: boolean;
  attemptId: string | null;
  notifyResultByEmail: boolean;
  /** Após finalizar: true se a tentativa entrou na janela oficial (ranking). */
  isWithinWindow: boolean;
  saving: boolean;
}

const emptySummary = {
  total: 0,
  answered: 0,
  unanswered: 0,
  markedForReview: 0,
  highConfidence: 0,
  unansweredIndices: [] as number[],
};

export function useExamFlow(): UseExamFlowReturn {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isOnboardingComplete, profile } = useUser();

  const { simulado, questions, loading: loadingSimulado } = useSimuladoDetail(id);
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);
  /** Sempre UUID do banco — rotas podem usar `slug`; RPCs e FK exigem UUID. */
  const storage = useExamStorageReal(simulado?.id ?? '');

  const [state, setState] = useState<ExamState | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
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

        const notifEnabled = await storage.getResultNotificationPreference();
        if (!cancelled) setNotifyResultByEmailState(notifEnabled);
      } catch (err) {
        logger.error('[useExamFlow] Init failed:', err);
        navigate(`/simulados/${id}`, { replace: true });
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // Intentionally re-run only when simulado or questions change; storage/setState are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulado?.id, loadingSimulado, questions.length]);

  useEffect(() => {
    setIsWithinWindow(true);
  }, [simulado?.id]);

  // Stable callback pattern: the focus/fullscreen handlers read from refs
  // that we keep fresh every render. This prevents useFocusControl from
  // re-registering window listeners every time `state` or `simulado` changes
  // (i.e. on every answered question).
  const stateRef = useRef(state);
  const simuladoRef = useRef(simulado);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { simuladoRef.current = simulado; }, [simulado]);

  const onTabExit = useCallback(() => {
    storage.registerTabExit();
    const s = stateRef.current;
    const sim = simuladoRef.current;
    if (s && sim) {
      const timeRemainingS = s.effectiveDeadline
        ? Math.max(0, Math.round((new Date(s.effectiveDeadline).getTime() - Date.now()) / 1000))
        : 0;
      trackEvent('exam_integrity_event', {
        simulado_id: sim.id,
        attempt_id: storage.attemptId.current ?? '',
        event_type: 'tab_exit',
        count_so_far: (s.tabExitCount ?? 0) + 1,
        time_remaining_seconds: timeRemainingS,
      });
    }
  }, [storage]);

  const onTabReturn = useCallback(() => {}, []);

  const onFullscreenExit = useCallback(() => {
    storage.registerFullscreenExit();
    setState(prev => prev ? { ...prev, fullscreenExitCount: prev.fullscreenExitCount + 1 } : prev);
    const s = stateRef.current;
    const sim = simuladoRef.current;
    if (s && sim) {
      const timeRemainingS = s.effectiveDeadline
        ? Math.max(0, Math.round((new Date(s.effectiveDeadline).getTime() - Date.now()) / 1000))
        : 0;
      trackEvent('exam_integrity_event', {
        simulado_id: sim.id,
        attempt_id: storage.attemptId.current ?? '',
        event_type: 'fullscreen_exit',
        count_so_far: (s.fullscreenExitCount ?? 0) + 1,
        time_remaining_seconds: timeRemainingS,
      });
    }
    toast({
      title: 'Você saiu da tela cheia',
      description: 'Penalidade de integridade registrada. Volte para tela cheia para continuar em conformidade.',
      variant: 'destructive',
    });
  }, [storage]);

  const focusControl = useFocusControl({
    onTabExit,
    onTabReturn,
    onFullscreenExit,
  });

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
      await storage.submitAttempt(state);
      setState(prev => prev ? { ...prev, status: 'submitted', lastSavedAt: new Date().toISOString() } : prev);

      let withinRankingWindow = true;
      let scorePercentage = 0;
      if (profile?.id) {
        try {
          const attempt = await simuladosApi.getAttempt(simulado.id, profile.id, 'online');
          if (attempt && typeof attempt.is_within_window === 'boolean') {
            withinRankingWindow = attempt.is_within_window;
          }
          if (attempt && typeof attempt.score_percentage === 'number') {
            scorePercentage = attempt.score_percentage;
          }
        } catch (e) {
          logger.error('[useExamFlow] Não foi possível ler is_within_window da tentativa:', e);
        }
      }
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
      // (ResultadoPage, CorrecaoPage, SimuladosPage list, performance summary).
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
  }, [state, simulado, storage, questionIds.length, profile?.id, queryClient]);

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

  // Keep the JWT access_token fresh so beforeunload can use it (it fires
  // synchronously — we can't await getSession() at that moment).
  const accessTokenRef = useRef<string | null>(null);
  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (active) accessTokenRef.current = data.session?.access_token ?? null;
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      accessTokenRef.current = session?.access_token ?? null;
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasFinalized.current || stateRef.current?.status !== 'in_progress') return;
      storage.flushPendingState();

      // Fire-and-forget sync as last resort. Uses the user's access_token so
      // RLS policies see auth.uid() correctly (anon key would be rejected
      // or associated with the anon role, losing the write).
      const aid = storage.attemptId.current;
      const currentState = stateRef.current;
      const accessToken = accessTokenRef.current;
      if (aid && currentState && accessToken) {
        try {
          const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
          const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
          if (supabaseUrl && supabaseKey) {
            const rows = Object.entries(currentState.answers).map(([questionId, ans]) => ({
              attempt_id: aid,
              question_id: questionId,
              selected_option_id: ans.selectedOption,
              marked_for_review: ans.markedForReview,
              high_confidence: ans.highConfidence,
              eliminated_options: ans.eliminatedAlternatives || [],
              answered_at: ans.selectedOption ? new Date().toISOString() : null,
            }));
            if (rows.length > 0) {
              const url = `${supabaseUrl}/rest/v1/answers?on_conflict=attempt_id,question_id`;
              // fetch+keepalive so we can set Authorization with the user's JWT
              // (sendBeacon cannot set custom headers).
              fetch(url, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'apikey': supabaseKey,
                  'Authorization': `Bearer ${accessToken}`,
                  'Prefer': 'resolution=merge-duplicates',
                },
                body: JSON.stringify(rows),
                keepalive: true,
              }).catch(() => {});
            }
          }
        } catch {
          // best-effort, ignore errors
        }
      }

      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [storage]);

  const currentIndex = state?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? state?.answers[currentQuestion.id] : undefined;

  const updateState = useCallback((updater: (prev: ExamState) => ExamState) => {
    setState(prev => {
      if (!prev || prev.status !== 'in_progress') return prev;
      const updated = updater(prev);
      storage.saveStateDebounced(updated);
      return updated;
    });
  }, [storage]);

  const handleSelectOption = useCallback((optionId: string) => {
    if (!currentQuestion) return;
    const answer: ExamAnswer = {
      ...(state?.answers[currentQuestion.id] ?? {
        questionId: currentQuestion.id,
        selectedOption: null,
        markedForReview: false,
        highConfidence: false,
        eliminatedAlternatives: [],
      }),
      questionId: currentQuestion.id,
      selectedOption: optionId,
    };
    storage.trackAnswer(currentQuestion.id, answer);
    updateState(prev => ({
      ...prev,
      answers: { ...prev.answers, [currentQuestion.id]: answer },
    }));
  }, [currentQuestion, state?.answers, updateState, storage]);

  const handleEliminateOption = useCallback((optionId: string) => {
    if (!currentQuestion) return;
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? {
        questionId: currentQuestion.id,
        selectedOption: null,
        markedForReview: false,
        highConfidence: false,
        eliminatedAlternatives: [],
      };
      const isEliminated = existing.eliminatedAlternatives.includes(optionId);
      const answer: ExamAnswer = {
        ...existing,
        eliminatedAlternatives: isEliminated
          ? existing.eliminatedAlternatives.filter(i => i !== optionId)
          : [...existing.eliminatedAlternatives, optionId],
      };
      storage.trackAnswer(currentQuestion.id, answer);
      return { ...prev, answers: { ...prev.answers, [currentQuestion.id]: answer } };
    });
  }, [currentQuestion, updateState, storage]);

  const handleNavigate = useCallback((index: number) => {
    updateState(prev => ({ ...prev, currentQuestionIndex: index }));
    setShowNavigator(false);
  }, [updateState]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) handleNavigate(currentIndex - 1);
  }, [currentIndex, handleNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) handleNavigate(currentIndex + 1);
  }, [currentIndex, questions.length, handleNavigate]);

  const toggleReview = useCallback(() => {
    if (!currentQuestion) return;
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? {
        questionId: currentQuestion.id,
        selectedOption: null,
        markedForReview: false,
        highConfidence: false,
        eliminatedAlternatives: [],
      };
      const newVal = !existing.markedForReview;
      toast({ title: newVal ? 'Questão marcada para revisão' : 'Marcação removida' });
      return {
        ...prev,
        answers: { ...prev.answers, [currentQuestion.id]: { ...existing, markedForReview: newVal } },
      };
    });
  }, [currentQuestion, updateState]);

  const toggleHighConfidence = useCallback(() => {
    if (!currentQuestion) return;
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? {
        questionId: currentQuestion.id,
        selectedOption: null,
        markedForReview: false,
        highConfidence: false,
        eliminatedAlternatives: [],
      };
      return {
        ...prev,
        answers: { ...prev.answers, [currentQuestion.id]: { ...existing, highConfidence: !existing.highConfidence } },
      };
    });
  }, [currentQuestion, updateState]);

  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {
      ArrowLeft: handlePrev,
      ArrowRight: handleNext,
      r: toggleReview,
      R: toggleReview,
      h: toggleHighConfidence,
      H: toggleHighConfidence,
      Escape: () => setShowSubmitModal(true),
    };
    if (currentQuestion) {
      currentQuestion.options.forEach((opt, i) => {
        map[String(i + 1)] = () => handleSelectOption(opt.id);
      });
    }
    return map;
  }, [handlePrev, handleNext, toggleReview, toggleHighConfidence, currentQuestion, handleSelectOption]);

  useKeyboardShortcuts(shortcuts, {
    enabled: state?.status === 'in_progress' && !showSubmitModal && !submitting,
  });

  const loading = loadingSimulado || initLoading || !simulado || !state;
  const isCompleted = state?.status === 'submitted' || state?.status === 'expired';
  const summary = state && questionIds.length > 0 ? computeExamSummary(state, questionIds) : null;

  return {
    simulado,
    questions,
    questionIds,
    state,
    loading,
    isCompleted,
    showNavigator,
    setShowNavigator,
    showSubmitModal,
    setShowSubmitModal,
    submitting,
    notificationSaving,
    focusControl,
    timeRemaining,
    finalize,
    setNotifyResultByEmail,
    updateState,
    handleSelectOption,
    handleEliminateOption,
    handleNavigate,
    handlePrev,
    handleNext,
    toggleReview,
    toggleHighConfidence,
    summary: summary ?? emptySummary,
    currentIndex,
    currentQuestion,
    currentAnswer,
    isReviewFlagged: currentAnswer?.markedForReview ?? false,
    isHighConfFlagged: currentAnswer?.highConfidence ?? false,
    attemptId: storage.attemptId.current,
    notifyResultByEmail,
    isWithinWindow,
    saving: storage.isSaving,
  };
}
