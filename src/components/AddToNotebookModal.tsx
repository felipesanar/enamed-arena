import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X, Sparkles, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';
import { simuladosApi } from '@/services/simuladosApi';
import { toast } from '@/hooks/use-toast';
import {
  type LocalReason,
  LOCAL_REASON_LABELS,
  LOCAL_TO_DB_REASON,
} from '@/lib/errorNotebookReasons';

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
  userId: string;
  onAdded?: () => void;
  selectedHighlight?: string;
}

export function AddToNotebookModal({
  open, onClose, questionId, simuladoId, simuladoTitle,
  area, theme, questionNumber, questionText, wasCorrect, userId, onAdded,
  selectedHighlight,
}: AddToNotebookModalProps) {
  const [reason, setReason] = useState<LocalReason | null>(null);
  const [learningNote, setLearningNote] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setReason(null);
    setLearningNote(selectedHighlight ? `"${selectedHighlight}"\n\n` : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const handleSubmit = async () => {
    if (!reason || !userId) return;
    setSaving(true);
    try {
      await simuladosApi.addToErrorNotebook({
        userId,
        simuladoId,
        questionId,
        area,
        theme,
        reason: LOCAL_TO_DB_REASON[reason],
        learningText: learningNote || null,
        wasCorrect,
        questionNumber,
        questionText: questionText.substring(0, 500),
        simuladoTitle,
      });
      toast({ title: 'Salvo no Caderno de Erros', description: 'Questão adicionada com sucesso.' });
      onAdded?.();
      onClose();
    } catch (err) {
      console.error('[AddToNotebookModal] Error:', err);
      toast({ title: 'Erro ao salvar', description: 'Tente novamente.', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const reasons: LocalReason[] = wasCorrect ? ['acertei_sem_certeza'] : ['nao_sei', 'nao_lembrei', 'nao_entendi'];

  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4" onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.95, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 16 }} transition={{ type: 'spring', damping: 25, stiffness: 300 }} className="bg-card border border-border rounded-2xl shadow-xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
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

            <div className="mb-4">
              <p className="text-body-sm font-semibold text-foreground mb-2">Por que quer salvar esta questão?</p>
              <div className="grid grid-cols-1 gap-2">
                {reasons.map(r => (
                  <button key={r} onClick={() => setReason(r)} className={cn(
                    'text-left p-3 rounded-xl border text-body-sm transition-all',
                    reason === r ? 'border-primary bg-primary/5 text-foreground font-medium' : 'border-border/60 bg-card text-muted-foreground hover:bg-accent/30',
                  )}>{LOCAL_REASON_LABELS[r]}</button>
                ))}
              </div>
            </div>

            <div className="mb-5">
              <p className="text-body-sm font-semibold text-foreground mb-2">Anotação de aprendizado <span className="text-muted-foreground font-normal">(opcional)</span></p>
              {selectedHighlight && (
                <div className="mb-2 rounded-xl bg-primary/5 border border-primary/15 p-3">
                  <p className="text-caption font-semibold text-primary mb-1.5 flex items-center gap-1.5">
                    <Quote className="h-3.5 w-3.5" /> Trecho do comentário
                  </p>
                  <p className="text-body-sm text-muted-foreground leading-relaxed italic line-clamp-3">"{selectedHighlight}"</p>
                </div>
              )}
              <textarea
                value={learningNote}
                onChange={e => setLearningNote(e.target.value)}
                placeholder="O que você aprendeu com esta questão?"
                rows={3}
                className="w-full rounded-xl border border-border/60 bg-card p-3 text-body-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
              <button onClick={handleSubmit} disabled={!reason || saving} className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-body-sm font-semibold hover:bg-wine-hover transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                <Sparkles className="h-3.5 w-3.5" />
                {saving ? 'Salvando...' : 'Salvar no Caderno'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
