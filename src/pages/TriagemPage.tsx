/**
 * TriagemPage — Triagem Automática Pós-Prova (spec 04).
 *
 * Rota: /simulados/:id/triagem
 * Acesso: exclusivo PRO. Não-PRO → redireciona para /simulados/:id/resultado.
 *
 * Fluxo:
 *  1. Carrega questões candidatas do attempt (erros + acertos de baixa confiança).
 *  2. Aplica a heurística imediatamente (otimista) nos cards.
 *  3. Em paralelo chama classify-exam-errors; quando responde, substitui os motivos.
 *  4. Erro 429/502 ou timeout → heurística permanece (sem mensagem de erro visível).
 *  5. "Adicionar todas" → addToNotebookBulk → toast → navigate para resultado.
 *  6. "Agora não" → navigate para resultado sem chamada ao banco.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Sparkles, Trophy } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useUser, useHasAccess } from '@/contexts/UserContext';
import { useSimuladoDetail } from '@/hooks/useSimuladoDetail';
import { simuladosApi } from '@/services/simuladosApi';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import type {
  CadernoTriageViewedPayload,
  CadernoTriageItemToggledPayload,
  CadernoTriageBatchAddedPayload,
} from '@/lib/analytics';
import { heuristicReason } from '@/lib/triageHeuristic';
import type { DbReason } from '@/lib/errorNotebookReasons';
import type { BulkAddEntry } from '@/types/caderno';
import { SkeletonCard } from '@/components/SkeletonCard';
import { EmptyState } from '@/components/EmptyState';
import { TriageItemCard } from '@/components/triagem/TriageItemCard';
import { TriageSummaryBar } from '@/components/triagem/TriageSummaryBar';

// ─── Tipos internos ───────────────────────────────────────────────────────────

interface CandidateItem {
  questionId: string;
  questionNumber: number;
  area: string;
  theme: string;
  isCorrect: boolean;
  confidence: 'baixa' | 'media' | 'alta' | null;
  userOptionLabel: string | null;
  correctOptionLabel: string;
  options: Array<{ label: string; text: string }>;
  questionStem: string;
  explanation: string | null;
  /** Motivo atualmente selecionado (pode ter sido editado pelo aluno). */
  reason: DbReason;
  /** Motivo original (heurística ou IA) para distinguir edições. */
  originalReason: DbReason;
  /** Fonte da classificação atual. */
  source: 'ia' | 'heuristic';
  /** Racional da IA (1 frase). */
  rationale: string | null;
  aiCertainty: 'alta' | 'baixa' | null;
  /** Questão já está no caderno (para badge "Já no caderno"). */
  alreadyInNotebook: boolean;
  /** Aluno pulou este item. */
  skipped: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const BATCH_SIZE = 15;

