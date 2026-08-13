/**
 * PresencialPage — /presencial/:codigo
 *
 * Rota pública (sem sessão, fora do shell premium) que conduz o fluxo
 * completo da aplicação presencial no dia da prova: identificação → gabarito
 * de bolhas → resultado. O aluno chega aqui lendo um QR code impresso na
 * sala; o tempo de prova foi controlado pelo fiscal no papel, então não há
 * cronômetro nesta tela.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import { useParams } from 'react-router-dom';
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
import { BrandLogo } from '@/components/brand/BrandMark';
import { AnswerSheetGrid, type AnswerSheetQuestion } from '@/components/exam/AnswerSheetGrid';
import { PresencialIdentifyStep } from '@/components/presencial/PresencialIdentifyStep';
import { PresencialResultStep } from '@/components/presencial/PresencialResultStep';
import { presencialApi } from '@/services/presencialApi';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import type { PresencialReady, PresencialResult } from '@/types/presencial';

type Stage = 'identify' | 'sheet' | 'result';

export default function PresencialPage() {
  const { codigo } = useParams<{ codigo: string }>();
  const prefersReducedMotion = useReducedMotion();

  const [stage, setStage] = useState<Stage>('identify');
  const [ready, setReady] = useState<PresencialReady | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<PresencialResult | null>(null);

  const answeredCount = Object.keys(answers).length;

  // Shape the skeleton (question_id, number, options) into what AnswerSheetGrid expects (id, number, options).
  const gridQuestions = useMemo<AnswerSheetQuestion[]>(() => {
    if (!ready) return [];
    return ready.questions.map(q => ({
      id: q.question_id,
      number: q.number,
      options: q.options,
    }));
  }, [ready]);

  // Auto-focus first unanswered question when the sheet mounts.
  useEffect(() => {
    if (stage === 'sheet' && gridQuestions.length > 0 && focusedQuestionId === null) {
      setFocusedQuestionId(gridQuestions[0].id);
    }
  }, [stage, gridQuestions, focusedQuestionId]);

  const handleReady = useCallback((readyResult: PresencialReady) => {
    setReady(readyResult);
    setStage('sheet');
  }, []);

  const handleSelect = useCallback(
    (questionId: string, optionId: string) => {
      setAnswers(prev => ({ ...prev, [questionId]: optionId }));

      // Auto-advance to next unanswered, same mechanic as AnswerSheetPage.
      setFocusedQuestionId(prev => {
        const idx = gridQuestions.findIndex(q => q.id === questionId);
        for (let i = idx + 1; i < gridQuestions.length; i++) {
          const next = gridQuestions[i];
          if (!answers[next.id]) return next.id;
        }
        for (let i = 0; i < idx; i++) {
          if (!answers[gridQuestions[i].id]) return gridQuestions[i].id;
        }
        return prev;
      });
    },
    [gridQuestions, answers],
  );

  const handleSubmit = useCallback(async () => {
    if (!ready) return;

    setSubmitting(true);
    setShowConfirm(false);

    try {
      // Answers travel in question order, matching AnswerSheetPage's payload shape.
      const payload = gridQuestions.map(q => ({
        question_id: q.id,
        selected_option_id: answers[q.id],
      }));

      const submitResult = await presencialApi.submit({ token: ready.token, answers: payload });
      logger.log('[PresencialPage] Resultado do envio:', submitResult);

      setResult(submitResult);
      setStage('result');
    } catch (err) {
      logger.error('[PresencialPage] Erro ao enviar gabarito:', err);
      toast({
        title: 'Erro ao enviar gabarito',
        description: (err as Error)?.message ?? 'Tente novamente.',
        variant: 'destructive',
      });
      setSubmitting(false);
    }
  }, [ready, gridQuestions, answers]);

  const allAnswered = gridQuestions.length > 0 && answeredCount === gridQuestions.length;
  const progressPercent = gridQuestions.length > 0 ? (answeredCount / gridQuestions.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="flex justify-center border-b border-border py-4">
        <BrandLogo />
      </header>

      {stage === 'identify' && (
        <PresencialIdentifyStep code={codigo ?? ''} onReady={handleReady} />
      )}

      {stage === 'sheet' && (
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
          className="mx-auto max-w-3xl space-y-6 px-4 py-6"
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
              Faltam {gridQuestions.length - answeredCount} questão(ões) sem resposta. Responda
              todas para enviar.
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
      )}

      {stage === 'result' && result && <PresencialResultStep result={result} />}

      {/* Confirmation modal — same texts/mechanics as AnswerSheetPage */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-heading-2">Confirmar envio?</DialogTitle>
            <DialogDescription className="mt-2 text-body text-muted-foreground">
              {allAnswered ? (
                'Todas as questões foram respondidas. Após enviar, o gabarito não pode ser alterado.'
              ) : (
                <>
                  <strong>{gridQuestions.length - answeredCount} questão(ões)</strong> sem
                  resposta. Responda todas as questões antes de enviar o gabarito.
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
              {submitting
                ? 'Enviando…'
                : !allAnswered
                  ? `Faltam ${gridQuestions.length - answeredCount} questões`
                  : 'Confirmar envio'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
