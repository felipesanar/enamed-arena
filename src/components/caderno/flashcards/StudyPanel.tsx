/**
 * StudyPanel — bloco "Estudar" da página de Flashcards.
 *
 * Card protagonista "Revisar devidos" (SRS) quando há cards no dia + grid de
 * modos de treino. Os modos calculam o pool da lista visível (deck atual ou
 * todos) e ficam desabilitados (com tooltip) quando o pool é vazio.
 */

import { useMemo } from 'react';
import {
  Play,
  Layers,
  BookOpen,
  Flame,
  Shuffle,
  ArrowLeftRight,
  Timer,
  GraduationCap,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { REVIEW_MODE_CONFIGS, filterFreePool, filterHardCards } from '@/lib/flashcardReviewModes';
import type { Flashcard, ReviewMode } from '@/types/caderno';
import { FlashcardPanel } from './FlashcardPanel';

const TRAINING_MODES: { mode: ReviewMode; icon: LucideIcon }[] = [
  { mode: 'free', icon: BookOpen },
  { mode: 'hard', icon: Flame },
  { mode: 'shuffle', icon: Shuffle },
  { mode: 'reversed', icon: ArrowLeftRight },
  { mode: 'timed', icon: Timer },
];

export interface StudyPanelProps {
  dueCount: number;
  /** Lista visível (deck selecionado ou todos) — base dos pools de treino. */
  cards: Flashcard[];
  onStart: (mode: ReviewMode) => void;
}

export function StudyPanel({ dueCount, cards, onStart }: StudyPanelProps) {
  // Memoize pool sizes so they are not recomputed on every render.
  const freePoolSize = useMemo(() => filterFreePool(cards).length, [cards]);
  const hardPoolSize = useMemo(() => filterHardCards(cards).length, [cards]);

  return (
    <FlashcardPanel
      icon={GraduationCap}
      title="Estudar"
      subtitle="Revise no intervalo certo ou treine do seu jeito"
      aria-label="Estudar"
    >
      {/* Protagonista: Revisar devidos / estado "em dia" */}
      {dueCount > 0 ? (
        <button
          type="button"
          onClick={() => onStart('due')}
          className={cn(
            'group mb-3 flex w-full items-center justify-between gap-4 overflow-hidden rounded-[var(--c-radius-control)]',
            'border border-[color-mix(in_srgb,var(--c-wine-500)_22%,transparent)]',
            'bg-gradient-to-r from-[color-mix(in_srgb,var(--c-wine-500)_10%,transparent)] via-[color-mix(in_srgb,var(--c-wine-500)_5%,transparent)] to-transparent',
            'px-4 py-2.5 transition-all duration-200',
            'hover:border-[color-mix(in_srgb,var(--c-wine-500)_45%,transparent)] hover:shadow-[var(--c-shadow-glow)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2',
          )}
        >
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_srgb,var(--c-wine-500)_12%,transparent)]">
              <Layers className="h-[18px] w-[18px] text-[var(--c-wine-500)]" aria-hidden />
            </div>
            <div className="min-w-0 text-left">
              <p className="text-[13.5px] font-bold text-[var(--c-ink)]">Revisar devidos</p>
              <p className="text-[11.5px] text-[var(--c-muted)]">
                {dueCount} {dueCount === 1 ? 'card pronto' : 'cards prontos'} para hoje
              </p>
            </div>
          </div>
          <span
            className={cn(
              'flex shrink-0 items-center gap-1.5 rounded-[var(--c-radius-control)] px-4 py-2',
              'bg-gradient-to-r from-[var(--c-wine-500)] to-[var(--c-wine-700)] text-white',
              'text-[12.5px] font-bold shadow-[var(--c-shadow-glow)]',
              'transition-transform duration-150 group-hover:scale-[1.03]',
            )}
          >
            <Play className="h-3.5 w-3.5 fill-current" aria-hidden />
            Iniciar
          </span>
        </button>
      ) : (
        <div className="mb-3 flex items-center gap-2.5 rounded-[var(--c-radius-control)] border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-2.5">
          <CheckCircle2 className="h-[18px] w-[18px] shrink-0 text-emerald-500" aria-hidden />
          <p className="text-[12.5px] font-semibold text-[var(--c-ink)]">
            Tudo revisado por hoje
            <span className="ml-1 font-normal text-[var(--c-muted)]">— escolha um modo de treino abaixo.</span>
          </p>
        </div>
      )}

      {/* Modos de treino */}
      <div className="mb-2 mt-1 flex items-center gap-2">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--c-muted-2)]">
          Modos de treino
        </span>
        <span className="h-px flex-1 bg-[var(--c-border)]" aria-hidden />
      </div>

      <div className="grid flex-1 auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3">
        {TRAINING_MODES.map(({ mode, icon: Icon }) => {
          const config = REVIEW_MODE_CONFIGS[mode];
          // shuffle/timed availability depends on the free pool (non-mastered cards).
          const poolSize = mode === 'hard' ? hardPoolSize : freePoolSize;
          const disabled = poolSize === 0;

          const renderTile = () => (
            <button
              type="button"
              disabled={disabled}
              onClick={() => onStart(mode)}
              aria-label={`${config.label} — ${config.description}`}
              className={cn(
                'flex h-full w-full flex-col items-start gap-1.5 rounded-2xl border border-transparent bg-[var(--c-surface-2)] p-2.5 text-left',
                'transition-all duration-150',
                disabled
                  // pointer-events-none so the wrapper span captures hover for the Tooltip.
                  ? 'pointer-events-none opacity-45'
                  : 'hover:-translate-y-[2px] hover:border-[color-mix(in_srgb,var(--c-wine-500)_30%,transparent)] hover:bg-[var(--c-surface)] hover:shadow-[var(--c-shadow-sm)] motion-reduce:hover:translate-y-0',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]',
              )}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--c-surface)] shadow-[var(--c-shadow-sm)] transition-colors group-hover:bg-[var(--c-surface-2)]">
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

          if (!disabled) return <div key={mode} className="h-full">{renderTile()}</div>;

          return (
            <Tooltip key={mode} delayDuration={300}>
              <TooltipTrigger asChild>
                <span className="block h-full cursor-not-allowed" tabIndex={0}>
                  {renderTile()}
                </span>
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
    </FlashcardPanel>
  );
}
