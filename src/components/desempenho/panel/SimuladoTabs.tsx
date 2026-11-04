import { cn } from '@/lib/utils';
import { useAppConfig } from '@/hooks/useAppConfig';
import { groupSimuladosByEdition } from '@/lib/edition-groups';
import { formatSimuladoLabel } from '@/lib/editions';
import type { SimuladoConfig } from '@/types';

export function SimuladoTabs({
  simulados,
  selectedId,
  onSelect,
}: {
  simulados: Array<{ id: string; title: string } & Partial<Pick<SimuladoConfig, 'sequenceNumber' | 'editionId' | 'editionCode' | 'editionLabel'>>>;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const editionsUi = useAppConfig('editions_ui');
  if (editionsUi) return (
    <label className="block text-caption text-muted-foreground">
      Escolher simulado
      <select value={selectedId ?? ''} onChange={event => onSelect(event.target.value)}
        className="mt-1 block w-full min-h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {!selectedId && <option value="" disabled>Escolha um simulado</option>}
        {groupSimuladosByEdition(simulados).map(group => <optgroup key={group.key} label={group.label}>
          {group.items.map(sim => <option key={sim.id} value={sim.id}>
            {sim.sequenceNumber != null ? formatSimuladoLabel({ ...sim, sequenceNumber: sim.sequenceNumber }) : sim.title}
          </option>)}
        </optgroup>)}
      </select>
    </label>
  );
  return (
    <div
      role="tablist"
      aria-label="Escolher simulado"
      className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
    >
      {simulados.map((s) => {
        const active = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(s.id)}
            title={s.title}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition-all duration-150',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active
                ? 'border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)]'
                : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground',
            )}
          >
            {s.title.length > 32 ? `${s.title.slice(0, 32)}…` : s.title}
          </button>
        );
      })}
    </div>
  );
}
