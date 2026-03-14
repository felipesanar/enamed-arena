import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  type ErrorReason,
  ERROR_REASON_LABELS,
  addToNotebook,
  isInNotebook,
} from '@/lib/notebook-helpers';

interface AddToNotebookModalProps {
  open: boolean;
  onClose: () => void;
  questionId: string;
  simuladoId: string;
  simuladoTitle: string;
  area: string;
  theme: string;
  questionNumber: number;
  questionText: string;
  wasCorrect: boolean;
  onAdded?: () => void;
}

export function AddToNotebookModal({
  open,
  onClose,
  questionId,
  simuladoId,
  simuladoTitle,
  area,
  theme,
  questionNumber,
  questionText,
  wasCorrect,
  onAdded,
}: AddToNotebookModalProps) {
  const [reason, setReason] = useState<ErrorReason | null>(null);
  const [learningNote, setLearningNote] = useState('');
  const alreadyAdded = isInNotebook(questionId, simuladoId);

  console.log('[AddToNotebookModal] Rendering, open:', open);

  const handleSubmit = () => {
    if (!reason) return;
    addToNotebook({
      questionId,
      simuladoId,
      simuladoTitle,
      area,
      theme,
      questionNumber,
      questionText: questionText.substring(0, 300),
      reason,
      learningNote,
      wasCorrect,
    });
    onAdded?.();
    onClose();
    setReason(null);
    setLearningNote('');
  };

  const reasons: ErrorReason[] = wasCorrect
    ? ['acertei_sem_certeza']
    : ['nao_sei', 'nao_lembrei', 'nao_entendi'];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-[18px] w-[18px] text-primary" />
                </div>
                <div>
                  <h3 className="text-heading-3 text-foreground">Caderno de Erros</h3>
                  <p className="text-caption text-muted-foreground">Questão {questionNumber}</p>
                </div>
              </div>
              <button onClick={onClose} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            {alreadyAdded && (
              <div className="rounded-xl bg-info/10 border border-info/20 p-3 mb-4">
                <p className="text-body-sm text-info">Esta questão já está no seu Caderno de Erros. Salvar novamente atualizará a entrada existente.</p>
              </div>
            )}

            {/* Reason selector */}
            <div className="mb-4">
              <p className="text-body-sm font-semibold text-foreground mb-2">Por que quer salvar esta questão?</p>
              <div className="grid grid-cols-1 gap-2">
                {reasons.map(r => (
                  <button
                    key={r}
                    onClick={() => setReason(r)}
                    className={cn(
                      'text-left p-3 rounded-xl border text-body-sm transition-all',
                      reason === r
                        ? 'border-primary bg-primary/5 text-foreground font-medium'
                        : 'border-border/60 bg-card text-muted-foreground hover:bg-accent/30',
                    )}
                  >
                    {ERROR_REASON_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            {/* Learning note */}
            <div className="mb-5">
              <p className="text-body-sm font-semibold text-foreground mb-2">Anotação de aprendizado <span className="text-muted-foreground font-normal">(opcional)</span></p>
              <textarea
                value={learningNote}
                onChange={e => setLearningNote(e.target.value)}
                placeholder="O que você aprendeu com esta questão?"
                rows={3}
                className="w-full rounded-xl border border-border/60 bg-card p-3 text-body-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body-sm font-medium hover:bg-muted transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmit}
                disabled={!reason}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body-sm font-semibold hover:bg-wine-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Salvar no Caderno
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
