/**
 * CalibrationPanel — Painel de Calibração de Confiança do Caderno de Erros v2.
 *
 * Exibe confiança declarada vs acerto real por nível (baixa / média / alta),
 * permitindo ao aluno avaliar sua metacognição:
 *   - Bem calibrado: acerto sobe com a confiança.
 *   - Overconfidence: marcou "alta" mas errou muito.
 *   - Underconfidence: marcou "baixa" mas acertou muito.
 *
 * Rastreia `caderno_calibration_viewed` via IntersectionObserver.
 *
 * Design: clínico premium — gráfico com cores semânticas, tooltip custom,
 * tabela resumo com CadernoCard, insights de calibração com banners sutis.
 */

import { useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
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
import { CadernoCard, SectionHeader, SkeletonLine } from '@/components/caderno/ui';
import type { ConfidenceCalibration, ConfidenceCalibrationBucket } from '@/types/caderno';

// ─── Helpers ───

const CONFIDENCE_LABEL: Record<string, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
};

const CONFIDENCE_ORDER: Record<string, number> = { baixa: 0, media: 1, alta: 2 };

function sortBuckets(buckets: ConfidenceCalibrationBucket[]): ConfidenceCalibrationBucket[] {
  return [...buckets].sort(
    (a, b) => (CONFIDENCE_ORDER[a.confidence] ?? 99) - (CONFIDENCE_ORDER[b.confidence] ?? 99),
  );
}

function barColor(confidence: string, accuracy: number | null): string {
  if (accuracy == null) return 'hsl(var(--muted-foreground) / 0.3)';
  if (confidence === 'alta' && accuracy < 0.5) return 'hsl(var(--destructive))';
  if (confidence === 'baixa' && accuracy > 0.6) return 'hsl(var(--warning))';
  return 'hsl(var(--success))';
}

function toPercent(v: number | null): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

// ─── Custom Tooltip ───

function CalibrationTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as ConfidenceCalibrationBucket & { accuracyPct: number | null };
  return (
    <div
      style={getChartTooltipContentStyle()}
      className="rounded-xl px-3 py-2 text-[12px] space-y-1"
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

  const isWellCalibrated =
    sorted.length === 3 &&
    sorted.every((b) => b.total > 0) &&
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
    <div className="space-y-2.5">
      {isWellCalibrated && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-xl',
            'bg-success/[0.08] border border-success/25',
            'px-4 py-3 text-caption',
          )}
        >
          <span className="mt-0.5 shrink-0 text-success font-bold" aria-hidden>✓</span>
          <span className="text-success">
            <strong className="font-bold">Mandou bem!</strong> Seu acerto cresce junto com a
            sua confiança. Você se conhece bem.
          </span>
        </div>
      )}

      {hasOverconfidence && (
        <div
          role="alert"
          className={cn(
            'flex items-start gap-3 rounded-xl',
            'bg-destructive/[0.07] border border-destructive/20',
            'px-4 py-3 text-caption',
          )}
        >
          <span className="mt-0.5 shrink-0 text-destructive" aria-hidden>⚠</span>
          <span className="text-destructive">
            <strong className="font-bold">Confiança alta demais.</strong>{' '}
            Você marcou confiança "alta" em {overall.alta_but_wrong} questões que errou.
            Revise esses temas com atenção.
          </span>
        </div>
      )}

      {hasUnderconfidence && (
        <div
          role="status"
          className={cn(
            'flex items-start gap-3 rounded-xl',
            'bg-warning/[0.08] border border-warning/20',
            'px-4 py-3 text-caption',
          )}
        >
          <span className="mt-0.5 shrink-0 text-warning" aria-hidden>💡</span>
          <span className="text-warning">
            <strong className="font-bold">Você se subestima.</strong>{' '}
            Acertou {overall.baixa_but_correct} questões em que marcou confiança "baixa".
            Você sabe mais do que pensa!
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

// ─── Skeleton ───

function CalibrationSkeleton() {
  return (
    <section aria-label="Painel de calibração — carregando" className="space-y-4">
      <SkeletonLine className="h-5 w-56" />
      <SkeletonLine className="h-[200px] w-full rounded-[var(--c-radius-card)]" />
      <SkeletonLine className="h-20 w-full rounded-[var(--c-radius-card)]" />
    </section>
  );
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

  if (loading) return <CalibrationSkeleton />;

  const sortedBuckets = sortBuckets(data?.buckets ?? []);
  const hasData = sortedBuckets.length > 0 && sortedBuckets.some((b) => b.total > 0);

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
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center h-8 w-8 rounded-[10px] bg-primary/10 text-primary"
            aria-hidden
          >
            <Brain className="h-4 w-4" />
          </span>
          <SectionHeader
            title="Calibração de Confiança"
            className="m-0 p-0 border-0"
          />
        </div>

        <UiTooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="O que é calibração de confiança?"
              className={cn(
                'inline-flex items-center justify-center h-8 w-8 rounded-lg',
                'text-muted-foreground transition-colors duration-150',
                'hover:bg-[var(--c-surface-2)] hover:text-foreground',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
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

      {/* ── Explicação pedagógica ── */}
      <p className="text-caption text-muted-foreground leading-relaxed">
        Saber o que você realmente sabe faz diferença. Comparamos a{' '}
        <strong className="font-semibold text-foreground">confiança que você declarou</strong>{' '}
        (baixa, média, alta) com seu{' '}
        <strong className="font-semibold text-foreground">acerto de verdade</strong>. Barras
        subindo da esquerda para a direita querem dizer que você se conhece bem.
      </p>

      {/* ── Estado sem dados ── */}
      {!hasData ? (
        <CadernoCard className="px-6 py-10 text-center space-y-2">
          <p className="text-body font-semibold text-foreground">Sem dados de calibração ainda</p>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Responda simulados informando sua confiança em cada questão para ver como sua
            autopercepção se compara ao seu acerto real.
          </p>
        </CadernoCard>
      ) : (
        <>
          {/* ── Gráfico de barras ── */}
          <CadernoCard className="p-4 md:p-5">
            <p className="text-[13px] font-semibold text-foreground mb-0.5">
              Acerto por nível de confiança
            </p>
            <p className="text-caption text-muted-foreground mb-4">
              Porcentagem de acerto para cada nível declarado
            </p>
            <div className="h-[160px] md:h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartData}
                  margin={{ top: 8, right: 12, left: -8, bottom: 4 }}
                  barCategoryGap="28%"
                >
                  <CartesianGrid {...getChartGridProps()} />
                  <XAxis dataKey="label" tick={getChartTickStyle()} tickLine={false} axisLine={false} />
                  <YAxis
                    domain={[0, 100]}
                    tick={getChartTickStyle()}
                    tickFormatter={(v) => `${v}%`}
                    tickLine={false}
                    axisLine={false}
                  />
                  <ReferenceLine
                    y={50}
                    stroke={chartColors.muted}
                    strokeDasharray="4 3"
                    strokeOpacity={0.5}
                    label={{
                      value: '50%',
                      position: 'insideTopRight',
                      fontSize: 10,
                      fill: chartColors.muted,
                    }}
                  />
                  <RechartsTooltip
                    content={<CalibrationTooltip />}
                    cursor={{ fill: 'hsl(var(--muted)/0.2)' }}
                  />
                  <Bar dataKey="accuracyPct" name="Acerto" radius={[6, 6, 0, 0]} maxBarSize={72}>
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
          </CadernoCard>

          {/* ── Tabela resumo ── */}
          <CadernoCard className="overflow-hidden p-0">
            <div className="px-4 py-3 border-b border-border bg-[color-mix(in_srgb,var(--c-surface-2)_50%,transparent)]">
              <p className="text-[13px] font-semibold text-foreground">Resumo por nível</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[320px]">
                <thead>
                  <tr className="border-b border-border/60 bg-[color-mix(in_srgb,var(--c-surface-2)_40%,transparent)]">
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
                      className="border-b border-border/50 last:border-0 hover:bg-[var(--c-surface-2)] transition-colors duration-100"
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
          </CadernoCard>

          {/* ── Insights de calibração ── */}
          {data && (
            <CalibrationInsights overall={data.overall} buckets={sortedBuckets} />
          )}
        </>
      )}
    </section>
  );
}
