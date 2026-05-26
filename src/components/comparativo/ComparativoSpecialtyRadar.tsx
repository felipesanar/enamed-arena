import { useMemo } from 'react';
import {
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend, Tooltip,
} from 'recharts';
import { TrendingUp, TrendingDown, Equal } from 'lucide-react';
import { PremiumCard } from '@/components/PremiumCard';
import { cn } from '@/lib/utils';
import { CHART_COLORS, getChartTooltipContentStyle } from '@/lib/chartTheme';
import type { ComparativeEntryRich } from '@/hooks/useComparativeData';

interface AreaListItem {
  area: string;
  firstScore: number | null;
  lastScore: number | null;
  delta: number | null;
}

/**
 * Lista agrupada por direção (subiu / caiu / estável).
 * Pensada para leitura instantânea — você bate o olho e sabe o que importa.
 */
function AreaGroupedList({
  entries,
  areaList,
}: {
  entries: ComparativeEntryRich[];
  areaList: AreaListItem[];
}) {
  const firstNum = entries[0].sequenceNumber;
  const lastNum = entries[entries.length - 1].sequenceNumber;

  const rising = areaList.filter(a => (a.delta ?? 0) > 0).sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0));
  const falling = areaList.filter(a => (a.delta ?? 0) < 0).sort((a, b) => (a.delta ?? 0) - (b.delta ?? 0));
  const stable = areaList.filter(a => a.delta === 0);
  const noData = areaList.filter(a => a.delta == null);

  return (
    <div className="space-y-5">
      {falling.length > 0 && (
        <AreaGroup
          title="Atenção"
          subtitle={falling.length === 1 ? '1 área caiu' : `${falling.length} áreas caíram`}
          variant="negative"
          items={falling}
          firstNum={firstNum}
          lastNum={lastNum}
        />
      )}
      {rising.length > 0 && (
        <AreaGroup
          title="Você cresceu"
          subtitle={rising.length === 1 ? '1 área subiu' : `${rising.length} áreas subiram`}
          variant="positive"
          items={rising}
          firstNum={firstNum}
          lastNum={lastNum}
        />
      )}
      {stable.length > 0 && (
        <AreaGroup
          title="Estável"
          subtitle="manteve o mesmo nível"
          variant="neutral"
          items={stable}
          firstNum={firstNum}
          lastNum={lastNum}
        />
      )}
      {noData.length > 0 && (
        <AreaGroup
          title="Sem dado comparável"
          subtitle="área apareceu em só um dos simulados"
          variant="empty"
          items={noData}
          firstNum={firstNum}
          lastNum={lastNum}
        />
      )}
    </div>
  );
}

const VARIANT: Record<'positive' | 'negative' | 'neutral' | 'empty', {
  badgeBg: string;
  text: string;
  ring: string;
  TrendIcon: typeof TrendingUp;
  barFill: string;
}> = {
  positive: {
    badgeBg: 'bg-success/10',
    text: 'text-success',
    ring: 'ring-success/15',
    TrendIcon: TrendingUp,
    barFill: 'bg-success',
  },
  negative: {
    badgeBg: 'bg-destructive/10',
    text: 'text-destructive',
    ring: 'ring-destructive/15',
    TrendIcon: TrendingDown,
    barFill: 'bg-destructive',
  },
  neutral: {
    badgeBg: 'bg-muted',
    text: 'text-muted-foreground',
    ring: 'ring-border',
    TrendIcon: Equal,
    barFill: 'bg-primary',
  },
  empty: {
    badgeBg: 'bg-muted',
    text: 'text-muted-foreground',
    ring: 'ring-border',
    TrendIcon: Equal,
    barFill: 'bg-muted-foreground/40',
  },
};

