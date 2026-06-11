/**
 * ReviewModesHub — hub de revisão da página de Flashcards.
 *
 * Card protagonista "Revisar devidos" (SRS) + fileira de modos de treino.
 * Modos de treino calculam o pool da lista visível (deck atual ou todos)
 * e ficam desabilitados (com tooltip) quando o pool é vazio.
 */

import { motion } from 'framer-motion';
import {
  Play,
  Layers,
  BookOpen,
  Flame,
  Shuffle,
  ArrowLeftRight,
  Timer,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { REVIEW_MODE_CONFIGS, filterFreePool, filterHardCards } from '@/lib/flashcardReviewModes';
import type { Flashcard, ReviewMode } from '@/types/caderno';

const TRAINING_MODES: { mode: ReviewMode; icon: LucideIcon }[] = [
  { mode: 'free', icon: BookOpen },
  { mode: 'hard', icon: Flame },
  { mode: 'shuffle', icon: Shuffle },
  { mode: 'reversed', icon: ArrowLeftRight },
  { mode: 'timed', icon: Timer },
];

export interface ReviewModesHubProps {
  dueCount: number;
  /** Lista visível (deck selecionado ou todos) — base dos pools de treino. */
  cards: Flashcard[];
  onStart: (mode: ReviewMode) => void;
}

export function ReviewModesHub({ dueCount, cards, onStart }: ReviewModesHubProps) {
  return (
    <section aria-label="Modos de revisão" className="space-y-3">
      {/* Protagonista: Revisar devidos */}
      {dueCount > 0 && (
        <motion.button
          type="button"
          onClick={() => onStart('due')}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            'group flex w-full items-center justify-between gap-4 overflow-hidden rounded-[var(--c-radius-card)]',
            'border border-[color-mix(in_srgb,var(--c-wine-500)_20%,transparent)] bg-gradient-to-r from-[color-mix(in_srgb,var(--c-wine-500)_8%,transparent)] via-[color-mix(in_srgb,var(--c-wine-500)_4%,transparent)] to-transparent',
            'px-5 py-4 transition-all duration-200',
            'hover:border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] hover:shadow-[var(--c-shadow-glow)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2',
          )}
        >
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)]">
              <Layers className="h-5 w-5 text-[var(--c-wine-500)]" aria-hidden />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[14px] font-bold text-[var(--c-ink)]">Revisar devidos</p>
              <p className="text-[12px] text-[var(--c-muted)]">
                {dueCount} {dueCount === 1 ? 'flashcard' : 'flashcards'} para hoje
              </p>
            </div>
          </div>
          <div
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-xl px-5 py-2.5',
              'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white',
              'text-[13px] font-bold shadow-[var(--c-shadow-glow)]',
              'transition-transform duration-150 group-hover:scale-[1.03]',
            )}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            Iniciar
          </div>
        </motion.button>
      )}

      {/* Modos de treino */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {TRAINING_MODES.map(({ mode, icon: Icon }) => {
          const config = REVIEW_MODE_CONFIGS[mode];
          // Deterministic pool size: avoid Math.random on every render.
          // shuffle/timed availability depends on the free pool (non-mastered cards).
          const poolSize = mode === 'hard' ? filterHardCards(cards).length : filterFreePool(cards).length;
          const disabled = poolSize === 0;

          const tile = (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => onStart(mode)}
              aria-label={`${config.label} — ${config.description}`}
              className={cn(
                'flex h-full flex-col items-start gap-2 rounded-[var(--c-radius-card)] border bg-[var(--c-surface)] p-3 text-left',
                'border-[var(--c-border)] transition-all duration-150',
                disabled
                  ? 'cursor-not-allowed opacity-45'
                  : 'hover:-translate-y-[1px] hover:border-[color-mix(in_srgb,var(--c-wine-500)_35%,transparent)] hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--c-surface-2)]">
                <Icon className="h-4 w-4 text-[var(--c-wine-500)]" aria-hidden />
              </span>
              <span className="text-[12.5px] font-bold leading-tight text-[var(--c-ink)]">
                {config.label}
              </span>
              <span className="line-clamp-2 text-[10.5px] leading-snug text-[var(--c-muted)]">
                {config.description}
              </span>
            </button>
          );

          if (!disabled) return tile;
          return (
            <Tooltip key={mode} delayDuration={300}>
              {/* span wrapper: tooltip precisa de target habilitado */}
              <TooltipTrigger asChild>
                <span className="h-full">{tile}</span>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {mode === 'hard'
                  ? 'Nenhum card difícil por aqui — bom sinal!'
                  : 'Sem cards disponíveis neste deck'}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </section>
  );
}
