import { CheckCircle2, Flag, Zap, AlertTriangle, Check, AlertCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import type { ExamSummary } from '@/types/exam';

interface SubmitConfirmModalProps {
  open: boolean;
  summary: ExamSummary;
  reviewIndices: number[];
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onNavigateToQuestion: (index: number) => void;
}

export function SubmitConfirmModal({
  open,
  summary,
  reviewIndices,
  submitting,
  onConfirm,
  onCancel,
  onNavigateToQuestion,
}: SubmitConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        className="w-[min(96vw,40rem)] max-h-[calc(100svh-1rem)] rounded-xl sm:rounded-2xl border border-border p-0 gap-0 overflow-hidden"
        onPointerDownOutside={(e) => submitting && e.preventDefault()}
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Finalizar simulado?</DialogTitle>
          <DialogDescription>
            Ao confirmar, seu simulado será enviado e não poderá ser alterado.
          </DialogDescription>
        </DialogHeader>

        <div className="flex max-h-[calc(100svh-1rem)] min-h-0 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 md:px-8">
            <div className="text-center mb-5 sm:mb-6">
              <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl bg-primary/8 flex items-center justify-center mx-auto mb-4 sm:mb-5">
                <CheckCircle2 className="h-7 w-7 sm:h-8 sm:w-8 text-primary" aria-hidden />
              </div>
              <h2 className="text-heading-2 text-foreground mb-2">Finalizar simulado?</h2>
              <p className="text-body text-muted-foreground mb-1">
                Ao confirmar, seu simulado será enviado e não poderá ser alterado.
              </p>
              <p className="text-body-sm text-muted-foreground">
                Revise os pontos abaixo antes de concluir.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-5 sm:mb-6">
              <div className="p-2.5 sm:p-3 rounded-xl bg-[hsl(var(--exam-surface))] border border-[hsl(var(--exam-border))] text-center">
                <p className="text-heading-3 text-foreground">{summary.answered}</p>
                <p className="text-caption text-muted-foreground">Respondidas</p>
              </div>
              <div className="p-2.5 sm:p-3 rounded-xl bg-[hsl(var(--exam-surface))] border border-[hsl(var(--exam-border))] text-center">
                <div className="flex items-center justify-center gap-1">
                  <Zap className="h-3.5 w-3.5 text-success" aria-hidden />
                  <p className="text-heading-3 text-success">{summary.highConfidence}</p>
                </div>
                <p className="text-caption text-muted-foreground">Alta certeza</p>
              </div>
            </div>

            {summary.unanswered > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 mb-4 sm:mb-6">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-warning mb-2">
                    Você tem {summary.unanswered} {summary.unanswered === 1 ? 'questão' : 'questões'} sem resposta.
                  </p>
                  <div className="max-h-24 overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-1.5">
                      {summary.unansweredIndices.slice(0, 12).map(i => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            onCancel();
                            onNavigateToQuestion(i);
                          }}
                          aria-label={`Ir para questão ${i + 1}`}
                          className="h-7 w-7 rounded-md text-[11px] font-bold bg-warning/15 text-warning border border-warning/30 hover:bg-warning/25 transition-colors"
                        >
                          {i + 1}
                        </button>
                      ))}
                      {summary.unansweredIndices.length > 12 && (
                        <span className="text-body-sm text-muted-foreground self-center">
                          +{summary.unansweredIndices.length - 12} mais
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {summary.markedForReview > 0 && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-info/10 mb-4 sm:mb-6">
                <Flag className="h-4 w-4 text-info shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-body-sm text-info mb-2">
                    Você marcou {summary.markedForReview} {summary.markedForReview === 1 ? 'questão' : 'questões'} para revisão.
                  </p>
                  <div className="max-h-24 overflow-y-auto pr-1">
                    <div className="flex flex-wrap gap-1.5">
                      {reviewIndices.slice(0, 12).map(i => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => {
                            onCancel();
                            onNavigateToQuestion(i);
                          }}
                          aria-label={`Ir para questão ${i + 1}`}
                          className="h-7 w-7 rounded-md text-[11px] font-bold bg-info/15 text-info border border-info/30 hover:bg-info/25 transition-colors"
                        >
                          {i + 1}
                        </button>
                      ))}
                      {reviewIndices.length > 12 && (
                        <span className="text-body-sm text-muted-foreground self-center">
                          +{reviewIndices.length - 12} mais
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <p className="text-caption text-muted-foreground text-center">
              Suas respostas já foram salvas. Você poderá ver o gabarito quando o resultado for liberado.
            </p>
          </div>

          <div className="border-t border-[hsl(var(--exam-border))] px-4 py-3 sm:px-6 sm:py-4 md:px-8 bg-[hsl(var(--exam-surface))]/90 backdrop-blur-sm">
            <div className="space-y-3">
              <button
                type="button"
                onClick={onConfirm}
                disabled={submitting}
                className="w-full min-h-[48px] px-6 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" aria-hidden />
                    Enviando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" aria-hidden />
                    Finalizar prova
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={onCancel}
                disabled={submitting}
                className="w-full py-2.5 text-body text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                Continuar respondendo
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
