/**
 * AnswerSheetPage — /simulados/:id/gabarito
 *
 * Digital answer sheet for offline exam submission.
 * Student fills in A/B/C/D bubbles for each question and submits.
 * Server validates timing and determines is_within_window.
 *
 * v2 (fluxo logado, presencial): quando o simulado tem cadernos impressos
 * ativos (`list_active_cadernos`), o aluno escolhe qual caderno recebeu
 * (Tela 0 — `PresencialCadernoStep`) antes de ver a grade, e a grade é
 * montada a partir do ESQUELETO do caderno (`get_caderno_skeleton`) — não de
 * `useSimuladoDetail().questions`. Sem cadernos ativos, o comportamento é o
 * de sempre. Ver docs/superpowers/specs/2026-09-06-presencial-cadernos-v2-fluxo-logado.md
 *
 * Invariante: se o esqueleto do caderno vier vazio ou a busca falhar, a
 * grade NUNCA cai na ordem natural das questões — preencher na ordem errada
 * é pior do que não preencher. Mostramos um estado de erro com "tentar de
 * novo" em vez disso.
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
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
import { cadernoApi } from '@/services/cadernoApi';
import { AnswerSheetGrid, type AnswerSheetQuestion } from '@/components/exam/AnswerSheetGrid';
import { PresencialCadernoStep } from '@/components/presencial/PresencialCadernoStep';
import { PresencialCadernoBanner } from '@/components/presencial/PresencialCadernoBanner';
import { cadernoColorLabel } from '@/components/presencial/presencialCadernoColors';
import type { PresencialCaderno, CadernoSkeletonQuestion } from '@/types/presencial';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';

export default function AnswerSheetPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const { simulado, questions, loading: loadingSim } = useSimuladoDetail(id);
  // Scope the offline attempt lookup to this simulado — a student can have
  // several pending offline attempts (one per simulado).
  const { activeAttempt, clearAttempt } = useOfflineAttempt(simulado?.id);

  // answers: question_id → selected option_id
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [focusedQuestionId, setFocusedQuestionId] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const answeredCount = Object.keys(answers).length;

  // ─── Cadernos impressos (v2 — fluxo logado) ────────────────────────────────
  // `null` = ainda não resolvido (loading); `[]` = sem cadernos ativos —
  // comportamento de hoje, inalterado.
  const [activeCadernos, setActiveCadernos] = useState<PresencialCaderno[] | null>(null);
  const [cadernosListError, setCadernosListError] = useState(false);
  const [selectedCaderno, setSelectedCaderno] = useState<PresencialCaderno | null>(null);
  const [cadernoSkeleton, setCadernoSkeleton] = useState<CadernoSkeletonQuestion[] | null>(null);
  const [cadernoSkeletonLoading, setCadernoSkeletonLoading] = useState(false);
  const [cadernoSkeletonError, setCadernoSkeletonError] = useState(false);
  const [showCadernoSwap, setShowCadernoSwap] = useState(false);

  const loadCadernos = useCallback(async (simuladoId: string) => {
    setCadernosListError(false);
    try {
      const list = await cadernoApi.listActiveCadernos(simuladoId);
      setActiveCadernos(list);
    } catch (err) {
      logger.error('[AnswerSheetPage] Erro ao listar cadernos ativos:', err);
      setActiveCadernos(null);
      setCadernosListError(true);
    }
  }, []);

  useEffect(() => {
    if (simulado?.id) {
      void loadCadernos(simulado.id);
    }
  }, [simulado?.id, loadCadernos]);

  // Sala com 1+ caderno ativo: pergunta qual antes da grade (Tela 0).
  const showCadernoFlow = (activeCadernos?.length ?? 0) > 0;

  const resolveCaderno = useCallback(
    async (caderno: PresencialCaderno) => {
      if (!simulado) return;
      if (!activeAttempt) {
        toast({
          title: 'Sessão expirada',
          description: 'Nenhuma tentativa offline ativa encontrada.',
          variant: 'destructive',
        });
        return;
      }

      setSelectedCaderno(caderno);
      setCadernoSkeleton(null);
      setCadernoSkeletonError(false);
      setCadernoSkeletonLoading(true);

      try {
        await cadernoApi.setAttemptCaderno(activeAttempt.id, caderno.code);
        const skeleton = await cadernoApi.getCadernoSkeleton(simulado.id, caderno.code);

        if (skeleton.length === 0) {
          // 0 linhas = caderno indisponível/incompleto. NUNCA cair na ordem
          // natural das questões aqui — ver comentário no topo do arquivo.
          setCadernoSkeletonError(true);
          return;
        }

        setCadernoSkeleton(skeleton);
        setAnswers({});
        setFocusedQuestionId(null);
      } catch (err) {
        logger.error('[AnswerSheetPage] Erro ao resolver o caderno escolhido:', err);
        setCadernoSkeletonError(true);
      } finally {
        setCadernoSkeletonLoading(false);
      }
    },
    [simulado, activeAttempt],
  );

  // Troca de caderno: as marcações apontam para as questões do caderno
  // anterior, então apagamos tudo e voltamos para a Tela 0.
  const doCadernoSwap = useCallback(() => {
    setShowCadernoSwap(false);
    setSelectedCaderno(null);
    setCadernoSkeleton(null);
    setCadernoSkeletonError(false);
    setAnswers({});
    setFocusedQuestionId(null);
  }, []);

  // Com gabarito já preenchido, confirma antes — trocar de caderno custaria
  // o trabalho todo. Sem nada marcado ainda, troca direto.
  const requestCadernoSwap = useCallback(() => {
    if (answeredCount > 0) {
      setShowCadernoSwap(true);
      return;
    }
    doCadernoSwap();
  }, [answeredCount, doCadernoSwap]);

  // Shape questions for the grid (only id, number, options with A/B/C/D).
  // Em fluxo de caderno, vem do esqueleto do caderno (ordem impressa); senão,
  // das questões do simulado na ordem natural — comportamento de hoje.
  const gridQuestions = useMemo<AnswerSheetQuestion[]>(() => {
    if (showCadernoFlow) {
      if (!cadernoSkeleton) return [];
      return cadernoSkeleton.map(q => ({
        id: q.question_id,
        number: q.number,
        options: q.options,
      }));
    }
    return questions.map(q => ({
      id: q.id,
      number: q.number,
      options: q.options
        .filter(o => ['A', 'B', 'C', 'D'].includes(o.label))
        .map(o => ({ id: o.id, label: o.label })),
    }));
  }, [showCadernoFlow, cadernoSkeleton, questions]);

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
        toast({
          title: 'Gabarito enviado!',
          description: 'Sua tentativa foi registrada no ranking. Revise seus erros no Caderno após a correção.',
        });
      } else {
        toast({
          title: 'Gabarito enviado',
          description: 'Resultado disponível, mas fora da janela de ranking. Revise seus erros no Caderno após a correção.',
        });
      }

      navigate(`/simulados/${simulado?.slug ?? id}`);
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

  const loadingUI = (
    <>
      <PageHeader title="Gabarito Offline" />
      <div className="space-y-4">
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </>
  );

  if (loadingSim) {
    return loadingUI;
  }

  if (!simulado) {
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

  // Ainda buscando `list_active_cadernos` — decide se a Tela 0 aparece.
  if (activeCadernos === null) {
    if (cadernosListError) {
      return (
        <>
          <PageHeader title="Gabarito Offline" subtitle={simulado.title} />
          <EmptyState
            variant="error"
            title="Não foi possível carregar os cadernos"
            description="Verifique sua conexão e tente novamente."
            onRetry={() => void loadCadernos(simulado.id)}
            backHref="/simulados"
            backLabel="Voltar aos Simulados"
          />
        </>
      );
    }
    return loadingUI;
  }

  // Tela 0 — sala com caderno(s) ativo(s) e nenhum escolhido ainda.
  if (showCadernoFlow && !selectedCaderno) {
    return (
      <>
        <PageHeader title="Gabarito Offline" subtitle={simulado.title} />
        <PresencialCadernoStep cadernos={activeCadernos} onSelect={resolveCaderno} />
      </>
    );
  }

  if (showCadernoFlow && cadernoSkeletonLoading) {
    return loadingUI;
  }

  // 0 linhas ou falha ao buscar o esqueleto do caderno: NUNCA cair na ordem
  // natural das questões — estado de erro com "tentar de novo".
  if (showCadernoFlow && (cadernoSkeletonError || gridQuestions.length === 0)) {
    return (
      <>
        <PageHeader title="Gabarito Offline" subtitle={simulado.title} />
        <EmptyState
          variant="error"
          title="Caderno indisponível"
          description="Chame o fiscal."
          onRetry={() => selectedCaderno && void resolveCaderno(selectedCaderno)}
          backHref="/simulados"
          backLabel="Voltar aos Simulados"
        />
      </>
    );
  }

  // Comportamento de hoje: sem cadernos ativos, grade natural, sem questões.
  if (!showCadernoFlow && gridQuestions.length === 0) {
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

      {selectedCaderno && (
        <PresencialCadernoBanner
          caderno={selectedCaderno}
          sticky
          onChangeCaderno={requestCadernoSwap}
        />
      )}

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

      {/* Troca de caderno com gabarito já preenchido — precisa confirmar,
          porque as respostas marcadas se perdem (apontam para as questões do
          caderno anterior). */}
      <Dialog open={showCadernoSwap} onOpenChange={setShowCadernoSwap}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-heading-2">Trocar de caderno?</DialogTitle>
            <DialogDescription className="mt-2 text-body text-muted-foreground">
              Você marcou <strong>{answeredCount} questão(ões)</strong>. Trocar de caderno apaga
              essas marcações, porque cada caderno tem as questões em outra ordem — não dá para
              aproveitar o que já foi preenchido. Você volta para a escolha do caderno e começa o
              gabarito de novo.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-6 flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setShowCadernoSwap(false)}>
              Continuar neste
            </Button>
            <Button variant="destructive" className="flex-1" onClick={doCadernoSwap}>
              Apagar e trocar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              {selectedCaderno && (
                <>
                  <br />
                  <strong>
                    {selectedCaderno.label} · {cadernoColorLabel(selectedCaderno.color)}
                  </strong>{' '}
                  — confira se é o caderno na sua mesa.
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
