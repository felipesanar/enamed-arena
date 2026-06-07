/**
 * FilterBar — painel de controles do Caderno (busca + ações + filtros).
 * Redesign B: tudo contido num card (--c-surface-2) separado da lista.
 *  Linha 1 — busca + ações (Exportar/Selecionar), passadas via `actions`.
 *  Linha 2 — Causa (chips).
 *  Linha 3 — Área (chips), só quando >1 especialidade. "Limpar filtros"
 *            aparece ancorado à direita da última faixa quando há filtro ativo.
 * Mobile: busca full-width, ações dividem a linha, chips deslizam na horizontal.
 */

import type { ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReasonMeta, type DbReason } from '@/lib/errorNotebookReasons';
import { FilterChip } from '@/components/caderno/ui';

export type CausaFilter = 'all' | DbReason;

export interface FilterBarProps {
  typeOptions: DbReason[];
  specialties: string[];
  totalCount: number;
  typeFilter: CausaFilter;
  specFilter: string | null;
  search: string;
  typeCounts: Partial<Record<DbReason, number>>;
  onTypeChange: (t: CausaFilter) => void;
  onSpecChange: (s: string | null) => void;
  onSearchChange: (s: string) => void;
  /** Ações do header (Exportar, Selecionar) — renderizadas ao lado da busca. */
  actions?: ReactNode;
  /** Limpa todos os filtros; o link só aparece quando há filtro ativo. */
  onClearFilters?: () => void;
  hasActiveFilters?: boolean;
}

const LABEL_CLASS =
  'shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)] w-[42px]';
const CHIPS_CLASS =
  'min-w-0 flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]';

export function FilterBar({
  typeOptions,
  specialties,
  totalCount,
  typeFilter,
  specFilter,
  search,
  typeCounts,
  onTypeChange,
  onSpecChange,
  onSearchChange,
  actions,
  onClearFilters,
  hasActiveFilters = false,
}: FilterBarProps) {
  const hasAreaRow = specialties.length > 1;

  const clearButton = onClearFilters && hasActiveFilters ? (
    <button
      type="button"
      onClick={onClearFilters}
      className={cn(
        'shrink-0 text-[12px] font-semibold text-[var(--c-wine-600)] dark:text-[var(--c-wine-300)]',
        'transition-colors duration-[var(--c-duration-fast)] hover:text-[var(--c-wine-700)]',
        'focus-visible:outline-none focus-visible:underline',
      )}
    >
      Limpar filtros
    </button>
  ) : null;

  return (
    <div
      className={cn(
        'rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface-2)]',
        'p-4 sm:p-5 shadow-[var(--c-shadow-sm)]',
      )}
    >
      {/* Linha 1 — Busca + ações */}
      <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--c-muted-2)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Buscar questão, área ou simulado…"
            aria-label="Buscar no caderno"
            className={cn(
              'h-[42px] w-full rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] pl-11 pr-4',
              'text-[13px] text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]',
              'transition-colors duration-[var(--c-duration-fast)]',
              'focus:border-[var(--c-wine-400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-wine-500)]/20',
            )}
          />
        </div>
        {actions && (
          <div className="flex items-center gap-2 [&>*]:flex-1 sm:[&>*]:flex-none">
            {actions}
          </div>
        )}
      </div>

      {/* Linha 2 — Causa */}
      <div className="flex items-center gap-2.5">
        <span className={LABEL_CLASS}>Causa</span>
        <div
          role="radiogroup"
          aria-label="Filtrar por causa do erro"
          className={CHIPS_CLASS}
        >
          <FilterChip
            label="Todos"
            count={totalCount}
            active={typeFilter === 'all'}
            onClick={() => onTypeChange('all')}
          />
          {typeOptions.map((type) => {
            const meta = getReasonMeta(type);
            return (
              <FilterChip
                key={type}
                label={meta.badge}
                count={typeCounts[type] ?? 0}
                active={typeFilter === type}
                onClick={() => onTypeChange(typeFilter === type ? 'all' : type)}
                style={
                  typeFilter === type
                    ? {
                        background: meta.colorBg,
                        color: meta.colorText,
                        borderColor: meta.colorBorder,
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
        {!hasAreaRow && clearButton}
      </div>

      {/* Linha 3 — Área (só quando >1 especialidade) */}
      {hasAreaRow && (
        <div className="mt-3 flex items-center gap-2.5">
          <span className={LABEL_CLASS}>Área</span>
          <div
            role="radiogroup"
            aria-label="Filtrar por especialidade"
            className={CHIPS_CLASS}
          >
            <FilterChip
              label="Todas"
              active={!specFilter}
              onClick={() => onSpecChange(null)}
            />
            {specialties.map((s) => (
              <FilterChip
                key={s}
                label={s}
                active={specFilter === s}
                onClick={() => onSpecChange(specFilter === s ? null : s)}
              />
            ))}
          </div>
          {clearButton}
        </div>
      )}
    </div>
  );
}
