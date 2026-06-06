/**
 * WeakAreaPicker — Seletor de área/tema fraco para o Treino do Caderno.
 *
 * Renderiza as áreas mais fracas do aluno como opções selecionáveis.
 * O aluno escolhe UMA área/tema e a quantidade de questões desejada.
 *
 * Acessibilidade: radio group com foco por teclado, aria-labels descritivos.
 */

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { getReasonMeta } from '@/lib/errorNotebookReasons';
import type { RankedWeakArea } from '@/lib/weakAreas';
import { AlertCircle, TrendingDown, Minus } from 'lucide-react';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface WeakAreaPickerProps {
  areas: RankedWeakArea[];
  selectedArea: RankedWeakArea | null;
  onSelectArea: (area: RankedWeakArea) => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function LapseBadge({ lapses }: { lapses: number }) {
  if (lapses === 0) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-destructive"
      title={`${lapses} lapso${lapses > 1 ? 's' : ''} SRS — questão de alta resistência`}
    >
      <TrendingDown className="h-2.5 w-2.5" aria-hidden />
      {lapses} {lapses === 1 ? 'lapso' : 'lapsos'}
    </span>
  );
}

function ReasonBadge({ reason }: { reason: string }) {
  const meta = getReasonMeta(reason as any);
  if (!meta) return null;
  return (
    <span
      className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
      style={{ backgroundColor: `${meta.color}18`, color: meta.color }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: meta.color }} aria-hidden />
      {meta.label}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WeakAreaPicker({ areas, selectedArea, onSelectArea }: WeakAreaPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Áreas para treinar — escolha uma"
      className="grid grid-cols-1 gap-2 sm:grid-cols-2"
    >
      {areas.map((area) => {
        const isSelected = selectedArea?.area === area.area && selectedArea?.theme === area.theme;
        const label = area.theme ? `${area.area} › ${area.theme}` : area.area;

        return (
          <button
            key={`${area.area}|${area.theme ?? ''}`}
            type="button"
            role="radio"
            aria-checked={isSelected}
            aria-label={`${label} — ${area.pending} pendentes`}
            onClick={() => onSelectArea(area)}
            className={cn(
              'relative flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              isSelected
                ? 'border-primary bg-primary/[0.07] shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]'
                : 'border-border bg-card hover:border-primary/30 hover:bg-primary/[0.03]',
            )}
          >
            {/* Indicador de seleção */}
            <span
              aria-hidden
              className={cn(
                'absolute right-3 top-3 h-4 w-4 rounded-full border-2 transition-colors',
                isSelected
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground/40 bg-transparent',
              )}
            >
              {isSelected && (
                <span className="absolute inset-[3px] rounded-full bg-primary-foreground" />
              )}
            </span>

            {/* Label (área / tema) */}
            <span className="pr-6 text-[13px] font-bold leading-tight text-foreground">
              {label}
            </span>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                {area.pending} pendente{area.pending !== 1 ? 's' : ''}
              </span>
              <LapseBadge lapses={area.totalLapses} />
              <ReasonBadge reason={area.topReason} />
            </div>
          </button>
        );
      })}
    </div>
  );
}
