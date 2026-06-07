/**
 * SelfGradeBar — Fase 4: autoavaliação da sessão de recall.
 *
 * Redesign premium: 4 botões grandes com gradiente semântico,
 * alvos ≥48px (mobile), microanimação de entrada staggered.
 * 'Fácil' desabilitado quando wasCorrect === false.
 * Keyboard: 1-4 (handled by useRecallKeyboard at page level).
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Loader2, X, BarChart2, CheckCheck, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewOutcome } from '@/types/caderno';

interface SelfGradeBarProps {
  wasCorrect: boolean;
  isLoading?: boolean;
  onGrade: (grade: ReviewOutcome) => void;
}

const GRADES: {
  value: ReviewOutcome;
  label: string;
  sublabel: string;
  key: string;
  icon: React.ElementType;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  hoverBorderClass: string;
  hoverBgClass: string;
}[] = [
  {
    value: 'errei',
    label: 'Errei',
    sublabel: 'Não lembrei',
    key: '1',
    icon: X,
    colorClass: '[color:var(--c-destructive)]',
    borderClass: '[border-color:color-mix(in_srgb,var(--c-destructive)_25%,transparent)]',
    bgClass: '',
    hoverBorderClass: 'hover:[border-color:color-mix(in_srgb,var(--c-destructive)_55%,transparent)]',
    hoverBgClass: 'hover:[background:color-mix(in_srgb,var(--c-destructive)_5%,transparent)]',
  },
  {
    value: 'dificil',
    label: 'Difícil',
    sublabel: 'Acertei com esforço',
    key: '2',
    icon: BarChart2,
    colorClass: '[color:var(--c-warning)]',
    borderClass: '[border-color:color-mix(in_srgb,var(--c-warning)_25%,transparent)]',
    bgClass: '',
    hoverBorderClass: 'hover:[border-color:color-mix(in_srgb,var(--c-warning)_55%,transparent)]',
    hoverBgClass: 'hover:[background:color-mix(in_srgb,var(--c-warning)_5%,transparent)]',
  },
  {
    value: 'bom',
    label: 'Bom',
    sublabel: 'Acertei com segurança',
    key: '3',
    icon: CheckCheck,
    colorClass: '[color:var(--c-success)]',
    borderClass: '[border-color:color-mix(in_srgb,var(--c-success)_25%,transparent)]',
    bgClass: '',
    hoverBorderClass: 'hover:[border-color:color-mix(in_srgb,var(--c-success)_55%,transparent)]',
    hoverBgClass: 'hover:[background:color-mix(in_srgb,var(--c-success)_5%,transparent)]',
  },
  {
    value: 'facil',
    label: 'Fácil',
    sublabel: 'Dominado!',
    key: '4',
    icon: Zap,
    colorClass: 'text-[var(--c-wine-500)]',
    borderClass: 'border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)]',
    bgClass: '',
    hoverBorderClass: 'hover:border-[color-mix(in_srgb,var(--c-wine-500)_55%,transparent)]',
    hoverBgClass: 'hover:bg-[color-mix(in_srgb,var(--c-wine-500)_5%,transparent)]',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const } },
};

export function SelfGradeBar({ wasCorrect, isLoading, onGrade }: SelfGradeBarProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow-sm)]"
    >
      <div className="mb-4">
        <p className="text-heading-3 font-bold text-[var(--c-ink)] tracking-tight">
          Como você se saiu?
        </p>
        <p className="mt-0.5 text-caption text-[var(--c-muted)]">
          {wasCorrect
            ? 'Marque sua confiança. Isso ajusta quando a questão volta para você.'
            : '"Fácil" só disponível quando você acerta.'}
        </p>
      </div>

      <motion.div
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
        role="radiogroup"
        aria-label="Autoavaliação"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
      >
        {GRADES.map((g) => {
          const isFacilDisabled = g.value === 'facil' && !wasCorrect;
          const Icon = g.icon;

          return (
            <motion.button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={false}
              disabled={isFacilDisabled || isLoading}
              onClick={() => !isFacilDisabled && !isLoading && onGrade(g.value)}
              title={isFacilDisabled ? 'Só disponível quando você acerta' : undefined}
              variants={prefersReducedMotion ? undefined : itemVariants}
              whileTap={!isFacilDisabled && !isLoading && !prefersReducedMotion ? { scale: 0.97 } : undefined}
              className={cn(
                'flex min-h-[76px] flex-col items-center justify-center gap-1.5',
                'rounded-[var(--c-radius-control)] border bg-[var(--c-surface)]',
                'px-2 py-3 text-center transition-all duration-150',
                g.borderClass,
                !isFacilDisabled && !isLoading && [g.hoverBorderClass, g.hoverBgClass, 'cursor-pointer'],
                isFacilDisabled && 'cursor-not-allowed opacity-35',
                isLoading && 'cursor-wait opacity-60',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)] focus-visible:ring-offset-2',
                // Mobile: extra tall
                'sm:min-h-[68px]',
              )}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin text-[var(--c-muted)]" aria-hidden />
              ) : (
                <>
                  <Icon
                    className={cn('h-4 w-4 shrink-0', g.colorClass)}
                    aria-hidden
                    strokeWidth={2.5}
                  />
                  <span className={cn('text-[13px] font-bold leading-tight', g.colorClass)}>
                    {g.label}
                  </span>
                  <span className="hidden text-center text-[10px] leading-tight text-[var(--c-muted)] sm:block">
                    {g.sublabel}
                  </span>
                  <kbd
                    className="hidden rounded bg-[var(--c-surface-2)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--c-muted)] sm:inline"
                    aria-hidden
                  >
                    {g.key}
                  </kbd>
                </>
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
