/**
 * useExamFlow — orchestration hook for the exam page.
 * Encapsulates: init/resume attempt, finalize, timer, focus control, keyboard shortcuts,
 * state updates, and navigation. SimuladoExamPage only composes UI from this hook.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamStorageReal } from '@/hooks/useExamStorageReal';
import { useExamTimer } from '@/hooks/useExamTimer';
import { useServerClock } from '@/hooks/useServerClock';
import { useFocusControl } from '@/hooks/useFocusControl';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useExamAnswers } from '@/hooks/exam/useExamAnswers';
import { useExamIntegrity } from '@/hooks/exam/useExamIntegrity';
import { useExamBeacon } from '@/hooks/exam/useExamBeacon';
import { useExamLifecycle } from '@/hooks/exam/useExamLifecycle';
import { useExamTabLease } from '@/hooks/useExamTabLease';
import { useExamRuntimeCapabilities } from '@/hooks/useExamRuntimeCapabilities';
import type { ExamRuntimePersistence } from '@/types/exam-runtime';
import { computeExamSummary, type ExamState, type ExamAnswer, type ConfidenceLevel } from '@/types/exam';
import type { Question } from '@/types';

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
  interactionLocked: boolean;
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
  handleSetConfidence: (level: ConfidenceLevel) => void;
  handleNavigate: (index: number) => void;
  handlePrev: () => void;
  handleNext: () => void;
  toggleReview: () => void;
  toggleHighConfidence: () => void;

  // Derived for current question
  summary: ReturnType<typeof computeExamSummary>;
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
  tabLease: ReturnType<typeof useExamTabLease>;
  preparation: { status: 'ready' | 'preparing' | 'error'; retry: () => void };
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
  const { isOnboardingComplete } = useUser();
  const { user } = useAuth();

  const { simulado, questions, loading: loadingSimulado } = useSimuladoDetail(id);
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);
  /** Sempre UUID do banco — rotas podem usar `slug`; RPCs e FK exigem UUID. */
  const clock = useServerClock(`${user?.id ?? ''}:${simulado?.id ?? ''}`);
  const { status: clockStatus, now } = clock;
  const ownershipRef = useRef<() => boolean>(() => false);
  const canWrite = useCallback(() => ownershipRef.current(), []);
  const runtimeRef = useRef<ExamRuntimePersistence>({ mode: 'pending', onMismatch: () => {} });
  const getRuntime = useCallback(() => runtimeRef.current, []);
  const storage = useExamStorageReal(simulado?.id ?? '', clock, canWrite, getRuntime);
  const capabilities = useExamRuntimeCapabilities(user?.id, storage.attemptId.current);
  const [preparedRevision, setPreparedRevision] = useState('');
  const [failedRevision, setFailedRevision] = useState('');

  const [state, setState] = useState<ExamState | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const reloadScopeRef = useRef('');
  reloadScopeRef.current = `${user?.id ?? ''}:${simulado?.id ?? ''}:${storage.attemptId.current ?? ''}`;
  const reloadForOwnership = useCallback(async (signal: AbortSignal) => {
    const scope = reloadScopeRef.current;
    const result = await storage.loadState(true, signal);
    if (signal.aborted || scope !== reloadScopeRef.current || !result.state || result.fromCache) throw new Error('Remote reload required');
    setState(result.state);
  }, [storage.loadState]);
  const tabLease = useExamTabLease(user?.id, storage.attemptId.current, reloadForOwnership);
  const knownRuntime = capabilities.mode === 'legacy' || capabilities.mode === 'v1';
  const preparationBlocked = !knownRuntime || preparedRevision !== capabilities.revision ||
    (capabilities.mode === 'v1' && clockStatus !== 'synced');
  const retryPreparation = useCallback(() => {
    runtimeRef.current.mode = 'pending';
    ownershipRef.current = () => false;
    setPreparedRevision(''); setFailedRevision('');
    capabilities.retry();
  }, [capabilities.retry]);
  runtimeRef.current = { mode: preparationBlocked ? 'pending' : capabilities.mode, onMismatch: retryPreparation };
  ownershipRef.current = () => !preparationBlocked && tabLease.canWrite();
  useEffect(() => {
    if (!knownRuntime || tabLease.status !== 'owned') return;
    const controller = new AbortController();
    const revision = capabilities.revision;
    void storage.loadState(true, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      if (!result.state || result.fromCache) throw new Error('Remote reconciliation required');
      setState(result.state); setPreparedRevision(revision); setFailedRevision('');
    }).catch(() => { if (!controller.signal.aborted) setFailedRevision(revision); });
    return () => controller.abort();
  }, [knownRuntime, capabilities.revision, tabLease.status, storage.loadState]);

  // Stable callback pattern: the focus/fullscreen handlers read from refs
  // that we keep fresh every render. This prevents useFocusControl from
  // re-registering window listeners every time `state` or `simulado` changes
  // (i.e. on every answered question).
  const stateRef = useRef(state);
  const simuladoRef = useRef(simulado);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { simuladoRef.current = simulado; }, [simulado]);
  useEffect(() => {
    setState(null);
    stateRef.current = null;
  }, [storage.userId, simulado?.id]);

  const escapeAllowedRef = useRef(false);
  const isEscapeAllowed = useCallback(() => escapeAllowedRef.current && canWrite(), [canWrite]);
  const focusControl = useExamIntegrity({
    isEscapeAllowed,
    canWrite,
    stateRef,
    simuladoRef,
    storage,
    setState,
    now,
  });

  const {
    submitting,
    interactionLocked,
    initLoading,
    isWithinWindow,
    notifyResultByEmail,
    notificationSaving,
    hasFinalized,
    finalize,
    setNotifyResultByEmail,
    timeRemaining,
  } = useExamLifecycle({
    ownershipBlocked: tabLease.blocked || preparationBlocked,
    canWrite,
    clock,
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
  });
  escapeAllowedRef.current = state?.status === 'in_progress' && !interactionLocked;

  useExamBeacon({
    getRuntime,
    canWrite,
    storage,
    stateRef,
    hasFinalized,
  });

  const currentIndex = state?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = currentQuestion ? state?.answers[currentQuestion.id] : undefined;

  const updateState = useCallback((updater: (prev: ExamState) => ExamState) => {
    setState(prev => {
      if (!canWrite() || !prev || prev.status !== 'in_progress' || interactionLocked ||
        preparationBlocked || (capabilities.mode === 'v1' && clockStatus !== 'synced') ||
        (clockStatus === 'synced' && prev.effectiveDeadline && new Date(prev.effectiveDeadline).getTime() <= now())) return prev;
      const updated = updater(prev);
      storage.saveStateDebounced(updated);
      return updated;
    });
  }, [storage, interactionLocked, clockStatus, now, canWrite, preparationBlocked, capabilities.mode]);

  const {
    handleSelectOption,
    handleEliminateOption,
    handleNavigate,
    handlePrev,
    handleNext,
    toggleReview,
    toggleHighConfidence,
    handleSetConfidence,
  } = useExamAnswers({
    now,
    versioned: capabilities.mode === 'v1',
    disabled: interactionLocked || preparationBlocked || state?.status !== 'in_progress',
    currentQuestion,
    currentIndex,
    questionsLength: questions.length,
    updateState,
    markAnswerDirty: storage.markAnswerDirty,
    setShowNavigator,
  });

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
    // Confidence shortcuts 1/2/3 (spec 04 §1.3):
    // Activates only after the aluno has selected an option — natural sequence avoids
    // collision with alternative shortcuts since confidence comes after selection.
    if (currentAnswer?.selectedOption) {
      map['1'] = () => handleSetConfidence('baixa');
      map['2'] = () => handleSetConfidence('media');
      map['3'] = () => handleSetConfidence('alta');
    }
    return map;
  }, [handlePrev, handleNext, toggleReview, toggleHighConfidence, currentQuestion, handleSelectOption, currentAnswer?.selectedOption, handleSetConfidence]);

  useKeyboardShortcuts(shortcuts, {
    enabled: state?.status === 'in_progress' && !showSubmitModal && !interactionLocked,
  });

  const loading = loadingSimulado || initLoading || !simulado || !state;
  const isCompleted = state?.status === 'submitted' || state?.status === 'expired';
  const summary = state && questionIds.length > 0 ? computeExamSummary(state, questionIds) : null;

  return {
    tabLease,
    preparation: { status: capabilities.mode === 'error' || failedRevision === capabilities.revision ? 'error' :
      preparationBlocked ? 'preparing' : 'ready', retry: retryPreparation },
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
    interactionLocked,
    notificationSaving,
    focusControl,
    timeRemaining,
    finalize,
    setNotifyResultByEmail,
    updateState,
    handleSelectOption,
    handleEliminateOption,
    handleSetConfidence,
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
