import React from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  bannerText: string;
  text1: string;
  setCutoffModalOpen: (open: boolean) => void;
}

export function RankingLowConfidenceBanner({ bannerText, text1, setCutoffModalOpen }: Props) {
  return (
    <div
      className="flex items-start gap-3 mb-4 rounded-[13px]"
      style={{
        padding: '11px 13px',
        background: 'rgba(251,146,60,0.07)',
        border: '1px solid rgba(251,146,60,0.22)',
      }}
    >
      <AlertTriangle
        className="h-4 w-4 mt-0.5 shrink-0"
        style={{ color: '#fb923c' }}
        aria-hidden
      />
      <p className="text-xs leading-relaxed" style={{ color: bannerText }}>
        <strong style={{ color: text1 }}>Poucos candidatos nesse recorte</strong> — com menos de 30 inscritos, esses dados podem não ser estatisticamente representativos.{' '}
        Nesse caso, o dado mais valioso é a{' '}
        <button
          type="button"
          onClick={() => setCutoffModalOpen(true)}
          className="underline underline-offset-2 transition-colors font-semibold"
          style={{ color: '#fb923c' }}
        >
          nota de corte do ano passado →
        </button>
      </p>
    </div>
  );
}
