/**
 * ConfidenceSelector — micro-seletor de 3 níveis de confiança.
 * Aparece após o aluno marcar uma alternativa (selectedOption !== null).
 * Opcional: o aluno pode navegar sem interagir.
 * Spec: docs/specs/04-auto-triage-confidence.md §1
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ConfidenceLevel } from '@/types/exam';

interface ConfidenceSelectorProps {
  value: ConfidenceLevel | null;
  onChange: (level: ConfidenceLevel) => void;
}

const CHIPS: { level: ConfidenceLevel; label: string; key: string }[] = [
  { level: 'baixa', label: 'Chute',       key: '1' },
  { level: 'media', label: 'Parcial',     key: '2' },
  { level: 'alta',  label: 'Tenho certeza', key: '3' },
];

const COLOR: Record<ConfidenceLevel, string> = {
  baixa: 'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20',
  media: 'bg-warning/10    text-warning    border-warning/30    hover:bg-warning/20',
  alta:  'bg-success/10   text-success    border-success/30   hover:bg-success/20',
};

const COLOR_SELECTED: Record<ConfidenceLevel, string> = {
  baixa: 'bg-destructive/20 text-destructive border-destructive/50 ring-1 ring-destructive/40',
  media: 'bg-warning/20    text-warning    border-warning/50    ring-1 ring-warning/40',
  alta:  'bg-success/20   text-success    border-success/50   ring-1 ring-success/40',
};

export function ConfidenceSelector({ value, onChange }: ConfidenceSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="mt-4 pt-3.5 border-t border-[hsl(var(--exam-border))]"
      aria-label="Nível de confiança"
    >
      <p
        id="confidence-label"
        className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-wide mb-2"
        title="Sua certeza ajuda a personalizar o caderno de erros"
      >
        Quão certo você está?
      </p>
      <div
        role="group"
        aria-labelledby="confidence-label"
        className="flex flex-wrap gap-2"
      >
        {CHIPS.map(({ level, label, key }) => {
          const isSelected = value === level;
          return (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(level)}
              title={`Tecla ${key} — Sua certeza ajuda a personalizar o caderno de erros`}
              aria-label={`${label} (tecla ${key})`}
              className={cn(
                'inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-[12px] font-medium',
                'transition-all duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1',
                isSelected ? COLOR_SELECTED[level] : `${COLOR[level]} border`,
              )}
            >
              {label}
              <span className="opacity-40 text-[10px] font-mono ml-0.5">{key}</span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}
