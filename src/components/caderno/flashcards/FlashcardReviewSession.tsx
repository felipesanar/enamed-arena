/**
 * FlashcardReviewSession — sessão SRS premium de revisão de flashcards.
 *
 * Desktop: card central grande com flip 3D, 4 botões de autoavaliação grandes.
 * Mobile: tela cheia, flip por tap, botões grandes em BottomActionBar.
 *         Atalhos de teclado: Espaço = revelar, 1/2/3/4 = grade.
 *
 * PRESERVADO: scheduleFlashcardReview, eventos analytics, keyboard shortcuts, SrsState.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
  RotateCcw,
  Trash2,
  Timer,
  Dumbbell,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CardFace } from './CardFace';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import { BottomActionBar, ProgressBar } from '@/components/caderno/ui';
import { useIsMobile } from '@/hooks/useIsMobile';
import { REVIEW_MODE_CONFIGS, type ReviewModeConfig } from '@/lib/flashcardReviewModes';
import type { Flashcard, FlashcardReviewOutcome, ReviewMode, SrsState } from '@/types/caderno';

/* ── Grade options config ── */

interface GradeOption {
  outcome: FlashcardReviewOutcome;
  label: string;
  sublabel: string;
  colorClass: string;
  bgClass: string;
  borderClass: string;
  icon: React.ReactNode;
}

const GRADE_OPTIONS: GradeOption[] = [
  {
    outcome: 'errei',
    label: 'Errei',
    sublabel: 'Não lembrei',
    colorClass: 'text-red-500',
    bgClass: 'bg-red-500/10',
    borderClass: 'border-red-500/25 hover:border-red-500/50 hover:bg-red-500/15',
    icon: <XCircle className="h-5 w-5" aria-hidden />,
  },
  {
    outcome: 'dificil',
    label: 'Difícil',
    sublabel: 'Com esforço',
    colorClass: 'text-orange-500',
    bgClass: 'bg-orange-500/10',
    borderClass: 'border-orange-500/25 hover:border-orange-500/50 hover:bg-orange-500/15',
    icon: <RotateCcw className="h-5 w-5" aria-hidden />,
  },
  {
    outcome: 'bom',
    label: 'Bom',
    sublabel: 'Lembrei',
    colorClass: 'text-blue-500',
    bgClass: 'bg-blue-500/10',
    borderClass: 'border-blue-500/25 hover:border-blue-500/50 hover:bg-blue-500/15',
    icon: <CheckCircle2 className="h-5 w-5" aria-hidden />,
  },
  {
    outcome: 'facil',
    label: 'Fácil',
    sublabel: 'Muito fácil',
    colorClass: 'text-emerald-500',
    bgClass: 'bg-emerald-500/10',
    borderClass: 'border-emerald-500/25 hover:border-emerald-500/50 hover:bg-emerald-500/15',
    icon: <Star className="h-5 w-5" aria-hidden />,
  },
];

/* ── SessionSummary ── */

interface SessionSummaryProps {
  total: number;
  results: Record<FlashcardReviewOutcome, number>;
  removedCount: number;
  modeLabel: string;
  timedSeconds: number | null;
  writesSrs: boolean;
  onFinish: () => void;
}

