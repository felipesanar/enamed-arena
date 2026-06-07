/**
 * useActiveRecallSession
 *
 * Orchestrates the active-recall review session:
 * - Loads queue (srs_due_at <= now, resolved_at IS NULL)
 * - Manages per-question FSM: answering → confidence → revealed → self_grade → (next)
 * - Calls recordReviewAttempt (fire-and-forget) then scheduleNextReview (blocking)
 * - Handles skip, remove, snooze and session completion
 *
 * Does NOT manage timer or fullscreen — out of scope per spec 03 §9.2.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { simuladosApi } from '@/services/simuladosApi';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import { isLeechEntry, isAwaitingLesson, isReviewBlocked } from '@/lib/cadernoStatus';
import type { Confidence, ReviewOutcome, SrsState } from '@/types/caderno';
import type { Question } from '@/types';
import type { AiPractice } from '@/services/simuladosApi';

// ─── Phase FSM ────────────────────────────────────────────────────────────────

export type RecallPhase = 'answering' | 'confidence' | 'revealed' | 'self_grade';

// ─── Queue entry (minimal shape needed by the session) ────────────────────────

export interface RecallEntry {
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
  /** ISO — present when SRS has been computed at least once */
  srsDueAt: string | null;
  /** Lower ease = harder questions — used for secondary sort */
  srsEase: number | null;
  // SRS blocking fields — populated from DB columns
  lastReviewOutcome: string | null;
  srsLapses: number | null;
  masteredAt: string | null;
}

// ─── Per-question review payload ─────────────────────────────────────────────

export interface EntryReviewData {
  question: Question | null;
  /** The option id the student originally selected in the simulado */
  originalSelectedOptionId: string | null;
  aiReviewMd: string | null;
  aiPractice: AiPractice | null;
  aiOptionRationales: Record<string, string> | null;
  chatCount: number;
}

// ─── Session stats (accumulated) ─────────────────────────────────────────────

export interface SessionStats {
  dominated: number;
  scheduled: number;
  skipped: number;
  initialTotal: number;
  startedAt: number;
  /** area → dominated count */
  areaMap: Map<string, number>;
}

// ─── Hook return type ─────────────────────────────────────────────────────────

export interface UseActiveRecallSessionReturn {
  // Queue
  entries: RecallEntry[];
  currentIndex: number;
  currentEntry: RecallEntry | null;

  /** True when ?timed=1 is present in the URL — enables DrillTimerBar */
  isTimed: boolean;

  // Loading states
  loadingList: boolean;
  listError: boolean;
  loadingReview: boolean;
  generatingAi: boolean;

  // Review data for current entry
  reviewData: EntryReviewData | null;

  // FSM
  phase: RecallPhase;
  selectedOptionId: string | null;
  confidence: Confidence | null;
  /** Set when scheduleNextReview is in-flight */
  schedulingNextReview: boolean;

  // Session state
  finished: boolean;
  stats: SessionStats;
  dominatedPulse: number;

  // Chat state
  chatOpen: boolean;
  chatMessages: ChatTurn[];
  chatInput: string;
  chatLoading: boolean;

  // Blocked state
  /** True when the current entry is leech_blocked or awaiting_lesson */
  isCurrentEntryBlocked: boolean;
  /** True when the current entry is a leech (leech_blocked) */
  isCurrentEntryLeech: boolean;
  /** True when the current entry is awaiting_lesson */
  isCurrentEntryAwaitingLesson: boolean;
  /** Whether the lesson-unlock dialog should be open */
  lessonUnlockDialogOpen: boolean;

