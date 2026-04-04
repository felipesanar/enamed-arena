import { CheckCircle2, Flag, Zap, AlertTriangle, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { ExamSummary } from '@/types/exam';

interface SubmitConfirmModalProps {
  open: boolean;
  summary: ExamSummary;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onNavigateToQuestion: (index: number) => void;
}

export function SubmitConfirmModal({
  open,
  summary,
  submitting,
  onConfirm,
  onCancel,
  onNavigateToQuestion,
}: SubmitConfirmModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent
        className="max-w-md w-full rounded-2xl border border-border p-6 md:p-8 gap-0"
        onPointerDownOutside={(e) => submitting && e.preventDefault()}
        onEscapeKeyDown={(e) => submitting && e.preventDefault()}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Finalizar simulado?</DialogTitle>
          <DialogDescription>
            Ao confirmar, seu simulado será enviado e não poderá ser alterado.
          </DialogDescription>
        </DialogHeader>

        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-primary" aria-hidden />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Finalizar simulado?</h2>
          <p className="text-body text-muted-foreground mb-1">
            Ao confirmar, seu simulado será enviado e não poderá ser alterado.
          </p>
          <p className="text-body-sm text-muted-foreground">
            Nada será perdido. Você poderá conferir o gabarito quando o resultado for liberado.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <p className="text-heading-3 text-foreground">{summary.answered}</p>
            <p className="text-caption text-muted-foreground">Respondidas</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <p className="text-heading-3 text-foreground">{summary.unanswered}</p>
            <p className="text-caption text-muted-foreground">Em branco</p>
          </div>
          <div className="p-3 rounded-xl bg-info/10 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flag className="h-3.5 w-3.5 text-info" aria-hidden />
              <p className="text-heading-3 text-info">{summary.markedForReview}</p>
            </div>
            <p className="text-caption text-muted-foreground">Para revisar</p>
          </div>
          <div className="p-3 rounded-xl bg-success/10 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-3.5 w-3.5 text-success" aria-hidden />
              <p className="text-heading-3 text-success">{summary.highConfidence}</p>
            </div>
            <p className="text-caption text-muted-foreground">Alta certeza</p>
          </div>
        </div>

        {summary.unanswered > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 mb-6">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" aria-hidden />
            <div className="flex-1 min-w-0">
              <p className="text-body-sm text-warning mb-2">
                Você tem {summary.unanswered} {summary.unanswered === 1 ? 'questão' : 'questões'} sem resposta.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {summary.unansweredIndices.slice(0, 12).map(i => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      onCancel();
                      onNavigateToQuestion(i);
                    }}
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
        )}

        {summary.markedForReview > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-info/10 mb-6">
            <Flag className="h-4 w-4 text-info shrink-0 mt-0.5" aria-hidden />
            <p className="text-body-sm text-info">
              Você marcou {summary.markedForReview} {summary.markedForReview === 1 ? 'questão' : 'questões'} para revisão.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className={cn(
              'flex-1 min-h-[44px] px-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]'
            )}
          >
            Continuar respondendo
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={cn(
              'flex-1 min-h-[44px] px-4 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors disabled:opacity-50',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]'
            )}
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" aria-hidden />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Check className="h-4 w-4" aria-hidden />
                Finalizar
              </span>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
