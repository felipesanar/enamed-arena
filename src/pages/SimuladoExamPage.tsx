import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/contexts/UserContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useExamStorageReal } from '@/hooks/useExamStorageReal';
import { canAccessSimulado } from '@/lib/simulado-helpers';
import { useExamTimer } from '@/hooks/useExamTimer';
import { useFocusControl } from '@/hooks/useFocusControl';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';
import { ExamHeader } from '@/components/exam/ExamHeader';
import { QuestionDisplay } from '@/components/exam/QuestionDisplay';
import { QuestionNavigator } from '@/components/exam/QuestionNavigator';
import { SubmitConfirmModal } from '@/components/exam/SubmitConfirmModal';
import { ExamCompletedScreen } from '@/components/exam/ExamCompletedScreen';
import { computeExamSummary, type ExamState, type ExamAnswer } from '@/types/exam';
import { computeSimuladoScore } from '@/lib/resultHelpers';
import { Flag, Zap, ChevronLeft, ChevronRight, Grid3X3, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function SimuladoExamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnboardingComplete } = useUser();

  const { simulado, questions, loading: loadingSimulado } = useSimuladoDetail(id);
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);

  const storage = useExamStorageReal(id || '');
  const [state, setState] = useState<ExamState | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [initLoading, setInitLoading] = useState(true);
  const hasFinalized = useRef(false);

  console.log('[SimuladoExamPage] Rendering, id:', id, 'state status:', state?.status);

  // ── Gate: redirect if not eligible ──
  useEffect(() => {
    if (loadingSimulado) return;
    if (!simulado || !canAccessSimulado(simulado.status) || !isOnboardingComplete) {
      console.log('[SimuladoExamPage] Not eligible, redirecting');
      navigate(simulado ? `/simulados/${id}` : '/simulados', { replace: true });
    }
  }, [simulado, loadingSimulado, isOnboardingComplete, navigate, id]);

  // ── Init or resume attempt (Academy pattern — now async) ──
  useEffect(() => {
    if (!simulado || !id || loadingSimulado || questions.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const existing = await storage.loadState();

        if (cancelled) return;

        if (existing && existing.status === 'in_progress') {
          console.log('[SimuladoExamPage] Resuming existing attempt');
          setState(existing);
          toast({ title: 'Prova retomada', description: 'Suas respostas foram recuperadas automaticamente.' });
        } else if (!existing || existing.status === 'not_started') {
          const fresh = await storage.initializeState(
            questions.length,
            simulado.estimatedDurationMinutes,
            simulado.executionWindowEnd,
          );
          if (!cancelled) {
            setState(fresh);
            console.log('[SimuladoExamPage] Created fresh attempt');
          }
        } else {
          // submitted/expired
          if (!cancelled) setState(existing);
        }
      } catch (err) {
        console.error('[SimuladoExamPage] Init error:', err);
        // Fallback to local
        const local = storage.loadLocalState();
        if (!cancelled && local) setState(local);
      } finally {
        if (!cancelled) setInitLoading(false);
      }
    })();

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [simulado?.id, loadingSimulado, questions.length]);

  // ── Focus control ──
  const focusControl = useFocusControl({
    onTabExit: () => {
      storage.registerTabExit();
      console.log('[SimuladoExamPage] Tab exit registered');
    },
    onTabReturn: () => {},
    onFullscreenExit: () => {
      storage.registerFullscreenExit();
    },
  });

  // ── Finalize ──
  const finalize = useCallback(async () => {
    if (hasFinalized.current || !state || !simulado) return;
    hasFinalized.current = true;
    setSubmitting(true);

    try {
      // Calculate score
      const score = computeSimuladoScore(state, questions);

      await storage.submitAttempt(
        score.percentageScore,
        score.totalCorrect,
        score.totalAnswered,
        state,
      );

      const submitted: ExamState = {
        ...state,
        status: 'submitted',
        lastSavedAt: new Date().toISOString(),
      };
      setState(submitted);
      setShowSubmitModal(false);

      console.log('[SimuladoExamPage] Exam finalized, score:', score.percentageScore);
      toast({ title: 'Simulado finalizado', description: 'Suas respostas foram registradas com sucesso.' });
    } catch (err) {
      console.error('[SimuladoExamPage] Finalize error:', err);
      toast({ title: 'Erro ao finalizar', description: 'Tente novamente.', variant: 'destructive' });
      hasFinalized.current = false;
    } finally {
      setSubmitting(false);
    }
  }, [state, simulado, questions, storage]);

  // ── Timer ──
  const handleTimeUp = useCallback(() => {
    console.log('[SimuladoExamPage] Time up — auto-finalizing');
    toast({ title: 'Tempo esgotado!', description: 'Seu simulado foi finalizado automaticamente.' });
    setTimeout(() => finalize(), 2000);
  }, [finalize]);

  const timeRemaining = useExamTimer({
    deadline: state?.effectiveDeadline ?? null,
    onTimeUp: handleTimeUp,
    paused: state?.status !== 'in_progress',
  });

  // ── beforeunload ──
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasFinalized.current || state?.status !== 'in_progress') return;
      storage.flushPendingState();
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [state?.status, storage]);

  // ── Current question ──
  const currentIndex = state?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentIndex];
  const currentAnswer = state?.answers[currentQuestion?.id];

  // ── State updater with debounced save ──
  const updateState = useCallback((updater: (prev: ExamState) => ExamState) => {
    setState(prev => {
      if (!prev || prev.status !== 'in_progress') return prev;
      const updated = updater(prev);
      storage.saveStateDebounced(updated);
      return updated;
    });
  }, [storage]);

  // ── Handlers ──
  const handleSelectOption = useCallback((optionId: string) => {
    if (!currentQuestion) return;
    const answer: ExamAnswer = {
      ...(state?.answers[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, markedForReview: false, highConfidence: false, eliminatedAlternatives: [] }),
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
      const existing = prev.answers[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, markedForReview: false, highConfidence: false, eliminatedAlternatives: [] };
      const isEliminated = existing.eliminatedAlternatives.includes(optionId);
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [currentQuestion.id]: {
            ...existing,
            eliminatedAlternatives: isEliminated
              ? existing.eliminatedAlternatives.filter(i => i !== optionId)
              : [...existing.eliminatedAlternatives, optionId],
          },
        },
      };
    });
  }, [currentQuestion, updateState]);

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
      const existing = prev.answers[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, markedForReview: false, highConfidence: false, eliminatedAlternatives: [] };
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
      const existing = prev.answers[currentQuestion.id] || { questionId: currentQuestion.id, selectedOption: null, markedForReview: false, highConfidence: false, eliminatedAlternatives: [] };
      return {
        ...prev,
        answers: { ...prev.answers, [currentQuestion.id]: { ...existing, highConfidence: !existing.highConfidence } },
      };
    });
  }, [currentQuestion, updateState]);

  // ── Keyboard shortcuts ──
  const shortcuts = useMemo(() => {
    const map: Record<string, () => void> = {
      'ArrowLeft': handlePrev,
      'ArrowRight': handleNext,
      'r': toggleReview,
      'R': toggleReview,
      'h': toggleHighConfidence,
      'H': toggleHighConfidence,
      'Escape': () => setShowSubmitModal(true),
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

  // ── Loading ──
  if (loadingSimulado || initLoading || !simulado || !state) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-body text-muted-foreground">Carregando simulado...</p>
        </div>
      </div>
    );
  }

  // ── Completed ──
  if (state.status === 'submitted' || state.status === 'expired') {
    const summary = computeExamSummary(state, questionIds);
    return (
      <ExamCompletedScreen
        simuladoId={simulado.id}
        simuladoTitle={simulado.title}
        resultsReleaseAt={simulado.resultsReleaseAt}
        answeredCount={summary.answered}
        totalCount={summary.total}
      />
    );
  }

  if (!currentQuestion) return null;

  const summary = computeExamSummary(state, questionIds);
  const isReviewFlagged = currentAnswer?.markedForReview;
  const isHighConfFlagged = currentAnswer?.highConfidence;

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Focus warnings */}
      <AnimatePresence>
        {focusControl.isTabAway && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-destructive/10 border-b border-destructive/20 px-4 py-3 flex items-center gap-2"
          >
            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            <p className="text-body-sm text-destructive font-medium">
              Você saiu da aba da prova. Retorne para continuar o simulado.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <ExamHeader
        title={simulado.title}
        currentQuestion={currentIndex + 1}
        totalQuestions={questions.length}
        timeRemaining={timeRemaining}
        onFinalize={() => setShowSubmitModal(true)}
      />

      {/* Progress bar */}
      <div className="px-4 md:px-6 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${(summary.answered / summary.total) * 100}%` }}
            />
          </div>
          <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
            {summary.answered}/{summary.total} respondidas
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            <QuestionDisplay
              question={currentQuestion}
              answer={currentAnswer}
              onSelectOption={handleSelectOption}
              onEliminateOption={handleEliminateOption}
            />

            {/* Action bar */}
            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={toggleReview}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
                  isReviewFlagged
                    ? 'bg-info/10 text-info border border-info/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Flag className="h-3.5 w-3.5" />
                {isReviewFlagged ? 'Marcada para revisão' : 'Revisar'}
              </button>
              <button
                onClick={toggleHighConfidence}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
                  isHighConfFlagged
                    ? 'bg-success/10 text-success border border-success/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                {isHighConfFlagged ? 'Alta certeza' : 'Alta certeza'}
              </button>
            </div>

            {/* Navigation */}
            <div className="mt-6 flex items-center justify-between pb-8">
              <button
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <button
                onClick={() => setShowNavigator(v => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>

              {currentIndex < questions.length - 1 ? (
                <button
                  onClick={handleNext}
                  className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Finalizar
                </button>
              )}
            </div>
          </div>
        </main>

        {/* Side navigator */}
        <aside className="hidden md:flex w-64 border-l border-border bg-card p-4 flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-body font-semibold text-foreground mb-1">Navegação</p>
            <p className="text-caption text-muted-foreground mb-3">
              {summary.answered}/{summary.total} respondidas
            </p>
          </div>
          <QuestionNavigator
            totalQuestions={questions.length}
            currentIndex={currentIndex}
            answers={state.answers}
            questionIds={questionIds}
            onNavigate={handleNavigate}
          />
          <div className="mt-auto space-y-2 text-caption text-muted-foreground pt-4 border-t border-border">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-accent border border-accent" />
              Respondida
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-info/20" />
              Para revisão
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded bg-success" />
              Alta certeza
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile navigator overlay */}
      <AnimatePresence>
        {showNavigator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden bg-foreground/40 backdrop-blur-sm"
            onClick={() => setShowNavigator(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border p-5 max-h-[70vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="w-10 h-1 rounded-full bg-muted mx-auto mb-4" />
              <div className="mb-4">
                <p className="text-body font-semibold text-foreground mb-1">Navegação</p>
                <p className="text-caption text-muted-foreground">
                  {summary.answered}/{summary.total} respondidas
                </p>
              </div>
              <QuestionNavigator
                totalQuestions={questions.length}
                currentIndex={currentIndex}
                answers={state.answers}
                questionIds={questionIds}
                onNavigate={handleNavigate}
              />
              <button
                onClick={() => setShowSubmitModal(true)}
                className="mt-6 w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
              >
                <Send className="h-4 w-4" />
                Finalizar simulado
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Submit modal */}
      {showSubmitModal && (
        <SubmitConfirmModal
          summary={summary}
          submitting={submitting}
          onConfirm={finalize}
          onCancel={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}
