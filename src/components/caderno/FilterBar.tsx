/**
 * FilterBar — faixa de chips de filtro (Causa + Área) + busca.
 * Redesign premium: usa FilterChip do design system.
 * Labels canônicos: "Causa" / "Área" / "Buscar".
 * Mobile: chips scrolláveis numa faixa horizontal horizontal.
 * Desktop: faixa com wrap suave para acomodar muitas especialidades.
 */

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
}

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
}: FilterBarProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Faixa 1 — Causa */}
      <div className="flex items-center gap-2.5">
        <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)] w-[38px]">
          Causa
        </span>
        <div
          role="radiogroup"
          aria-label="Filtrar por causa do erro"
          className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
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
      </div>

      {/* Faixa 2 — Área (só quando >1 especialidade) */}
      {specialties.length > 1 && (
        <div className="flex items-center gap-2.5">
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--c-muted)] w-[38px]">
            Área
          </span>
          <div
            role="radiogroup"
            aria-label="Filtrar por especialidade"
            className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
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
        </div>
      )}

      {/* Faixa 3 — Busca */}
      <div className="relative">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--c-muted-2)]"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Questão, área ou simulado…"
          aria-label="Buscar no caderno"
          className={cn(
            'w-full rounded-[var(--c-radius-control)] border border-[var(--c-border)] bg-[var(--c-surface)] py-2.5 pl-10 pr-4',
            'text-[13px] text-[var(--c-ink)] placeholder:text-[var(--c-muted-2)]',
            'transition-colors duration-[var(--c-duration-fast)]',
            'focus:border-[var(--c-wine-400)] focus:outline-none focus:ring-2 focus:ring-[var(--c-wine-500)]/20',
          )}
        />
      </div>
    </div>
  );
}
