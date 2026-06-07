import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Link, Navigate } from 'react-router-dom';
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
  MessageCircle,
  Send,
} from 'lucide-react';

import { PageTransition } from '@/components/premium/PageTransition';
import { EmptyState } from '@/components/EmptyState';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ToastAction } from '@/components/ui/toast';
import { QuestionImage } from '@/components/exam/QuestionImage';

import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { supabase } from '@/integrations/supabase/client';
import { simuladosApi, type AiPractice } from '@/services/simuladosApi';
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
  aiPractice: AiPractice | null;
  aiOptionRationales: Record<string, string> | null;
  chatCount: number;
}

const CHAT_LIMIT_PER_ENTRY = 10;

/* ──────────────────────────────────────────────────────────────────────────
 * SessionPanel — fila visual da sessão de revisão (desktop only)
 * ────────────────────────────────────────────────────────────────────────── */

function SessionPanel({
  entries,
  currentIndex,
  onJump,
  dominatedIds,
  snoozedIds,
  sessionDominated,
  initialTotal,
}: {
  entries: PendingEntry[];
  currentIndex: number;
  onJump: (index: number) => void;
  dominatedIds: Set<string>;
  snoozedIds: Set<string>;
  sessionDominated: number;
  initialTotal: number;
}) {
  const completionPct = initialTotal === 0 ? 0 : Math.round((sessionDominated / initialTotal) * 100);

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm flex flex-col max-h-[calc(100vh-9rem)]">
      <div className="border-b border-border px-4 py-3">
        <div className="flex items-center justify-between">
          <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
            Sessão
          </span>
          <span className="text-caption font-bold tabular-nums text-foreground">
            {sessionDominated}/{initialTotal}
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-success transition-[width] duration-500 ease-out"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      <ul className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {entries.length === 0 && (
          <li className="px-3 py-6 text-center text-caption text-muted-foreground">
            Fila vazia.
          </li>
        )}
        {entries.map((e, i) => {
          const isCurrent = i === currentIndex;
          const isSnoozed = snoozedIds.has(e.id);
          const meta = getReasonMeta(e.reason);
          return (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onJump(i)}
                className={cn(
                  'group w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                  isCurrent
                    ? 'bg-primary/[0.08] ring-1 ring-primary/30'
                    : 'hover:bg-muted/60',
                )}
                aria-current={isCurrent ? 'true' : undefined}
              >
                <span
                  aria-hidden
                  className="h-6 w-[3px] shrink-0 rounded-full"
                  style={{ background: meta.colorBase }}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'block truncate text-[12px] font-semibold',
                      isCurrent ? 'text-foreground' : 'text-foreground/85',
                    )}
                  >
                    Q{e.questionNumber ?? '?'} · {e.area ?? '—'}
                  </span>
                  <span className="block truncate text-[10px] text-muted-foreground">
                    {e.theme ?? meta.badge}
                  </span>
                </span>
                {isSnoozed && (
                  <Clock className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
                )}
                {isCurrent && (
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {sessionDominated > 0 && (
        <div className="border-t border-border px-4 py-2.5 text-caption text-success font-semibold flex items-center gap-1.5">
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
          {sessionDominated} dominada{sessionDominated > 1 ? 's' : ''} nesta sessão
        </div>
      )}
    </div>
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * SessionSummary — dashboard pós-sessão
 * ────────────────────────────────────────────────────────────────────────── */

function SessionSummary({
  dominated,
  snoozed,
  remaining,
  initialTotal,
  elapsedMs,
  topAreas,
}: {
  dominated: number;
  snoozed: number;
  remaining: number;
  initialTotal: number;
  elapsedMs: number;
  topAreas: [string, number][];
}) {
  const completionPct = initialTotal === 0 ? 0 : Math.round((dominated / initialTotal) * 100);
  const minutes = Math.max(1, Math.round(elapsedMs / 60000));

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="hero-status-card">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-14 -top-14 h-48 w-48 rounded-full bg-primary/10 blur-[60px] dark:bg-[rgba(232,56,98,0.16)]"
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-success/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-success border border-success/25">
            <CheckCircle2 className="h-3 w-3" aria-hidden />
            Sessão concluída
          </div>
          <h2 className="mt-3 text-heading-1 text-white tracking-[-0.015em]">
            {dominated > 0 ? 'Mandou bem!' : 'Sessão encerrada.'}
          </h2>
          <p className="mt-1 text-body text-white/65">
            {dominated > 0
              ? `Você dominou ${dominated} ${dominated === 1 ? 'questão' : 'questões'} em ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}.`
              : 'Você não marcou nenhuma como dominada. Sem stress — bora retomar quando der.'}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryStat label="Dominadas" value={dominated} accent="text-success" />
            <SummaryStat label="Revisar depois" value={snoozed} accent="text-orange-300" />
            <SummaryStat label="Restantes" value={remaining} accent="text-white" />
            <SummaryStat label="Tempo" value={`${minutes}m`} accent="text-white/80" />
          </div>

          {initialTotal > 0 && (
            <div className="mt-5">
              <div className="flex justify-between text-[11px] text-white/60">
                <span>{completionPct}% da meta da sessão</span>
                <span className="tabular-nums">
                  {dominated}/{initialTotal}
                </span>
              </div>
              <div className="mt-1.5 h-[6px] overflow-hidden rounded-full bg-white/[0.08]">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)]"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {topAreas.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
            Áreas trabalhadas nesta sessão
          </p>
          <div className="mt-3 space-y-2">
            {topAreas.map(([area, count]) => (
              <div key={area} className="flex items-center justify-between">
                <span className="text-body-sm font-semibold text-foreground truncate pr-3">
                  {area}
                </span>
                <span className="inline-flex items-center gap-1 text-caption font-bold text-success tabular-nums">
                  <CheckCircle2 className="h-3 w-3" aria-hidden />
                  {count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link
          to="/caderno-erros"
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 text-[13px] font-semibold text-foreground transition-colors hover:bg-muted no-underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Voltar ao caderno
        </Link>
        <Link
          to="/simulados"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-[0_4px_14px_-4px_hsl(345_65%_30%/0.4)] transition-all hover:bg-wine-hover no-underline"
        >
          <Zap className="h-4 w-4" aria-hidden />
          Treinar mais um simulado
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5">
      <div className={cn('text-[20px] font-extrabold leading-none tracking-[-0.02em] tabular-nums', accent)}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wide text-white/55">
        {label}
      </div>
    </div>
  );
}

function CadernoRevisaoContent({ userId, studentName }: { userId: string; studentName: string }) {
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
  const [sessionSnoozedCount, setSessionSnoozedCount] = useState(0);
  const [finished, setFinished] = useState(false);

  // Chat efêmero com o Prof. Sanor — histórico em memória, reseta a cada entry.
  type ChatTurn = { role: 'user' | 'assistant'; content: string };
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const dominatedIdsRef = useRef<Set<string>>(new Set());
  const snoozedIdsRef = useRef<Set<string>>(new Set());
  const sessionStartRef = useRef<number>(Date.now());
  const initialTotalRef = useRef<number | null>(null);
  const sessionAreasRef = useRef<Map<string, number>>(new Map());

  const generatedFor = useRef<Set<string>>(new Set());

  const fetchPending = useCallback(async () => {
    if (!userId) return;
    setLoadingList(true);
    setListError(false);
    try {
      const rows = await simuladosApi.getErrorNotebook(userId);
      const now = Date.now();
      const pending = rows
        .filter((row) => !row.resolved_at)
        .filter((row) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const nr = (row as any).next_review_at as string | null | undefined;
          if (!nr) return true;
          return new Date(nr).getTime() <= now;
        })
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
    if (initialTotalRef.current === null) {
      initialTotalRef.current = entries.length;
      sessionStartRef.current = Date.now();
    }
    trackEvent('caderno_revisao_started', { total_pending: entries.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingList, listError]);

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
    setChatMessages([]);
    setChatInput('');
    setChatOpen(false);

    simuladosApi
      .getErrorNotebookEntryForReview(currentEntry.id, userId)
      .then((res) => {
        if (cancelled || !res) return;
        setReviewData({
          question: res.question,
          userSelectedOptionId: res.userSelectedOptionId,
          aiReviewMd: res.aiReviewMd,
          aiPractice: res.aiPractice,
          aiOptionRationales: res.aiOptionRationales,
          chatCount: res.chatCount ?? 0,
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
      const practice = (data?.practice as AiPractice | null | undefined) ?? null;
      const optionRationales =
        (data?.optionRationales as Record<string, string> | null | undefined) ?? null;

      setReviewData((prev) =>
        prev
          ? {
              ...prev,
              aiReviewMd: markdown,
              aiPractice: practice,
              aiOptionRationales: optionRationales,
            }
          : prev,
      );

      try {
        await simuladosApi.saveErrorNotebookAiReview(currentEntry.id, userId, {
          markdown,
          practice,
          optionRationales,
        });
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

  const sendChatMessage = async () => {
    if (!currentEntry || !reviewData?.question) return;
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    if (reviewData.chatCount >= CHAT_LIMIT_PER_ENTRY) return;

    const userTurn: ChatTurn = { role: 'user', content: trimmed };
    const nextHistory = [...chatMessages, userTurn];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const q = reviewData.question;
      const correctLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? null;
      const userLabel =
        q.options.find((o) => o.id === reviewData.userSelectedOptionId)?.label ?? null;

      const { data, error } = await supabase.functions.invoke('gemini-error-notebook-chat', {
        body: {
          entryId: currentEntry.id,
          studentName,
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
          aiReviewMd: reviewData.aiReviewMd,
          history: chatMessages,
          question: trimmed,
        },
      });

      // 429 do edge function (rate limit). supabase-js coloca o status no error.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const statusCode = (error as any)?.context?.status as number | undefined;
      if (statusCode === 429) {
        setReviewData((prev) =>
          prev ? { ...prev, chatCount: CHAT_LIMIT_PER_ENTRY } : prev,
        );
        toast({
          title: 'Limite de perguntas atingido',
          description: `Você usou as ${CHAT_LIMIT_PER_ENTRY} perguntas dessa questão.`,
          variant: 'destructive',
        });
        setChatMessages(chatMessages);
        setChatInput(trimmed);
        return;
      }

      if (error) throw error;
      const reply = (data?.reply as string | undefined)?.trim();
      if (!reply) throw new Error('Resposta vazia');

      const offTopic = !!data?.offTopic;
      const used = (data?.used as number | undefined) ?? reviewData.chatCount + 1;

      setChatMessages([...nextHistory, { role: 'assistant', content: reply }]);
      setReviewData((prev) => (prev ? { ...prev, chatCount: used } : prev));

      trackEvent('caderno_revisao_chat_message_sent', {
        area: currentEntry.area ?? 'unknown',
        history_length: nextHistory.length,
        off_topic: offTopic,
        used,
      });
    } catch (err) {
      logger.error('[CadernoRevisao] chat error:', err);
      toast({
        title: 'Não consegui responder agora',
        description: 'Tente de novo em instantes.',
        variant: 'destructive',
      });
      setChatMessages(chatMessages);
      setChatInput(trimmed);
    } finally {
      setChatLoading(false);
    }
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };

  const goNext = useCallback(() => {
    if (currentIndex < entries.length - 1) {
      setCurrentIndex((i) => i + 1);
    } else {
      setFinished(true);
    }
  }, [currentIndex, entries.length]);

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
      dominatedIdsRef.current.add(currentEntry.id);
      if (currentEntry.area) {
        const map = sessionAreasRef.current;
        map.set(currentEntry.area, (map.get(currentEntry.area) ?? 0) + 1);
      }
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

  // Snooze persistido via RPC; remove a questão da fila atual desta sessão
  // e marca next_review_at no banco. Quando days é undefined (atalho J ou
  // botão default), aplica o intervalo padrão de 3 dias.
  const handleSnooze = async (days = 3) => {
    if (!currentEntry) return;
    const target = currentEntry;

    // Otimista: tira da fila desta sessão imediatamente.
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== target.id);
      if (currentIndex >= next.length) {
        setCurrentIndex(Math.max(0, next.length - 1));
      }
      return next;
    });
    if (!snoozedIdsRef.current.has(target.id)) {
      snoozedIdsRef.current.add(target.id);
      setSessionSnoozedCount((n) => n + 1);
    }

    trackEvent('caderno_revisao_snoozed', {
      reason: target.reason,
      area: target.area ?? 'unknown',
      days,
    });

    try {
      await simuladosApi.snoozeErrorNotebookEntry(target.id, days);
      const label = days === 1 ? 'amanhã' : `em ${days} dias`;
      toast({
        title: `Vai voltar ${label}`,
        description: 'A questão sai da fila ativa até lá.',
      });
    } catch (err) {
      logger.error('[CadernoRevisao] snooze error:', err);
      toast({
        title: 'Não consegui agendar a revisão',
        description: 'A questão segue só pro fim da fila desta sessão.',
        variant: 'destructive',
      });
    }
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

  // Se acabou (botão Finalizar) ou esvaziou após dominar tudo — dashboard de sessão
  const sessionHadActivity =
    sessionDominated > 0 || sessionSnoozedCount > 0 || dominatedIdsRef.current.size > 0;

  if (finished || (entries.length === 0 && sessionHadActivity)) {
    return (
      <SessionSummary
        dominated={sessionDominated}
        snoozed={sessionSnoozedCount}
        remaining={entries.length}
        initialTotal={initialTotalRef.current ?? sessionDominated + entries.length}
        elapsedMs={Date.now() - sessionStartRef.current}
        topAreas={Array.from(sessionAreasRef.current.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)}
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

      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1 space-y-4">
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
                  const rationale =
                    !isCorrect && reviewData?.aiOptionRationales
                      ? reviewData.aiOptionRationales[opt.label]
                      : null;

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
                        {rationale && (
                          <p
                            className={cn(
                              'mt-2 flex items-start gap-1.5 text-[12px] leading-snug',
                              userWasWrong ? 'text-destructive/90' : 'text-muted-foreground',
                            )}
                          >
                            <XCircle className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
                            <span>{rationale}</span>
                          </p>
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

                  {/* Fechamento do ciclo: CTA pra treinar mais do mesmo tema/subtópico.
                      Quando a IA extrai um subtópico específico (ai_practice.topic),
                      priorizamos ele; senão caímos no tema/área da própria questão. */}
                  {(() => {
                    // Botão "Treinar N questões de…" ocultado a pedido do produto.
                    return null;

                    const practice = reviewData.aiPractice;
                    const topic =
                      practice?.topic ?? currentEntry.theme ?? currentEntry.area ?? null;
                    if (!topic) return null;
                    const count = practice?.suggestedCount ?? 5;
                    const params = new URLSearchParams();
                    if (practice?.area ?? currentEntry.area)
                      params.set('area', practice?.area ?? currentEntry.area ?? '');
                    if (practice?.theme ?? currentEntry.theme)
                      params.set('theme', practice?.theme ?? currentEntry.theme ?? '');
                    if (practice?.topic) params.set('topic', practice.topic);

                    return (
                      <Link
                        to={`/simulados?${params.toString()}`}
                        onClick={() =>
                          trackEvent('caderno_revisao_train_more_clicked', {
                            area: practice?.area ?? currentEntry.area ?? 'unknown',
                            theme: practice?.theme ?? currentEntry.theme ?? 'unknown',
                            topic: practice?.topic ?? null,
                            suggested_count: count,
                          })
                        }
                        className="mt-5 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/[0.04] px-4 py-2.5 text-[13px] font-semibold text-primary transition-all duration-200 hover:border-primary/45 hover:bg-primary/[0.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 no-underline"
                      >
                        <Zap className="h-3.5 w-3.5" aria-hidden />
                        Treinar <span className="font-extrabold tabular-nums">{count}</span>{' '}
                        questões de <span className="font-extrabold">{topic}</span>
                        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                      </Link>
                    );
                  })()}

                  {/* Chat efêmero com o Prof. Sanor */}
                  <div className="mt-5 border-t border-primary/10 pt-4">
                    {!chatOpen ? (
                      <button
                        type="button"
                        onClick={() => {
                          setChatOpen(true);
                          trackEvent('caderno_revisao_chat_opened', {
                            area: currentEntry.area ?? 'unknown',
                          });
                        }}
                        className="inline-flex items-center gap-2 rounded-xl border border-border bg-card px-3.5 py-2 text-[12px] font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      >
                        <MessageCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
                        Tirar uma dúvida com o Prof. San
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
                            Conversa com o Prof. San
                          </p>
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums',
                                reviewData.chatCount >= CHAT_LIMIT_PER_ENTRY
                                  ? 'bg-destructive/10 text-destructive'
                                  : reviewData.chatCount >= CHAT_LIMIT_PER_ENTRY - 2
                                    ? 'bg-warning/10 text-warning'
                                    : 'bg-muted text-muted-foreground',
                              )}
                              title="Perguntas usadas nesta questão"
                            >
                              {reviewData.chatCount}/{CHAT_LIMIT_PER_ENTRY}
                            </span>
                            <button
                              type="button"
                              onClick={() => setChatOpen(false)}
                              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                            >
                              Fechar
                            </button>
                          </div>
                        </div>

                        {chatMessages.length === 0 && !chatLoading && (
                          <p className="text-caption text-muted-foreground italic">
                            Pergunte sobre essa questão ou sobre conteúdo de medicina
                            relacionado. Você tem{' '}
                            <strong className="text-foreground">
                              {Math.max(0, CHAT_LIMIT_PER_ENTRY - reviewData.chatCount)} pergunta
                              {CHAT_LIMIT_PER_ENTRY - reviewData.chatCount === 1 ? '' : 's'}
                            </strong>{' '}
                            nessa questão.
                          </p>
                        )}

                        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                          {chatMessages.map((m, i) => (
                            <div
                              key={i}
                              className={cn(
                                'rounded-xl px-3 py-2 text-[13px] leading-relaxed',
                                m.role === 'user'
                                  ? 'ml-6 bg-primary/[0.08] text-foreground'
                                  : 'mr-6 border border-border bg-card text-foreground',
                              )}
                            >
                              {m.role === 'assistant' ? (
                                <div className="prose prose-sm max-w-none prose-p:my-1 prose-p:text-[13px] prose-strong:text-foreground prose-li:text-[13px]">
                                  <ReactMarkdown>{m.content}</ReactMarkdown>
                                </div>
                              ) : (
                                <p>{m.content}</p>
                              )}
                            </div>
                          ))}
                          {chatLoading && (
                            <div className="mr-6 rounded-xl border border-border bg-card px-3 py-2">
                              <div className="flex items-center gap-2 text-caption text-muted-foreground">
                                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                Prof. San pensando…
                              </div>
                            </div>
                          )}
                        </div>

                        {reviewData.chatCount >= CHAT_LIMIT_PER_ENTRY ? (
                          <div className="rounded-xl border border-warning/30 bg-warning/[0.06] px-3 py-2.5 text-[12px] text-foreground">
                            <p className="font-semibold">Limite de perguntas atingido</p>
                            <p className="mt-0.5 text-muted-foreground">
                              Você já fez {CHAT_LIMIT_PER_ENTRY} perguntas sobre essa questão.
                              Quando dominar, pode treinar mais com os simulados sugeridos.
                            </p>
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              void sendChatMessage();
                            }}
                            className="flex items-end gap-2"
                          >
                            <textarea
                              value={chatInput}
                              onChange={(e) => setChatInput(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  void sendChatMessage();
                                }
                              }}
                              rows={1}
                              maxLength={600}
                              placeholder="Pergunte sobre essa questão…"
                              disabled={chatLoading}
                              className="flex-1 resize-none rounded-xl border border-border bg-background px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                            />
                            <Button
                              type="submit"
                              size="sm"
                              disabled={chatLoading || !chatInput.trim()}
                              className="!text-white"
                            >
                              <Send className="h-3.5 w-3.5" aria-hidden />
                              <span className="sr-only">Enviar</span>
                            </Button>
                          </form>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>

        {/* Painel lateral — fila da sessão (desktop) */}
        <aside className="hidden lg:block lg:w-72 lg:shrink-0 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-9rem)]">
          <SessionPanel
            entries={entries}
            currentIndex={currentIndex}
            onJump={(i) => setCurrentIndex(i)}
            dominatedIds={dominatedIdsRef.current}
            snoozedIds={snoozedIdsRef.current}
            sessionDominated={sessionDominated}
            initialTotal={initialTotalRef.current ?? entries.length}
          />
        </aside>
      </div>

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
            <DropdownMenu>
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Clock className="h-4 w-4 mr-1.5" />
                      Revisar depois
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">
                  Agenda pra revisar mais tarde{' '}
                  <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">J</kbd>
                </TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Volta na fila ativa em
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => handleSnooze(1)}>
                  Amanhã
                  <span className="ml-auto text-[10px] text-muted-foreground">1 dia</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(3)}>
                  Em alguns dias
                  <span className="ml-auto text-[10px] text-muted-foreground">3 dias</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSnooze(7)}>
                  Próxima semana
                  <span className="ml-auto text-[10px] text-muted-foreground">7 dias</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleSnooze(3)}
                  className="text-[11px] text-muted-foreground"
                >
                  Padrão (3 dias)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

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
