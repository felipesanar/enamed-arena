/**
 * ConfidenceStep — Fase 2 do recall ativo.
 *
 * Redesign premium: 3 botões grandes com ícones, paleta semântica,
 * microanimação de entrada, alvos ≥48px (mobile).
 * Keyboard: 1-2-3 (handled by useRecallKeyboard at page level).
 */

import { motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { Confidence } from '@/types/caderno';

interface ConfidenceStepProps {
  onSelect: (c: Confidence) => void;
}

const OPTIONS: {
  value: Confidence;
  label: string;
  sublabel: string;
  key: '1' | '2' | '3';
  emoji: string;
  accentClass: string;
  borderClass: string;
  bgClass: string;
}[] = [
  {
    value: 'baixa',
    label: 'Baixa',
    sublabel: 'Chutei ou não tinha certeza',
    key: '1',
    emoji: '😅',
    accentClass: 'text-rose-500',
    borderClass: 'border-rose-400/30 hover:border-rose-400/60',
    bgClass: 'hover:bg-rose-500/[0.04]',
  },
  {
    value: 'media',
    label: 'Média',
    sublabel: 'Achei que estava certo',
    key: '2',
    emoji: '🤔',
    accentClass: 'text-amber-500',
    borderClass: 'border-amber-400/30 hover:border-amber-400/60',
    bgClass: 'hover:bg-amber-500/[0.04]',
  },
  {
    value: 'alta',
    label: 'Alta',
    sublabel: 'Tinha certeza da resposta',
    key: '3',
    emoji: '💪',
    accentClass: 'text-emerald-500',
    borderClass: 'border-emerald-400/30 hover:border-emerald-400/60',
    bgClass: 'hover:bg-emerald-500/[0.04]',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.22, 1, 0.36, 1] } },
};

export function ConfidenceStep({ onSelect }: ConfidenceStepProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className="rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5 shadow-[var(--c-shadow-sm)]"
    >
      {/* Header */}
      <div className="mb-4">
        <p className="text-heading-3 font-bold text-[var(--c-ink)] tracking-tight">
          Qual foi sua confiança?
        </p>
        <p className="mt-0.5 text-caption text-[var(--c-muted)]">
          Seja honesto — isso calibra seu próximo intervalo de revisão.
        </p>
      </div>

      {/* Buttons */}
      <motion.div
        className="grid grid-cols-3 gap-3"
        role="radiogroup"
        aria-label="Nível de confiança"
        variants={prefersReducedMotion ? undefined : containerVariants}
        initial={prefersReducedMotion ? false : 'hidden'}
        animate="visible"
      >
        {OPTIONS.map((opt) => (
          <motion.button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onSelect(opt.value)}
            variants={prefersReducedMotion ? undefined : itemVariants}
            whileTap={prefersReducedMotion ? undefined : { scale: 0.97 }}
            className={cn(
              'group flex min-h-[72px] flex-col items-center justify-center gap-1.5',
              'rounded-[var(--c-radius-control)] border bg-[var(--c-surface)]',
              'px-2 py-3 text-center transition-all duration-150',
              opt.borderClass,
              opt.bgClass,
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
              // Mobile: extra tall tap target
              'sm:min-h-[64px]',
            )}
          >
            <span className="text-[22px] leading-none" aria-hidden>
              {opt.emoji}
            </span>
            <span className={cn('text-[13px] font-bold leading-tight', opt.accentClass)}>
              {opt.label}
            </span>
            <span className="hidden text-[10px] leading-tight text-[var(--c-muted)] sm:block">
              {opt.sublabel}
            </span>
            <kbd
              className="hidden rounded bg-[var(--c-surface-2)] px-1.5 py-0.5 font-mono text-[9px] text-[var(--c-muted)] sm:inline"
              aria-hidden
            >
              {opt.key}
            </kbd>
          </motion.button>
        ))}
      </motion.div>
    </motion.div>
  );
}
