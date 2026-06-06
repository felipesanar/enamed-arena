/**
 * FilterBar — duas faixas de chips (Causa + Área) + busca.
 *
 * Labels canônicos (spec 00 §6.5): "Causa" / "Área" / "Buscar".
 * aria-checked em todo chip (spec 00 §6.6).
 */

import { Search, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getReasonMeta, type DbReason } from '@/lib/errorNotebookReasons';

export type CausaFilter = 'all' | DbReason;

interface FilterChipProps {
  label: string;
  count?: number;
  active: boolean;
  dotColor?: string;
  activeStyle?: { background: string; color: string; borderColor: string };
  onClick: () => void;
}

function FilterChip({ label, count, active, dotColor, activeStyle, onClick }: FilterChipProps) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      style={active && activeStyle ? activeStyle : undefined}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        active && !activeStyle && 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]',
        active && !!activeStyle && 'shadow-[0_2px_6px_-2px_hsl(0_0%_0%/0.15)]',
        !active && 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
      )}
    >
      {active ? (
        <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden />
      ) : (
        dotColor && (
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: dotColor }} />
        )
      )}
      {label}
      {typeof count === 'number' && (
        <span className={cn('text-[10px] font-bold tabular-nums', active ? 'opacity-80' : 'opacity-55')}>
          {count}
        </span>
      )}
    </button>
  );
}

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
    <div className="flex flex-col gap-2.5">
      {/* Faixa 1 — Causa */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
        <span className="w-[44px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          Causa
        </span>
        <div role="radiogroup" aria-label="Filtrar por causa do erro" className="flex items-center gap-1.5">
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
                dotColor={meta.colorBase}
                activeStyle={{
                  background: meta.colorBg,
                  color: meta.colorText,
                  borderColor: meta.colorBorder,
                }}
                onClick={() => onTypeChange(typeFilter === type ? 'all' : type)}
              />
            );
          })}
        </div>
      </div>

      {/* Faixa 2 — Área (só quando >1 especialidade) */}
      {specialties.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
          <span className="w-[44px] shrink-0 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Área
          </span>
          <div role="radiogroup" aria-label="Filtrar por especialidade" className="flex items-center gap-1.5">
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
          className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/60"
          aria-hidden
        />
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Questão, área ou simulado…"
          aria-label="Buscar no caderno"
          className={cn(
            'w-full rounded-xl border border-border bg-card py-2 pl-9 pr-3 text-[13px] text-foreground placeholder:text-muted-foreground/60',
            'transition-colors duration-150 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
          )}
        />
      </div>
    </div>
  );
}