  // Actions
  selectOption: (optionId: string) => void;
  /** Advance from 'answering' to 'confidence' when an option is already selected
   *  (used by the mobile "Confirmar resposta" CTA). No-op in other phases. */
  goToConfidence: () => void;
  setConfidence: (c: Confidence) => void;
  submitSelfGrade: (grade: ReviewOutcome) => Promise<void>;
  skipCurrent: () => void;
  goToPrev: () => void;
  jumpTo: (index: number) => void;
  handleRemove: () => Promise<void>;
  handleSnooze: (days?: number) => Promise<void>;
  generateAiReview: (force?: boolean) => Promise<void>;
  setChatOpen: (open: boolean) => void;
  setChatInput: (v: string) => void;
  sendChatMessage: () => Promise<void>;
  retryLoad: () => void;
  finishSession: () => void;
  /** Called after leech reset succeeds — refreshes entry state and re-enables review */
  handleLeechReset: (entryId: string) => void;
  /** Called when student confirms they've studied the lesson (awaiting_lesson unlock) */
  handleLessonUnlock: (entryId: string) => Promise<void>;
  /** Closes the lesson-unlock dialog without confirming */
  closeLessonUnlockDialog: () => void;
}

export type ChatTurn = { role: 'user' | 'assistant'; content: string };

const CHAT_LIMIT_PER_ENTRY = 10;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toRecallEntry(row: any): RecallEntry {
  return {
    id: row.id,
    questionId: row.question_id ?? null,
    simuladoId: row.simulado_id ?? null,
    simuladoTitle: row.simulado_title ?? null,
    area: row.area ?? null,
    theme: row.theme ?? null,
    questionNumber: row.question_number ?? null,
    reason: row.reason ?? 'did_not_know',
    learningNote: row.learning_text ?? null,
    wasCorrect: row.was_correct ?? false,
    addedAt: row.created_at,
    srsDueAt: (row as any).srs_due_at ?? null,
    srsEase: (row as any).srs_ease ?? null,
    lastReviewOutcome: (row as any).last_review_outcome ?? null,
    srsLapses: (row as any).srs_lapses ?? null,
    masteredAt: (row as any).mastered_at ?? null,
  };
}

