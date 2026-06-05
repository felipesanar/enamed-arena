/**
 * useExamFlow — orchestration hook for the exam page.
 * Encapsulates: init/resume attempt, finalize, timer, focus control, keyboard shortcuts,
 * state updates, and navigation. SimuladoExamPage only composes UI from this hook.
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '@/contexts/UserContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamStorageReal } from '@/hooks/useExamStorageReal';
import { useExamTimer } from '@/hooks/useExamTimer';
import { useFocusControl } from '@/hooks/useFocusControl';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { useExamAnswers } from '@/hooks/exam/useExamAnswers';
import { useExamIntegrity } from '@/hooks/exam/useExamIntegrity';
import { useExamBeacon } from '@/hooks/exam/useExamBeacon';
import { useExamLifecycle } from '@/hooks/exam/useExamLifecycle';
import { computeExamSummary, type ExamState, type ExamAnswer } from '@/types/exam';
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
  const { isOnboardingComplete } = useUser();

  const { simulado, questions, loading: loadingSimulado } = useSimuladoDetail(id);
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);
  /** Sempre UUID do banco — rotas podem usar `slug`; RPCs e FK exigem UUID. */
  const storage = useExamStorageReal(simulado?.id ?? '');

  const [state, setState] = useState<ExamState | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  // Stable callback pattern: the focus/fullscreen handlers read from refs
  // that we keep fresh every render. This prevents useFocusControl from
  // re-registering window listeners every time `state` or `simulado` changes
  // (i.e. on every answered question).
  const stateRef = useRef(state);
  const simuladoRef = useRef(simulado);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { simuladoRef.current = simulado; }, [simulado]);

  const focusControl = useExamIntegrity({
    stateRef,
    simuladoRef,
    storage,
    setState,
  });

  const {
    submitting,
    initLoading,
    isWithinWindow,
    notifyResultByEmail,
    notificationSaving,
    hasFinalized,
    finalize,
    setNotifyResultByEmail,
    timeRemaining,
  } = useExamLifecycle({
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

  useExamBeacon({
    storage,
    stateRef,
    hasFinalized,
  });

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

  const {
    handleSelectOption,
    handleEliminateOption,
    handleNavigate,
    handlePrev,
    handleNext,
    toggleReview,
    toggleHighConfidence,
  } = useExamAnswers({
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
