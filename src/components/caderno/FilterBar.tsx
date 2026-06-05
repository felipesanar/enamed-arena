import { getReasonMeta, type DbReason } from '@/lib/errorNotebookReasons';
import { FilterChip } from './FilterChip';
import { type NotebookEntry, type TypeFilter } from './helpers';

/* ──────────────────────────────────────────────────────────────────────────
 * FilterBar — chips segmented, acessível, tokens
 * ────────────────────────────────────────────────────────────────────────── */

export function FilterBar({
  entries,
  typeOptions,
  specialties,
  typeFilter,
  specFilter,
  onTypeChange,
  onSpecChange,
}: {
  entries: NotebookEntry[];
  typeOptions: DbReason[];
  specialties: string[];
  typeFilter: TypeFilter;
  specFilter: string | null;
  onTypeChange: (t: TypeFilter) => void;
  onSpecChange: (s: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {/* Type chips */}
      <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
        <span className="shrink-0 text-overline font-bold uppercase tracking-wider text-muted-foreground w-[44px]">
          Tipo
        </span>
        <div
          role="radiogroup"
          aria-label="Filtrar por tipo de erro"
          className="flex items-center gap-1.5"
        >
          <FilterChip
            label="Todos"
            count={entries.length}
            active={typeFilter === 'all'}
            onClick={() => onTypeChange('all')}
          />
          {typeOptions.map((type) => {
            const meta = getReasonMeta(type);
            const count = entries.filter((e) => e.reason === type).length;
            return (
              <FilterChip
                key={type}
                label={meta.badge}
                count={count}
                active={typeFilter === type}
                dotColor={meta.colorBase}
                activeColors={{
                  bg: meta.colorBg,
                  text: meta.colorText,
                  border: meta.colorBorder,
                }}
                onClick={() => onTypeChange(typeFilter === type ? 'all' : type)}
              />
            );
          })}
        </div>
      </div>

      {/* Specialty chips (only when multiple) */}
      {specialties.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]">
          <span className="shrink-0 text-overline font-bold uppercase tracking-wider text-muted-foreground w-[44px]">
            Área
          </span>
          <div
            role="radiogroup"
            aria-label="Filtrar por especialidade"
            className="flex items-center gap-1.5"
          >
            <FilterChip
              label="Todas"
              active={!specFilter}
              onClick={() => onSpecChange(null)}
              variant="subtle"
            />
            {specialties.map((s) => (
              <FilterChip
                key={s}
                label={s}
                active={specFilter === s}
                onClick={() => onSpecChange(specFilter === s ? null : s)}
                variant="subtle"
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
