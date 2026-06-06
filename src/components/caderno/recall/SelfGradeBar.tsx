/**
 * SelfGradeBar
 *
 * 4-button self-assessment block shown in phases 'revealed' / 'self_grade'.
 * 'Fácil' is disabled when wasCorrect === false (spec §1 Fase 4).
 * Keyboard: 1-4 (handled by useRecallKeyboard at page level).
 */

import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ReviewOutcome } from '@/types/caderno';

interface SelfGradeBarProps {
  wasCorrect: boolean;
  isLoading?: boolean;
  onGrade: (grade: ReviewOutcome) => void;
}

const GRADES: { value: ReviewOutcome; label: string; subtitle: string; key: string }[] = [
  { value: 'errei',   label: 'Errei',   subtitle: 'Não lembrei / errei a resposta', key: '1' },
  { value: 'dificil', label: 'Difícil', subtitle: 'Acertei com esforço',            key: '2' },
  { value: 'bom',     label: 'Bom',     subtitle: 'Acertei com segurança',          key: '3' },
  { value: 'facil',   label: 'Fácil',   subtitle: 'Muito fácil, dominado',          key: '4' },
];

export function SelfGradeBar({ wasCorrect, isLoading, onGrade }: SelfGradeBarProps) {
  return (
    <div
      className="mt-5 rounded-xl border border-border bg-muted/40 p-4"
    >
      <p className="text-body-sm font-semibold text-foreground">Como foi?</p>

      {/* Desktop: 4 columns. Mobile: 2×2 grid */}
      <div
        className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2"
        role="radiogroup"
        aria-label="Autoavaliação"
      >
        {GRADES.map((g) => {
          const isFacilDisabled = g.value === 'facil' && !wasCorrect;
          return (
            <button
              key={g.value}
              type="button"
              role="radio"
              aria-checked={false}
              disabled={isFacilDisabled || isLoading}
              onClick={() => !isFacilDisabled && !isLoading && onGrade(g.value)}
              title={isFacilDisabled ? 'Só disponível quando você acerta' : undefined}
              className={cn(
                'flex flex-col items-center gap-1 rounded-xl border border-border bg-card px-2 py-2.5',
                'text-[13px] font-semibold text-foreground transition-colors',
                !isFacilDisabled && !isLoading && 'hover:border-primary/40 hover:bg-primary/[0.04] cursor-pointer',
                isFacilDisabled && 'opacity-40 cursor-not-allowed',
                isLoading && 'opacity-60 cursor-wait',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              )}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <>
                  {g.label}
                  <span className="text-[10px] font-normal text-muted-foreground text-center leading-tight">
                    {g.subtitle}
                  </span>
                  <kbd className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground mt-0.5">
                    {g.key}
                  </kbd>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