function SessionSummary({ total, results, removedCount, modeLabel, timedSeconds, writesSrs, onFinish }: SessionSummaryProps) {
  const mastered = (results.bom ?? 0) + (results.facil ?? 0);
  return (
    <div className="flex flex-col items-center gap-8 py-16 text-center">
      {/* Icon celebratório */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="flex h-24 w-24 items-center justify-center rounded-3xl bg-emerald-500/10"
      >
        <CheckCircle2 className="h-12 w-12 text-emerald-500" aria-hidden />
      </motion.div>

      <div>
        <h3 className="text-[24px] font-extrabold tracking-tight text-[var(--c-ink)]">
          Sessão concluída!
        </h3>
        <p className="mt-1.5 text-[14px] text-[var(--c-muted)]">
          {modeLabel}
          {' — '}
          {total} {total === 1 ? 'flashcard revisado' : 'flashcards revisados'}
          {timedSeconds !== null && ` em ${Math.floor(timedSeconds / 60)}:${String(timedSeconds % 60).padStart(2, '0')}`}
        </p>
      </div>

      {/* Grid de resultados */}
      <div className="grid w-full max-w-sm grid-cols-4 gap-3">
        {GRADE_OPTIONS.map((g, i) => (
          <motion.div
            key={g.outcome}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 + i * 0.05, duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className={cn(
              'flex flex-col items-center gap-2 rounded-[var(--c-radius-card)] border p-4',
              g.borderClass,
              g.bgClass,
            )}
          >
            <span className={cn('text-[22px] font-extrabold tabular-nums', g.colorClass)}>
              {results[g.outcome] ?? 0}
            </span>
            <span className="text-[10px] font-semibold text-[var(--c-muted)]">{g.label}</span>
          </motion.div>
        ))}
      </div>

      {mastered > 0 && (
        <p className="text-[13px] text-[var(--c-muted)]">
          <span className="font-bold text-[var(--c-ink)]">{mastered}</span>{' '}
          {mastered === 1 ? 'card com bom desempenho' : 'cards com bom desempenho'}.
          {writesSrs && ' Revisão reagendada.'}
        </p>
      )}

      {removedCount > 0 && (
        <p className="text-[12px] text-[var(--c-muted)]">
          {removedCount} {removedCount === 1 ? 'card removido' : 'cards removidos'} nesta sessão.
        </p>
      )}

      <Button
        onClick={onFinish}
        className="min-w-[180px] bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] hover:opacity-90"
      >
        Voltar para Flashcards
      </Button>
    </div>
  );
}

/* ── FlashcardReviewSession ── */

export interface FlashcardReviewSessionProps {
  cards: Flashcard[];
  /** Modo da sessão. Default 'due' (comportamento original, grava SRS). */
  mode?: ReviewMode;
  onFinish: () => void;
}

export function FlashcardReviewSession({ cards, mode = 'due', onFinish }: FlashcardReviewSessionProps) {
  const config: ReviewModeConfig = REVIEW_MODE_CONFIGS[mode];
  const isTraining = !config.writesSrs;

  const prefersReducedMotion = useReducedMotion();
  const isMobile = useIsMobile();

  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);
  const [flipDir, setFlipDir] = useState<'forward' | 'back'>('forward');
  const [results, setResults] = useState<Record<FlashcardReviewOutcome, number>>({
    errei: 0, dificil: 0, bom: 0, facil: 0,
  });
  const [done, setDone] = useState(false);
  const [removedCount, setRemovedCount] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(config.timerSeconds);

  // Countdown do modo cronometrado: ao zerar, encerra a sessão.
  useEffect(() => {
    if (secondsLeft === null || done) return;
    if (secondsLeft <= 0) {
      setDone(true);
      return;
    }
    const t = setTimeout(() => setSecondsLeft((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft, done]);

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const currentCard = cards[currentIndex];
  const progressPct = (currentIndex / cards.length) * 100;

  // Modo invertido mostra o verso primeiro e pede a frente.
  const firstFace = config.reversed
    ? { md: currentCard?.back_md ?? '', imageUrl: currentCard?.back_image_url ?? null, label: 'Verso' as const }
    : { md: currentCard?.front_md ?? '', imageUrl: currentCard?.front_image_url ?? null, label: 'Frente' as const };
  const secondFace = config.reversed
    ? { md: currentCard?.front_md ?? '', imageUrl: currentCard?.front_image_url ?? null, label: 'Frente' as const }
    : { md: currentCard?.back_md ?? '', imageUrl: currentCard?.back_image_url ?? null, label: 'Verso' as const };

  const handleGradeRef = useRef<(outcome: FlashcardReviewOutcome) => Promise<void>>(
    async () => { /* placeholder */ },
  );

  // Keyboard: Espaço = revelar | 1/2/3/4 = grade
  useEffect(() => {
    if (done) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !revealed && !grading) {
        e.preventDefault();
        setFlipDir('forward');
        setRevealed(true);
        return;
      }
      if (revealed && !grading) {
        const map: Record<string, FlashcardReviewOutcome> = { '1': 'errei', '2': 'dificil', '3': 'bom', '4': 'facil' };
        if (map[e.key]) {
          e.preventDefault();
          handleGradeRef.current(map[e.key]);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, grading, done]);

  const handleGrade = useCallback(
    async (outcome: FlashcardReviewOutcome) => {
      if (grading || !currentCard) return;
      setGrading(true);
      try {
        if (config.writesSrs) {
          const srs: SrsState = await simuladosApi.scheduleFlashcardReview(currentCard.id, outcome);
          trackEvent('caderno_flashcard_reviewed', {
            flashcard_id: currentCard.id,
            outcome,
            mode,
            mastered: srs.mastered,
            srs_interval: srs.srsInterval,
          });
        } else {
          trackEvent('caderno_flashcard_reviewed', {
            flashcard_id: currentCard.id,
            outcome,
            mode,
            training: true,
          } as any);
        }
        setResults((prev) => ({ ...prev, [outcome]: (prev[outcome] ?? 0) + 1 }));
      } catch (err) {
        logger.error('[FlashcardReviewSession] Error scheduling review:', err);
        toast({ title: 'Erro ao registrar avaliação', description: 'Tente novamente.', variant: 'destructive' });
        setGrading(false);
        return;
      }
      const next = currentIndex + 1;
      if (next >= cards.length) {
        setDone(true);
      } else {
        setFlipDir('back');
        setCurrentIndex(next);
        setRevealed(false);
      }
      setGrading(false);
    },
    [currentCard, currentIndex, cards.length, grading, config.writesSrs, mode],
  );

  handleGradeRef.current = handleGrade;

  const handleRemove = useCallback(async () => {
    if (grading || !currentCard) return;
    setGrading(true);
    try {
      await simuladosApi.softDeleteFlashcard(currentCard.id);
      trackEvent('caderno_flashcard_disliked', { flashcard_id: currentCard.id });
    } catch (err) {
      logger.error('[FlashcardReviewSession] Error removing card:', err);
      toast({ title: 'Não foi possível remover', variant: 'destructive' });
      setGrading(false);
      return;
    }
    toast({ title: 'Card removido' });
    setRemovedCount((n) => n + 1);
    const next = currentIndex + 1;
    if (next >= cards.length) {
      setDone(true);
    } else {
      setFlipDir('back');
      setCurrentIndex(next);
      setRevealed(false);
    }
    setGrading(false);
  }, [currentCard, currentIndex, cards.length, grading]);

  if (done) {
    const reviewedCount = Object.values(results).reduce((a, b) => a + b, 0);
    return (
      <SessionSummary
        total={reviewedCount}
        results={results}
        removedCount={removedCount}
        modeLabel={config.label}
        timedSeconds={config.timerSeconds !== null ? config.timerSeconds - (secondsLeft ?? 0) : null}
        writesSrs={config.writesSrs}
        onFinish={onFinish}
      />
    );
  }

  if (!currentCard) return null;

  /* ── Flip animation variants ── */
  const flipVariants = prefersReducedMotion
    ? {
        enterFront: {},
        enterBack: {},
        center: { opacity: 1, rotateY: 0 },
        exitFront: {},
        exitBack: {},
      }
    : {
        enterFront: { opacity: 0, rotateY: -90 },
        enterBack: { opacity: 0, rotateY: 90 },
        center: { opacity: 1, rotateY: 0 },
        exitFront: { opacity: 0, rotateY: 90 },
        exitBack: { opacity: 0, rotateY: -90 },
      };

  const gradeButtons = (
    <div className="grid gap-3 grid-cols-4">
      {GRADE_OPTIONS.map((g, i) => (
        <button
          key={g.outcome}
          type="button"
          disabled={grading}
          onClick={() => handleGrade(g.outcome)}
          aria-label={`${g.label} — ${g.sublabel} (tecla ${i + 1})`}
          className={cn(
            'relative flex flex-col items-center gap-2 rounded-[var(--c-radius-card)] border py-4 transition-all duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
            'disabled:cursor-not-allowed disabled:opacity-50',
            g.borderClass,
            g.colorClass,
            isMobile ? 'px-2 py-3' : 'px-3 py-4',
          )}
        >
          {grading ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          ) : (
            g.icon
          )}
          <span className={cn('font-bold', isMobile ? 'text-[11px]' : 'text-[13px]')}>
            {g.label}
          </span>
          {!isMobile && (
            <span className="text-[10px] opacity-60">{g.sublabel}</span>
          )}
          {/* Keyboard hint */}
          <span className="absolute right-1.5 top-1.5 rounded border border-current/20 bg-current/10 px-1 py-0.5 text-[8px] font-mono opacity-40">
            {i + 1}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <div
      className={cn(
        'caderno-root flex flex-col gap-5',
        isMobile && 'pb-[calc(120px+env(safe-area-inset-bottom,0px))]',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onFinish}
          aria-label="Sair da sessão de revisão"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] px-2 py-1.5',
            'text-[12px] font-semibold text-[var(--c-muted)]',
            'transition-colors hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
          )}
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Sair
        </button>

        <div className="flex items-center gap-3">
          {secondsLeft !== null && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-[var(--c-radius-pill)] border px-2.5 py-1 text-[12px] font-bold tabular-nums',
                secondsLeft <= 30
                  ? 'border-red-500/30 bg-red-500/10 text-red-500'
                  : 'border-[var(--c-border)] bg-[var(--c-surface-2)] text-[var(--c-ink)]',
              )}
              aria-label={`Tempo restante: ${formatTime(secondsLeft)}`}
            >
              <Timer className="h-3.5 w-3.5" aria-hidden />
              {formatTime(secondsLeft)}
            </span>
          )}
          <span className="text-[13px] font-bold tabular-nums text-[var(--c-muted)]">
            {currentIndex + 1}
            <span className="font-normal opacity-60"> / {cards.length}</span>
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <ProgressBar
        value={progressPct}
        label={`${currentIndex} de ${cards.length} flashcards revisados`}
        className="h-[3px]"
      />

      {/* Banner de treino */}
      {isTraining && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-[var(--c-border)] bg-[var(--c-surface-2)] px-3 py-2">
          <Dumbbell className="h-3.5 w-3.5 shrink-0 text-[var(--c-muted)]" aria-hidden />
          <p className="text-[11.5px] font-medium text-[var(--c-muted)]">
            <span className="font-bold text-[var(--c-ink)]">{config.label}</span>
            {' · '}modo treino — não altera seu agendamento
          </p>
        </div>
      )}

      {/* Card com flip 3D */}
      <div
        style={{ perspective: '1400px' }}
        className={cn(
          'relative',
          isMobile ? '' : 'mx-auto w-full max-w-xl',
        )}
      >
        <AnimatePresence mode="wait" custom={flipDir}>
          {!revealed ? (
            <motion.div
              key={`front-${currentCard.id}`}
              custom={flipDir}
              initial={prefersReducedMotion ? false : flipVariants.enterFront}
              animate={flipVariants.center}
              exit={prefersReducedMotion ? undefined : flipVariants.exitFront}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              onClick={isMobile ? () => setRevealed(true) : undefined}
              className={cn(
                'overflow-hidden rounded-[var(--c-radius-card)] border border-[color-mix(in_srgb,var(--c-wine-500)_15%,transparent)] bg-[var(--c-surface)] shadow-[var(--c-shadow-md)]',
                isMobile && 'cursor-pointer active:scale-[0.99]',
              )}
            >
              <CardFace
                md={firstFace.md}
                imageUrl={firstFace.imageUrl}
                faceLabel={firstFace.label}
                isMobile={isMobile}
              />

              {/* "Tap para revelar" hint (mobile only) */}
              {isMobile && (
                <div className="flex items-center justify-center gap-1.5 border-t border-[var(--c-border)] py-3">
                  <span className="text-[11px] font-semibold text-[var(--c-muted)]">
                    Toque para revelar o verso
                  </span>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key={`back-${currentCard.id}`}
              custom={flipDir}
              initial={prefersReducedMotion ? false : flipVariants.enterBack}
              animate={flipVariants.center}
              exit={prefersReducedMotion ? undefined : flipVariants.exitBack}
              transition={{ duration: prefersReducedMotion ? 0 : 0.3, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface-2)] shadow-[var(--c-shadow-md)]"
            >
              <CardFace
                md={secondFace.md}
                imageUrl={secondFace.imageUrl}
                faceLabel={secondFace.label}
                isMobile={isMobile}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Curadoria: remover card que o aluno não gostou */}
      <div className="flex justify-center">
        <button
          type="button"
          disabled={grading}
          onClick={handleRemove}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-[var(--c-radius-control)] px-3 py-1.5',
            'text-[11.5px] font-semibold text-[var(--c-muted)] transition-colors',
            'hover:bg-destructive/10 hover:text-destructive',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          aria-label="Não gostei deste card, remover da coleção"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          Não gostei · remover
        </button>
      </div>

      {/* Ações */}
      <AnimatePresence mode="wait">
        {!revealed ? (
          !isMobile ? (
            /* Desktop: botão centralizado */
            <motion.div
              key="reveal-desktop"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="flex justify-center"
            >
              <Button
                size="lg"
                onClick={() => { setFlipDir('forward'); setRevealed(true); }}
                className="min-w-[220px] bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)] hover:opacity-90"
                aria-label="Mostrar resposta (Espaço)"
              >
                Mostrar resposta
                <kbd className="ml-2.5 rounded border border-white/20 bg-white/10 px-1.5 py-0.5 text-[10px] font-mono">
                  Espaço
                </kbd>
              </Button>
            </motion.div>
          ) : null
        ) : (
          !isMobile ? (
            /* Desktop: grade buttons inline */
            <motion.div
              key="grade-desktop"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              transition={{ duration: 0.18 }}
              className="space-y-3"
            >
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Como foi?
              </p>
              {gradeButtons}
            </motion.div>
          ) : null
        )}
      </AnimatePresence>

      {/* Mobile: BottomActionBar com botões */}
      {isMobile && (
        <BottomActionBar>
          {!revealed ? (
            <Button
              size="lg"
              onClick={() => { setFlipDir('forward'); setRevealed(true); }}
              className="w-full bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white shadow-[var(--c-shadow-glow)]"
              aria-label="Mostrar resposta"
            >
              Mostrar resposta
            </Button>
          ) : (
            <div className="w-full space-y-2">
              <p className="text-center text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted)]">
                Como foi?
              </p>
              {gradeButtons}
            </div>
          )}
        </BottomActionBar>
      )}
    </div>
  );
}
