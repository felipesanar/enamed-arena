import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Check,
  Sparkles,
  Loader2,
  RefreshCw,
  Trash2,
  BookOpen,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Flame,
  Zap,
} from 'lucide-react';

import { PageTransition } from '@/components/premium/PageTransition';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ToastAction } from '@/components/ui/toast';
import { QuestionImage } from '@/components/exam/QuestionImage';

import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { simuladosApi } from '@/services/simuladosApi';
import { SEGMENT_ACCESS } from '@/types';
import { toast } from '@/hooks/use-toast';
import { logger } from '@/lib/logger';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { ProfSanorAvatar } from '@/components/comparativo/ProfSanorAvatar';
import type { Question } from '@/types';

interface PendingEntry {
  id: string;
  questionId: string | null;
  simuladoId: string | null;
  simuladoTitle: string | null;
  area: string | null;
  theme: string | null;
  questionNumber: number | null;
  reason: string;
  learningNote: string | null;
  wasCorrect: boolean;
  addedAt: string;
}

function daysSince(iso: string): number {
  const then = new Date(iso).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

interface ReviewData {
  question: Question | null;
  userSelectedOptionId: string | null;
  aiReviewMd: string | null;
}

function CadernoRevisaoContent({ userId, studentName }: { userId: string; studentName: string }) {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();

  const [entries, setEntries] = useState<PendingEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(false);

  const [currentIndex, setCurrentIndex] = useState(0);
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  const [sessionDominated, setSessionDominated] = useState(0);
  const [dominatedPulse, setDominatedPulse] = useState(0);

  const generatedFor = useRef<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    if (!userId) return;
    setLoadingList(true);
    setListError(false);
    try {
      const rows = await simuladosApi.getErrorNotebook(userId);
      const pending = rows
        .filter((row) => !row.resolved_at)
        .map((row) => ({
          id: row.id,
          questionId: row.question_id,
          simuladoId: row.simulado_id,
          simuladoTitle: row.simulado_title || null,
          area: row.area,
          theme: row.theme,
          questionNumber: row.question_number || null,
          reason: row.reason,
          learningNote: row.learning_text,
          wasCorrect: row.was_correct,
          addedAt: row.created_at,
        }))
        .sort((a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0));
      setEntries(pending);
    } catch (err) {
      logger.error('[CadernoRevisao] load list error:', err);
      setListError(true);
    } finally {
      setLoadingList(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  useEffect(() => {
    if (loadingList || listError) return;
    trackEvent('caderno_revisao_started', { total_pending: entries.length });
  }, [loadingList, listError, entries.length]);

  const currentEntry = entries[currentIndex] ?? null;

  // Load the review payload for the current entry whenever it changes.
  useEffect(() => {
    if (!currentEntry) {
      setReviewData(null);
      return;
    }
    let cancelled = false;
    setLoadingReview(true);
    setReviewData(null);

    simuladosApi
      .getErrorNotebookEntryForReview(currentEntry.id, userId)
      .then((res) => {
        if (cancelled || !res) return;
        setReviewData({
          question: res.question,
          userSelectedOptionId: res.userSelectedOptionId,
          aiReviewMd: res.aiReviewMd,
        });
      })
      .catch((err) => {
        logger.error('[CadernoRevisao] load entry error:', err);
        if (!cancelled) {
          toast({
            title: 'Não foi possível carregar a questão',
            description: 'Pulamos pra próxima quando você quiser.',
            variant: 'destructive',
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingReview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentEntry, userId]);

  // Auto-generate AI review on first view if not cached.
  useEffect(() => {
    if (!currentEntry || !reviewData || loadingReview) return;
    if (reviewData.aiReviewMd) return;
    if (!reviewData.question) return;
    if (generatedFor.current.has(currentEntry.id)) return;
    generatedFor.current.add(currentEntry.id);
    void generateAiReview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentEntry, reviewData, loadingReview]);

  const generateAiReview = async (force = false) => {
    if (!currentEntry || !reviewData?.question) return;
    if (generatingAi) return;
    setGeneratingAi(true);
    try {
      const q = reviewData.question;
      const correctLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? null;
      const userLabel =
        q.options.find((o) => o.id === reviewData.userSelectedOptionId)?.label ?? null;

      const { data, error } = await supabase.functions.invoke('gemini-error-notebook-review', {
        body: {
          studentName,
          questionNumber: currentEntry.questionNumber,
          questionStem: q.text,
          options: q.options.map((o) => ({
            label: o.label,
            text: o.text,
            isCorrect: o.id === q.correctOptionId,
          })),
          correctLabel,
          userLabel,
          area: currentEntry.area,
          theme: currentEntry.theme,
          reason: currentEntry.reason,
          learningNote: currentEntry.learningNote,
          explanation: q.explanation ?? null,
        },
      });

      if (error) throw error;
      const markdown = data?.markdown as string | undefined;
      if (!markdown) throw new Error('Resposta vazia da IA');

      setReviewData((prev) => (prev ? { ...prev, aiReviewMd: markdown } : prev));

      try {
        await simuladosApi.saveErrorNotebookAiReview(currentEntry.id, userId, markdown);
      } catch (cacheErr) {
        logger.error('[CadernoRevisao] cache save error:', cacheErr);
      }

      trackEvent('caderno_revisao_ai_generated', {
        reason: currentEntry.reason,
        area: currentEntry.area ?? 'unknown',
        regenerated: force,
      });
    } catch (err) {
      logger.error('[CadernoRevisao] gemini error:', err);
      toast({
        title: 'Não consegui gerar a análise agora',
        description: 'Tente novamente em instantes.',
        variant: 'destructive',
      });
      generatedFor.current.delete(currentEntry.id);
    } finally {
      setGeneratingAi(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const goNext = useCallback(() => {
    if (currentIndex < entries.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      // Acabou — manda de volta pro caderno
      navigate('/caderno-erros');
    }
  }, [currentIndex, entries.length, navigate]);

  const handleResolved = async () => {
    if (!currentEntry) return;
    try {
      await simuladosApi.toggleResolvedEntry(currentEntry.id, userId, true);
      trackEvent('caderno_revisao_marked_resolved', {
        reason: currentEntry.reason,
        area: currentEntry.area ?? 'unknown',
      });
      setSessionDominated((n) => n + 1);
      setDominatedPulse((n) => n + 1);
      toast({ title: 'Mandou bem! Marcada como dominada.' });
      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== currentEntry.id);
        if (currentIndex >= next.length) {
          setCurrentIndex(Math.max(0, next.length - 1));
        }
        return next;
      });
    } catch (err) {
      logger.error('[CadernoRevisao] resolve error:', err);
      toast({
        title: 'Não foi possível marcar',
        description: 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  // Snooze local — manda a questão para o fim da fila sem persistir nada.
  const handleSnooze = () => {
    if (!currentEntry) return;
    setEntries((prev) => {
      if (prev.length <= 1) return prev;
      const idx = prev.findIndex((e) => e.id === currentEntry.id);
      if (idx === -1) return prev;
      const next = [...prev];
      const [item] = next.splice(idx, 1);
      next.push(item);
      return next;
    });
    trackEvent('caderno_revisao_snoozed', {
      reason: currentEntry.reason,
      area: currentEntry.area ?? 'unknown',
    });
    toast({
      title: 'Vamos voltar nela depois',
      description: 'A questão foi pro fim da fila desta sessão.',
    });
  };

  const handleRemove = async () => {
    if (!currentEntry) return;
    const target = currentEntry;
    const previousEntries = entries;
    const previousIndex = currentIndex;

    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== target.id);
      if (currentIndex >= next.length) {
        setCurrentIndex(Math.max(0, next.length - 1));
      }
      return next;
    });

    let undone = false;
    const t = toast({
      title: 'Removida do caderno',
      description: `Q${target.questionNumber ?? '?'} · ${target.area ?? '—'}`,
      duration: 5000,
      action: (
        <ToastAction
          altText="Desfazer remoção"
          onClick={() => {
            undone = true;
            setEntries(previousEntries);
            setCurrentIndex(previousIndex);
            t.dismiss();
          }}
        >
          Desfazer
        </ToastAction>
      ),
    });

    setTimeout(async () => {
      if (undone) return;
      try {
        await simuladosApi.deleteErrorNotebookEntry(target.id, userId);
      } catch (err) {
        logger.error('[CadernoRevisao] delete error:', err);
        setEntries(previousEntries);
        setCurrentIndex(previousIndex);
        toast({
          title: 'Não foi possível remover',
          description: 'Tente novamente em instantes.',
          variant: 'destructive',
        });
      }
    }, 5000);
  };

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault();
        void handleResolved();
      } else if (e.key === 'j' || e.key === 'J') {
        e.preventDefault();
        handleSnooze();
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        void handleRemove();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const progress = useMemo(() => {
    if (entries.length === 0) return 0;
    return Math.round(((currentIndex + 1) / entries.length) * 100);
  }, [currentIndex, entries.length]);

  /* ── Loading state ── */
  if (loadingList) {
    return (
      <div className="space-y-4 animate-pulse">
        <SkeletonCard className="h-[80px] rounded-2xl" />
        <SkeletonCard className="h-[300px] rounded-2xl" />
        <SkeletonCard className="h-[200px] rounded-2xl" />
      </div>
    );
  }

  if (listError) {
    return (
      <EmptyState
        variant="error"
        title="Não foi possível carregar a revisão"
        description="Verifique sua conexão e tente novamente."
        onRetry={fetchPending}
        backHref="/caderno-erros"
        backLabel="Voltar ao caderno"
      />
    );
  }

  if (entries.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nada pra revisar 🎯"
        description="Você não tem questões pendentes no caderno. Aproveita pra revisar as resolvidas ou ir treinar mais um simulado."
        backHref="/caderno-erros"
        backLabel="Voltar ao caderno"
      />
    );
  }

  if (!currentEntry) return null;

  const reasonMeta = getReasonMeta(currentEntry.reason);
  const question = reviewData?.question ?? null;
  const userSelectedId = reviewData?.userSelectedOptionId ?? null;

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Sticky header com progresso */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 bg-background/95 px-4 md:px-6 py-2.5 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between gap-3">
          <Link
            to="/caderno-erros"
            className="inline-flex items-center gap-1.5 text-caption font-medium text-muted-foreground/80 transition-colors hover:text-foreground no-underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Sair
          </Link>
          <div className="flex items-center gap-3 md:gap-4">
            <AnimatePresence>
              {sessionDominated > 0 && (
                <motion.span
                  key={dominatedPulse}
                  initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/[0.08] px-2.5 py-1 text-[11px] font-bold text-success tabular-nums"
                  aria-label={`${sessionDominated} dominadas nesta sessão`}
                >
                  <Flame className="h-3 w-3" aria-hidden />
                  {sessionDominated} dominada{sessionDominated > 1 ? 's' : ''}
                </motion.span>
              )}
            </AnimatePresence>
            <span className="text-caption font-bold text-foreground tabular-nums">
              {currentIndex + 1} / {entries.length}
            </span>
            <div className="hidden sm:block h-1 w-32 overflow-hidden rounded-full bg-muted">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading da questão */}
      {loadingReview && (
        <div className="space-y-4 animate-pulse">
          <SkeletonCard className="h-[320px] rounded-2xl" />
          <SkeletonCard className="h-[180px] rounded-2xl" />
        </div>
      )}

      {/* Questão não encontrada */}
      {!loadingReview && !question && (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-warning" aria-hidden />
          <p className="mt-3 text-body font-semibold text-foreground">
            Não consegui carregar essa questão.
          </p>
          <p className="mt-1 text-caption text-muted-foreground">
            Pode ter sido removida do simulado. Pula pra próxima.
          </p>
        </div>
      )}

      {/* Cards principais */}
      <AnimatePresence mode="wait">
        {!loadingReview && question && (
          <motion.div
            key={currentEntry.id}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="space-y-4"
          >
            {/* Card da questão */}
            <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
              {/* Meta */}
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Tooltip delayDuration={200}>
                  <TooltipTrigger asChild>
                    <span
                      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide cursor-help"
                      style={{
                        background: reasonMeta.colorBg,
                        color: reasonMeta.colorText,
                        borderColor: reasonMeta.colorBorder,
                      }}
                    >
                      <span
                        aria-hidden
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ background: reasonMeta.colorBase }}
                      />
                      Tipo: {reasonMeta.badge}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Categoria do erro: {reasonMeta.badge.toLowerCase()}
                  </TooltipContent>
                </Tooltip>

                {currentEntry.area && (
                  <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                    <span className="font-bold text-foreground">{currentEntry.area}</span>
                    {currentEntry.theme && (
                      <>
                        <span className="mx-1.5 opacity-50">›</span>
                        {currentEntry.theme}
                      </>
                    )}
                  </span>
                )}

                <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  <Clock className="h-2.5 w-2.5" aria-hidden />
                  {(() => {
                    const d = daysSince(currentEntry.addedAt);
                    if (d === 0) return 'Salva hoje';
                    if (d === 1) return 'Há 1 dia';
                    return `Há ${d} dias`;
                  })()}
                </span>

                {currentEntry.simuladoTitle && currentEntry.simuladoId && (
                  <Link
                    to={`/simulados/${currentEntry.simuladoId}/correcao?q=${currentEntry.questionNumber ?? ''}`}
                    className="text-caption text-muted-foreground hover:text-primary underline-offset-2 hover:underline transition-colors no-underline"
                  >
                    {currentEntry.simuladoTitle}
                  </Link>
                )}
              </div>

              {/* Título da questão */}
              <h2 className="text-heading-3 text-foreground">
                Q{currentEntry.questionNumber ?? '?'}
              </h2>

              {/* Anotação do aluno */}
              {currentEntry.learningNote && (
                <div className="mt-3 rounded-xl border border-border/60 bg-muted/40 p-3">
                  <p className="text-overline font-semibold uppercase text-muted-foreground">
                    Sua anotação
                  </p>
                  <p className="mt-1 text-body-sm italic text-foreground/90">
                    {currentEntry.learningNote}
                  </p>
                </div>
              )}

              {/* Enunciado */}
              <div className="mt-5 text-body text-foreground leading-relaxed whitespace-pre-wrap">
                {question.text}
              </div>

              {question.imageUrl && (
                <div className="mt-4">
                  <QuestionImage
                    src={question.imageUrl}
                    alt={`Imagem da questão ${currentEntry.questionNumber ?? ''}`}
                  />
                </div>
              )}

              {/* Alternativas */}
              <div className="mt-5 space-y-2">
                {question.options.map((opt) => {
                  const isCorrect = opt.id === question.correctOptionId;
                  const isUserChoice = opt.id === userSelectedId;
                  const userWasWrong = isUserChoice && !isCorrect;
                  const userWasRight = isUserChoice && isCorrect;

                  return (
                    <div
                      key={opt.id}
                      className={cn(
                        'flex items-start gap-3 rounded-xl border px-3.5 py-3 transition-colors',
                        isCorrect && 'border-success/40 bg-success/[0.06]',
                        userWasWrong && 'border-destructive/40 bg-destructive/[0.06]',
                        !isCorrect && !userWasWrong && 'border-border bg-card',
                      )}
                    >
                      <span
                        className={cn(
                          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[12px] font-bold',
                          isCorrect && 'bg-success text-success-foreground',
                          userWasWrong && 'bg-destructive text-destructive-foreground',
                          !isCorrect && !userWasWrong && 'bg-muted text-muted-foreground',
                        )}
                      >
                        {opt.label}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-sm text-foreground leading-relaxed">
                          {opt.text}
                        </p>
                        {(isCorrect || isUserChoice) && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {isUserChoice && (
                              <span
                                className={cn(
                                  'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                                  userWasWrong
                                    ? 'border-destructive/40 bg-destructive/10 text-destructive'
                                    : 'border-success/40 bg-success/10 text-success',
                                )}
                              >
                                {userWasWrong ? (
                                  <XCircle className="h-2.5 w-2.5" aria-hidden />
                                ) : (
                                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                                )}
                                Sua resposta
                              </span>
                            )}
                            {isCorrect && !userWasRight && (
                              <span className="inline-flex items-center gap-1 rounded-md border border-success/40 bg-success/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-success">
                                <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                                Resposta correta
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Resumo construtivo do que aconteceu */}
              <div className="mt-5 flex flex-wrap items-center gap-3 text-caption">
                {userSelectedId ? (
                  (() => {
                    const userLabel =
                      question.options.find((o) => o.id === userSelectedId)?.label ?? '?';
                    return currentEntry.wasCorrect ? (
                      <span className="inline-flex items-center gap-1.5 text-success font-semibold">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        Você marcou {userLabel} e acertou. Bora consolidar o raciocínio.
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-foreground font-semibold">
                        <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                        Você marcou {userLabel}. Vamos entender por que a resposta era outra.
                      </span>
                    );
                  })()
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-muted-foreground font-semibold">
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden />
                    Você não marcou nenhuma alternativa — vamos passar por ela agora.
                  </span>
                )}
              </div>
            </div>

            {/* Card Prof. San */}
            <div className="rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.04] to-primary/[0.08] p-5 md:p-6">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="rounded-full bg-primary/[0.04] border-2 border-background shadow-sm overflow-hidden">
                      <ProfSanorAvatar size={48} animated={generatingAi} />
                    </div>
                    <span
                      className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-success border-2 border-background"
                      aria-hidden
                    />
                  </div>
                  <div>
                    <h3 className="text-heading-3 font-bold text-primary tracking-tight">Prof. San</h3>
                    <p className="text-caption text-muted-foreground mt-0.5">
                      Análise personalizada dessa questão.
                    </p>
                  </div>
                </div>
                {reviewData?.aiReviewMd && (
                  <Button
                    onClick={() => generateAiReview(true)}
                    disabled={generatingAi}
                    variant="outline"
                    size="sm"
                  >
                    {generatingAi ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        Gerando…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                        Gerar de novo
                      </>
                    )}
                  </Button>
                )}
              </div>

              {!reviewData?.aiReviewMd && generatingAi && (
                <div className="mt-5 space-y-3">
                  <div className="h-3 w-3/4 rounded bg-primary/10 animate-pulse" />
                  <div className="h-3 w-full rounded bg-primary/10 animate-pulse" />
                  <div className="h-3 w-5/6 rounded bg-primary/10 animate-pulse" />
                  <div className="h-3 w-2/3 rounded bg-primary/10 animate-pulse" />
                </div>
              )}

              {!reviewData?.aiReviewMd && !generatingAi && (
                <div className="mt-5">
                  <Button onClick={() => generateAiReview(false)} className="!text-white">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Gerar análise
                  </Button>
                </div>
              )}

              {reviewData?.aiReviewMd && (
                <>
                  <div className="prose prose-sm max-w-none mt-5 text-foreground prose-headings:text-foreground prose-headings:font-semibold prose-h3:text-[15px] prose-h3:mt-4 prose-h3:mb-2 prose-p:text-body prose-p:text-muted-foreground prose-li:text-body prose-li:text-muted-foreground prose-strong:text-foreground">
                    <ReactMarkdown>{reviewData.aiReviewMd}</ReactMarkdown>
                  </div>

                  {/* Fechamento do ciclo: CTA pra treinar mais do mesmo tema */}
                  {(currentEntry.theme || currentEntry.area) && (
                    <Link
                      to="/simulados"
                      onClick={() =>
                        trackEvent('caderno_revisao_train_more_clicked', {
                          area: currentEntry.area ?? 'unknown',
                          theme: currentEntry.theme ?? 'unknown',
                        })
                      }
                      className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-[13px] font-semibold text-primary transition-all duration-200 hover:border-primary/45 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
                    >
                      <Zap className="h-3.5 w-3.5" aria-hidden />
                      Treinar mais questões de{' '}
                      <span className="font-extrabold">
                        {currentEntry.theme ?? currentEntry.area}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                    </Link>
                  )}
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Action bar */}
      <div className="sticky bottom-0 -mx-4 md:-mx-6 bg-background/95 px-4 md:px-6 py-3 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button
              onClick={goPrev}
              disabled={currentIndex === 0}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleRemove}
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover do caderno"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Remover do caderno <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">R</kbd>
              </TooltipContent>
            </Tooltip>
          </div>

          <div className="flex items-center gap-2">
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button
                  onClick={handleSnooze}
                  variant="ghost"
                  size="sm"
                  disabled={entries.length <= 1}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <Clock className="h-4 w-4 mr-1.5" />
                  Revisar depois
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Manda pro fim da fila <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">J</kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <motion.div
                  key={dominatedPulse}
                  initial={false}
                  animate={prefersReducedMotion ? undefined : { scale: [1, 1.06, 1] }}
                  transition={{ duration: 0.32, ease: 'easeOut' }}
                >
                  <Button
                    onClick={handleResolved}
                    size="sm"
                    className="bg-success hover:bg-success/90 !text-success-foreground shadow-[0_4px_14px_-4px_hsl(152_60%_36%/0.4)]"
                  >
                    <Check className="h-4 w-4 mr-1.5" strokeWidth={2.5} />
                    Já dominei
                  </Button>
                </motion.div>
              </TooltipTrigger>
              <TooltipContent side="top">
                Marcar como dominada <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">D</kbd>
              </TooltipContent>
            </Tooltip>

            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button onClick={goNext} size="sm" variant="outline">
                  {currentIndex < entries.length - 1 ? (
                    <>
                      Próxima
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Finalizar
                      <Check className="h-4 w-4 ml-1" />
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {currentIndex < entries.length - 1 ? 'Próxima questão' : 'Finalizar sessão'}{' '}
                <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">→</kbd>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Legenda de atalhos — só em telas com espaço */}
        <div className="mt-2 hidden md:flex items-center justify-center gap-3 text-[10px] text-muted-foreground/70">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">←</kbd>
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">→</kbd>
            navegar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">D</kbd>
            dominei
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">J</kbd>
            depois
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">R</kbd>
            remover
          </span>
        </div>
      </div>
    </div>
  );
}

export default function CadernoRevisaoPage() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  if (!hasAccess) {
    return <Navigate to="/caderno-erros" replace />;
  }

  if (!user?.id) {
    return (
      <PageTransition>
        <EmptyState
          icon={BookOpen}
          title="Sessão expirada"
          description="Faça login pra continuar revisando."
          backHref="/caderno-erros"
          backLabel="Voltar"
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <CadernoRevisaoContent userId={user.id} studentName={profile?.name ?? 'Aluno'} />
    </PageTransition>
  );
}
