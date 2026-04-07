/**
 * AnswerSheetPage — /simulados/:id/gabarito
 *
 * Digital answer sheet for offline exam submission.
 * Student fills in A/B/C/D bubbles for each question and submits.
 * Server validates timing and determines is_within_window.
 */
import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CheckCircle, AlertCircle, Send } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { PageHeader } from '@/components/PageHeader';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { useOfflineAttempt } from '@/hooks/useOfflineAttempt';
import { offlineApi } from '@/services/offlineApi';
import { AnswerSheetGrid, type AnswerSheetQuestion } from '@/components/exam/AnswerSheetGrid';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export default function AnswerSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  const { activeAttempt, clearAttempt } = useOfflineAttempt();

  // answers: question_id → selected option_id
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const answeredCount = Object.keys(answers).length;

  // Shape questions for the grid (only id, number, options with A/B/C/D)
  const gridQuestions = useMemo<AnswerSheetQuestion[]>(() => {
    return questions.map(q => ({
      id: q.id,
      number: q.number,
      options: q.options
        .filter(o => ['A', 'B', 'C', 'D'].includes(o.label))
        .map(o => ({ id: o.id, label: o.label })),
    }));
  }, [questions]);

  // Auto-focus first unanswered question on load
  useEffect(() => {
    if (gridQuestions.length > 0 && focusedQuestionId === null) {
      setFocusedQuestionId(gridQuestions[0].id);
    }
  }, [gridQuestions, focusedQuestionId]);

  // Validate that this page belongs to the active offline attempt
  const attemptBelongsHere = activeAttempt && simulado
    ? activeAttempt.simulado_id === simulado.id
    : true; // allow if still loading

  const handleSelect = useCallback(
    (questionId: string, optionId: string) => {
      setAnswers(prev => ({ ...prev, [questionId]: optionId }));

      // Auto-advance to next unanswered
      setFocusedQuestionId(prev => {
        const idx = gridQuestions.findIndex(q => q.id === questionId);
        // Find next unanswered after this one
        for (let i = idx + 1; i < gridQuestions.length; i++) {
          const next = gridQuestions[i];
          if (!answers[next.id]) return next.id;
        }
        // Wrap: find first unanswered
        for (let i = 0; i < idx; i++) {
          if (!answers[gridQuestions[i].id]) return gridQuestions[i].id;
        }
        return prev; // all answered
      });
    },
    [gridQuestions, answers],
  );

  const handleSubmit = useCallback(async () => {
    if (!activeAttempt) {
      toast({
        title: 'Sessão expirada',
        description: 'Nenhuma tentativa offline ativa encontrada.',
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    setShowConfirm(false);

    try {
      // Build payload: answered questions + nulls for skipped ones
      const payload = gridQuestions.map(q => ({
        question_id:        q.id,
        selected_option_id: answers[q.id] ?? null,
      }));

      const result = await offlineApi.submitOfflineAnswers(activeAttempt.id, payload);
      logger.log('[AnswerSheetPage] Submit result:', result);

      clearAttempt();

      if (result.is_within_window) {
        toast({ title: 'Gabarito enviado!', description: 'Sua tentativa foi registrada no ranking.' });
      } else {
        toast({
          title: 'Gabarito enviado',
          description: 'Resultado disponível, mas fora da janela de ranking.',
        });
      }

      navigate(`/simulados/${simulado?.slug ?? id}/resultado`);
    } catch (err) {
      logger.error('[AnswerSheetPage] Submit error:', err);
      toast({
        title: 'Erro ao enviar gabarito',
        description: (err as Error)?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  }, [activeAttempt, gridQuestions, answers, clearAttempt, navigate, simulado, id]);

  // ─── Loading ───────────────────────────────────────────────────────────────

  if (loadingSim) {
    return (
      <>
        <PageHeader title="Gabarito Offline" />
        <div className="space-y-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </>
    );
  }

  if (!simulado || gridQuestions.length === 0) {
    return (
      <>
        <PageHeader title="Gabarito Offline" />
        <EmptyState
          variant="error"
          title="Simulado não encontrado"
          description="Não foi possível carregar as questões."
          backHref="/simulados"
          backLabel="Voltar aos Simulados"
        />
      </>
    );
  }

  if (!attemptBelongsHere) {
    return (
      <>
        <PageHeader title="Gabarito Offline" />
        <EmptyState
          variant="error"
          title="Tentativa offline não encontrada"
          description="Faça o download da prova antes de preencher o gabarito."
          backHref="/simulados"
          backLabel="Voltar aos Simulados"
        />
      </>
    );
  }

  const progressPercent = (answeredCount / gridQuestions.length) * 100;
  const allAnswered = answeredCount === gridQuestions.length;

  return (
    <>
      <PageHeader
        title="Gabarito Offline"
        subtitle={simulado.title}
      />

      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
        className="space-y-6"
      >
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">
              <span className="font-semibold text-foreground">{answeredCount}</span> de{' '}
              {gridQuestions.length} respondidas
            </span>
            {allAnswered && (
              <span className="flex items-center gap-1.5 text-success font-medium">
                <CheckCircle className="h-4 w-4" />
                Todas respondidas
              </span>
            )}
          </div>
          <Progress value={progressPercent} className="h-2" />
        </div>

        {/* Incomplete warning */}
        {!allAnswered && answeredCount > 0 && (
          <div
            className="flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
            style={{
              background: 'hsl(var(--warning) / 0.08)',
              border: '1px solid hsl(var(--warning) / 0.2)',
              color: 'hsl(var(--warning))',
            }}
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            Faltam {gridQuestions.length - answeredCount} questão(ões) sem resposta. Responda todas para enviar.
          </div>
        )}

        {/* Answer grid */}
        <div className="rounded-xl border border-border bg-card p-4 md:p-6">
          <AnswerSheetGrid
            questions={gridQuestions}
            answers={answers}
            onSelect={handleSelect}
            focusedQuestionId={focusedQuestionId}
          />
        </div>

        {/* Submit button — sticky bottom */}
        <div className="sticky bottom-4 flex justify-center">
          <Button
            size="lg"
            onClick={() => setShowConfirm(true)}
            disabled={submitting || !allAnswered}
            className="shadow-lg gap-2 px-8"
          >
            <Send className="h-4 w-4" />
            Enviar gabarito
          </Button>
        </div>
      </motion.div>

      {/* Confirmation modal */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-heading-2">Confirmar envio?</DialogTitle>
            <DialogDescription className="mt-2 text-body text-muted-foreground">
              {allAnswered ? (
                'Todas as questões foram respondidas. Após enviar, o gabarito não pode ser alterado.'
              ) : (
              <>
                  <strong>{gridQuestions.length - answeredCount} questão(ões)</strong> sem resposta.
                  Responda todas as questões antes de enviar o gabarito.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mt-6">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setShowConfirm(false)}
              disabled={submitting}
            >
              Voltar
            </Button>
            <Button
              className="flex-1 gap-2"
              onClick={handleSubmit}
              disabled={submitting || !allAnswered}
            >
              {submitting ? 'Enviando…' : !allAnswered ? `Faltam ${gridQuestions.length - answeredCount} questões` : 'Confirmar envio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
