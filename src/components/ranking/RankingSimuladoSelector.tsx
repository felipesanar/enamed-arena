import React from 'react';
import { cn } from '@/lib/utils';
import { groupSimuladosByEdition } from '@/lib/edition-groups';
import { formatSimuladoLabel } from '@/lib/editions';
import type { SimuladoConfig } from '@/types';

interface Props {
  simuladosWithResults: Array<{ id: string; title: string; sequence_number: number } & Pick<SimuladoConfig, 'editionId' | 'editionCode' | 'editionLabel'>>;
  selectedSimuladoId: string | null;
  setSelectedSimuladoId: (id: string) => void;
  editionsUi?: boolean;
}

export function RankingSimuladoSelector({
  simuladosWithResults,
  selectedSimuladoId,
  setSelectedSimuladoId,
  editionsUi = false,
}: Props) {
  if (simuladosWithResults.length <= 1) return null;

  if (editionsUi) return (
    <label className="block mb-5 text-caption text-muted-foreground">
      Escolher simulado do ranking
      <select value={selectedSimuladoId ?? ''} onChange={event => setSelectedSimuladoId(event.target.value)}
        className="mt-1 block w-full min-h-11 rounded-xl border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        {!selectedSimuladoId && <option value="" disabled>Escolha um simulado</option>}
        {groupSimuladosByEdition(simuladosWithResults).map(group => <optgroup key={group.key} label={group.label}>
          {group.items.map(sim => <option key={sim.id} value={sim.id}>
            {formatSimuladoLabel({ ...sim, sequenceNumber: sim.sequence_number })}
          </option>)}
        </optgroup>)}
      </select>
    </label>
  );

  return (
    <div className="relative mb-5 after:absolute after:right-0 after:top-0 after:h-[calc(100%-8px)] after:w-10 after:bg-gradient-to-l after:from-[hsl(var(--background)/0.95)] after:to-transparent after:pointer-events-none after:content-['']">
      <div className="flex gap-2 overflow-x-auto pb-2 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden scroll-smooth">
      {simuladosWithResults.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => setSelectedSimuladoId(s.id)}
          className={cn(
            'px-4 py-2 rounded-xl text-sm font-medium transition-all whitespace-nowrap shrink-0',
            s.id === selectedSimuladoId
              ? 'bg-primary text-white'
              : 'bg-muted text-muted-foreground border border-border hover:bg-accent',
          )}
        >
          {s.title}
        </button>
      ))}
      </div>
    </div>
  );
}
