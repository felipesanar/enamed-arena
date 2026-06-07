import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { scoreTier } from './helpers';

export function AreaCard({
  label,
  correct,
  total,
  score,
  isBest,
  isWorst,
  onClick,
  prefersReducedMotion,
}: {
  label: string;
  correct: number;
  total: number;
  score: number;
  isBest: boolean;
  isWorst: boolean;
  onClick: () => void;
  prefersReducedMotion: boolean;
}) {
  const tier = scoreTier(score);

  const tierBar =
    tier === 'success'
      ? 'bg-gradient-to-r from-emerald-400 to-emerald-500'
      : tier === 'warning'
        ? 'bg-gradient-to-r from-amber-400 to-amber-500'
        : 'bg-gradient-to-r from-rose-500 to-rose-600';

  const tierText =
    tier === 'success'
      ? 'text-success'
      : tier === 'warning'
        ? 'text-warning'
        : 'text-destructive';

  const tierChipClass =
    tier === 'success'
      ? 'bg-success/10 text-success'
      : tier === 'warning'
        ? 'bg-warning/15 text-warning-foreground border border-warning/30'
        : 'bg-destructive/10 text-destructive';

  // Subtle visual weight for best/worst
  const frameClass = isBest
    ? 'border-success/30 shadow-[0_4px_14px_-6px_hsl(152_60%_36%/0.25)]'
    : isWorst
      ? 'border-destructive/30 shadow-[0_4px_14px_-6px_hsl(0_72%_51%/0.2)]'
      : 'border-border';

  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      transition={{ duration: 0.15 }}
      aria-label={`${label}: ${correct} de ${total} acertos, ${score}% de aproveitamento`}
      className={cn(
        'group relative w-full overflow-hidden rounded-2xl border bg-card p-4 text-left transition-all duration-200',
        'hover:border-primary/30 hover:shadow-[0_8px_22px_-12px_hsl(345_65%_30%/0.22)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        frameClass,
      )}
    >
      {/* Top: label + chevron */}
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-caption font-semibold text-foreground" title={label}>
          {label}
        </p>
        <ChevronRight
          className="h-4 w-4 shrink-0 text-muted-foreground/50 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-primary"
          aria-hidden
        />
      </div>

      {/* Middle: score + % chip */}
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <p
          className={cn(
            'text-[26px] font-extrabold leading-none tracking-[-0.025em] tabular-nums',
            tierText,
          )}
        >
          {correct}
          <span className="text-muted-foreground/40">/</span>
          {total}
        </p>
        <span
          className={cn(
            'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums uppercase tracking-wide',
            tierChipClass,
          )}
        >
          {score}%
        </span>
      </div>

      {/* Footer: progress bar + questions count */}
      <div className="mt-3">
        <div
          className="h-[6px] overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={correct}
          aria-valuemax={total}
        >
          <motion.div
            className={cn('h-full rounded-full', tierBar)}
            initial={{ width: prefersReducedMotion ? `${score}%` : 0 }}
            animate={{ width: `${score}%` }}
            transition={{
              duration: prefersReducedMotion ? 0 : 0.6,
              ease: 'easeOut',
              delay: prefersReducedMotion ? 0 : 0.1,
            }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {total} {total === 1 ? 'questão' : 'questões'}
        </p>
      </div>
    </motion.button>
  );
}
