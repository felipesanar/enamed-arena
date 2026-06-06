/**
 * ConfidenceStep
 *
 * Inline block that appears below the options in phase 'confidence'.
 * Renders 3 buttons (Baixa / Média / Alta) + keyboard hint (1-2-3).
 * Emits onSelect(confidence) which advances phase to 'revealed'.
 */

import { cn } from '@/lib/utils';
import type { Confidence } from '@/types/caderno';

interface ConfidenceStepProps {
  onSelect: (c: Confidence) => void;
}

const OPTIONS: { value: Confidence; label: string; key: '1' | '2' | '3' }[] = [
  { value: 'baixa', label: 'Baixa', key: '1' },
  { value: 'media', label: 'Média', key: '2' },
  { value: 'alta',  label: 'Alta',  key: '3' },
];

export function ConfidenceStep({ onSelect }: ConfidenceStepProps) {
  return (
    <div
      className="mt-4 rounded-xl border border-border bg-muted/40 p-4"
      role="group"
      aria-label="Nível de confiança"
    >
      <p className="text-body-sm font-semibold text-foreground">
        Qual o seu nível de confiança nessa resposta?
      </p>
      <p className="mt-0.5 text-caption text-muted-foreground">
        Seja honesto — isso ajusta sua agenda de revisão.
      </p>

      <div
        className="mt-3 flex gap-2"
        role="radiogroup"
        aria-label="Nível de confiança"
      >
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={false}
            onClick={() => onSelect(opt.value)}
            className={cn(
              'flex-1 flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-3 py-2.5',
              'text-[13px] font-semibold text-foreground transition-colors',
              'hover:border-primary/40 hover:bg-primary/[0.04]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            )}
          >
            {opt.label}
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
              {opt.key}
            </kbd>
          </button>
        ))}
      </div>
    </div>
  );
}
