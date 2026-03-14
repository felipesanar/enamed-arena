import { motion } from 'framer-motion';
import { CheckCircle2, Clock, Flag, Zap, AlertTriangle } from 'lucide-react';
import type { ExamSummary } from '@/types/exam';

interface SubmitConfirmModalProps {
  summary: ExamSummary;
  onConfirm: () => void;
  onCancel: () => void;
}

export function SubmitConfirmModal({ summary, onConfirm, onCancel }: SubmitConfirmModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-card rounded-2xl border border-border shadow-lg max-w-md w-full p-6 md:p-8"
      >
        <div className="text-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-7 w-7 text-primary" />
          </div>
          <h2 className="text-heading-2 text-foreground mb-2">Finalizar simulado?</h2>
          <p className="text-body text-muted-foreground">
            Revise o resumo abaixo antes de confirmar. Após a finalização, não será possível alterar suas respostas.
          </p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <p className="text-heading-3 text-foreground">{summary.answered}</p>
            <p className="text-caption text-muted-foreground">Respondidas</p>
          </div>
          <div className="p-3 rounded-xl bg-muted/50 text-center">
            <p className="text-heading-3 text-foreground">{summary.unanswered}</p>
            <p className="text-caption text-muted-foreground">Em branco</p>
          </div>
          <div className="p-3 rounded-xl bg-warning/10 text-center">
            <div className="flex items-center justify-center gap-1">
              <Flag className="h-3.5 w-3.5 text-warning" />
              <p className="text-heading-3 text-warning">{summary.markedForReview}</p>
            </div>
            <p className="text-caption text-muted-foreground">Para revisar</p>
          </div>
          <div className="p-3 rounded-xl bg-success/10 text-center">
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-3.5 w-3.5 text-success" />
              <p className="text-heading-3 text-success">{summary.highConfidence}</p>
            </div>
            <p className="text-caption text-muted-foreground">Alta certeza</p>
          </div>
        </div>

        {summary.unanswered > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-xl bg-warning/10 mb-6">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
            <p className="text-body-sm text-warning">
              Você tem {summary.unanswered} {summary.unanswered === 1 ? 'questão' : 'questões'} sem resposta. Questões em branco serão consideradas incorretas.
            </p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-3 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors"
          >
            Voltar à prova
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
          >
            Finalizar
          </button>
        </div>
      </motion.div>
    </div>
  );
}
