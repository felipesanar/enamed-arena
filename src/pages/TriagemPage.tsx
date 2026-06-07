/**
 * TriagemPage v2 — Triagem Automática Pós-Prova (spec 04).
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
 *
 * v2: redesign visual premium — lógica/dados/IA/heurística/analytics INALTERADOS.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { BookOpen, Sparkles, Trophy, AlertCircle, RefreshCw } from 'lucide-react';
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
import { CadernoSkeleton, CadernoEmptyState, PageHeaderPremium } from '@/components/caderno/ui';
import { TriageItemCard } from '@/components/triagem/TriageItemCard';
import { TriageSummaryBar } from '@/components/triagem/TriageSummaryBar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { cn } from '@/lib/utils';

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
  const isMobile = useIsMobile();
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
  const profileLoaded = profile !== null;
  if (profileLoaded && !hasAccess) {
    return <Navigate to={`/simulados/${simuladoId}/resultado`} replace />;
  }

  // ── Estado de carregamento ────────────────────────────────────────────────
  if (loadingCandidates || loadingSim) {
    return (
      <div className="caderno-root mx-auto w-full max-w-2xl px-4 py-6 sm:px-0">
        {/* Header skeleton */}
        <div className="mb-8 space-y-3">
          <div className="h-3 w-28 animate-pulse rounded-full bg-[var(--c-surface-2)]" />
          <div className="h-7 w-72 animate-pulse rounded-lg bg-[var(--c-surface-2)]" />
          <div className="h-4 w-48 animate-pulse rounded-md bg-[var(--c-surface-2)]" />
        </div>
        <CadernoSkeleton count={3} />
      </div>
    );
  }

  // ── Estado de erro ────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="caderno-root mx-auto w-full max-w-2xl px-4 py-16">
        <div
          className={cn(
            'flex flex-col items-center gap-4 rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)]',
            'bg-[var(--c-surface)] px-6 py-12 text-center',
          )}
        >
          <div
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--c-surface-2)]"
            aria-hidden
          >
            <AlertCircle className="h-7 w-7" style={{ color: 'var(--c-destructive)' }} />
          </div>
          <div className="space-y-1">
            <h3 className="text-heading-3 font-semibold" style={{ color: 'var(--c-ink)' }}>
              Não foi possível carregar a triagem
            </h3>
            <p className="text-body-sm" style={{ color: 'var(--c-muted)' }}>
              {loadError}
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 sm:flex-row">
            <button
              type="button"
              onClick={loadCandidates}
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5',
                'text-sm font-semibold text-white',
                '[background:var(--c-gradient-brand)]',
                'hover:brightness-110 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
              )}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Tentar novamente
            </button>
            <button
              type="button"
              onClick={() => navigate(`/simulados/${simuladoId}/resultado`)}
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-5 py-2.5',
                'text-sm font-medium',
                'border border-[var(--c-border)] bg-transparent',
                'hover:bg-[var(--c-surface-2)] transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-border)]',
              )}
              style={{ color: 'var(--c-muted)' }}
            >
              Ir para o resultado
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Estado vazio — gabaritou ou não tem candidatos ────────────────────────
  if (candidates.length === 0) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
        className="caderno-root mx-auto w-full max-w-md px-4 py-16"
      >
        <CadernoEmptyState
          variant="celebratory"
          icon={<Trophy className="h-8 w-8" style={{ color: 'var(--c-wine-500)' }} aria-hidden />}
          title="Parabéns, nenhum erro para revisar!"
          description="Continue assim. Sua performance foi excelente neste simulado."
          action={
            <button
              type="button"
              onClick={() => navigate(`/simulados/${simuladoId}/resultado`)}
              className={cn(
                'inline-flex items-center gap-2 rounded-[var(--c-radius-control)] px-6 py-3',
                'text-sm font-semibold text-white',
                '[background:var(--c-gradient-brand)]',
                'shadow-[var(--c-shadow-sm)] hover:shadow-[var(--c-shadow-glow)]',
                'hover:brightness-110 transition-all active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50',
              )}
            >
              <BookOpen className="h-4 w-4" aria-hidden />
              Ver resultado
            </button>
          }
        />
      </motion.div>
    );
  }

  const selectedCandidates = candidates.filter(c => !c.skipped);
  const noneSelected = selectedCandidates.length === 0;

  // ── Barra de stats ────────────────────────────────────────────────────────
  const headerStats = [
    {
      label: 'Para revisar',
      value: candidates.length,
      color: 'var(--c-wine-500)',
    },
    {
      label: 'Selecionadas',
      value: selectedCandidates.length,
      color: 'var(--c-ink)',
    },
    ...(isClassifying
      ? [{ label: 'Classificando', value: '…', color: 'var(--c-info)' }]
      : [{ label: 'Classificadas', value: candidates.filter(c => c.source === 'ia').length, color: 'var(--c-success)' }]),
  ];

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
      className={cn(
        'caderno-root mx-auto w-full',
        isMobile ? 'pb-[140px]' : 'max-w-2xl px-4 py-6 sm:px-0',
      )}
    >
      {/* ── Header Premium ──────────────────────────────────────────────── */}
      <PageHeaderPremium
        title="Transforme seus erros em plano de estudo"
        subtitle={
          isClassifying
            ? `${candidates.length} questões para revisar, classificando com IA…`
            : `${candidates.length} questões pré-classificadas`
        }
        stats={headerStats}
        onBack={isMobile ? () => navigate(`/simulados/${simuladoId}/resultado`) : undefined}
        className={cn(
          isMobile ? '' : 'mb-6',
        )}
      />

      {/* Eyebrow overline (desktop only) */}
      {!isMobile && (
        <div className="flex items-center gap-2 mb-2 -mt-4">
          <Sparkles className="h-3.5 w-3.5" style={{ color: 'var(--c-wine-500)' }} aria-hidden />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: 'var(--c-wine-500)' }}
          >
            Caderno de Erros
          </span>
        </div>
      )}

      {/* Padding top mobile (abaixo da MobileAppBar) */}
      {isMobile && <div className="px-4 pt-4" />}

      {/* ── Aviso quando todas puladas ──────────────────────────────────── */}
      {noneSelected && candidates.length > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className={cn(
            'mb-4 rounded-[var(--c-radius-control)] border border-[var(--c-border)]',
            'bg-[var(--c-surface-2)] px-4 py-3 text-center',
            isMobile && 'mx-4',
          )}
          role="alert"
          aria-live="polite"
        >
          <p className="text-sm" style={{ color: 'var(--c-muted)' }}>
            Nenhuma questão selecionada.{' '}
            <button
              type="button"
              className="font-semibold underline underline-offset-2 focus-visible:outline-none"
              style={{ color: 'var(--c-wine-500)' }}
              onClick={() =>
                setCandidates(prev => prev.map(c => ({ ...c, skipped: false })))
              }
            >
              Restaurar todas
            </button>
          </p>
        </motion.div>
      )}

      {/* ── Lista de cards ───────────────────────────────────────────────── */}
      <ul
        className={cn(
          'space-y-3',
          isMobile && 'px-4',
        )}
        aria-label="Questões para o caderno"
      >
        {candidates.map((item, idx) => (
          <motion.li
            key={item.questionId}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.22,
              delay: Math.min(idx * 0.035, 0.42),
              ease: [0.22, 1, 0.36, 1],
            }}
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

      {/* ── Barra de ação ───────────────────────────────────────────────── */}
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
