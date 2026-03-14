import { useState, useCallback, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '@/contexts/UserContext';
import { getSimuladoById } from '@/data/mock';
import { getQuestionsForSimulado } from '@/data/mock-questions';
import { canAccessSimulado } from '@/lib/simulado-helpers';
import { loadAttempt, saveAttempt } from '@/lib/exam-persistence';
import { useExamTimer } from '@/hooks/use-exam-timer';
import { useTabWarning } from '@/hooks/use-tab-warning';
import { ExamHeader } from '@/components/exam/ExamHeader';
import { QuestionDisplay } from '@/components/exam/QuestionDisplay';
import { QuestionNavigator } from '@/components/exam/QuestionNavigator';
import { SubmitConfirmModal } from '@/components/exam/SubmitConfirmModal';
import { ExamCompletedScreen } from '@/components/exam/ExamCompletedScreen';
import { computeExamSummary, type ExamAttempt } from '@/types/exam';
import { Flag, Zap, ChevronLeft, ChevronRight, Grid3X3, Send, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

export default function SimuladoExamPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isOnboardingComplete, profile } = useUser();

  const simulado = useMemo(() => (id ? getSimuladoById(id) : null), [id]);
  const questions = useMemo(() => (id ? getQuestionsForSimulado(id) : []), [id]);
  const questionIds = useMemo(() => questions.map(q => q.id), [questions]);

  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [showNavigator, setShowNavigator] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showTabWarning, setShowTabWarning] = useState(false);

  console.log('[SimuladoExamPage] Rendering, id:', id, 'attempt status:', attempt?.status);

  // ── Gate: redirect if not eligible ──
  useEffect(() => {
    if (!simulado || !canAccessSimulado(simulado.status) || !isOnboardingComplete) {
      console.log('[SimuladoExamPage] Not eligible, redirecting');
      navigate(simulado ? `/simulados/${id}` : '/simulados', { replace: true });
    }
  }, [simulado, isOnboardingComplete, navigate, id]);

  // ── Init or resume attempt ──
  useEffect(() => {
    if (!simulado || !id) return;
    const existing = loadAttempt(id);
    if (existing && existing.status === 'in_progress') {
      console.log('[SimuladoExamPage] Resuming existing attempt');
      setAttempt(existing);
      toast({ title: 'Prova retomada', description: 'Suas respostas foram recuperadas automaticamente.' });
    } else if (!existing || existing.status === 'not_started') {
      const fresh: ExamAttempt = {
        simuladoId: id,
        userId: profile?.id ?? 'demo-user',
        status: 'in_progress',
        startedAt: new Date().toISOString(),
        lastSavedAt: new Date().toISOString(),
        totalDurationSeconds: simulado.estimatedDurationMinutes * 60,
        timeRemainingSeconds: simulado.estimatedDurationMinutes * 60,
        currentQuestionIndex: 0,
        answers: {},
        reviewFlags: {},
        highConfidenceFlags: {},
        emailReminderEnabled: false,
      };
      setAttempt(fresh);
      saveAttempt(fresh);
      console.log('[SimuladoExamPage] Created fresh attempt');
    } else {
      // submitted already
      setAttempt(existing);
    }
  }, [simulado, id, profile?.id]);

  // ── Auto-save helper ──
  const doSave = useCallback((updated: ExamAttempt) => {
    saveAttempt(updated);
  }, []);

  // ── Timer callbacks ──
  const handleTimeUp = useCallback(() => {
    console.log('[SimuladoExamPage] Time up!');
    setAttempt(prev => {
      if (!prev) return prev;
      const final = { ...prev, status: 'submitted' as const, finishedAt: new Date().toISOString(), timeRemainingSeconds: 0 };
      saveAttempt(final);
      return final;
    });
    toast({ title: 'Tempo esgotado', description: 'Sua prova foi finalizada automaticamente.' });
  }, []);

  const handleTimerTick = useCallback((remaining: number) => {
    setAttempt(prev => {
      if (!prev || prev.status !== 'in_progress') return prev;
      const updated = { ...prev, timeRemainingSeconds: remaining };
      doSave(updated);
      return updated;
    });
  }, [doSave]);

  const timeRemaining = useExamTimer({
    attempt: attempt ?? { status: 'not_started', timeRemainingSeconds: 0 } as any,
    onTimeUp: handleTimeUp,
    onTick: handleTimerTick,
  });

  // ── Tab switch warning ──
  useTabWarning({
    enabled: attempt?.status === 'in_progress',
    onTabSwitch: () => {
      setTabSwitchCount(c => c + 1);
      setShowTabWarning(true);
      setTimeout(() => setShowTabWarning(false), 5000);
    },
  });

  // ── Handlers ──
  const currentIndex = attempt?.currentQuestionIndex ?? 0;
  const currentQuestion = questions[currentIndex];

  const updateAttempt = useCallback((updater: (prev: ExamAttempt) => ExamAttempt) => {
    setAttempt(prev => {
      if (!prev || prev.status !== 'in_progress') return prev;
      const updated = updater(prev);
      doSave(updated);
      return updated;
    });
  }, [doSave]);

  const handleSelectOption = useCallback((optionId: string) => {
    if (!currentQuestion) return;
    updateAttempt(prev => ({
      ...prev,
      answers: { ...prev.answers, [currentQuestion.id]: optionId },
    }));
  }, [currentQuestion, updateAttempt]);

  const handleNavigate = useCallback((index: number) => {
    updateAttempt(prev => ({ ...prev, currentQuestionIndex: index }));
    setShowNavigator(false);
  }, [updateAttempt]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) handleNavigate(currentIndex - 1);
  }, [currentIndex, handleNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < questions.length - 1) handleNavigate(currentIndex + 1);
  }, [currentIndex, questions.length, handleNavigate]);

  const toggleReview = useCallback(() => {
    if (!currentQuestion) return;
    updateAttempt(prev => ({
      ...prev,
      reviewFlags: { ...prev.reviewFlags, [currentQuestion.id]: !prev.reviewFlags[currentQuestion.id] },
    }));
  }, [currentQuestion, updateAttempt]);

  const toggleHighConfidence = useCallback(() => {
    if (!currentQuestion) return;
    updateAttempt(prev => ({
      ...prev,
      highConfidenceFlags: { ...prev.highConfidenceFlags, [currentQuestion.id]: !prev.highConfidenceFlags[currentQuestion.id] },
    }));
  }, [currentQuestion, updateAttempt]);

  const handleSubmit = useCallback(() => {
    updateAttempt(prev => ({
      ...prev,
      status: 'submitted',
      finishedAt: new Date().toISOString(),
      timeRemainingSeconds: timeRemaining,
    }));
    setShowSubmitModal(false);
    console.log('[SimuladoExamPage] Exam submitted');
  }, [updateAttempt, timeRemaining]);

  const handleExit = useCallback(() => {
    // Save before navigating (contingency save)
    if (attempt && attempt.status === 'in_progress') {
      saveAttempt({ ...attempt, timeRemainingSeconds: timeRemaining });
    }
    navigate(`/simulados/${id}`);
  }, [attempt, timeRemaining, navigate, id]);

  // ── Loading / invalid states ──
  if (!simulado || !attempt) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin mx-auto mb-4" />
          <p className="text-body text-muted-foreground">Carregando prova...</p>
        </div>
      </div>
    );
  }

  // ── Completed state ──
  if (attempt.status === 'submitted' || attempt.status === 'expired') {
    const summary = computeExamSummary(attempt, questionIds);
    return (
      <ExamCompletedScreen
        simuladoTitle={simulado.title}
        resultsReleaseAt={simulado.resultsReleaseAt}
        answeredCount={summary.answered}
        totalCount={summary.total}
      />
    );
  }

  if (!currentQuestion) return null;

  const isReviewFlagged = attempt.reviewFlags[currentQuestion.id];
  const isHighConfFlagged = attempt.highConfidenceFlags[currentQuestion.id];
  const summary = computeExamSummary(attempt, questionIds);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <ExamHeader
        title={simulado.title}
        currentQuestion={currentIndex + 1}
        totalQuestions={questions.length}
        timeRemaining={timeRemaining}
        lastSaved={attempt.lastSavedAt}
        onExit={handleExit}
      />

      {/* Tab switch warning banner */}
      <AnimatePresence>
        {showTabWarning && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-warning/10 border-b border-warning/20 px-4 py-3 flex items-center gap-2"
          >
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-body-sm text-warning">
              Alternância de aba detectada ({tabSwitchCount}x). Mantenha o foco na prova para simular condições reais.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex">
        {/* Main content */}
        <main className="flex-1 max-w-3xl mx-auto w-full px-4 md:px-6 py-6 md:py-8">
          <QuestionDisplay
            question={currentQuestion}
            selectedOptionId={attempt.answers[currentQuestion.id] ?? null}
            onSelectOption={handleSelectOption}
          />

          {/* Action bar */}
          <div className="mt-8 flex flex-wrap items-center gap-2">
            <button
              onClick={toggleReview}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-colors',
                isReviewFlagged
                  ? 'bg-warning/10 text-warning border border-warning/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Flag className="h-3.5 w-3.5" />
              {isReviewFlagged ? 'Marcada para revisar' : 'Marcar para revisar'}
            </button>
            <button
              onClick={toggleHighConfidence}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-colors',
                isHighConfFlagged
                  ? 'bg-success/10 text-success border border-success/30'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80',
              )}
            >
              <Zap className="h-3.5 w-3.5" />
              {isHighConfFlagged ? 'Alta certeza' : 'Marcar alta certeza'}
            </button>
          </div>

          {/* Navigation bar */}
          <div className="mt-6 flex items-center justify-between">
            <button
              onClick={handlePrev}
              disabled={currentIndex === 0}
              className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowNavigator(v => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors"
              >
                <Grid3X3 className="h-4 w-4" />
                <span className="hidden sm:inline">Questões</span>
              </button>
            </div>

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
        </main>

        {/* Side navigator (desktop) */}
        <AnimatePresence>
          {showNavigator && (
            <motion.aside
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="hidden md:block w-72 border-l border-border bg-card p-4 overflow-y-auto"
            >
              <div className="mb-4">
                <p className="text-body font-semibold text-foreground mb-1">Navegação</p>
                <p className="text-caption text-muted-foreground">
                  {summary.answered}/{summary.total} respondidas
                </p>
              </div>
              <QuestionNavigator
                total={questions.length}
                currentIndex={currentIndex}
                answers={attempt.answers}
                reviewFlags={attempt.reviewFlags}
                highConfidenceFlags={attempt.highConfidenceFlags}
                questionIds={questionIds}
                onNavigate={handleNavigate}
              />
              <div className="mt-6 space-y-2 text-caption text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-accent border border-accent" />
                  Respondida
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-warning" />
                  Para revisar
                </div>
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full bg-success" />
                  Alta certeza
                </div>
              </div>
            </motion.aside>
          )}
        </AnimatePresence>
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
                total={questions.length}
                currentIndex={currentIndex}
                answers={attempt.answers}
                reviewFlags={attempt.reviewFlags}
                highConfidenceFlags={attempt.highConfidenceFlags}
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

      {/* Submit confirmation modal */}
      {showSubmitModal && (
        <SubmitConfirmModal
          summary={summary}
          onConfirm={handleSubmit}
          onCancel={() => setShowSubmitModal(false)}
        />
      )}
    </div>
  );
}
