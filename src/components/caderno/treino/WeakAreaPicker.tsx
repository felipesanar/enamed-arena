/**
 * WeakAreaPicker — Seletor de área/tema fraco para o Treino do Caderno.
 *
 * Redesign premium ("arena clínica"): ranking vertical de cards substanciais,
 * cada um com medalhão de prioridade, indicador de fraqueza protagonista
 * (gauge gradiente wine + leitura numérica grande), progresso de domínio na
 * área e causa frequente. Estado selecionado com trilho de acento wine, glow e
 * check. Hover com elevação. Acessível (radiogroup) e dark-ready.
 */

import { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { TrendingDown, Check, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CauseBadge } from '@/components/caderno/ui/CauseBadge';
import type { RankedWeakArea } from '@/lib/weakAreas';

// ─── Tipos ─────────────────────────────────────────────────────────────────────

export interface WeakAreaPickerProps {
  areas: RankedWeakArea[];
  selectedArea: RankedWeakArea | null;
  onSelectArea: (area: RankedWeakArea) => void;
}

// ─── Helpers de prioridade ───────────────────────────────────────────────────

/** Rótulo curto de prioridade derivado da posição no ranking. */
function priorityLabel(rank: number): string {
  if (rank === 1) return 'Prioridade máxima';
  if (rank <= 3) return 'Prioridade alta';
  return 'Acompanhar';
}

// ─── Subcomponente: medalhão de rank ──────────────────────────────────────────

function RankMedallion({ rank, selected }: { rank: number; selected: boolean }) {
  const isTop = rank <= 3;
  return (
    <span
      aria-hidden
      className={cn(
        'relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px]',
        'text-[15px] font-extrabold tabular-nums leading-none',
        'transition-all duration-[var(--c-duration-base)]',
        isTop
          ? 'text-white shadow-[0_4px_14px_-6px_rgba(176,41,74,0.7)]'
          : 'bg-[var(--c-surface-2)] text-[var(--c-muted)] ring-1 ring-[var(--c-border)]',
      )}
      style={
        isTop
          ? { backgroundImage: 'linear-gradient(135deg, var(--c-wine-500,#B0294A), var(--c-wine-700,#7A1A32))' }
          : undefined
      }
    >
      {rank}
      {selected && (
        <span
          className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--c-wine-500)] ring-2 ring-[var(--c-surface)]"
        >
          <Check className="h-2.5 w-2.5 text-white" strokeWidth={3.5} />
        </span>
      )}
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function WeakAreaPicker({ areas, selectedArea, onSelectArea }: WeakAreaPickerProps) {
  const prefersReducedMotion = useReducedMotion();
  // score máximo para normalizar as barras (fraqueza relativa ao pior caso)
  const maxScore = useMemo(() => Math.max(...areas.map((a) => a.score), 1), [areas]);

  return (
    <div
      role="radiogroup"
      aria-label="Áreas para treinar — escolha uma"
      className="flex flex-col gap-2.5"
    >
      {areas.map((area, idx) => {
        const isSelected =
          selectedArea?.area === area.area && selectedArea?.theme === area.theme;
        const rank = idx + 1;
        const label = area.theme ? `${area.area} › ${area.theme}` : area.area;
        const weaknessPct = Math.round((area.score / maxScore) * 100);
        const mastered = Math.max(0, area.total - area.pending);

        return (
          <motion.div
            key={`${area.area}|${area.theme ?? ''}`}
            initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, delay: idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <div
              role="radio"
              aria-checked={isSelected}
              aria-label={`${label} — ${area.pending} pendente${area.pending !== 1 ? 's' : ''}, índice de fraqueza ${weaknessPct}%`}
              tabIndex={0}
              onClick={() => onSelectArea(area)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectArea(area);
                }
              }}
              className={cn(
                'group relative cursor-pointer select-none overflow-hidden',
                'rounded-[var(--c-radius-card)] border bg-[var(--c-surface)]',
                'pl-5 pr-4 py-4',
                'transition-all duration-[var(--c-duration-base)] ease-[var(--c-ease-standard)]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_55%,transparent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--c-bg)]',
                isSelected
                  ? 'border-[color-mix(in_srgb,var(--c-wine-500)_40%,transparent)] shadow-[var(--c-shadow-glow)]'
                  : 'border-[var(--c-border)] hover:-translate-y-[2px] hover:border-[color-mix(in_srgb,var(--c-wine-500)_25%,transparent)] hover:shadow-[var(--c-shadow-md)] motion-reduce:hover:translate-y-0',
              )}
              style={
                isSelected
                  ? { background: 'linear-gradient(180deg, color-mix(in srgb, var(--c-wine-500) 7%, var(--c-surface)), var(--c-surface))' }
                  : undefined
              }
            >
              {/* Trilho de acento à esquerda — wine intenso quando selecionado */}
              <span
                aria-hidden
                className={cn(
                  'absolute inset-y-0 left-0 w-[3px] transition-opacity duration-[var(--c-duration-base)]',
                  isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-60',
                )}
                style={{ background: 'linear-gradient(180deg, var(--c-wine-400,#CF5C7C), var(--c-wine-700,#7A1A32))' }}
              />

              {/* Linha 1: medalhão + título + prioridade + chevron */}
              <div className="flex items-center gap-3">
                <RankMedallion rank={rank} selected={isSelected} />

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-[14.5px] font-extrabold leading-tight tracking-[-0.01em]',
                      isSelected ? 'text-[var(--c-wine-600)]' : 'text-[var(--c-ink)]',
                    )}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--c-muted)]">
                    <span
                      aria-hidden
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ background: rank <= 3 ? 'var(--c-wine-500,#B0294A)' : 'var(--c-muted-2,#A89DA1)' }}
                    />
                    {priorityLabel(rank)}
                  </p>
                </div>

                <ChevronRight
                  className={cn(
                    'h-4 w-4 shrink-0 transition-all duration-[var(--c-duration-base)]',
                    isSelected
                      ? 'text-[var(--c-wine-500)] translate-x-0'
                      : 'text-[var(--c-muted-2)] -translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100',
                  )}
                  aria-hidden
                />
              </div>

              {/* Linha 2: gauge de fraqueza — protagonista */}
              <div className="mt-3.5">
                <div className="mb-1.5 flex items-end justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)]">
                    Índice de fraqueza
                  </span>
                  <span
                    className={cn(
                      'text-[15px] font-extrabold tabular-nums leading-none',
                      isSelected ? 'text-[var(--c-wine-600)]' : 'text-[var(--c-ink)]',
                    )}
                  >
                    {weaknessPct}
                    <span className="ml-px text-[10px] font-bold text-[var(--c-muted)]">%</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--c-surface-2)]">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--c-wine-700,#7A1A32), var(--c-wine-400,#CF5C7C))' }}
                    initial={prefersReducedMotion ? false : { width: 0 }}
                    animate={{ width: `${weaknessPct}%` }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.7, delay: prefersReducedMotion ? 0 : 0.1 + idx * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>

              {/* Linha 3: métricas + causa */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10.5px] font-bold text-orange-600 dark:text-orange-400">
                  {area.pending} pendente{area.pending !== 1 ? 's' : ''}
                </span>

                {area.totalLapses > 0 && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full bg-destructive/10 px-2 py-0.5 text-[10.5px] font-bold text-destructive"
                    title={`${area.totalLapses} ${area.totalLapses > 1 ? 'tropeços' : 'tropeço'} na revisão, alta resistência`}
                  >
                    <TrendingDown className="h-2.5 w-2.5" aria-hidden />
                    {area.totalLapses} {area.totalLapses === 1 ? 'tropeço' : 'tropeços'}
                  </span>
                )}

                <CauseBadge reason={area.topReason} size="sm" />

                {mastered > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-semibold text-[var(--c-muted)]">
                    <Check className="h-3 w-3 text-[var(--c-success)]" strokeWidth={3} aria-hidden />
                    {mastered}/{area.total} dominadas
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
