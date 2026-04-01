import { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExamFlow } from '@/hooks/useExamFlow';
import { ExamHeader } from '@/components/exam/ExamHeader';
import { QuestionDisplay } from '@/components/exam/QuestionDisplay';
import { QuestionNavigator } from '@/components/exam/QuestionNavigator';
import { SubmitConfirmModal } from '@/components/exam/SubmitConfirmModal';
import { ExamCompletedScreen } from '@/components/exam/ExamCompletedScreen';
import { Flag, Zap, ChevronLeft, ChevronRight, Grid3X3, Send, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

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

export default function SimuladoExamPage() {
  const flow = useExamFlow();
  const { enterFullscreen, exitFullscreen } = useFullscreen();

  // Enter fullscreen on mount, exit on unmount
  useEffect(() => {
    enterFullscreen();
    return () => exitFullscreen();
  }, [enterFullscreen, exitFullscreen]);

  if (flow.loading) {
    return (
      <div className="h-screen flex flex-col bg-background">
        <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center justify-between px-4 md:px-6 h-14">
            <div className="h-5 w-48 bg-muted rounded animate-pulse" />
            <div className="flex items-center gap-2">
              <div className="h-4 w-12 bg-muted rounded animate-pulse" />
              <div className="w-24 h-1.5 rounded-full bg-muted animate-pulse" />
            </div>
            <div className="h-9 w-20 bg-muted rounded-lg animate-pulse" />
          </div>
        </header>
        <div className="px-4 md:px-6 py-2 bg-muted/30 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-muted animate-pulse" />
            <div className="h-4 w-16 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex gap-2">
              <div className="h-6 w-20 bg-muted rounded animate-pulse" />
              <div className="h-6 w-24 bg-muted rounded animate-pulse" />
            </div>
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 w-full bg-muted rounded animate-pulse" />
            <div className="h-4 max-w-[75%] w-full bg-muted rounded animate-pulse" />
            <div className="pt-6 space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-14 w-full bg-muted rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </main>
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
        notifyResultByEmail={flow.notifyResultByEmail}
        notificationSaving={flow.notificationSaving}
        isWithinWindow={flow.isWithinWindow}
        onToggleNotifyResultByEmail={flow.setNotifyResultByEmail}
      />
    );
  }

  if (!flow.currentQuestion || !flow.simulado || !flow.state) return null;

  const { summary } = flow;

  return (
    <div className="h-screen flex flex-col bg-background">
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

      <ExamHeader
        title={flow.simulado.title}
        currentQuestion={flow.currentIndex + 1}
        totalQuestions={flow.questions.length}
        timeRemaining={flow.timeRemaining}
        onFinalize={() => flow.setShowSubmitModal(true)}
      />

      <div className="px-4 md:px-6 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${summary.total > 0 ? (summary.answered / summary.total) * 100 : 0}%` }}
            />
          </div>
          <span className="text-caption font-medium text-muted-foreground whitespace-nowrap">
            {summary.answered}/{summary.total} respondidas
          </span>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-3xl mx-auto">
            <QuestionDisplay
              question={flow.currentQuestion}
              answer={flow.currentAnswer}
              onSelectOption={flow.handleSelectOption}
              onEliminateOption={flow.handleEliminateOption}
            />

            <div className="mt-6 flex flex-wrap items-center gap-2">
              <button
                onClick={flow.toggleReview}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
                  flow.isReviewFlagged
                    ? 'bg-info/10 text-info border border-info/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Flag className="h-3.5 w-3.5" />
                {flow.isReviewFlagged ? 'Marcada para revisão' : 'Revisar'}
              </button>
              <button
                onClick={flow.toggleHighConfidence}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-body-sm font-medium transition-all',
                  flow.isHighConfFlagged
                    ? 'bg-success/10 text-success border border-success/30'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80',
                )}
              >
                <Zap className="h-3.5 w-3.5" />
                {flow.isHighConfFlagged ? 'Alta certeza' : 'Alta certeza'}
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between pb-8">
              <button
                onClick={flow.handlePrev}
                disabled={flow.currentIndex === 0}
                className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>

              <button
                onClick={() => flow.setShowNavigator(v => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-muted-foreground text-body-sm font-medium hover:bg-muted/80 transition-colors md:hidden"
              >
                <Grid3X3 className="h-4 w-4" />
              </button>

              {flow.currentIndex < flow.questions.length - 1 ? (
                <button
                  onClick={flow.handleNext}
                  className="inline-flex items-center gap-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-medium hover:bg-wine-hover transition-colors"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4" />
                </button>
              ) : (
                <button
                  onClick={() => flow.setShowSubmitModal(true)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
                >
                  <Send className="h-4 w-4" />
                  Finalizar
                </button>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden md:flex w-64 border-l border-border bg-card p-4 flex-col gap-4 overflow-y-auto">
          <div>
            <p className="text-body font-semibold text-foreground mb-1">Navegação</p>
            <p className="text-caption text-muted-foreground mb-3">
              {summary.answered}/{summary.total} respondidas
            </p>
          </div>
          <QuestionNavigator
            totalQuestions={flow.questions.length}
            currentIndex={flow.currentIndex}
            answers={flow.state.answers}
            questionIds={flow.questionIds}
            onNavigate={flow.handleNavigate}
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

      <AnimatePresence>
        {flow.showNavigator && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 md:hidden bg-foreground/40 backdrop-blur-sm"
            onClick={() => flow.setShowNavigator(false)}
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
                totalQuestions={flow.questions.length}
                currentIndex={flow.currentIndex}
                answers={flow.state.answers}
                questionIds={flow.questionIds}
                onNavigate={flow.handleNavigate}
              />
              <button
                onClick={() => flow.setShowSubmitModal(true)}
                className="mt-6 w-full inline-flex items-center justify-center gap-1.5 px-5 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
              >
                <Send className="h-4 w-4" />
                Finalizar simulado
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <SubmitConfirmModal
        open={flow.showSubmitModal}
        summary={flow.summary}
        submitting={flow.submitting}
        onConfirm={flow.finalize}
        onCancel={() => flow.setShowSubmitModal(false)}
      />
    </div>
  );
}