function buildQueue(
  rows: any[],
  mode: 'due' | 'all' | 'drill',
  singleId: string | null,
  drillArea: string | null,
  drillTheme: string | null,
): RecallEntry[] {
  const now = Date.now();

  // Always exclude resolved, deleted and SRS-blocked entries regardless of mode.
  const BLOCKED_OUTCOMES = new Set(['leech_blocked', 'awaiting_lesson']);
  let filtered = rows.filter(
    (r) =>
      !r.resolved_at &&
      !r.deleted_at &&
      !BLOCKED_OUTCOMES.has((r as any).last_review_outcome),
  );

  if (singleId) {
    filtered = filtered.filter((r) => r.id === singleId);
  } else if (mode === 'drill' && drillArea) {
    // Drill mode with area: all non-mastered entries for the chosen area/theme
    filtered = filtered.filter((r) => {
      if (r.mastered_at) return false;
      const rowArea: string = (r.area ?? '') as string;
      if (rowArea.toLowerCase() !== drillArea.toLowerCase()) return false;
      if (drillTheme) {
        const rowTheme: string = (r.theme ?? '') as string;
        if (rowTheme.toLowerCase() !== drillTheme.toLowerCase()) return false;
      }
      return true;
    });
  } else if (mode === 'due' || mode === 'drill') {
    // 'due' behaviour: srs_due_at <= now (also fallback for drill without area)
    filtered = filtered.filter((r) => {
      const due = (r as any).srs_due_at as string | null | undefined;
      if (!due) {
        // No SRS computed yet — treat as due (legacy entries)
        const nr = (r as any).next_review_at as string | null | undefined;
        if (!nr) return true;
        return new Date(nr).getTime() <= now;
      }
      return new Date(due).getTime() <= now;
    });
  }
  // mode === 'all': no extra filter (all pending, non-blocked entries)

  // Sort: overdue / oldest due first, then by ease ascending (harder first)
  return filtered
    .map(toRecallEntry)
    .sort((a, b) => {
      const aDue = a.srsDueAt ? new Date(a.srsDueAt).getTime() : 0;
      const bDue = b.srsDueAt ? new Date(b.srsDueAt).getTime() : 0;
      if (aDue !== bDue) return aDue - bDue;
      return (a.srsEase ?? 2.5) - (b.srsEase ?? 2.5);
    });
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useActiveRecallSession(
  userId: string,
  studentName: string,
): UseActiveRecallSessionReturn {
  const [searchParams] = useSearchParams();
  const mode = (searchParams.get('mode') as 'due' | 'all' | 'drill') ?? 'due';
  const singleEntryId = searchParams.get('entry');
  const drillArea = searchParams.get('area');
  const drillTheme = searchParams.get('theme');
  const isTimed = searchParams.get('timed') === '1';
  const drillCount = searchParams.get('count') ? parseInt(searchParams.get('count')!, 10) : null;

  // Queue
  const [entries, setEntries] = useState<RecallEntry[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState(false);

  // Navigation
  const [currentIndex, setCurrentIndex] = useState(0);

  // Per-entry review data
  const [reviewData, setReviewData] = useState<EntryReviewData | null>(null);
  const [loadingReview, setLoadingReview] = useState(false);
  const [generatingAi, setGeneratingAi] = useState(false);

  // FSM state
  const [phase, setPhase] = useState<RecallPhase>('answering');
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [confidence, setConfidenceState] = useState<Confidence | null>(null);
  const [schedulingNextReview, setSchedulingNextReview] = useState(false);

  // Session
  const [finished, setFinished] = useState(false);
  const [dominatedPulse, setDominatedPulse] = useState(0);
  const [stats, setStats] = useState<SessionStats>({
    dominated: 0,
    scheduled: 0,
    skipped: 0,
    initialTotal: 0,
    startedAt: Date.now(),
    areaMap: new Map(),
  });

  // Chat
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatTurn[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // Lesson-unlock dialog (awaiting_lesson)
  const [lessonUnlockDialogOpen, setLessonUnlockDialogOpen] = useState(false);

  // Refs to avoid stale closures + track generated entries
  const generatedFor = useRef<Set<string>>(new Set());
  const initialTotalSet = useRef(false);
  // Tracks entry ids for which the lesson-unlock dialog was manually closed by the user.
  // Prevents the effect from re-opening it until the entry changes.
  const lessonDialogDismissedFor = useRef<Set<string>>(new Set());
  // Ref mirror of generatingAi to avoid listing it as a useCallback dep (prevents stale closure
  // warnings from react-hooks/exhaustive-deps while keeping the in-flight guard correct).
  const generatingAiRef = useRef(false);

  // ── Load queue ──────────────────────────────────────────────────────────────

  const fetchPending = useCallback(async () => {
    if (!userId) return;
    setLoadingList(true);
    setListError(false);
    try {
      const rows = await simuladosApi.getErrorNotebook(userId);
      let queue = buildQueue(rows, mode, singleEntryId, drillArea, drillTheme);
      if (mode === 'drill' && drillCount !== null && drillCount > 0) {
        queue = queue.slice(0, drillCount);
      }
      setEntries(queue);
      if (!initialTotalSet.current) {
        initialTotalSet.current = true;
        setStats((s) => ({
          ...s,
          initialTotal: queue.length,
          startedAt: Date.now(),
        }));
        trackEvent('caderno_revisao_started', {
          total_pending: queue.length,
          mode,
        });
      }
    } catch (err) {
      logger.error('[useActiveRecallSession] load list error:', err);
      setListError(true);
    } finally {
      setLoadingList(false);
    }
  }, [userId, mode, singleEntryId, drillArea, drillTheme, drillCount]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  // ── Current entry ───────────────────────────────────────────────────────────

  const currentEntry = entries[currentIndex] ?? null;

  // ── Load review data when entry changes ─────────────────────────────────────

  useEffect(() => {
    if (!currentEntry) {
      setReviewData(null);
      return;
    }
    let cancelled = false;
    setLoadingReview(true);
    setReviewData(null);
    setPhase('answering');
    setSelectedOptionId(null);
    setConfidenceState(null);
    setChatMessages([]);
    setChatInput('');
    setChatOpen(false);

    simuladosApi
      .getErrorNotebookEntryForReview(currentEntry.id, userId)
      .then((res) => {
        if (cancelled || !res) return;
        setReviewData({
          question: res.question,
          originalSelectedOptionId: res.userSelectedOptionId,
          aiReviewMd: res.aiReviewMd,
          aiPractice: res.aiPractice,
          aiOptionRationales: res.aiOptionRationales,
          chatCount: res.chatCount ?? 0,
        });
      })
      .catch((err) => {
        logger.error('[useActiveRecallSession] load entry error:', err);
        if (!cancelled) {
          toast({
            title: 'Não foi possível carregar a questão',
            description: 'Pule para a próxima quando quiser.',
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally keyed on id only
  }, [currentEntry?.id, userId]);

  // ── Auto-generate AI on first reveal if not cached ──────────────────────────
  // We only trigger generation after the reveal phase starts so the student
  // doesn't see the answer before responding.

  const generateAiReview = useCallback(
    async (force = false) => {
      if (!currentEntry || !reviewData?.question) return;
      if (generatingAiRef.current) return;
      if (!force && generatedFor.current.has(currentEntry.id)) return;
      if (!force && reviewData.aiReviewMd) return;

      generatedFor.current.add(currentEntry.id);
      generatingAiRef.current = true;
      setGeneratingAi(true);

      try {
        const q = reviewData.question;
        const correctLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? null;
        const userLabel =
          q.options.find((o) => o.id === reviewData.originalSelectedOptionId)?.label ?? null;

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
          prev ? { ...prev, aiReviewMd: markdown, aiPractice: practice, aiOptionRationales: optionRationales } : prev,
        );

        try {
          await simuladosApi.saveErrorNotebookAiReview(currentEntry.id, userId, {
            markdown,
            practice,
            optionRationales,
          });
        } catch (cacheErr) {
          logger.error('[useActiveRecallSession] cache save error:', cacheErr);
        }

        trackEvent('caderno_revisao_ai_generated', {
          reason: currentEntry.reason,
          area: currentEntry.area ?? 'unknown',
          regenerated: force,
        });
      } catch (err) {
        logger.error('[useActiveRecallSession] gemini error:', err);
        toast({
          title: 'Não consegui gerar a análise agora',
          description: 'Tente novamente em instantes.',
          variant: 'destructive',
        });
        if (!force) generatedFor.current.delete(currentEntry.id);
      } finally {
        generatingAiRef.current = false;
        setGeneratingAi(false);
      }
    },
    [currentEntry, reviewData, studentName, userId],
  );

  // ── FSM actions ──────────────────────────────────────────────────────────────

  const selectOption = useCallback((optionId: string) => {
    if (phase !== 'answering') return;
    setSelectedOptionId(optionId);
    // Advance to confidence phase immediately after selection
    setPhase('confidence');
    trackEvent('caderno_recall_answer_selected', {
      entry_id: currentEntry?.id ?? '',
      was_correct: currentEntry
        ? reviewData?.question?.correctOptionId === optionId
        : false,
      option_label:
        reviewData?.question?.options.find((o) => o.id === optionId)?.label ?? '',
    });
  }, [phase, currentEntry, reviewData]);

  /** Mobile CTA: advance to confidence phase when an option is already selected. */
  const goToConfidence = useCallback(() => {
    if (phase !== 'answering' || !selectedOptionId) return;
    setPhase('confidence');
  }, [phase, selectedOptionId]);

  const setConfidence = useCallback(
    (c: Confidence) => {
      if (phase !== 'confidence') return;
      setConfidenceState(c);
      setPhase('revealed');

      trackEvent('caderno_recall_confidence_set', {
        entry_id: currentEntry?.id ?? '',
        confidence: c,
      });

      // Fire-and-forget: record attempt (no self_grade yet — will be sent again in submitSelfGrade)
      // Per spec appendix A: "record_review_attempt_guarded — Ao confirmar confiança (Fase 2→3)"
      // We send a preliminary record here without self_grade (will be overwritten after self_grade)
      // Actually spec says "chama record_review_attempt_guarded" at confidence — we fire-and-forget
      // but self_grade will be 'errei' placeholder; the real call is in submitSelfGrade.
      // To avoid duplicate records we only call the full RPC in submitSelfGrade.
      // Here we just reveal the answer.

      trackEvent('caderno_recall_revealed', {
        entry_id: currentEntry?.id ?? '',
        was_correct: currentEntry
          ? reviewData?.question?.correctOptionId === selectedOptionId
          : false,
      });

      // Auto-generate AI review if not cached
      if (!reviewData?.aiReviewMd && currentEntry && !generatedFor.current.has(currentEntry.id)) {
        // Non-blocking — will update state when ready
        void generateAiReview(false);
      }
    },
    [phase, currentEntry, reviewData, selectedOptionId, generateAiReview],
  );

  const advanceQueue = useCallback(() => {
    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== currentEntry?.id);
      setCurrentIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)));
      return next;
    });
  }, [currentEntry]);

  const goToNext = useCallback(() => {
    if (!currentEntry) return;
    setEntries((prev) => {
      if (currentIndex >= prev.length - 1) {
        setFinished(true);
        return prev;
      }
      setCurrentIndex((i) => i + 1);
      return prev;
    });
  }, [currentIndex, currentEntry]);

  const submitSelfGrade = useCallback(
    async (grade: ReviewOutcome) => {
      if (phase !== 'self_grade' && phase !== 'revealed') return;
      if (!currentEntry || !selectedOptionId || confidence === null) return;

      const q = reviewData?.question;
      const wasCorrect = q ? q.correctOptionId === selectedOptionId : false;

      // Validate: 'facil' not allowed when wrong
      if (grade === 'facil' && !wasCorrect) return;

      setSchedulingNextReview(true);

      try {
        // 1. Record attempt — MUST be awaited before scheduleNextReview because the
        //    schedule RPC reads the last 2 review_attempts to compute domain/promotion.
        try {
          await simuladosApi.recordReviewAttempt({
            entryId: currentEntry.id,
            selectedOptionId,
            wasCorrect,
            confidence,
            selfGrade: grade,
          });
        } catch (recordErr) {
          logger.error('[useActiveRecallSession] recordReviewAttempt error:', recordErr);
          toast({
            title: 'Não foi possível registrar sua tentativa',
            description: 'Verifique sua conexão e tente novamente.',
            variant: 'destructive',
          });
          setSchedulingNextReview(false);
          return;
        }

        trackEvent('caderno_recall_self_graded', {
          entry_id: currentEntry.id,
          grade,
          was_correct: wasCorrect,
          srs_next_interval_days: 0, // will update after schedule
        });

        // 2. Schedule next review (blocking — max 3s)
        let srsState: SrsState | null = null;
        const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000));
        srsState = await Promise.race([
          simuladosApi.scheduleNextReview(currentEntry.id, grade, confidence),
          timeout,
        ]);

        if (!srsState) {
          toast({
            title: 'Agendamento demorou mais que o esperado',
            description: 'Avançando — a questão será agendada em breve.',
            variant: 'default',
          });
        }

        // Track mastered
        if (srsState?.mastered) {
          trackEvent('caderno_entry_mastered', {
            entry_id: currentEntry.id,
            via_srs: true,
            srs_interval_days: srsState.srsInterval,
          });
          setDominatedPulse((n) => n + 1);
          setStats((s) => {
            const newMap = new Map(s.areaMap);
            if (currentEntry.area) {
              newMap.set(currentEntry.area, (newMap.get(currentEntry.area) ?? 0) + 1);
            }
            return { ...s, dominated: s.dominated + 1, areaMap: newMap };
          });
          // Toast appears 500ms after transition per spec
          setTimeout(() => {
            toast({
              title: `Dominada! Q${currentEntry.questionNumber ?? '?'} sai da fila por um bom tempo.`,
            });
          }, 500);
        } else {
          setStats((s) => ({ ...s, scheduled: s.scheduled + 1 }));
        }

        // Track leech
        if (srsState?.isLeech) {
          trackEvent('caderno_entry_leech_triggered', {
            entry_id: currentEntry.id,
            srs_lapses: 0, // actual value from DB — we don't have it client-side
            area: currentEntry.area ?? 'unknown',
          });
        }

        // Remove from queue and advance
        advanceQueue();
      } catch (err: any) {
        logger.error('[useActiveRecallSession] submitSelfGrade error:', err);

        // Defensive fallback: if the DB rejects because the entry is blocked,
        // update local state to reflect the blocking condition so the UI can
        // show the appropriate intervention (LeechInterventionBanner / LessonUnlockDialog).
        const errMsg: string = err?.message ?? err?.code ?? '';
        if (errMsg.includes('review_blocked') || errMsg.includes('awaiting_lesson') || errMsg.includes('leech_blocked')) {
          logger.log('[useActiveRecallSession] scheduleNextReview blocked — refreshing entry state');
          void fetchPending();
          toast({
            title: 'Esta questão está bloqueada',
            description: 'Siga as instruções na tela para desbloqueá-la antes de revisar.',
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Não foi possível salvar sua avaliação',
            description: 'A questão será mantida na fila.',
            variant: 'destructive',
          });
        }
      } finally {
        setSchedulingNextReview(false);
      }
    },
    [phase, currentEntry, selectedOptionId, confidence, reviewData, advanceQueue, fetchPending],
  );

  const skipCurrent = useCallback(() => {
    if (!currentEntry) return;
    setStats((s) => ({ ...s, skipped: s.skipped + 1 }));
    if (currentIndex >= entries.length - 1) {
      setFinished(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentEntry, currentIndex, entries.length]);

  const goToPrev = useCallback(() => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  const jumpTo = useCallback((index: number) => {
    if (index >= 0 && index < entries.length) setCurrentIndex(index);
  }, [entries.length]);

  const handleRemove = useCallback(async () => {
    if (!currentEntry) return;
    const target = currentEntry;
    const removedIndex = currentIndex;

    setEntries((prev) => {
      const next = prev.filter((e) => e.id !== target.id);
      setCurrentIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)));
      return next;
    });

    // No JSX undo action from hooks — simple fire-and-forget with error recovery
    toast({
      title: 'Removida do caderno',
      description: `Q${target.questionNumber ?? '?'} · ${target.area ?? '—'}`,
      duration: 3000,
    });

    setTimeout(async () => {
      try {
        await simuladosApi.deleteErrorNotebookEntry(target.id, userId);
      } catch (err) {
        logger.error('[useActiveRecallSession] delete error:', err);
        // Re-insert only the removed entry at its original position into the
        // current state (not a stale snapshot) to avoid resurrecting other
        // removals that may have happened during the 5-second window.
        setEntries((curr) => {
          if (curr.some((e) => e.id === target.id)) return curr; // already re-added
          const insertAt = Math.min(removedIndex, curr.length);
          return [...curr.slice(0, insertAt), target, ...curr.slice(insertAt)];
        });
        toast({
          title: 'Não foi possível remover',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
      }
    }, 5000);
  }, [currentEntry, currentIndex, userId]);

  const handleSnooze = useCallback(
    async (days = 3) => {
      if (!currentEntry) return;
      const target = currentEntry;

      setEntries((prev) => {
        const next = prev.filter((e) => e.id !== target.id);
        setCurrentIndex((idx) => Math.min(idx, Math.max(0, next.length - 1)));
        return next;
      });

      trackEvent('caderno_entry_snoozed', {
        entry_id: target.id,
        days_snoozed: days,
        reason: 'manual_override',
      });

      try {
        await simuladosApi.snoozeErrorNotebookEntry(target.id, days);
        const label = days === 1 ? 'amanhã' : `em ${days} dias`;
        toast({ title: `Vai voltar ${label}`, description: 'A questão sai da fila ativa até lá.' });
      } catch (err) {
        logger.error('[useActiveRecallSession] snooze error:', err);
        toast({
          title: 'Não consegui agendar a revisão',
          description: 'A questão segue pro fim da fila desta sessão.',
          variant: 'destructive',
        });
      }
    },
    [currentEntry],
  );

  // ── Chat ─────────────────────────────────────────────────────────────────────

  const sendChatMessage = useCallback(async () => {
    if (!currentEntry || !reviewData?.question) return;
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading) return;
    if ((reviewData.chatCount ?? 0) >= CHAT_LIMIT_PER_ENTRY) return;

    const userTurn: ChatTurn = { role: 'user', content: trimmed };
    const nextHistory = [...chatMessages, userTurn];
    setChatMessages(nextHistory);
    setChatInput('');
    setChatLoading(true);

    try {
      const q = reviewData.question;
      const correctLabel = q.options.find((o) => o.id === q.correctOptionId)?.label ?? null;
      const userLabel =
        q.options.find((o) => o.id === reviewData.originalSelectedOptionId)?.label ?? null;

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

      const statusCode = (error as any)?.context?.status as number | undefined;
      if (statusCode === 429) {
        setReviewData((prev) => (prev ? { ...prev, chatCount: CHAT_LIMIT_PER_ENTRY } : prev));
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

      const used = (data?.used as number | undefined) ?? (reviewData.chatCount ?? 0) + 1;
      setChatMessages([...nextHistory, { role: 'assistant', content: reply }]);
      setReviewData((prev) => (prev ? { ...prev, chatCount: used } : prev));

      trackEvent('caderno_revisao_chat_message_sent', {
        area: currentEntry.area ?? 'unknown',
        history_length: nextHistory.length,
        off_topic: !!data?.offTopic,
        used,
      });
    } catch (err) {
      logger.error('[useActiveRecallSession] chat error:', err);
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
  }, [currentEntry, reviewData, chatInput, chatLoading, chatMessages, studentName]);

  const finishSession = useCallback(() => {
    const elapsed = Math.round((Date.now() - stats.startedAt) / 1000);
    const topArea = Array.from(stats.areaMap.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
    trackEvent('caderno_revisao_session_ended', {
      session_duration_seconds: elapsed,
      entries_reviewed: stats.dominated + stats.scheduled,
      entries_mastered: stats.dominated,
      entries_snoozed: stats.skipped,
      top_area: topArea,
    });
    setFinished(true);
  }, [stats]);

  // ── Blocked-entry helpers ────────────────────────────────────────────────────

  // Derive blocking state from the current entry's SRS fields
  const srsShape = currentEntry
    ? {
        last_review_outcome: currentEntry.lastReviewOutcome,
        srs_lapses: currentEntry.srsLapses,
        mastered_at: currentEntry.masteredAt,
        srs_due_at: currentEntry.srsDueAt,
      }
    : null;

  const isCurrentEntryBlocked = srsShape ? isReviewBlocked(srsShape) : false;
  const isCurrentEntryLeech = srsShape ? isLeechEntry(srsShape) : false;
  const isCurrentEntryAwaitingLesson = srsShape ? isAwaitingLesson(srsShape) : false;

  // Open the lesson-unlock dialog automatically when the current entry is awaiting_lesson.
  // Does NOT reopen if the user already dismissed it manually for this specific entry.
  useEffect(() => {
    if (isCurrentEntryAwaitingLesson) {
      const entryId = currentEntry?.id ?? '';
      if (!lessonDialogDismissedFor.current.has(entryId)) {
        setLessonUnlockDialogOpen(true);
      }
    } else {
      setLessonUnlockDialogOpen(false);
    }
  }, [currentEntry?.id, isCurrentEntryAwaitingLesson]);

  /**
   * Called by LeechInterventionBanner after `simuladosApi.resetLeech` succeeds.
   * Updates the local queue entry optimistically so the UI re-enables the review
   * flow without a full refetch. A background refetch is also triggered.
   */
  const handleLeechReset = useCallback(
    (entryId: string) => {
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, lastReviewOutcome: null, srsLapses: 0 }
            : e,
        ),
      );
      // Background refetch to sync DB-computed SRS fields
      void fetchPending();
    },
    [fetchPending],
  );

  /**
   * Called when the student confirms they've studied the lesson (LessonUnlockDialog).
   *
   * Chama `simuladosApi.clearAwaitingLesson(entryId)` para limpar
   * `last_review_outcome = 'awaiting_lesson'` server-side, garantindo persistência
   * entre reloads. Aplica também um optimistic update local para resposta imediata.
   */
  const handleLessonUnlock = useCallback(
    async (entryId: string) => {
      // Optimistic update — desbloqueia imediatamente na UI
      setEntries((prev) =>
        prev.map((e) =>
          e.id === entryId
            ? { ...e, lastReviewOutcome: null }
            : e,
        ),
      );
      setLessonUnlockDialogOpen(false);

      try {
        await simuladosApi.clearAwaitingLesson(entryId);
        logger.log('[useActiveRecallSession] Lesson unlock confirmed (server) for entry', entryId);
        trackEvent('caderno_lesson_unlocked', { entry_id: entryId });
        toast({
          title: 'Ótimo! Questão liberada para revisão.',
          description: 'O caderno vai espaçar as revisões a partir de agora.',
        });
        // Refetch em background para sincronizar qualquer campo computado pelo servidor
        void fetchPending();
      } catch (err) {
        logger.error('[useActiveRecallSession] Error clearing awaiting_lesson:', err);
        // Reverte o optimistic update em caso de falha
        setEntries((prev) =>
          prev.map((e) =>
            e.id === entryId
              ? { ...e, lastReviewOutcome: 'awaiting_lesson' }
              : e,
          ),
        );
        setLessonUnlockDialogOpen(true);
        toast({
          title: 'Não foi possível liberar a questão',
          description: 'Verifique sua conexão e tente novamente.',
          variant: 'destructive',
        });
      }
    },
    [fetchPending],
  );

  const closeLessonUnlockDialog = useCallback(() => {
    setLessonUnlockDialogOpen(false);
    // Mark this entry as manually dismissed so the effect does not reopen the dialog.
    if (currentEntry?.id) {
      lessonDialogDismissedFor.current.add(currentEntry.id);
    }
  }, [currentEntry?.id]);

  return {
    entries,
    currentIndex,
    currentEntry,
    loadingList,
    listError,
    loadingReview,
    generatingAi,
    reviewData,
    phase,
    selectedOptionId,
    confidence,
    schedulingNextReview,
    finished,
    stats,
    dominatedPulse,
    chatOpen,
    chatMessages,
    chatInput,
    chatLoading,
    isTimed,
    // Blocked state
    isCurrentEntryBlocked,
    isCurrentEntryLeech,
    isCurrentEntryAwaitingLesson,
    lessonUnlockDialogOpen,
    selectOption,
    goToConfidence,
    setConfidence,
    submitSelfGrade,
    skipCurrent,
    goToPrev,
    jumpTo,
    handleRemove,
    handleSnooze,
    generateAiReview,
    setChatOpen,
    setChatInput,
    sendChatMessage,
    retryLoad: fetchPending,
    finishSession,
    handleLeechReset,
    handleLessonUnlock,
    closeLessonUnlockDialog,
  };
}
