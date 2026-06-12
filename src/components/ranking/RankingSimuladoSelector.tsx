import React from 'react';
import { cn } from '@/lib/utils';

interface Props {
  simuladosWithResults: Array<{ id: string; title: string; sequence_number: number }>;
  selectedSimuladoId: string | null;
  setSelectedSimuladoId: (id: string) => void;
}

export function RankingSimuladoSelector({
  simuladosWithResults,
  selectedSimuladoId,
  setSelectedSimuladoId,
}: Props) {
  if (simuladosWithResults.length <= 1) return null;

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
