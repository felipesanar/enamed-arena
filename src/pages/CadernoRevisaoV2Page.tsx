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
 * Props for wiring: none — reads userId/segment from context.
 *
 * Does NOT modify CadernoRevisaoPage (production page) — this is a new file.
 */

import { useEffect, useRef, useCallback } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Trash2,
  Flame,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Clock,
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

import { RecallQuestionCard } from '@/components/caderno/recall/RecallQuestionCard';
import { ConfidenceStep } from '@/components/caderno/recall/ConfidenceStep';
import { RevealPanel } from '@/components/caderno/recall/RevealPanel';
import { SelfGradeBar } from '@/components/caderno/recall/SelfGradeBar';
import { SessionSummaryV2 } from '@/components/caderno/recall/SessionSummaryV2';
import { DesktopQueuePanel, MobileQueueTrigger } from '@/components/caderno/recall/SessionQueuePanel';
import { LeechInterventionBanner } from '@/components/caderno/LeechInterventionBanner';
import { LessonUnlockDialog } from '@/components/caderno/LessonUnlockDialog';
import { DrillTimerBar } from '@/components/caderno/recall/DrillTimerBar';

import { useActiveRecallSession } from '@/hooks/useActiveRecallSession';
import { useAuth } from '@/contexts/AuthContext';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { cn } from '@/lib/utils';