function AreaGroup({
  title,
  subtitle,
  variant,
  items,
  firstNum,
  lastNum,
}: {
  title: string;
  subtitle: string;
  variant: 'positive' | 'negative' | 'neutral' | 'empty';
  items: AreaListItem[];
  firstNum: number;
  lastNum: number;
}) {
  const v = VARIANT[variant];
  const { TrendIcon } = v;
  return (
    <div>
      {/* Header do grupo */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className={cn('h-6 w-6 rounded-md flex items-center justify-center', v.badgeBg)}>
          <TrendIcon className={cn('h-3.5 w-3.5', v.text)} />
        </div>
        <p className="text-caption font-bold uppercase tracking-wider text-foreground">{title}</p>
        <span className="text-caption text-muted-foreground">· {subtitle}</span>
      </div>

      {/* Items */}
      <div className="space-y-2.5">
        {items.map(({ area, firstScore, lastScore, delta }) => (
          <AreaRow
            key={area}
            area={area}
            firstScore={firstScore}
            lastScore={lastScore}
            delta={delta}
            variant={variant}
            firstNum={firstNum}
            lastNum={lastNum}
          />
        ))}
      </div>
    </div>
  );
}

function AreaRow({
  area, firstScore, lastScore, delta, variant, firstNum, lastNum,
}: {
  area: string;
  firstScore: number | null;
  lastScore: number | null;
  delta: number | null;
  variant: 'positive' | 'negative' | 'neutral' | 'empty';
  firstNum: number;
  lastNum: number;
}) {
  const v = VARIANT[variant];

  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2.5 hover:bg-muted/30 transition-colors">
      {/* Linha 1: nome + delta protagonista */}
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="text-body-sm font-semibold text-foreground truncate">{area}</p>
        {delta != null ? (
          <span className={cn('text-body font-bold tabular-nums shrink-0', v.text)}>
            {delta > 0 ? '+' : ''}{delta}<span className="text-caption font-semibold ml-0.5 opacity-80">pp</span>
          </span>
        ) : (
          <span className="text-caption text-muted-foreground">—</span>
        )}
      </div>

      {/* Linha 2: barra única horizontal com 2 marcadores */}
      <div className="relative h-1.5 rounded-full bg-muted/60 overflow-visible">
        {/* Marcador #1 (cinza) */}
        {firstScore != null && (
          <div
            className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-3 rounded-full bg-muted-foreground/50 border-2 border-background shadow-sm"
            style={{ left: `${firstScore}%` }}
            aria-label={`Simulado #${firstNum}: ${firstScore}%`}
          />
        )}
        {/* Marcador #último (cor da variante) */}
        {lastScore != null && (
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3.5 w-3.5 rounded-full border-2 border-background shadow-sm z-10',
              v.barFill,
            )}
            style={{ left: `${lastScore}%` }}
            aria-label={`Simulado #${lastNum}: ${lastScore}%`}
          />
        )}
        {/* Linha conectora entre os dois marcadores */}
        {firstScore != null && lastScore != null && (
          <div
            className={cn('absolute top-1/2 -translate-y-1/2 h-0.5 rounded-full opacity-60', v.barFill)}
            style={{
              left: `${Math.min(firstScore, lastScore)}%`,
              width: `${Math.abs(lastScore - firstScore)}%`,
            }}
          />
        )}
      </div>

      {/* Linha 3: legenda compacta */}
      <div className="flex items-center justify-between text-caption text-muted-foreground mt-1.5 tabular-nums">
        <span>#{firstNum} <span className="text-foreground/70">{firstScore != null ? `${firstScore}%` : '—'}</span></span>
        <span>#{lastNum} <span className="text-foreground/70 font-semibold">{lastScore != null ? `${lastScore}%` : '—'}</span></span>
      </div>
    </div>
  );
}

interface Props {
  entries: ComparativeEntryRich[]; // sorted asc
}

// Paleta para múltiplas series do radar
const SERIES_COLORS = [
  CHART_COLORS.primary,
  '#7C3AED', // roxo
  '#0EA5E9', // ciano
  '#F59E0B', // âmbar
  '#10B981', // verde
];

export function ComparativoSpecialtyRadar({ entries }: Props) {
  const allAreas = useMemo(() => {
    const set = new Set<string>();
    entries.forEach(e => Object.keys(e.areaScores).forEach(a => set.add(a)));
    return Array.from(set).sort();
  }, [entries]);

  const radarData = useMemo(() => {
    return allAreas.map(area => {
      const row: Record<string, string | number> = { area };
      entries.forEach(e => {
        row[`#${e.sequenceNumber}`] = e.areaScores[area] ?? 0;
      });
      return row;
    });
  }, [allAreas, entries]);

  // Para a lista lateral: por área, com first/last/delta
  const areaList = useMemo(() => {
    const first = entries[0];
    const last = entries[entries.length - 1];
    return allAreas.map(area => {
      const fs = first.areaScores[area] ?? null;
      const ls = last.areaScores[area] ?? null;
      const delta = fs != null && ls != null ? ls - fs : null;
      return { area, firstScore: fs, lastScore: ls, delta };
    }).sort((a, b) => {
      // Maior queda primeiro (mais acionável), depois maior alta, depois 0/null
      const aD = a.delta == null ? Number.POSITIVE_INFINITY : a.delta;
      const bD = b.delta == null ? Number.POSITIVE_INFINITY : b.delta;
      return aD - bD;
    });
  }, [allAreas, entries]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* Radar à esquerda */}
      <PremiumCard className="p-4 md:p-5 lg:col-span-3">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-body font-semibold text-foreground">Performance por especialidade</p>
            <p className="text-caption text-muted-foreground">
              Sobreposição dos {entries.length} simulados
            </p>
          </div>
        </div>
        <div className="h-[340px] md:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="hsl(var(--border))" strokeOpacity={0.6} />
              <PolarAngleAxis
                dataKey="area"
                tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))', fontWeight: 500 }}
              />
              <PolarRadiusAxis
                domain={[0, 100]}
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                stroke="hsl(var(--border))"
                strokeOpacity={0.5}
              />
              {entries.map((e, i) => (
                <Radar
                  key={e.simuladoId}
                  name={`#${e.sequenceNumber} ${e.title}`}
                  dataKey={`#${e.sequenceNumber}`}
                  stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fill={SERIES_COLORS[i % SERIES_COLORS.length]}
                  fillOpacity={0.18}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              ))}
              <Tooltip contentStyle={getChartTooltipContentStyle()} formatter={(v: number) => `${v}%`} />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))', paddingTop: 8 }}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      {/* Lista agrupada subiu/caiu/estável */}
      <PremiumCard className="p-4 md:p-5 lg:col-span-2">
        <div className="mb-4">
          <p className="text-body font-semibold text-foreground">Onde você mudou</p>
          <p className="text-caption text-muted-foreground">
            Variação do primeiro pro último simulado
          </p>
        </div>

        <AreaGroupedList entries={entries} areaList={areaList} />
      </PremiumCard>
    </div>
  );
}
