/**
 * CadernoRevisaoV2Page — Sessão de Recall Ativo (Caderno de Erros v2)
 *
 * Exported name: CadernoRevisaoV2Page
 * Route: /caderno/revisao  (fiar em App.tsx)
 * Query params:
 *   ?entry=<uuid>   — sessão de 1 questão específica
 *   ?mode=due       — (padrão) somente vencidas hoje (srs_due_at <= now)
 *   ?mode=all       — todas as entradas pendentes
 *
 * Layout:
 *   Desktop (≥lg): 2 painéis — questão central + SessionQueuePanel à direita.
 *   Mobile: 1 coluna, MobileAppBar, BottomActionBar no thumb-zone.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Trash2,
  Flame,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
  X,
} from 'lucide-react';

import { PageTransition } from '@/components/premium/PageTransition';
import { EmptyState } from '@/components/EmptyState';
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

import { RecallQuestionCard } from '@/components/caderno/recall/RecallQuestionCard';
import { ConfidenceStep } from '@/components/caderno/recall/ConfidenceStep';
import { RevealPanel } from '@/components/caderno/recall/RevealPanel';
import { SelfGradeBar } from '@/components/caderno/recall/SelfGradeBar';
import { SessionSummaryV2 } from '@/components/caderno/recall/SessionSummaryV2';
import { DesktopQueuePanel, MobileQueueTrigger } from '@/components/caderno/recall/SessionQueuePanel';
import { LeechInterventionBanner } from '@/components/caderno/LeechInterventionBanner';
import { LessonUnlockDialog } from '@/components/caderno/LessonUnlockDialog';
import { DrillTimerBar } from '@/components/caderno/recall/DrillTimerBar';

import { MobileAppBar } from '@/components/caderno/ui/MobileAppBar';
import { BottomActionBar } from '@/components/caderno/ui/BottomActionBar';
import { ProgressBar } from '@/components/caderno/ui/ProgressRing';
import { CadernoCardSkeleton, SkeletonLine } from '@/components/caderno/ui/CadernoSkeleton';

import { useActiveRecallSession } from '@/hooks/useActiveRecallSession';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { cn } from '@/lib/utils';

// ─── Keyboard handler ─────────────────────────────────────────────────────────

function useRecallKeyboard(session: ReturnType<typeof useActiveRecallSession>) {
  const {
    phase,
    currentEntry,
    selectedOptionId,
    reviewData,
    schedulingNextReview,
    chatOpen,
    selectOption,
    setConfidence,
    submitSelfGrade,
    skipCurrent,
    goToPrev,
    handleRemove,
  } = session;

  const handler = useCallback(
    (e: KeyboardEvent) => {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      const isEditable =
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        (document.activeElement as HTMLElement)?.isContentEditable;

      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Escape' && chatOpen) return;

      if (!isEditable) {
        if (e.key === 'ArrowRight') { e.preventDefault(); skipCurrent(); return; }
        if (e.key === 'ArrowLeft') { e.preventDefault(); goToPrev(); return; }
        if (e.key === 'r' || e.key === 'R') { e.preventDefault(); void handleRemove(); return; }
      }

      if (isEditable) return;

      if (phase === 'answering') {
        const optionKey = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E'].includes(optionKey) && reviewData?.question) {
          e.preventDefault();
          const opt = reviewData.question.options.find((o) => o.label === optionKey);
          if (opt) selectOption(opt.id);
        }
        if (e.key === 'Enter' && selectedOptionId) {
          e.preventDefault();
        }
      }

      if (phase === 'confidence') {
        if (e.key === '1') { e.preventDefault(); setConfidence('baixa'); }
        if (e.key === '2') { e.preventDefault(); setConfidence('media'); }
        if (e.key === '3') { e.preventDefault(); setConfidence('alta'); }
      }

      if ((phase === 'revealed' || phase === 'self_grade') && !schedulingNextReview) {
        if (e.key === '1') { e.preventDefault(); void submitSelfGrade('errei'); }
        if (e.key === '2') { e.preventDefault(); void submitSelfGrade('dificil'); }
        if (e.key === '3') { e.preventDefault(); void submitSelfGrade('bom'); }
        const wasCorrect =
          !!reviewData?.question && reviewData.question.correctOptionId === selectedOptionId;
        if (e.key === '4' && wasCorrect) { e.preventDefault(); void submitSelfGrade('facil'); }
      }
    },
    [
      phase,
      chatOpen,
      selectedOptionId,
      reviewData,
      schedulingNextReview,
      selectOption,
      setConfidence,
      submitSelfGrade,
      skipCurrent,
      goToPrev,
      handleRemove,
    ],
  );

  useEffect(() => {
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handler]);
}

// ─── Desktop keyboard legend ──────────────────────────────────────────────────

function KeyboardLegend({ phase }: { phase: string }) {
  return (
    <div className="mt-2 hidden md:flex items-center justify-center gap-4 text-[10px] text-[var(--c-muted)]/60">
      {phase === 'answering' && (
        <>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">A</kbd>
            –
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">E</kbd>
            selecionar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">→</kbd>
            pular
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">R</kbd>
            remover
          </span>
        </>
      )}
      {phase === 'confidence' && (
        <>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">1</kbd>
            –
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">3</kbd>
            confiança
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">←</kbd>
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">→</kbd>
            navegar
          </span>
        </>
      )}
      {(phase === 'revealed' || phase === 'self_grade') && (
        <>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">1</kbd>
            –
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">4</kbd>
            autoavaliar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-[var(--c-surface-2)] px-1 py-0.5 font-mono text-[9px]">Esc</kbd>
            fechar chat
          </span>
        </>
      )}
    </div>
  );
}

// ─── Desktop sticky top bar ───────────────────────────────────────────────────

function DesktopTopBar({
  currentIndex,
  total,
  dominated,
  dominatedPulse,
  phase,
  progress,
  isTimed,
  startedAt,
  initialTotal,
}: {
  currentIndex: number;
  total: number;
  dominated: number;
  dominatedPulse: number;
  phase: string;
  progress: number;
  isTimed: boolean;
  startedAt: number;
  initialTotal: number;
}) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="sticky top-0 z-30 hidden md:block">
      <div className="border-b border-[var(--c-border)] bg-[var(--c-surface)]/95 px-0 py-2.5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-4">
          {/* Left — exit */}
          <Link
            to="/caderno"
            className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--c-muted)] transition-colors hover:text-[var(--c-ink)] no-underline shrink-0"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
            Sair
          </Link>

          {/* Center — dominated badge + counter */}
          <div className="flex flex-1 items-center justify-center gap-3">
            <AnimatePresence>
              {dominated > 0 && (
                <motion.span
                  key={dominatedPulse}
                  initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="inline-flex items-center gap-1.5 rounded-[var(--c-radius-pill)] border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[11px] font-bold text-emerald-600 tabular-nums"
                  aria-label={`${dominated} dominadas nesta sessão`}
                >
                  <Flame className="h-3 w-3" aria-hidden />
                  {dominated} dominada{dominated > 1 ? 's' : ''}
                </motion.span>
              )}
            </AnimatePresence>

            <span className="text-[13px] font-bold tabular-nums text-[var(--c-ink)]">
              {currentIndex + 1} / {total}
            </span>

            {/* Progress bar */}
            <div className="w-36">
              <ProgressBar
                value={progress}
                label="Progresso da sessão"
                className="h-[5px]"
              />
            </div>

            {/* Timer when timed */}
            {isTimed && (
              <div className="shrink-0 w-56">
                <DrillTimerBar
                  startedAt={startedAt}
                  totalQuestions={initialTotal > 0 ? initialTotal : total}
                  questionsAnswered={currentIndex}
                />
              </div>
            )}
          </div>

          {/* Right — mobile queue trigger (shows on md, hidden on lg) */}
          <div className="lg:hidden shrink-0">
            {/* placeholder for mobile trigger spacing */}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function RecallContent({ userId, studentName }: { userId: string; studentName: string }) {
  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const session = useActiveRecallSession(userId, studentName);
  useRecallKeyboard(session);

  const {
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
    retryLoad,
    finishSession,
    handleLeechReset,
    handleLessonUnlock,
    closeLessonUnlockDialog,
  } = session;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingList) {
    return (
      <div className="caderno-root space-y-4 p-4">
        {/* Top bar skeleton */}
        <div className="flex items-center justify-between rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] p-3">
          <SkeletonLine className="h-4 w-12" />
          <SkeletonLine className="h-4 w-24" />
          <SkeletonLine className="h-4 w-16" />
        </div>
        <CadernoCardSkeleton className="h-[360px]" />
        <CadernoCardSkeleton className="h-[120px]" />
      </div>
    );
  }

  if (listError) {
    return (
      <div className="caderno-root p-4">
        <EmptyState
          variant="error"
          title="Não foi possível carregar a revisão"
          description="Verifique sua conexão e tente novamente."
          onRetry={retryLoad}
          backHref="/caderno"
          backLabel="Voltar ao caderno"
        />
      </div>
    );
  }

  // ── Session finished ─────────────────────────────────────────────────────
  const sessionHadActivity = stats.dominated > 0 || stats.scheduled > 0;

  if (finished || (entries.length === 0 && sessionHadActivity)) {
    return (
      <div className="caderno-root p-4 md:p-6">
        <SessionSummaryV2
          stats={stats}
          remainingCount={entries.length}
          onContinue={
            entries.length > 0
              ? () => { window.location.reload(); }
              : undefined
          }
        />
      </div>
    );
  }

  // ── Queue empty (never had activity) ────────────────────────────────────
  if (entries.length === 0) {
    return (
      <div className="caderno-root p-4">
        <EmptyState
          icon={CheckCircle2}
          title="Nada pra revisar agora"
          description="Você não tem questões vencidas no caderno. Aproveita pra fazer mais um simulado e adicionar questões ao caderno."
          backHref="/caderno"
          backLabel="Voltar ao caderno"
        />
      </div>
    );
  }

  if (!currentEntry) return null;

  const question = reviewData?.question ?? null;
  const revealCorrect = phase === 'revealed' || phase === 'self_grade';
  const wasCorrect = question ? question.correctOptionId === selectedOptionId : false;
  const progress = Math.round(((currentIndex + 1) / entries.length) * 100);

  // Notebook-compatible shape for blocked components
  const currentEntryAsNotebook = {
    id: currentEntry.id,
    questionId: currentEntry.questionId,
    simuladoId: currentEntry.simuladoId,
    simuladoTitle: currentEntry.simuladoTitle,
    area: currentEntry.area,
    theme: currentEntry.theme,
    questionNumber: currentEntry.questionNumber,
    reason: currentEntry.reason,
    learningNote: currentEntry.learningNote,
    wasCorrect: currentEntry.wasCorrect,
    addedAt: currentEntry.addedAt,
    resolvedAt: null as string | null,
    nextReviewAt: currentEntry.srsDueAt,
    last_review_outcome: currentEntry.lastReviewOutcome,
    srs_lapses: currentEntry.srsLapses,
    masteredAt: currentEntry.masteredAt,
    srsDueAt: currentEntry.srsDueAt,
  };

  // ── Mobile layout ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div className="caderno-root flex min-h-screen flex-col bg-[var(--c-bg)]">
        {/* Mobile App Bar */}
        <MobileAppBar
          title={`${currentIndex + 1} / ${entries.length}`}
          onBack={() => navigate('/caderno')}
          action={
            <MobileQueueTrigger
              entries={entries}
              currentIndex={currentIndex}
              onJump={jumpTo}
              dominated={stats.dominated}
              initialTotal={stats.initialTotal}
            />
          }
        />

        {/* Progress bar below app bar */}
        <div className="h-[3px] w-full bg-[var(--c-surface-2)]">
          <motion.div
            className="h-full"
            style={{ background: 'linear-gradient(135deg, var(--c-wine-500), var(--c-wine-700))' }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
          />
        </div>

        {/* DrillTimerBar (timed mode) */}
        {isTimed && (
          <div className="px-4 pt-3">
            <DrillTimerBar
              startedAt={stats.startedAt}
              totalQuestions={stats.initialTotal > 0 ? stats.initialTotal : entries.length}
              questionsAnswered={currentIndex}
            />
          </div>
        )}

        {/* Dominated badge */}
        <AnimatePresence>
          {stats.dominated > 0 && (
            <motion.div
              key={dominatedPulse}
              initial={prefersReducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mx-4 mt-3"
            >
              <span className="inline-flex items-center gap-1.5 rounded-[var(--c-radius-pill)] border border-emerald-400/25 bg-emerald-500/[0.08] px-2.5 py-1 text-[11px] font-bold text-emerald-600 tabular-nums">
                <Flame className="h-3 w-3" aria-hidden />
                {stats.dominated} dominada{stats.dominated > 1 ? 's' : ''} esta sessão
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 pb-[160px] space-y-4">
          {/* Loading skeleton */}
          {loadingReview && (
            <div className="space-y-3">
              <CadernoCardSkeleton className="h-[320px]" />
              <CadernoCardSkeleton className="h-[100px]" />
            </div>
          )}

          {/* Question not found */}
          {!loadingReview && !question && (
            <div className="rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
              <p className="mt-3 text-body font-semibold text-[var(--c-ink)]">
                Não consegui carregar essa questão.
              </p>
              <p className="mt-1 text-caption text-[var(--c-muted)]">
                Pode ter sido removida. Pule para a próxima.
              </p>
            </div>
          )}

          {/* Leech intervention */}
          {!loadingReview && isCurrentEntryLeech && (
            <LeechInterventionBanner
              entry={currentEntryAsNotebook as any}
              onReset={handleLeechReset}
              className="mb-2"
            />
          )}

          {/* Lesson unlock dialog */}
          {currentEntry && isCurrentEntryAwaitingLesson && (
            <LessonUnlockDialog
              entry={currentEntryAsNotebook as any}
              open={lessonUnlockDialogOpen}
              onConfirmStudied={handleLessonUnlock}
              onClose={closeLessonUnlockDialog}
            />
          )}

          {/* Cards */}
          <AnimatePresence mode="wait">
            {!loadingReview && question && !isCurrentEntryBlocked && (
              <motion.div
                key={currentEntry.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.22 }}
                className="space-y-4"
                onAnimationComplete={() => {
                  const el = document.getElementById(`recall-q-${currentEntry.id}`);
                  if (el) el.focus();
                }}
              >
                <RecallQuestionCard
                  entry={currentEntry}
                  question={question}
                  reviewData={reviewData!}
                  revealCorrect={revealCorrect}
                  selectedOptionId={selectedOptionId}
                  onSelectOption={selectOption}
                  onSwipeNext={skipCurrent}
                  onSwipePrev={goToPrev}
                />

                {phase === 'confidence' && (
                  <ConfidenceStep onSelect={setConfidence} />
                )}

                {revealCorrect && reviewData && (
                  <RevealPanel
                    entry={currentEntry}
                    reviewData={reviewData}
                    generatingAi={generatingAi}
                    chatOpen={chatOpen}
                    chatMessages={chatMessages}
                    chatInput={chatInput}
                    chatLoading={chatLoading}
                    onGenerateAi={generateAiReview}
                    onChatOpen={setChatOpen}
                    onChatInputChange={setChatInput}
                    onChatSend={sendChatMessage}
                  />
                )}

                {revealCorrect && (
                  <SelfGradeBar
                    wasCorrect={wasCorrect}
                    isLoading={schedulingNextReview}
                    onGrade={(g) => void submitSelfGrade(g)}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Mobile Bottom Action Bar ─────────────────────────────────────── */}
        <BottomActionBar>
          {/* Prev */}
          <Button
            onClick={goToPrev}
            disabled={currentIndex === 0}
            variant="ghost"
            size="sm"
            className="text-[var(--c-muted)] h-11 px-3"
            aria-label="Questão anterior"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Button>

          {/* Phase CTA (center) */}
          <div className="flex flex-1 items-center justify-center gap-2">
            {phase === 'answering' && !selectedOptionId && (
              <span className="text-[11px] text-[var(--c-muted)]">Selecione uma alternativa</span>
            )}
            {phase === 'answering' && selectedOptionId && (
              <Button
                size="sm"
                onClick={goToConfidence}
                className="h-11 min-w-[140px] !text-white bg-[linear-gradient(135deg,var(--c-wine-500),var(--c-wine-700))] shadow-[0_4px_14px_-4px_rgba(176,41,74,.45)]"
              >
                Confirmar resposta
              </Button>
            )}
            {phase === 'confidence' && (
              <span className="text-[12px] font-medium text-[var(--c-muted)]">
                Selecione sua confiança
              </span>
            )}
            {(phase === 'revealed' || phase === 'self_grade') && !schedulingNextReview && (
              <span className="text-[12px] font-medium text-[var(--c-muted)]">
                Como você se saiu?
              </span>
            )}
            {schedulingNextReview && (
              <span className="text-[12px] text-[var(--c-muted)]">Salvando…</span>
            )}
          </div>

          {/* Skip / next */}
          <Button
            onClick={skipCurrent}
            variant="ghost"
            size="sm"
            className="text-[var(--c-muted)] h-11 px-3"
            aria-label={
              phase === 'answering' || phase === 'confidence' ? 'Pular questão' : 'Pular sem avaliar'
            }
          >
            <ChevronRight className="h-5 w-5" aria-hidden />
          </Button>
        </BottomActionBar>
      </div>
    );
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div className="caderno-root">
      {/* Desktop top sticky bar */}
      <DesktopTopBar
        currentIndex={currentIndex}
        total={entries.length}
        dominated={stats.dominated}
        dominatedPulse={dominatedPulse}
        phase={phase}
        progress={progress}
        isTimed={isTimed}
        startedAt={stats.startedAt}
        initialTotal={stats.initialTotal}
      />

      {/* Desktop DrillTimerBar (separate from header, when timed) */}
      {isTimed && (
        <div className="mt-3 mb-1">
          {/* Timer already embedded in DesktopTopBar — nothing here */}
        </div>
      )}

      {/* Two-panel layout */}
      <div className="mt-5 flex items-start gap-6">
        {/* Main column */}
        <div className="min-w-0 flex-1 space-y-4">
          {/* Loading skeleton */}
          {loadingReview && (
            <div className="space-y-4">
              <CadernoCardSkeleton className="h-[360px]" />
              <CadernoCardSkeleton className="h-[140px]" />
            </div>
          )}

          {/* Question not found */}
          {!loadingReview && !question && (
            <div className="rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] p-10 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
              <p className="mt-3 text-body font-semibold text-[var(--c-ink)]">
                Não consegui carregar essa questão.
              </p>
              <p className="mt-1 text-caption text-[var(--c-muted)]">
                Pode ter sido removida do simulado. Pule para a próxima.
              </p>
            </div>
          )}

          {/* Leech intervention */}
          {!loadingReview && isCurrentEntryLeech && (
            <LeechInterventionBanner
              entry={currentEntryAsNotebook as any}
              onReset={handleLeechReset}
              className="mb-2"
            />
          )}

          {/* Lesson unlock dialog */}
          {currentEntry && isCurrentEntryAwaitingLesson && (
            <LessonUnlockDialog
              entry={currentEntryAsNotebook as any}
              open={lessonUnlockDialogOpen}
              onConfirmStudied={handleLessonUnlock}
              onClose={closeLessonUnlockDialog}
            />
          )}

          {/* Main cards */}
          <AnimatePresence mode="wait">
            {!loadingReview && question && !isCurrentEntryBlocked && (
              <motion.div
                key={currentEntry.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -6 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="space-y-4"
                onAnimationComplete={() => {
                  const el = document.getElementById(`recall-q-${currentEntry.id}`);
                  if (el) el.focus();
                }}
              >
                <RecallQuestionCard
                  entry={currentEntry}
                  question={question}
                  reviewData={reviewData!}
                  revealCorrect={revealCorrect}
                  selectedOptionId={selectedOptionId}
                  onSelectOption={selectOption}
                  onSwipeNext={skipCurrent}
                  onSwipePrev={goToPrev}
                />

                <AnimatePresence>
                  {phase === 'confidence' && (
                    <motion.div
                      key="confidence"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                    >
                      <ConfidenceStep onSelect={setConfidence} />
                    </motion.div>
                  )}

                  {revealCorrect && reviewData && (
                    <motion.div
                      key="reveal"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25 }}
                    >
                      <RevealPanel
                        entry={currentEntry}
                        reviewData={reviewData}
                        generatingAi={generatingAi}
                        chatOpen={chatOpen}
                        chatMessages={chatMessages}
                        chatInput={chatInput}
                        chatLoading={chatLoading}
                        onGenerateAi={generateAiReview}
                        onChatOpen={setChatOpen}
                        onChatInputChange={setChatInput}
                        onChatSend={sendChatMessage}
                      />
                    </motion.div>
                  )}

                  {revealCorrect && (
                    <motion.div
                      key="selfgrade"
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: 0.05 }}
                    >
                      <SelfGradeBar
                        wasCorrect={wasCorrect}
                        isLoading={schedulingNextReview}
                        onGrade={(g) => void submitSelfGrade(g)}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right sidebar — desktop queue panel */}
        <DesktopQueuePanel
          entries={entries}
          currentIndex={currentIndex}
          onJump={jumpTo}
          dominated={stats.dominated}
          initialTotal={stats.initialTotal}
        />
      </div>

      {/* ── Desktop bottom action bar ───────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 mt-4 md:-mx-6 border-t border-[var(--c-border)] bg-[var(--c-surface)]/95 px-4 md:px-6 py-3 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-2">
          {/* Left: prev + remove + snooze */}
          <div className="flex items-center gap-1">
            <Button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              variant="ghost"
              size="sm"
              className="text-[var(--c-muted)]"
            >
              <ChevronLeft className="h-4 w-4 mr-1" aria-hidden />
              <span className="hidden sm:inline">Anterior</span>
            </Button>

            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => void handleRemove()}
                  variant="ghost"
                  size="sm"
                  className="text-[var(--c-muted)] hover:text-destructive"
                  aria-label="Remover do caderno"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Remover do caderno{' '}
                <kbd className="ml-1 rounded bg-[var(--c-surface-2)] px-1 text-[10px]">R</kbd>
              </TooltipContent>
            </Tooltip>

            {/* Snooze */}
            <DropdownMenu>
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[var(--c-muted)] hover:text-[var(--c-ink)] hidden sm:inline-flex"
                    >
                      <Clock className="h-4 w-4 mr-1.5" aria-hidden />
                      Adiar
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Adiar manualmente (override SRS)</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-[var(--c-muted)]">
                  Volta na fila em
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void handleSnooze(1)}>
                  Amanhã <span className="ml-auto text-[10px] text-[var(--c-muted)]">1 dia</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleSnooze(3)}>
                  Em alguns dias{' '}
                  <span className="ml-auto text-[10px] text-[var(--c-muted)]">3 dias</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleSnooze(7)}>
                  Próxima semana{' '}
                  <span className="ml-auto text-[10px] text-[var(--c-muted)]">7 dias</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleSnooze(3)}
                  className="text-[11px] text-[var(--c-muted)]"
                >
                  Padrão (3 dias)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right: confirm / skip / finish */}
          <div className="flex items-center gap-2">
            {/* Desktop confirm CTA (answering with selection) */}
            {phase === 'answering' && selectedOptionId && (
              <Button
                size="sm"
                onClick={goToConfidence}
                className="hidden sm:inline-flex !text-white bg-[linear-gradient(135deg,var(--c-wine-500),var(--c-wine-700))] shadow-[0_4px_12px_-4px_rgba(176,41,74,.4)] hover:opacity-90"
              >
                Confirmar resposta
              </Button>
            )}

            {/* Skip */}
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button onClick={skipCurrent} variant="outline" size="sm">
                  {phase === 'answering' || phase === 'confidence' ? (
                    <>
                      Pular
                      <ChevronRight className="h-4 w-4 ml-1" aria-hidden />
                    </>
                  ) : (
                    <>
                      Pular sem avaliar
                      <ChevronRight className="h-4 w-4 ml-1" aria-hidden />
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {phase === 'answering' || phase === 'confidence'
                  ? 'Pular questão'
                  : 'Avançar sem registrar autoavaliação'}{' '}
                <kbd className="ml-1 rounded bg-[var(--c-surface-2)] px-1 text-[10px]">→</kbd>
              </TooltipContent>
            </Tooltip>

            {/* Finish session (last entry) */}
            {currentIndex >= entries.length - 1 && phase === 'answering' && (
              <Button
                onClick={finishSession}
                size="sm"
                variant="ghost"
                className="text-[var(--c-muted)] text-[12px]"
              >
                Finalizar sessão
              </Button>
            )}
          </div>
        </div>

        {/* Keyboard legend */}
        <KeyboardLegend phase={phase} />
      </div>
    </div>
  );
}

// ─── Page wrapper (auth + access guard) ──────────────────────────────────────

export function CadernoRevisaoV2Page() {
  const { profile } = useUser();
  const { user } = useAuth();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].cadernoErros;

  if (!hasAccess) {
    return <Navigate to="/caderno" replace />;
  }

  if (!user?.id) {
    return (
      <PageTransition>
        <EmptyState
          icon={BookOpen}
          title="Sessão expirada"
          description="Faça login pra continuar revisando."
          backHref="/caderno"
          backLabel="Voltar"
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <RecallContent userId={user.id} studentName={profile?.name ?? 'Aluno'} />
    </PageTransition>
  );
}