// ─── Keyboard handler hook ────────────────────────────────────────────────────

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

      // Esc closes chat
      if (e.key === 'Escape' && chatOpen) return; // let textarea handle it

      // Navigation (all phases, when not in editable)
      if (!isEditable) {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          skipCurrent();
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goToPrev();
          return;
        }
        if (e.key === 'r' || e.key === 'R') {
          e.preventDefault();
          void handleRemove();
          return;
        }
      }

      // Phase-specific bindings (skip if in editable element)
      if (isEditable) return;

      if (phase === 'answering') {
        const optionKey = e.key.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E'].includes(optionKey) && reviewData?.question) {
          e.preventDefault();
          const opt = reviewData.question.options.find((o) => o.label === optionKey);
          if (opt) selectOption(opt.id);
        }
        // Enter to confirm selection (spec §1 Fase 1)
        if (e.key === 'Enter' && selectedOptionId) {
          e.preventDefault();
          // Option already selected — phase advances in selectOption
        }
      }

      if (phase === 'confidence') {
        if (e.key === '1') { e.preventDefault(); setConfidence('baixa'); }
        if (e.key === '2') { e.preventDefault(); setConfidence('media'); }
        if (e.key === '3') { e.preventDefault(); setConfidence('alta'); }
      }

      if ((phase === 'revealed' || phase === 'self_grade') && !schedulingNextReview) {
        const wasCorrect =
          !!reviewData?.question && reviewData.question.correctOptionId === selectedOptionId;
        if (e.key === '1') { e.preventDefault(); void submitSelfGrade('errei'); }
        if (e.key === '2') { e.preventDefault(); void submitSelfGrade('dificil'); }
        if (e.key === '3') { e.preventDefault(); void submitSelfGrade('bom'); }
        if (e.key === '4' && wasCorrect) { e.preventDefault(); void submitSelfGrade('facil'); }
      }
    },
    [
      phase,
      chatOpen,
      currentEntry,
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

// ─── Active keyboard legend ───────────────────────────────────────────────────

function KeyboardLegend({ phase }: { phase: string }) {
  return (
    <div className="mt-2 hidden md:flex items-center justify-center gap-4 text-[10px] text-muted-foreground/70">
      {phase === 'answering' && (
        <>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">A</kbd>–
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">E</kbd>
            selecionar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">→</kbd>
            pular
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">R</kbd>
            remover
          </span>
        </>
      )}
      {phase === 'confidence' && (
        <>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">1</kbd>–
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">3</kbd>
            confiança
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">←</kbd>
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">→</kbd>
            navegar
          </span>
        </>
      )}
      {(phase === 'revealed' || phase === 'self_grade') && (
        <>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">1</kbd>–
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">4</kbd>
            autoavaliar
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Esc</kbd>
            fechar chat
          </span>
        </>
      )}
    </div>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function RecallContent({ userId, studentName }: { userId: string; studentName: string }) {
  const prefersReducedMotion = useReducedMotion();
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
    // Blocked-entry state
    isCurrentEntryBlocked,
    isCurrentEntryLeech,
    isCurrentEntryAwaitingLesson,
    lessonUnlockDialogOpen,
    selectOption,
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

  // Focus question heading after transition
  const questionHeadingRef = useRef<HTMLHeadingElement | null>(null);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loadingList) {
    return (
      <div className="space-y-4 motion-safe:animate-pulse">
        <SkeletonCard className="h-[80px] rounded-2xl" />
        <SkeletonCard className="h-[300px] rounded-2xl" />
        <SkeletonCard className="h-[180px] rounded-2xl" />
      </div>
    );
  }

  if (listError) {
    return (
      <EmptyState
        variant="error"
        title="Não foi possível carregar a revisão"
        description="Verifique sua conexão e tente novamente."
        onRetry={retryLoad}
        backHref="/caderno"
        backLabel="Voltar ao caderno"
      />
    );
  }

  // ── Session finished / all done ───────────────────────────────────────────
  const sessionHadActivity = stats.dominated > 0 || stats.scheduled > 0;

  if (finished || (entries.length === 0 && sessionHadActivity)) {
    return (
      <SessionSummaryV2
        stats={stats}
        remainingCount={entries.length}
        onContinue={
          entries.length > 0
            ? () => {
                // Just reset finished flag to continue
                // We reload the page state — since sessionHadActivity restores it,
                // we navigate back to force a fresh load
                window.location.reload();
              }
            : undefined
        }
      />
    );
  }

  // ── Queue empty (never added) ─────────────────────────────────────────────
  if (entries.length === 0) {
    return (
      <EmptyState
        icon={CheckCircle2}
        title="Nada pra revisar agora"
        description="Você não tem questões vencidas no caderno. Aproveita pra fazer mais um simulado e adicionar questões ao caderno."
        backHref="/caderno"
        backLabel="Voltar ao caderno"
      />
    );
  }

  if (!currentEntry) return null;

  const question = reviewData?.question ?? null;
  const revealCorrect = phase === 'revealed' || phase === 'self_grade';
  const wasCorrect = question
    ? question.correctOptionId === selectedOptionId
    : false;

  const progress = Math.round(((currentIndex + 1) / entries.length) * 100);

  // Build a NotebookEntry-compatible shape from the RecallEntry for blocked components
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
    resolvedAt: null,
    nextReviewAt: currentEntry.srsDueAt,
    last_review_outcome: currentEntry.lastReviewOutcome,
    srs_lapses: currentEntry.srsLapses,
    masteredAt: currentEntry.masteredAt,
    srsDueAt: currentEntry.srsDueAt,
  };

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Sticky header */}
      <div className="sticky top-0 z-30 -mx-4 md:-mx-6 bg-background/95 px-4 md:px-6 py-2.5 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between gap-3">
          {/* Left — exit */}
          <Link
            to="/caderno"
            className="inline-flex items-center gap-1.5 text-caption font-medium text-muted-foreground/80 transition-colors hover:text-foreground no-underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
            Sair
          </Link>

          {/* Center — dominated badge + counter + mobile queue + progress */}
          <div className="flex items-center gap-2 md:gap-3">
            <AnimatePresence>
              {stats.dominated > 0 && (
                <motion.span
                  key={dominatedPulse}
                  initial={prefersReducedMotion ? false : { scale: 0.85, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/[0.08] px-2.5 py-1 text-[11px] font-bold text-success tabular-nums"
                  aria-label={`${stats.dominated} dominadas nesta sessão`}
                >
                  <Flame className="h-3 w-3" aria-hidden />
                  {stats.dominated} dominada{stats.dominated > 1 ? 's' : ''}
                </motion.span>
              )}
            </AnimatePresence>

            <span className="text-caption font-bold text-foreground tabular-nums">
              {currentIndex + 1} / {entries.length}
            </span>

            {/* Mobile queue button */}
            <MobileQueueTrigger
              entries={entries}
              currentIndex={currentIndex}
              onJump={jumpTo}
              dominated={stats.dominated}
              initialTotal={stats.initialTotal}
            />

            {/* Progress bar (hidden on small screens) */}
            <div
              className="hidden sm:block h-1 w-32 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={currentIndex + 1}
              aria-valuemax={entries.length}
              aria-label="Progresso da sessão"
            >
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

      {/* Cronômetro do treino — exibido apenas no modo cronometrado */}
      {isTimed && (
        <DrillTimerBar
          startedAt={stats.startedAt}
          totalQuestions={stats.initialTotal > 0 ? stats.initialTotal : entries.length}
          questionsAnswered={currentIndex}
        />
      )}

      {/* Layout: main content + desktop sidebar */}
      <div className="lg:flex lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1 space-y-4">
          {/* Loading skeleton */}
          {loadingReview && (
            <div className="space-y-4 motion-safe:animate-pulse">
              <SkeletonCard className="h-[320px] rounded-2xl" />
              <SkeletonCard className="h-[180px] rounded-2xl" />
            </div>
          )}

          {/* Question not found */}
          {!loadingReview && !question && (
            <div className="rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
              <AlertCircle className="mx-auto h-8 w-8 text-warning" aria-hidden />
              <p className="mt-3 text-body font-semibold text-foreground">
                Não consegui carregar essa questão.
              </p>
              <p className="mt-1 text-caption text-muted-foreground">
                Pode ter sido removida do simulado. Pule para a próxima.
              </p>
            </div>
          )}

          {/* Intervenção: Leech blocked */}
          {!loadingReview && isCurrentEntryLeech && (
            <LeechInterventionBanner
              entry={currentEntryAsNotebook as any}
              onReset={handleLeechReset}
              className="mb-2"
            />
          )}

          {/* Intervenção: Awaiting lesson — dialog controlado pelo hook */}
          {currentEntry && isCurrentEntryAwaitingLesson && (
            <LessonUnlockDialog
              entry={currentEntryAsNotebook as any}
              open={lessonUnlockDialogOpen}
              onConfirmStudied={handleLessonUnlock}
              onClose={closeLessonUnlockDialog}
            />
          )}

          {/* Cards — exibido apenas quando a entrada NÃO está bloqueada */}
          <AnimatePresence mode="wait">
            {!loadingReview && question && !isCurrentEntryBlocked && (
              <motion.div
                key={currentEntry.id}
                initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
                onAnimationComplete={() => {
                  // Move focus to question heading for a11y
                  const el = document.getElementById(`recall-q-${currentEntry.id}`);
                  if (el) el.focus();
                }}
              >
                {/* Question card */}
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

                {/* Confidence step (phase 2 only) */}
                {phase === 'confidence' && (
                  <ConfidenceStep onSelect={setConfidence} />
                )}

                {/* Prof. San reveal panel (phases 3-4) */}
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

                {/* Self-grade bar (phases 3-4) */}
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

        {/* Desktop queue panel */}
        <DesktopQueuePanel
          entries={entries}
          currentIndex={currentIndex}
          onJump={jumpTo}
          dominated={stats.dominated}
          initialTotal={stats.initialTotal}
        />
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-4 md:-mx-6 bg-background/95 px-4 md:px-6 py-3 backdrop-blur-sm border-t border-border">
        <div className="flex items-center justify-between gap-2">
          {/* Left group: prev + remove + snooze */}
          <div className="flex items-center gap-1">
            <Button
              onClick={goToPrev}
              disabled={currentIndex === 0}
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
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
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Remover do caderno"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                Remover do caderno{' '}
                <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">R</kbd>
              </TooltipContent>
            </Tooltip>

            {/* Manual snooze — "..." overflow */}
            <DropdownMenu>
              <Tooltip delayDuration={250}>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                    >
                      <Clock className="h-4 w-4 mr-1.5" aria-hidden />
                      Adiar
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="top">Adiar manualmente (override SRS)</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="start" className="w-44">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Volta na fila ativa em
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => void handleSnooze(1)}>
                  Amanhã <span className="ml-auto text-[10px] text-muted-foreground">1 dia</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleSnooze(3)}>
                  Em alguns dias{' '}
                  <span className="ml-auto text-[10px] text-muted-foreground">3 dias</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => void handleSnooze(7)}>
                  Próxima semana{' '}
                  <span className="ml-auto text-[10px] text-muted-foreground">7 dias</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => void handleSnooze(3)}
                  className="text-[11px] text-muted-foreground"
                >
                  Padrão (3 dias)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Right group: mobile CTA + skip */}
          <div className="flex items-center gap-2">
            {/* Mobile phase CTA */}
            <div className="sm:hidden">
              {phase === 'answering' && !selectedOptionId && (
                <span className="text-[11px] text-muted-foreground">Selecione uma alternativa</span>
              )}
              {phase === 'answering' && selectedOptionId && (
                <Button size="sm" variant="outline" onClick={() => setConfidence('media')}>
                  Confirmar resposta
                </Button>
              )}
            </div>

            {/* Skip / next (all phases) */}
            <Tooltip delayDuration={250}>
              <TooltipTrigger asChild>
                <Button
                  onClick={revealCorrect ? undefined : skipCurrent}
                  variant="outline"
                  size="sm"
                  className={cn(revealCorrect && 'opacity-50 cursor-default')}
                  disabled={revealCorrect && !schedulingNextReview ? false : false}
                >
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
                <kbd className="ml-1 rounded bg-muted px-1 text-[10px]">→</kbd>
              </TooltipContent>
            </Tooltip>

            {/* Finish session button (last entry) */}
            {currentIndex >= entries.length - 1 && phase === 'answering' && (
              <Button
                onClick={finishSession}
                size="sm"
                variant="ghost"
                className="text-muted-foreground text-[12px]"
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
