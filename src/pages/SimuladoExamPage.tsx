import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExamFlow } from '@/hooks/useExamFlow';
import { formatTimer, getTimerColor, getTimerBgClass } from '@/hooks/useExamTimer';
import { ExamHeader } from '@/components/exam/ExamHeader';
import { QuestionDisplay } from '@/components/exam/QuestionDisplay';
import { QuestionNavigator } from '@/components/exam/QuestionNavigator';
import { SubmitConfirmModal } from '@/components/exam/SubmitConfirmModal';
import { ExamCompletedScreen } from '@/components/exam/ExamCompletedScreen';
import { Flag, Zap, ChevronLeft, ChevronRight, Grid3X3, AlertCircle, Clock, Play, WifiOff, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { canViewResults } from '@/lib/simulado-helpers';

function useFullscreen() {
  const enterFullscreen = useCallback(() => {
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } catch {}
  }, []);

  const exitFullscreen = useCallback(() => {
    try {
      if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      }
    } catch {}
  }, []);

  return { enterFullscreen, exitFullscreen };
}

function useOnlineStatus() {
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  return online;
}

function MobileQuestionNav({
  questionIds,
  currentIndex,
  answers,
  onNavigate,
}: {
  questionIds: string[];
  currentIndex: number;
  answers: Record<string, import('@/types/exam').ExamAnswer>;
  onNavigate: (index: number) => void;
}) {
  const currentRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    currentRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentIndex]);

  return (
    <div
      className="md:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-[hsl(var(--exam-border))] px-3 py-2.5"
      style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}
    >
      <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide pb-1">
        {questionIds.map((qId, i) => {
          const a = answers[qId];
          const isAnswered = !!a?.selectedOption;
          const isReview = !!a?.markedForReview;
          const isHighConf = !!a?.highConfidence;
          const isCurrent = i === currentIndex;

          return (
            <button
              type="button"
              key={qId}
              ref={isCurrent ? currentRef : undefined}
              onClick={() => onNavigate(i)}
              className={cn(
                'flex-shrink-0 h-8 min-w-[32px] px-1 rounded-lg text-[11px] font-bold transition-all duration-150',
                'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                isCurrent && 'ring-2 ring-primary ring-offset-1',
                isReview
                  ? 'bg-warning text-warning-foreground border border-warning/60'
                  : isHighConf
                    ? 'bg-success/20 text-success'
                    : isAnswered
                      ? 'bg-info text-info-foreground border border-info/50'
                      : 'bg-transparent border border-[hsl(var(--exam-border))] text-muted-foreground',
              )}
              aria-label={`Questão ${i + 1}${isAnswered ? ', respondida' : ''}${isReview ? ', marcada para revisão' : ''}`}
              aria-current={isCurrent ? 'step' : undefined}
            >
              {i + 1}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function SimuladoExamPage() {
  const flow = useExamFlow();
  const { enterFullscreen, exitFullscreen } = useFullscreen();
  const isOnline = useOnlineStatus();

  const [preFlightDismissed, setPreFlightDismissed] = useState(false);
  const [timeWarningShown, setTimeWarningShown] = useState(false);
  const [timeWarningVisible, setTimeWarningVisible] = useState(false);

  useEffect(() => {
    enterFullscreen();
    return () => exitFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  useEffect(() => {
    if (flow.timeRemaining <= 300 && flow.timeRemaining > 295 && !timeWarningShown) {
      setTimeWarningShown(true);
      setTimeWarningVisible(true);
      const timer = setTimeout(() => setTimeWarningVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [flow.timeRemaining, timeWarningShown]);

  if (flow.loading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center exam-bg">
        <div className="text-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
          <p className="text-body text-muted-foreground">Preparando sua prova...</p>
        </div>
      </div>
    );
  }

  if (flow.isCompleted && flow.simulado && flow.state) {
    return (
      <ExamCompletedScreen
        simuladoId={flow.simulado.id}
        simuladoTitle={flow.simulado.title}
        resultsReleaseAt={flow.simulado.resultsReleaseAt}
        answeredCount={flow.summary.answered}
        totalCount={flow.summary.total}
        highConfidenceCount={flow.summary.highConfidence}
        markedForReviewCount={flow.summary.markedForReview}
        notifyResultByEmail={flow.notifyResultByEmail}
        notificationSaving={flow.notificationSaving}
        isWithinWindow={flow.isWithinWindow}
        resultsAvailable={canViewResults(flow.simulado.status)}
        onToggleNotifyResultByEmail={flow.setNotifyResultByEmail}
      />
    );
  }

  if (!flow.currentQuestion || !flow.simulado || !flow.state) return null;

  const { summary } = flow;
  const reviewIndices = flow.questionIds
    .map((qId, i) => (flow.state?.answers[qId]?.markedForReview ? i : -1))
    .filter((i) => i >= 0);

  const isResuming = flow.state.status === 'in_progress'
    && flow.summary.answered > 0
    && !preFlightDismissed;

  const showPreFlight = !preFlightDismissed
    && flow.state.status === 'in_progress'
    && flow.currentIndex === 0
    && flow.summary.answered === 0;

  const showIntermediateScreen = showPreFlight || isResuming;

  return (
    <div className="h-full min-h-0 flex flex-col exam-bg">
      {/* Aria-live region for screen readers */}
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        Questão {flow.currentIndex + 1} de {flow.questions.length}
        {flow.currentQuestion.area && ` — ${flow.currentQuestion.area}`}
      </div>

      <AnimatePresence>
        {flow.focusControl.isTabAway && (
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

      <AnimatePresence>
        {flow.focusControl.isFullscreenLost && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="bg-destructive/12 border-b border-destructive/30 px-4 py-3 flex flex-wrap items-center justify-between gap-3"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
              <div className="text-body-sm">
                <p className="text-destructive font-semibold">
                  Você saiu do modo tela cheia.
                </p>
                <p className="text-destructive/90">
                  O cronômetro continua e uma penalidade de integridade foi registrada ({flow.state?.fullscreenExitCount ?? 0}).
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={flow.focusControl.enterFullscreen}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-destructive text-destructive-foreground text-body-sm font-semibold hover:brightness-95 transition-colors"
            >
              <Maximize2 className="h-4 w-4" />
              Voltar à tela cheia
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <ExamHeader
        title={flow.simulado.title}
        currentQuestion={flow.currentIndex + 1}
        totalQuestions={flow.questions.length}
        timeRemaining={flow.timeRemaining}
        onFinalize={() => flow.setShowSubmitModal(true)}
        saving={flow.saving ?? false}
      />

      {/* Offline banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-warning/8 border-b border-warning/15 px-4 py-2.5 flex items-center gap-2"
          >
            <WifiOff className="h-3.5 w-3.5 text-warning shrink-0" />
            <p className="text-body-sm text-warning">
              Sem conexão. Suas respostas estão salvas localmente e serão sincronizadas automaticamente.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Time warning banner */}
      <AnimatePresence>
        {timeWarningVisible && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-warning/8 border-b border-warning/15 px-4 py-2 text-center"
          >
            <p className="text-body-sm text-warning font-medium">
              Restam 5 minutos para o término da prova.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {showIntermediateScreen ? (
          <motion.div
            key={isResuming ? 'resume' : 'preflight'}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-1 min-h-0 flex items-center justify-center p-6"
          >
            {isResuming ? (
              <div className="text-center max-w-md">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Play className="h-7 w-7 text-primary" />
                </div>
                <h1 className="text-heading-2 text-foreground mb-2">Bem-vindo de volta</h1>
                <p className="text-body text-muted-foreground mb-4">
                  Você respondeu {flow.summary.answered} de {flow.summary.total} questões.
                </p>
                <div className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-body tabular-nums font-semibold mb-6',
                  getTimerBgClass(flow.timeRemaining),
                  getTimerColor(flow.timeRemaining),
                )}>
                  <Clock className="h-4 w-4" />
                  {formatTimer(flow.timeRemaining)} restantes
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setPreFlightDismissed(true)}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <Play className="h-4 w-4" />
                    Continuar de onde parei
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center max-w-md">
                <h1 className="text-heading-1 text-foreground mb-2">{flow.simulado.title}</h1>
                <div className="flex items-center justify-center gap-4 text-body text-muted-foreground mb-6">
                  <span>{flow.questions.length} questões</span>
                  <span className="w-1 h-1 rounded-full bg-muted-foreground/30" />
                  <span>{flow.simulado.estimatedDuration}</span>
                </div>

                <div className={cn(
                  'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-mono text-body-lg tabular-nums font-semibold mb-6',
                  getTimerBgClass(flow.timeRemaining),
                  getTimerColor(flow.timeRemaining),
                )}>
                  <Clock className="h-4 w-4" />
                  {formatTimer(flow.timeRemaining)}
                </div>

                <p className="text-body-sm text-muted-foreground mb-8">
                  O cronômetro já está ativo. Boa prova!
                </p>

                <button
                  type="button"
                  onClick={() => setPreFlightDismissed(true)}
                  className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-colors shadow-sm hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  Começar
                </button>
              </div>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="exam"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="flex-1 min-h-0 flex overflow-hidden"
          >
            <main className="flex-1 min-h-0 overflow-hidden p-3 md:p-4 pb-14 md:pb-0">
              <div className="max-w-5xl mx-auto h-full min-h-0">
                <div className="h-full overflow-y-auto pr-1">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={flow.currentQuestion.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.15}
                      onDragEnd={(_, info) => {
                        if (info.offset.x < -80 && flow.currentIndex < flow.questions.length - 1) {
                          flow.handleNext();
                        } else if (info.offset.x > 80 && flow.currentIndex > 0) {
                          flow.handlePrev();
                        }
                      }}
                    >
                      <QuestionDisplay
                        question={flow.currentQuestion}
                        answer={flow.currentAnswer}
                        onSelectOption={flow.handleSelectOption}
                        onEliminateOption={flow.handleEliminateOption}
                      />
                    </motion.div>
                  </AnimatePresence>
                  <div className="mt-3 pt-3 border-t border-[hsl(var(--exam-border))]">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={flow.toggleReview}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
                          flow.isReviewFlagged
                            ? 'bg-warning text-warning-foreground border border-warning/60'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        <Flag className="h-3.5 w-3.5" />
                        {flow.isReviewFlagged ? 'Marcada p/ revisão' : 'Marcar p/ revisar'}
                      </button>
                      <button
                        type="button"
                        onClick={flow.toggleHighConfidence}
                        title="Alta certeza — marque quando tiver certeza da resposta. Aparece na sua análise de resultados."
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
                          flow.isHighConfFlagged
                            ? 'bg-success/10 text-success border border-success/30'
                            : 'bg-muted text-muted-foreground hover:bg-muted/80',
                        )}
                      >
                        <Zap className="h-3.5 w-3.5" />
                        {flow.isHighConfFlagged ? 'Alta certeza ✓' : 'Alta certeza'}
                      </button>
                    </div>
                    <p className="mt-1.5 text-[10px] text-muted-foreground/40">
                      R = revisar · H = certeza
                    </p>

                    <div className="mt-3 flex items-center justify-between pb-2">
                      <button
                        type="button"
                        onClick={flow.handlePrev}
                        disabled={flow.currentIndex === 0}
                        className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-30 disabled:pointer-events-none"
                      >
                        <ChevronLeft className="h-4 w-4" />
                        Anterior
                      </button>

                      <button
                        type="button"
                        onClick={() => flow.setShowNavigator(v => !v)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
                      >
                        <Grid3X3 className="h-4 w-4" />
                      </button>

                      {flow.currentIndex < flow.questions.length - 1 ? (
                        <button
                          type="button"
                          onClick={flow.handleNext}
                          className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors"
                        >
                          Próxima
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => flow.setShowSubmitModal(true)}
                          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
                        >
                          Encerrar prova
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </main>

            <aside className="hidden md:flex w-[340px] border-l border-[hsl(var(--exam-border))] p-5 flex-col gap-4 overflow-y-auto">
              <div className="flex items-baseline justify-between mb-3">
                <p className="text-body-sm font-semibold text-foreground">Questões</p>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {summary.answered}/{summary.total}
                </p>
              </div>
              <QuestionNavigator
                totalQuestions={flow.questions.length}
                currentIndex={flow.currentIndex}
                answers={flow.state.answers}
                questionIds={flow.questionIds}
                onNavigate={flow.handleNavigate}
              />
              <div className="mt-auto flex flex-wrap gap-x-4 gap-y-1.5 text-[10px] text-muted-foreground pt-4 border-t border-[hsl(var(--exam-border))]">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-info" /> Respondida
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-warning" /> Revisão
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-success/20" /> Certeza
                </span>
              </div>
            </aside>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {flow.showNavigator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden bg-foreground/50 backdrop-blur-md"
            onClick={() => flow.setShowNavigator(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25 }}
              className="absolute bottom-0 left-0 right-0 rounded-t-2xl border-t border-[hsl(var(--exam-border))] p-5 max-h-[70vh] overflow-y-auto"
              style={{ backgroundColor: 'hsl(var(--exam-header-bg))', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="w-8 h-1 rounded-full bg-muted-foreground/20 mx-auto mb-4" />
              <div className="flex items-baseline justify-between mb-4">
                <p className="text-body-sm font-semibold text-foreground">Questões</p>
                <p className="text-caption text-muted-foreground tabular-nums">
                  {summary.answered}/{summary.total}
                </p>
              </div>
              <QuestionNavigator
                totalQuestions={flow.questions.length}
                currentIndex={flow.currentIndex}
                answers={flow.state.answers}
                questionIds={flow.questionIds}
                onNavigate={flow.handleNavigate}
              />
              <button
                type="button"
                onClick={() => flow.setShowSubmitModal(true)}
                className="mt-6 w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
              >
                Encerrar prova
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {flow.state && !showIntermediateScreen && (
        <MobileQuestionNav
          questionIds={flow.questionIds}
          currentIndex={flow.currentIndex}
          answers={flow.state.answers}
          onNavigate={flow.handleNavigate}
        />
      )}

      <SubmitConfirmModal
        open={flow.showSubmitModal}
        summary={flow.summary}
        reviewIndices={reviewIndices}
        submitting={flow.submitting}
        onConfirm={flow.finalize}
        onCancel={() => flow.setShowSubmitModal(false)}
        onNavigateToQuestion={(index) => {
          flow.handleNavigate(index);
        }}
      />
    </div>
  );
}
