import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  setCutoffModalOpen: (open: boolean) => void;
}

export function RankingLowConfidenceBanner({ setCutoffModalOpen }: Props) {
  return (
    <div className="flex items-start gap-3 mb-4 rounded-xl border border-warning/30 bg-warning/10 px-3.5 py-3">
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" aria-hidden />
      <p className="text-xs leading-relaxed text-muted-foreground">
        <strong className="text-foreground">Poucos candidatos nesse recorte</strong> — com menos de 30 inscritos, esses dados podem não ser estatisticamente representativos.{' '}
        Nesse caso, o dado mais valioso é a{' '}
        <button
          type="button"
          onClick={() => setCutoffModalOpen(true)}
          className="underline underline-offset-2 transition-colors font-semibold text-warning"
        >
          nota de corte do ano passado →
        </button>
      </p>
    </div>
  );
}
