/**
 * FlashcardReviewSession — sessão SRS de revisão de flashcards devidos.
 *
 * Fluxo: frente → "Mostrar resposta" (flip animado) → verso → 4 botões de
 * autoavaliação (Errei / Difícil / Bom / Fácil) → scheduleFlashcardReview → próximo.
 *
 * Respeita prefers-reduced-motion: sem flip quando ativo.
 * Dispara: caderno_flashcard_reviewed
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
  RotateCcw,
  Image as ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { toast } from '@/hooks/use-toast';
import { trackEvent } from '@/lib/analytics';
import { simuladosApi } from '@/services/simuladosApi';
import { Button } from '@/components/ui/button';
import type { Flashcard, FlashcardReviewOutcome, SrsState } from '@/types/caderno';

/* ── Self-grade button config ── */

interface GradeOption {
  outcome: FlashcardReviewOutcome;
  label: string;
  sublabel: string;
  colorClass: string;
  borderClass: string;
  icon: React.ReactNode;
}

const GRADE_OPTIONS: GradeOption[] = [
  {
    outcome: 'errei',
    label: 'Errei',
    sublabel: 'Não lembrei',
    colorClass: 'text-red-400',
    borderClass: 'border-red-500/30 bg-red-500/10 hover:bg-red-500/15',
    icon: <XCircle className="h-4 w-4" aria-hidden />,
  },
  {
    outcome: 'dificil',
    label: 'Difícil',
    sublabel: 'Lembrei com esforço',
    colorClass: 'text-orange-400',
    borderClass: 'border-orange-500/30 bg-orange-500/10 hover:bg-orange-500/15',
    icon: <RotateCcw className="h-4 w-4" aria-hidden />,
  },
  {
    outcome: 'bom',
    label: 'Bom',
    sublabel: 'Lembrei',
    colorClass: 'text-blue-400',
    borderClass: 'border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/15',
    icon: <CheckCircle2 className="h-4 w-4" aria-hidden />,
  },
  {
    outcome: 'facil',
    label: 'Fácil',
    sublabel: 'Muito fácil',
    colorClass: 'text-emerald-400',
    borderClass: 'border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/15',
    icon: <Star className="h-4 w-4" aria-hidden />,
  },
];

/* ── CardFace ── */

interface CardFaceProps {
  md: string;
  imageUrl: string | null;
  faceLabel: 'Frente' | 'Verso';
}

function CardFace({ md, imageUrl, faceLabel }: CardFaceProps) {
  return (
    <div className="flex min-h-[200px] flex-col gap-4 p-6 sm:min-h-[260px] sm:p-8">
      <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground/50">
        {faceLabel}
      </span>

      {imageUrl ? (
        <div className="overflow-hidden rounded-xl border border-border/60">
          <img
            src={imageUrl}
            alt={`Imagem do ${faceLabel.toLowerCase()} do flashcard`}
            className="max-h-44 w-full object-contain"
          />
        </div>
      ) : null}

      {md.trim() ? (
        <div className="prose prose-sm dark:prose-invert max-w-none flex-1 text-[14px] leading-relaxed">
          <ReactMarkdown>{md}</ReactMarkdown>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground/40">
          <ImageIcon className="h-4 w-4" aria-hidden />
          <span className="text-[13px] italic">(conteúdo vazio)</span>
        </div>
      )}
    </div>
  );
}

/* ── SessionSummary ── */

interface SessionSummaryProps {
  total: number;
  results: Record<FlashcardReviewOutcome, number>;
  onFinish: () => void;
}

function SessionSummary({ total, results, onFinish }: SessionSummaryProps) {
  const mastered = (results.bom ?? 0) + (results.facil ?? 0);
  return (
    <div className="flex flex-col items-center gap-6 py-12 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-emerald-500/10">
        <CheckCircle2 className="h-10 w-10 text-emerald-400" aria-hidden />
      </div>
      <div>
        <h3 className="text-[22px] font-extrabold tracking-tight text-foreground">
          Sessão concluída!
        </h3>
        <p className="mt-1 text-[13px] text-muted-foreground">
          {total} {total === 1 ? 'flashcard revisado' : 'flashcards revisados'}
        </p>
      </div>

      <div className="grid w-full max-w-xs grid-cols-4 gap-2">
        {GRADE_OPTIONS.map((g) => (
          <div
            key={g.outcome}
            className={cn('flex flex-col items-center gap-1 rounded-xl border p-3', g.borderClass)}
          >
            <span className={cn('text-[20px] font-extrabold tabular-nums', g.colorClass)}>
              {results[g.outcome] ?? 0}
            </span>
            <span className="text-[10px] font-semibold text-muted-foreground">{g.label}</span>
          </div>
        ))}
      </div>

      {mastered > 0 && (
        <p className="text-[13px] text-muted-foreground">
          <span className="font-bold text-foreground">{mastered}</span>{' '}
          {mastered === 1 ? 'card com bom desempenho' : 'cards com bom desempenho'} — SRS atualizado.
        </p>
      )}

      <Button onClick={onFinish} className="px-8">
        Voltar para Flashcards
      </Button>
    </div>
  );
}

/* ── FlashcardReviewSession ── */

