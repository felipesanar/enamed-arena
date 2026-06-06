/**
 * WeakAreaPicker — Seletor de área/tema fraco para o Treino do Caderno.
 *
 * Redesign premium: ranking visual com ProgressBar de fraqueza relativa,
 * contagem de pendentes/lapsos, causa frequente via CauseBadge.
 * Desktop: grid 2 colunas com hover elevation. Mobile: coluna única, alvos ≥44px.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingDown, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CadernoCard } from '@/components/caderno/ui/CadernoCard';
import { CauseBadge } from '@/components/caderno/ui/CauseBadge';
import { ProgressBar } from '@/components/caderno/ui/ProgressRing';
import type { RankedWeakArea } from '@/lib/weakAreas';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface WeakAreaPickerProps {
  areas: RankedWeakArea[];
  selectedArea: RankedWeakArea | null;
  onSelectArea: (area: RankedWeakArea) => void;
}

// ─── Subcomponente: rank badge ────────────────────────────────────────────────

function RankPill({ rank }: { rank: number }) {
  const isTop = rank <= 3;
  return (
    <span
      aria-label={`Posição ${rank}`}
      className={cn(
        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold tabular-nums',
        isTop
          ? 'bg-[var(--c-wine-500)] text-white'
          : 'bg-[var(--c-surface-2)] text-[var(--c-muted)]',
      )}
    >
      {rank}
    </span>
  );
}

// ─── Subcomponente: indicador de radio ───────────────────────────────────────

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-[var(--c-duration-fast)]',
        selected
          ? 'border-[var(--c-wine-500)] bg-[var(--c-wine-500)]'
          : 'border-[var(--c-muted-2)] bg-transparent',
      )}
    >
      {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WeakAreaPicker({ areas, selectedArea, onSelectArea }: WeakAreaPickerProps) {
  // score máximo para normalizar as barras
  const maxScore = useMemo(() => Math.max(...areas.map((a) => a.score), 1), [areas]);

  return (
    <div
      role="radiogroup"
      aria-label="Áreas para treinar — escolha uma"
      className="grid grid-cols-1 gap-2.5 sm:grid-cols-2"
    >
      {areas.map((area, idx) => {
        const isSelected =
          selectedArea?.area === area.area && selectedArea?.theme === area.theme;
        const label = area.theme ? `${area.area} › ${area.theme}` : area.area;
        const weaknessPct = Math.round((area.score / maxScore) * 100);

        return (
          <motion.div
            key={`${area.area}|${area.theme ?? ''}`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.22,
              delay: idx * 0.04,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <CadernoCard
              variant="interactive"
              hero={isSelected}
              role="radio"
              aria-checked={isSelected}
              aria-label={`${label} — ${area.pending} pendente${area.pending !== 1 ? 's' : ''}`}
              tabIndex={0}
              onClick={() => onSelectArea(area)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectArea(area);
                }
              }}
              className={cn(
                'flex cursor-pointer flex-col gap-3 p-4',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-2',
                'select-none',
                isSelected
                  ? 'border-[var(--c-wine-500)]/30 bg-[var(--c-wine-500)]/[0.05]'
                  : 'hover:border-[var(--c-wine-500)]/20 hover:bg-[var(--c-wine-500)]/[0.03]',
              )}
            >
              {/* Row 1: rank + label + radio */}
              <div className="flex items-start gap-2.5">
                <RankPill rank={idx + 1} />
                <span
                  className={cn(
                    'flex-1 text-[13px] font-bold leading-snug',
                    isSelected ? 'text-[var(--c-wine-600)]' : 'text-[var(--c-ink)]',
                  )}
                >
                  {label}
                </span>
                <RadioDot selected={isSelected} />
              </div>

              {/* Row 2: barra de fraqueza relativa */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--c-muted)]">
                    Índice de fraqueza
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-bold tabular-nums',
                      isSelected ? 'text-[var(--c-wine-600)]' : 'text-[var(--c-muted)]',
                    )}
                  >
                    {weaknessPct}%
                  </span>
                </div>
                <ProgressBar
                  value={weaknessPct}
                  label={`Índice de fraqueza de ${label}: ${weaknessPct}%`}
                  className="h-1.5"
                />
              </div>

              {/* Row 3: métricas + causa */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Pendentes */}
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                  {area.pending} pendente{area.pending !== 1 ? 's' : ''}
                </span>

                {/* Lapsos SRS */}
                {area.totalLapses > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-bold text-destructive"
                    title={`${area.totalLapses} lapso${area.totalLapses > 1 ? 's' : ''} SRS — alta resistência`}
                  >
                    <TrendingDown className="h-2.5 w-2.5" aria-hidden />
                    {area.totalLapses} {area.totalLapses === 1 ? 'lapso' : 'lapsos'}
                  </span>
                )}

                {/* Causa frequente */}
                <CauseBadge reason={area.topReason} size="sm" />
              </div>
            </CadernoCard>
          </motion.div>
        );
      })}
    </div>
  );
}
