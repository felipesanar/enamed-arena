import { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceArea,
} from 'recharts';
import { MousePointerClick } from 'lucide-react';
import { PremiumCard } from '@/components/PremiumCard';
import {
  CHART_COLORS, chartTickStyle, chartGridProps, chartTooltipContentStyle,
} from '@/lib/chartTheme';
import { SimuladoSnapshotDrawer } from './SimuladoSnapshotDrawer';
import type { ComparativeEntryRich, SimuladoSlot } from '@/hooks/useComparativeData';

interface Props {
  entries: ComparativeEntryRich[];
  /** Todos os simulados publicados (pra mostrar slots futuros vazios no eixo X) */
  allSlots: SimuladoSlot[];
  /** Nota de corte / meta de referência (default 50%) */
  goalScore?: number;
}

export function ComparativoEvolutionChart({ entries, allSlots, goalScore = 50 }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);

  // Dados pra Recharts: 1 ponto por simulado da plataforma.
  // Quando o aluno não fez aquele simulado, score = null → Recharts pula
  // (com connectNulls=false a linha não atravessa o gap futuro).
  const data = useMemo(
    () => allSlots.map(slot => ({
      name: `#${slot.sequenceNumber}`,
      score: slot.score,
      simuladoId: slot.simuladoId,
      title: slot.title,
      done: slot.score != null,
    })),
    [allSlots],
  );

  const completedScores = entries.map(e => e.percentageScore);
  const avg = completedScores.length > 0
    ? Math.round(completedScores.reduce((a, b) => a + b, 0) / completedScores.length)
    : 0;
  const maxScore = completedScores.length > 0 ? Math.max(...completedScores) : 0;
  const yMax = Math.min(100, Math.max(maxScore + 15, goalScore + 15, 60));
  const yMin = 0;

  const selectedEntry = entries.find(e => e.simuladoId === openId) ?? null;

  return (
    <>
      <PremiumCard className="p-5 md:p-6">
        <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
          <div className="min-w-0">
            <p className="text-heading-3 text-foreground">Evolução do score</p>
            <p className="text-caption text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <MousePointerClick className="h-3 w-3" />
              Clique em um ponto para abrir o resumo
            </p>
          </div>
          <div className="flex items-center gap-3 lg:gap-4 text-caption flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded-full bg-primary" />
              <span className="text-muted-foreground">Score</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-0.5 w-3 bg-muted-foreground/60" />
              <span className="text-muted-foreground">Média {avg}%</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded bg-success/20" />
              <span className="text-muted-foreground">Meta {goalScore}%+</span>
            </div>
          </div>
        </div>

        <div className="h-[300px] md:h-[360px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid {...chartGridProps} />
              <XAxis dataKey="name" tick={chartTickStyle} />
              <YAxis domain={[yMin, yMax]} tick={chartTickStyle} />

              {/* Faixa de meta */}
              <ReferenceArea
                y1={goalScore}
                y2={yMax}
                fill={CHART_COLORS.success ?? '#10B981'}
                fillOpacity={0.06}
                stroke="none"
              />

              {/* Linha de média */}
              <ReferenceLine
                y={avg}
                stroke="hsl(var(--muted-foreground))"
                strokeDasharray="4 4"
                strokeOpacity={0.5}
                label={{
                  value: `Média ${avg}%`,
                  position: 'right',
                  fill: 'hsl(var(--muted-foreground))',
                  fontSize: 11,
                }}
              />

              <Tooltip
                contentStyle={chartTooltipContentStyle}
                formatter={(v: number) => [`${v}%`, 'Score']}
                labelFormatter={(label, payload) => {
                  const p = payload?.[0]?.payload;
                  return p?.title ? `${label} · ${p.title}` : label;
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke={CHART_COLORS.primary}
                strokeWidth={3}
                // Não atravessa nulls — linha para no último simulado feito
                connectNulls={false}
                isAnimationActive={false}
                dot={(props: { cx?: number; cy?: number; payload?: { done?: boolean; simuladoId?: string } }) => {
                  const { cx, cy, payload } = props;
                  if (cx == null || cy == null || !payload) return <g />;
                  if (payload.done) {
                    // Ponto cheio onde aluno já fez
                    return (
                      <circle
                        cx={cx}
                        cy={cy}
                        r={6}
                        fill={CHART_COLORS.primary}
                        stroke="#fff"
                        strokeWidth={2}
                        style={{ cursor: 'pointer' }}
                      />
                    );
                  }
                  // Slot futuro: ponto oco/cinza no eixo X (em y=0 já que score=null não renderiza)
                  return <g />;
                }}
                activeDot={{
                  r: 9,
                  style: { cursor: 'pointer' },
                  onClick: (_e, payload) => {
                    // recharts injects payload as the dot's payload
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const id = (payload as any)?.payload?.simuladoId;
                    if (id) setOpenId(id);
                  },
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      <SimuladoSnapshotDrawer
        open={!!openId}
        onOpenChange={open => !open && setOpenId(null)}
        entry={selectedEntry}
      />
    </>
  );
}