export interface FlashcardReviewSessionProps {
  cards: Flashcard[];
  onFinish: () => void;
}

export function FlashcardReviewSession({ cards, onFinish }: FlashcardReviewSessionProps) {
  const prefersReducedMotion = useReducedMotion();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [grading, setGrading] = useState(false);
  const [results, setResults] = useState<Record<FlashcardReviewOutcome, number>>({
    errei: 0,
    dificil: 0,
    bom: 0,
    facil: 0,
  });
  const [done, setDone] = useState(false);

  const currentCard = cards[currentIndex];

  // Keep a ref to the latest handleGrade to avoid stale closures in the keyboard handler
  const handleGradeRef = useRef<(outcome: FlashcardReviewOutcome) => Promise<void>>(
    async () => { /* placeholder, replaced below */ },
  );

  // Keyboard shortcut — 1/2/3/4 for grade after reveal
  useEffect(() => {
    if (!revealed || grading || done) return;
    const handler = (e: KeyboardEvent) => {
      const map: Record<string, FlashcardReviewOutcome> = {
        '1': 'errei',
        '2': 'dificil',
        '3': 'bom',
        '4': 'facil',
      };
      if (map[e.key]) {
        e.preventDefault();
        handleGradeRef.current(map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [revealed, grading, done]);

  // Space to reveal
  useEffect(() => {
    if (revealed || done) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !grading) {
        e.preventDefault();
        setRevealed(true);
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
        const srs: SrsState = await simuladosApi.scheduleFlashcardReview(currentCard.id, outcome);
        setResults((prev) => ({ ...prev, [outcome]: (prev[outcome] ?? 0) + 1 }));
        trackEvent('caderno_flashcard_reviewed', {
          flashcard_id: currentCard.id,
          outcome,
          mastered: srs.mastered,
          srs_interval: srs.srsInterval,
        });
      } catch (err) {
        logger.error('[FlashcardReviewSession] Error scheduling review:', err);
        toast({
          title: 'Erro ao registrar avaliação',
          description: 'Tente novamente.',
          variant: 'destructive',
        });
        setGrading(false);
        return;
      }

      const next = currentIndex + 1;
      if (next >= cards.length) {
        setDone(true);
      } else {
        setCurrentIndex(next);
        setRevealed(false);
      }
      setGrading(false);
    },
    [currentCard, currentIndex, cards.length, grading],
  );

  // Keep ref in sync with latest handleGrade to avoid stale closure in keyboard listener
  handleGradeRef.current = handleGrade;

  if (done) {
    return (
      <SessionSummary
        total={cards.length}
        results={results}
        onFinish={onFinish}
      />
    );
  }

  if (!currentCard) return null;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onFinish}
          aria-label="Sair da sessão de revisão"
          className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Sair da sessão
        </button>
        <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
          {currentIndex + 1} / {cards.length}
        </span>
      </div>

      {/* Progress bar */}
      <div
        role="progressbar"
        aria-valuenow={currentIndex}
        aria-valuemax={cards.length}
        aria-label={`${currentIndex} de ${cards.length} flashcards revisados`}
        className="h-[4px] overflow-hidden rounded-full bg-muted"
      >
        <motion.div
          className="h-full rounded-full bg-primary"
          animate={{ width: `${(currentIndex / cards.length) * 100}%` }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4, ease: 'easeOut' }}
        />
      </div>

      {/* Card */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div
              key={`front-${currentCard.id}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -30 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            >
              <CardFace md={currentCard.front_md} imageUrl={currentCard.front_image_url} faceLabel="Frente" />
            </motion.div>
          ) : (
            <motion.div
              key={`back-${currentCard.id}`}
              initial={prefersReducedMotion ? false : { opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, x: -30 }}
              transition={{ duration: prefersReducedMotion ? 0 : 0.22 }}
            >
              <CardFace md={currentCard.back_md} imageUrl={currentCard.back_image_url} faceLabel="Verso" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Ações */}
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="reveal-btn"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="flex justify-center"
          >
            <Button
              size="lg"
              onClick={() => setRevealed(true)}
              className="min-w-[200px]"
              aria-label="Mostrar resposta (Espaço)"
            >
              Mostrar resposta
              <span className="ml-2 rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1.5 py-0.5 text-[10px] font-mono">
                Espaço
              </span>
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="grade-btns"
            initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
            transition={{ duration: 0.18 }}
            className="space-y-3"
          >
            <p className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Como foi?
            </p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {GRADE_OPTIONS.map((g, i) => (
                <button
                  key={g.outcome}
                  type="button"
                  disabled={grading}
                  onClick={() => handleGrade(g.outcome)}
                  aria-label={`${g.label} — ${g.sublabel} (tecla ${i + 1})`}
                  className={cn(
                    'relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-150',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'disabled:cursor-not-allowed disabled:opacity-50',
                    g.borderClass,
                    g.colorClass,
                  )}
                >
                  {grading ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    g.icon
                  )}
                  <span className="text-[12px] font-bold">{g.label}</span>
                  <span className="text-[10px] opacity-70">{g.sublabel}</span>
                  <span className="absolute right-1.5 top-1.5 rounded border border-current/20 bg-current/10 px-1 py-0.5 text-[9px] font-mono opacity-50">
                    {i + 1}
                  </span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
