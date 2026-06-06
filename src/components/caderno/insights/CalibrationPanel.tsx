/**
 * CalibrationPanel — Painel de Calibração de Confiança do Caderno de Erros v2.
 *
 * Exibe confiança declarada vs acerto real por nível (baixa / média / alta),
 * permitindo ao aluno avaliar sua metacognição:
 *   - Bem calibrado: acerto sobe com a confiança.
 *   - Overconfidence: marcou "alta" mas errou muito (alta_but_wrong).
 *   - Underconfidence: marcou "baixa" mas acertou muito (baixa_but_correct).
 *
 * Estado sem dados: exibe mensagem orientando o aluno a responder simulados
 * informando sua confiança.
 *
 * Rastreia `caderno_calibration_viewed` via IntersectionObserver.
 */

import { useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
  ReferenceLine,
} from 'recharts';
import { Brain, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';
import {
  getChartSemanticColors,
  getChartTickStyle,
  getChartGridProps,
  getChartTooltipContentStyle,
} from '@/lib/chartTheme';
import {
  Tooltip as UiTooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
import type { ConfidenceCalibration, ConfidenceCalibrationBucket } from '@/types/caderno';

// ─── Helpers ───

const CONFIDENCE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

/** Ordena os buckets na sequência pedagógica: baixa → media → alta. */
const CONFIDENCE_ORDER: Record<string, number> = { baixa: 0, media: 1, alta: 2 };

function sortBuckets(buckets: ConfidenceCalibrationBucket[]): ConfidenceCalibrationBucket[] {
  return [...buckets].sort(
    (a, b) => (CONFIDENCE_ORDER[a.confidence] ?? 99) - (CONFIDENCE_ORDER[b.confidence] ?? 99),
  );
}

/** Cor da barra por nível de confiança (semântica: success / warning / destructive-ish). */
function barColor(confidence: string, accuracy: number | null): string {
  if (accuracy == null) return 'hsl(var(--muted-foreground) / 0.4)';
  if (confidence === 'alta' && accuracy < 0.5) return 'hsl(var(--destructive))';
  if (confidence === 'baixa' && accuracy > 0.6) return 'hsl(var(--warning))';
  return 'hsl(var(--success))';
}

function toPercent(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

// ─── CustomTooltip ───

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ConfidenceCalibrationBucket & { accuracyPct: number | null };
  return (
    <div
      style={getChartTooltipContentStyle()}
      className="rounded-xl border border-border px-3 py-2 text-[12px] space-y-1"
      role="tooltip"
    >
      <p className="font-bold text-foreground">
        Confiança {CONFIDENCE_LABEL[d.confidence] ?? d.confidence}
      </p>
      <p className="text-muted-foreground">
        Acerto: <span className="font-semibold text-foreground">{toPercent(d.accuracy)}</span>
      </p>
      <p className="text-muted-foreground">
        Respondidas: <span className="font-semibold text-foreground">{d.total}</span>
      </p>
      <p className="text-muted-foreground">
        Corretas: <span className="font-semibold text-foreground">{d.correct}</span>
      </p>
    </div>
  );
}

// ─── CalibrationInsights ───

interface CalibrationInsightsProps {
  overall: ConfidenceCalibration['overall'];
  buckets: ConfidenceCalibrationBucket[];
}

function CalibrationInsights({ overall, buckets }: CalibrationInsightsProps) {
  const sorted = sortBuckets(buckets);
  const baixaBucket = sorted.find((b) => b.confidence === 'baixa');
  const altaBucket = sorted.find((b) => b.confidence === 'alta');

  // Detectar tendências
  const isWellCalibrated =
    sorted.length === 3 &&
    sorted.every((b, i) => {
      if (i === 0) return true;
      const prev = sorted[i - 1];
      return (b.accuracy ?? 0) >= (prev.accuracy ?? 0);
    });

  const hasOverconfidence =
    overall.alta_but_wrong > 0 &&
    altaBucket != null &&
    altaBucket.total > 0 &&
    overall.alta_but_wrong / altaBucket.total > 0.4;

  const hasUnderconfidence =
    overall.baixa_but_correct > 0 &&
    baixaBucket != null &&
    baixaBucket.total > 0 &&
    overall.baixa_but_correct / baixaBucket.total > 0.4;

  if (!hasOverconfidence && !hasUnderconfidence && !isWellCalibrated) return null;

  return (
    <div className="space-y-2">
      {isWellCalibrated && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl bg-success/10 border border-success/20 px-3 py-2.5 text-caption text-success"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            ✓
          </span>
          <span>
            <strong>Bem calibrado!</strong> Seu acerto sobe junto com a confiança declarada —
            sinal de boa metacognição.
          </span>
        </div>
      )}

      {hasOverconfidence && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-caption text-destructive"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            ⚠
          </span>
          <span>
            <strong>Overconfidence detectada.</strong> Você declarou confiança "alta" em{' '}
            {overall.alta_but_wrong} questões que errou. Revise esses temas com atenção.
          </span>
        </div>
      )}

      {hasUnderconfidence && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-xl bg-warning/10 border border-warning/20 px-3 py-2.5 text-caption text-warning"
        >
          <span className="mt-0.5 shrink-0" aria-hidden>
            💡
          </span>
          <span>
            <strong>Underconfidence detectada.</strong> Você acertou {overall.baixa_but_correct}{' '}
            questões onde declarou confiança "baixa" — talvez domine mais do que imagina!
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Props ───

interface CalibrationPanelProps {
  data: ConfidenceCalibration | null;
  loading: boolean;
}

// ─── Component ───

export function CalibrationPanel({ data, loading }: CalibrationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const tracked = useRef(false);

  const chartColors = getChartSemanticColors();

  // IntersectionObserver → caderno_calibration_viewed
  useEffect(() => {
    if (!panelRef.current || tracked.current || loading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !tracked.current) {
          tracked.current = true;
          trackEvent('caderno_calibration_viewed', {
            has_data: !!(data && data.buckets.length > 0),
            total_answered_with_confidence: data?.overall.total_answered_with_confidence ?? 0,
            alta_but_wrong: data?.overall.alta_but_wrong ?? 0,
            baixa_but_correct: data?.overall.baixa_but_correct ?? 0,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [loading, data]);

  // ─── Skeleton ───
  if (loading) {
    return (
      <section aria-label="Painel de calibração — carregando" className="space-y-4">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-[200px] w-full rounded-2xl" />
        <Skeleton className="h-16 w-full rounded-2xl" />
      </section>
    );
  }

  const sortedBuckets = sortBuckets(data?.buckets ?? []);
  const hasData = sortedBuckets.length > 0 && sortedBuckets.some((b) => b.total > 0);

  // Chart data: add accuracyPct (0–100) for axis display
  const chartData = sortedBuckets.map((b) => ({
    ...b,
    label: CONFIDENCE_LABEL[b.confidence] ?? b.confidence,
    accuracyPct: b.accuracy != null ? Math.round(b.accuracy * 100) : null,
  }));

  return (
    <section
      ref={panelRef}
      aria-label="Painel de calibração de confiança"
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary shrink-0" aria-hidden />
          <h2 className="text-heading-3 font-bold text-foreground">
            Calibração de Confiança
          </h2>
        </div>
        <UiTooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="O que é calibração de confiança?"
              className={cn(
                'inline-flex items-center justify-center w-7 h-7 rounded-lg',
                'text-muted-foreground hover:bg-muted hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors',
              )}
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left" className="max-w-[240px]">
            Calibração mede se sua confiança declarada condiz com seu desempenho real. Ideal:
            acerto sobe de "baixa" para "alta".
          </TooltipContent>
        </UiTooltip>
      </div>

      {/* Explicação pedagógica */}
      <p className="text-caption text-muted-foreground leading-relaxed">
        Metacognição é saber o que você sabe. Aqui comparamos sua{' '}
        <strong className="text-foreground">confiança declarada</strong> (baixa / média / alta)
        com seu <strong className="text-foreground">acerto real</strong>. Quando as barras sobem
        da esquerda para a direita, você está bem calibrado.
      </p>

      {/* Estado sem dados */}
      {!hasData ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center space-y-2">
          <p className="text-body font-medium text-foreground">Sem dados de calibração ainda</p>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Responda simulados informando sua confiança em cada questão para ver como sua
            autopercepção se compara ao seu acerto real.
          </p>
        </div>
      ) : (
        <>
          {/* Gráfico de barras */}
          <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
            <p className="text-body-sm font-semibold text-foreground mb-1">
              Acerto por nível de confiança
            </p>
            <p className="text-caption text-muted-foreground mb-4">
              Porcentagem de acerto para cada nível declarado
            </p>
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                  barCategoryGap="30%"
                >
                  <CartesianGrid {...getChartGridProps()} />
                  <XAxis dataKey="label" tick={getChartTickStyle()} />
                  <YAxis
                    domain={[0, 100]}
                    tick={getChartTickStyle()}
                    tickFormatter={(v) => `${v}%`}
                  />
                  {/* Linha de referência em 50% */}
                  <ReferenceLine
                    y={50}
                    stroke={chartColors.muted}
                    strokeDasharray="4 3"
                    label={{
                      value: '50%',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: chartColors.muted,
                    }}
                  />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: 'hsl(var(--muted)/0.3)' }} />
                  <Bar dataKey="accuracyPct" name="Acerto" radius={[6, 6, 0, 0]} maxBarSize={64}>
                    {chartData.map((entry) => (
                      <Cell
                        key={entry.confidence}
                        fill={barColor(entry.confidence, entry.accuracy)}
                        aria-label={`${CONFIDENCE_LABEL[entry.confidence]}: ${toPercent(entry.accuracy)}`}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Tabela resumo */}
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <p className="text-body-sm font-semibold text-foreground">Resumo por nível</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px]">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Confiança
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Respondidas
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Corretas
                    </th>
                    <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Acerto
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedBuckets.map((b) => (
                    <tr
                      key={b.confidence}
                      className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="px-4 py-2.5 text-[13px] font-medium text-foreground">
                        {CONFIDENCE_LABEL[b.confidence] ?? b.confidence}
                      </td>
                      <td className="px-4 py-2.5 text-center text-caption tabular-nums text-muted-foreground">
                        {b.total}
                      </td>
                      <td className="px-4 py-2.5 text-center text-caption tabular-nums text-muted-foreground">
                        {b.correct}
                      </td>
                      <td className="px-4 py-2.5 text-center text-caption tabular-nums font-semibold">
                        {b.accuracy != null ? (
                          <span
                            className={cn(
                              b.accuracy >= 0.6 ? 'text-success' : 'text-destructive',
                            )}
                          >
                            {toPercent(b.accuracy)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Insights de calibração */}
          {data && (
            <CalibrationInsights overall={data.overall} buckets={sortedBuckets} />
          )}
        </>
      )}
    </section>
  );
}
