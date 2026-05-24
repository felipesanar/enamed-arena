import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

interface Props {
  entries: ComparativeEntryRich[]; // sorted asc by sequenceNumber
}

/**
 * Linha de KPIs no topo do Comparativo: Simulados / Último score / Média / Variação.
 * Ocupa a largura toda em desktop — fica acima do Prof. Sanor + chart.
 */
export function ComparativoKpiRow({ entries }: Props) {
  if (entries.length === 0) return null;

  const last = entries[entries.length - 1];
  const first = entries[0];
  const delta = last.percentageScore - first.percentageScore;
  const trend = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const avg = Math.round(entries.reduce((a, e) => a + e.percentageScore, 0) / entries.length);

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor =
    trend === 'up' ? 'text-success' : trend === 'down' ? 'text-destructive' : 'text-muted-foreground';
  const trendBg =
    trend === 'up' ? 'bg-success/10' : trend === 'down' ? 'bg-destructive/10' : 'bg-muted';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
      <div className="rounded-2xl bg-card border border-border px-4 py-3">
        <p className="text-caption text-muted-foreground mb-1">Simulados</p>
        <p className="text-heading-2 tabular-nums text-foreground leading-none">
          {entries.length}
        </p>
      </div>
      <div className="rounded-2xl bg-card border border-border px-4 py-3">
        <p className="text-caption text-muted-foreground mb-1">Último score</p>
        <p className="text-heading-2 tabular-nums text-foreground leading-none">
          {last.percentageScore}
          <span className="text-body text-muted-foreground ml-0.5">%</span>
        </p>
      </div>
      <div className="rounded-2xl bg-card border border-border px-4 py-3">
        <p className="text-caption text-muted-foreground mb-1">Média</p>
        <p className="text-heading-2 tabular-nums text-foreground leading-none">
          {avg}
          <span className="text-body text-muted-foreground ml-0.5">%</span>
        </p>
      </div>
      <div
        className={cn('rounded-2xl border px-4 py-3', trendBg, 'border-transparent')}
        title="pp = pontos percentuais. Diferença bruta entre o score do primeiro e do último simulado."
      >
        <p className="text-caption text-muted-foreground mb-1">Variação</p>
        <div className="flex items-center gap-1.5">
          <TrendIcon className={cn('h-4 w-4 shrink-0', trendColor)} />
          <p className={cn('text-heading-2 tabular-nums leading-none', trendColor)}>
            {delta >= 0 ? '+' : ''}{delta}
            <span className="text-body ml-0.5">pp</span>
          </p>
        </div>
      </div>
    </div>
  );
}