function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function TriagemPage() {
  const { id: simuladoId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const { user } = useAuth();
  const { profile } = useUser();
  const hasAccess = useHasAccess('cadernoErros');

  const { simulado, loading: loadingSim } = useSimuladoDetail(simuladoId);

  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loadingCandidates, setLoadingCandidates] = useState(true);
  const [isClassifying, setIsClassifying] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const triageTrackedRef = useRef(false);

  // ─── Carrega candidatos ────────────────────────────────────────────────────
  const loadCandidates = useCallback(async () => {
    if (!simuladoId || !user) return;
    setLoadingCandidates(true);
    setLoadError(null);

    try {
      // 1. Pega o attempt mais recente finalizado
      const attempt = await simuladosApi.getAttempt(simuladoId, user.id, 'online');
      if (!attempt || (attempt.status !== 'submitted' && attempt.status !== 'expired')) {
        setLoadingCandidates(false);
        return;
      }
      setAttemptId(attempt.id);

      // 2. Carrega resultados por questão, respostas do aluno e questões em paralelo
      const [questionResults, answerRows, questions] = await Promise.all([
        simuladosApi.getAttemptQuestionResults(attempt.id),
        simuladosApi.getAnswers(attempt.id),
        simuladosApi.getQuestions(simuladoId, true),
      ]);

      // Mapas auxiliares
      const answerMap = Object.fromEntries(answerRows.map(a => [a.question_id, a]));
      const questionMap = Object.fromEntries(questions.map(q => [q.id, q]));

      // 3. Carrega entradas existentes do caderno para dedup visual
      let notebookQuestionIds = new Set<string>();
      try {
        const notebook = await simuladosApi.getErrorNotebook(user.id);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        notebookQuestionIds = new Set((notebook as any[]).map((e: any) => e.question_id as string));
      } catch {
        // falha silenciosa — dedup é visual, não crítico
      }

      // 4. Filtra candidatos (spec 04 §2.2)
      const items: CandidateItem[] = [];
      for (const qr of questionResults) {
        const ans = answerMap[qr.question_id];
        const q = questionMap[qr.question_id];
        if (!q) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const confidence = ((ans as any)?.confidence as 'baixa' | 'media' | 'alta' | null) ?? null;
        const wasAnswered = qr.was_answered;

        // Condição 1: errou e respondeu
        const isError = !qr.is_correct && wasAnswered;
        // Condição 2: acertou com baixa confiança
        const isGuessedCorrectly = qr.is_correct && confidence === 'baixa';

        if (!isError && !isGuessedCorrectly) continue;

        // Label das alternativas
        const userSelectedId = qr.selected_option_id;
        const userOption = q.options.find(o => o.id === userSelectedId);
        const correctOption = q.options.find(o => o.id === q.correctOptionId);

        const hInput = {
          isCorrect: qr.is_correct,
          confidence,
          userOptionLabel: userOption?.label ?? null,
          correctOptionLabel: correctOption?.label ?? '',
          options: q.options,
        };
        const hReason = heuristicReason(hInput);

        // Cache de IA na coluna attempt_question_results (spec 04 §7.2)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const cachedAiReason = (qr as any).ai_suggested_reason as string | null;
        const initialReason: DbReason = (cachedAiReason as DbReason) ?? hReason;
        const initialSource: 'ia' | 'heuristic' = cachedAiReason ? 'ia' : 'heuristic';

        items.push({
          questionId: q.id,
          questionNumber: q.number,
          area: q.area,
          theme: q.theme,
          isCorrect: qr.is_correct,
          confidence,
          userOptionLabel: userOption?.label ?? null,
          correctOptionLabel: correctOption?.label ?? '',
          options: q.options,
          questionStem: (q.text ?? '').slice(0, 600),
          explanation: (q.explanation ?? null)
            ? (q.explanation as string).slice(0, 400)
            : null,
          reason: initialReason,
          originalReason: initialReason,
          source: initialSource,
          rationale: null,
          aiCertainty: null,
          alreadyInNotebook: notebookQuestionIds.has(q.id),
          skipped: false,
        });
      }

      // Ordena por número da questão
      items.sort((a, b) => a.questionNumber - b.questionNumber);
      setCandidates(items);

      // Analytics: tela visualizada
      if (!triageTrackedRef.current && items.length > 0) {
        triageTrackedRef.current = true;
        trackEvent('caderno_triage_viewed', {
          attempt_id: attempt.id,
          simulado_id: simuladoId,
          candidate_count: items.length,
        } satisfies CadernoTriageViewedPayload);
      }

      // 5. Inicia classificação por IA (assíncrona, não bloqueia UI)
      const needsClassification = items.filter(i => i.source === 'heuristic');
      if (needsClassification.length > 0) {
        classifyWithAI(attempt.id, needsClassification);
      }
    } catch (err) {
      logger.error('[TriagemPage] Erro ao carregar candidatos:', err);
      setLoadError('Não foi possível carregar as questões. Tente novamente.');
    } finally {
      setLoadingCandidates(false);
    }
  }, [simuladoId, user]);

  useEffect(() => {
    loadCandidates();
  }, [loadCandidates]);

  // ─── Classificação por IA ─────────────────────────────────────────────────
  const classifyWithAI = async (
    currentAttemptId: string,
    items: CandidateItem[],
  ) => {
    setIsClassifying(true);
    try {
      const batches = chunkArray(items, BATCH_SIZE);
      const allClassifications: Array<{
        questionId: string;
        suggestedReason: DbReason;
        rationale: string;
        aiCertainty: 'alta' | 'baixa';
      }> = [];

      for (const batch of batches) {
        const questions = batch.map(item => ({
          questionId: item.questionId,
          questionNumber: item.questionNumber,
          questionStem: item.questionStem,
          options: item.options.map(o => ({ label: o.label, text: o.text })),
          correctOptionLabel: item.correctOptionLabel,
          userOptionLabel: item.userOptionLabel,
          isCorrect: item.isCorrect,
          confidence: item.confidence,
          area: item.area,
          theme: item.theme,
          explanation: item.explanation,
        }));

        try {
          const { data, error } = await supabase.functions.invoke<{
            classifications: Array<{
              questionId: string;
              suggestedReason: DbReason;
              rationale: string;
              aiCertainty: 'alta' | 'baixa';
            }>;
            partial: boolean;
          }>('classify-exam-errors', {
            body: { attemptId: currentAttemptId, questions },
          });

          if (error) {
            logger.log('[TriagemPage] classify-exam-errors retornou erro, usando heurística:', error);
            break; // cai na heurística silenciosamente
          }

          if (data?.classifications) {
            allClassifications.push(...data.classifications);
          }

          // Se partial=true, continua com o que chegou mas para os próximos batches
          if (data?.partial) break;
        } catch {
          // timeout ou erro de rede → heurística permanece
          break;
        }
      }

      if (allClassifications.length > 0) {
        // Atualiza apenas os cards que receberam classificação da IA
        const classMap = Object.fromEntries(
          allClassifications.map(c => [c.questionId, c]),
        );
        setCandidates(prev =>
          prev.map(item => {
            const cls = classMap[item.questionId];
            if (!cls) return item;
            return {
              ...item,
              reason: cls.suggestedReason,
              originalReason: cls.suggestedReason,
              source: 'ia' as const,
              rationale: cls.rationale,
              aiCertainty: cls.aiCertainty,
            };
          }),
        );
      }
    } catch (err) {
      logger.log('[TriagemPage] Erro na classificação por IA (silencioso):', err);
    } finally {
      setIsClassifying(false);
    }
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleReasonChange = useCallback((questionId: string, reason: DbReason) => {
    setCandidates(prev =>
      prev.map(item =>
        item.questionId === questionId ? { ...item, reason } : item,
      ),
    );
  }, []);

  const handleSkip = useCallback((questionId: string) => {
    setCandidates(prev =>
      prev.map(item =>
        item.questionId === questionId ? { ...item, skipped: true } : item,
      ),
    );
    const item = candidates.find(c => c.questionId === questionId);
    if (item) {
      trackEvent('caderno_triage_item_toggled', {
        question_id: questionId,
        action: 'rejected',
        reason: item.reason,
        reason_changed: item.reason !== item.originalReason,
      } satisfies CadernoTriageItemToggledPayload);
    }
  }, [candidates]);

  const handleUnskip = useCallback((questionId: string) => {
    setCandidates(prev =>
      prev.map(item =>
        item.questionId === questionId ? { ...item, skipped: false } : item,
      ),
    );
    const item = candidates.find(c => c.questionId === questionId);
    if (item) {
      trackEvent('caderno_triage_item_toggled', {
        question_id: questionId,
        action: 'accepted',
        reason: item.reason,
        reason_changed: item.reason !== item.originalReason,
      } satisfies CadernoTriageItemToggledPayload);
    }
  }, [candidates]);

  const handleAdd = useCallback(async () => {
    if (!simuladoId || !user || !simulado) return;
    const selected = candidates.filter(c => !c.skipped);
    if (selected.length === 0) return;

    setIsAdding(true);
    try {
      const entries: BulkAddEntry[] = selected.map(c => ({
        question_id: c.questionId,
        simulado_id: simuladoId,
        reason: c.reason,
        was_correct: c.isCorrect,
        learning_text: null,
        question_number: c.questionNumber,
        question_text: c.questionStem.slice(0, 500),
        simulado_title: simulado.title ?? null,
        area: c.area,
        theme: c.theme,
      }));

      const result = await simuladosApi.addToNotebookBulk(entries);

      trackEvent('caderno_triage_batch_added', {
        attempt_id: attemptId ?? '',
        added_count: result.added,
        rejected_count: candidates.filter(c => c.skipped).length,
      } satisfies CadernoTriageBatchAddedPayload);

      const toastParts: string[] = [];
      if (result.added > 0) toastParts.push(`${result.added} adicionada${result.added > 1 ? 's' : ''}`);
      if (result.skipped > 0) toastParts.push(`${result.skipped} já existia${result.skipped > 1 ? 'm' : ''}`);

      toast({
        title: 'Caderno atualizado',
        description: toastParts.join(', ') + ' no caderno de erros.',
      });

      navigate(`/simulados/${simuladoId}/resultado`);
    } catch (err) {
      logger.error('[TriagemPage] Erro ao adicionar ao caderno:', err);
      toast({
        title: 'Erro ao adicionar',
        description: 'Não foi possível salvar no caderno. Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setIsAdding(false);
    }
  }, [candidates, simuladoId, simulado, user, attemptId, navigate]);

  const handleSkipAll = useCallback(() => {
    navigate(`/simulados/${simuladoId}/resultado`);
  }, [navigate, simuladoId]);

  // ─── Render ────────────────────────────────────────────────────────────────

  // ─── Redireciona não-PRO para o resultado ──────────────────────────────────
  // Verificação após todos os hooks (regra do React).
  // Aguarda o carregamento do perfil antes de redirecionar para evitar flash.
  const profileLoaded = profile !== null;
  if (profileLoaded && !hasAccess) {
    return <Navigate to={`/simulados/${simuladoId}/resultado`} replace />;
  }

  if (loadingCandidates || loadingSim) {
    return (
      <div className="max-w-xl mx-auto w-full py-6 space-y-4">
        <div className="h-8 w-48 rounded-lg bg-muted animate-pulse mb-6" />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }

  if (loadError) {
    return (
      <EmptyState
        variant="error"
        title="Não foi possível carregar a triagem"
        description={loadError}
        onRetry={loadCandidates}
        backHref={`/simulados/${simuladoId}/resultado`}
        backLabel="Ir para o resultado"
      />
    );
  }

  // Estado vazio — gabaritou ou não tem candidatos
  if (candidates.length === 0) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
        className="max-w-md mx-auto py-16 text-center px-4"
      >
        <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto mb-6">
          <Trophy className="h-9 w-9 text-primary" aria-hidden />
        </div>
        <h2 className="text-heading-1 mb-3">Parabéns, nenhum erro para revisar!</h2>
        <p className="text-body text-muted-foreground mb-8">
          Continue assim. Sua performance foi excelente neste simulado.
        </p>
        <button
          type="button"
          onClick={() => navigate(`/simulados/${simuladoId}/resultado`)}
          className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-primary text-primary-foreground !text-white font-semibold text-body hover:bg-wine-hover transition-colors"
        >
          <BookOpen className="h-4 w-4" aria-hidden />
          Ver resultado
        </button>
      </motion.div>
    );
  }

  const selectedCandidates = candidates.filter(c => !c.skipped);
  const noneSelected = selectedCandidates.length === 0;

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.35 }}
      className="max-w-xl mx-auto w-full py-6 px-4 sm:px-0"
    >
      {/* Cabeçalho */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden />
          <span className="text-overline uppercase text-primary font-bold tracking-wider">
            Caderno de Erros
          </span>
        </div>
        <h1 className="text-heading-1 text-foreground mb-1">
          Transforme seus erros em plano de estudo
        </h1>
        <p className="text-body text-muted-foreground">
          {isClassifying
            ? `${candidates.length} questões para revisar, classificando com IA…`
            : `${candidates.length} questões para revisar, pré-classificadas`}
        </p>
      </div>

      {/* Aviso quando todas puladas */}
      {noneSelected && candidates.length > 0 && (
        <div
          className="mb-4 px-4 py-3 rounded-xl bg-muted text-body-sm text-muted-foreground text-center"
          role="alert"
        >
          Nenhuma questão selecionada.
        </div>
      )}

      {/* Lista de cards */}
      <ul className="space-y-3" aria-label="Questões para o caderno">
        {candidates.map((item, idx) => (
          <motion.li
            key={item.questionId}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.2, delay: Math.min(idx * 0.04, 0.4) }}
          >
            <TriageItemCard
              questionId={item.questionId}
              questionNumber={item.questionNumber}
              area={item.area}
              theme={item.theme}
              isCorrect={item.isCorrect}
              reason={item.reason}
              originalReason={item.originalReason}
              source={item.source}
              rationale={item.rationale}
              aiCertainty={item.aiCertainty}
              isLoading={isClassifying && item.source === 'heuristic'}
              alreadyInNotebook={item.alreadyInNotebook}
              skipped={item.skipped}
              onReasonChange={handleReasonChange}
              onSkip={handleSkip}
              onUnskip={handleUnskip}
            />
          </motion.li>
        ))}
      </ul>

      {/* Barra de ação */}
      <TriageSummaryBar
        selectedCount={selectedCandidates.length}
        totalCount={candidates.length}
        isClassifying={isClassifying}
        isAdding={isAdding}
        onAdd={handleAdd}
        onSkipAll={handleSkipAll}
      />
    </motion.div>
  );
}
