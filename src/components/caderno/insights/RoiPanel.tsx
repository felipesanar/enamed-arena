/**
 * RoiPanel — Painel de ROI do Caderno de Erros v2.
 *
 * Consome getAreaScoreHistory para exibir:
 *   1. Sparkline de evolução global de score.
 *   2. Tabela por área com delta antes/depois de dominar questões.
 *   3. Estado vazio informativo.
 *
 * Rastreia caderno_roi_viewed (IntersectionObserver) e caderno_roi_area_expanded.
 *
 * Design: clínico premium — card com CadernoCard, gráfico recharts
 * estilizado com tokens wine/semânticos, tooltip custom, grid suave.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  ReferenceLine,
} from 'recharts';
import { TrendingUp, Info, ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
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

// ─── Types (shape do retorno de getAreaScoreHistory) ───

interface AttemptScore {
  attempt_id: string;
  finished_at: string;
  score: number;
  questions_total: number;
  questions_correct: number;
}

interface GlobalScore {
  attempt_id: string;
  finished_at: string;
  score_global: number;
}

interface AreaScoreHistory {
  by_area: Record<string, AttemptScore[]>;
  global: GlobalScore[];
}

// ─── Helpers ───

function toPercent(v: number) {
  return `${Math.round(v * 100)}%`;
}

function deltaLabel(delta: number) {
  const abs = Math.abs(Math.round(delta));
  return `${delta >= 0 ? '+' : '-'}${abs}pp`;
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
}

// ─── Custom Tooltip para sparkline ───

function SparklineTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as { name: string; score: number; date: string };
  return (
    <div
      style={getChartTooltipContentStyle()}
      className="rounded-xl px-3 py-2 text-[12px] space-y-0.5"
      role="tooltip"
    >
      <p className="font-bold text-foreground tabular-nums">{d.score}%</p>
      <p className="text-muted-foreground">{d.date}</p>
    </div>
  );
}

// ─── DeltaBadge ───

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) return <span className="text-muted-foreground/50 text-caption">—</span>;

  const abs = Math.abs(Math.round(delta));
  const label = `${delta >= 0 ? '+' : '-'}${abs}pp`;

  if (delta >= 5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-success text-caption font-bold tabular-nums">
        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
    );
  }
  if (delta < -5) {
    return (
      <span className="inline-flex items-center gap-0.5 text-destructive text-caption font-bold tabular-nums">
        <ArrowDownRight className="h-3.5 w-3.5" aria-hidden />
        {label}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-0.5 text-muted-foreground text-caption tabular-nums">
      <Minus className="h-3.5 w-3.5" aria-hidden />
      {label}
    </span>
  );
}

// ─── AreaRow ───

interface AreaRowProps {
  area: string;
  scoreBefore: number | null;
  scoreAfter: number | null;
  delta: number | null;
}

function AreaRow({ area, scoreBefore, scoreAfter, delta }: AreaRowProps) {
  function handleExpand() {
    trackEvent('caderno_roi_area_expanded', {
      area,
      delta_pp: delta ?? 0,
    });
  }

  return (
    <tr
      className="border-b border-border/50 last:border-0 hover:bg-[var(--c-surface-2)] transition-colors duration-100 cursor-default"
      onClick={handleExpand}
    >
      <td className="px-4 py-2.5 text-[13px] font-medium text-foreground">{area}</td>
      <td className="px-4 py-2.5 text-center text-caption tabular-nums text-muted-foreground">
        {scoreBefore != null ? toPercent(scoreBefore) : '—'}
      </td>
      <td className="px-4 py-2.5 text-center text-caption tabular-nums text-muted-foreground">
        {scoreAfter != null ? toPercent(scoreAfter) : '—'}
      </td>
      <td className="px-4 py-2.5 text-center">
        <DeltaBadge delta={delta} />
      </td>
    </tr>
  );
}

// ─── Props ───

interface RoiPanelProps {
  history: AreaScoreHistory | null;
  loading: boolean;
  /** Kept for API compatibility; no longer used internally. */
  roiInsights?: Array<{ data: Record<string, unknown> }>;
}

// ─── Skeleton ───

function RoiSkeleton() {
  return (
    <section aria-label="Painel de ROI — carregando" className="space-y-4">
      <SkeletonLine className="h-5 w-52" />
      <SkeletonLine className="h-[180px] w-full rounded-[var(--c-radius-card)]" />
      <SkeletonLine className="h-36 w-full rounded-[var(--c-radius-card)]" />
    </section>
  );
}

// ─── Component ───

export function RoiPanel({ history, loading }: RoiPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const trackedRoi = useRef(false);
  const [methodologyOpen, setMethodologyOpen] = useState(false);

  const chartColors = getChartSemanticColors();

  // IntersectionObserver → caderno_roi_viewed
  useEffect(() => {
    if (!panelRef.current || trackedRoi.current || loading || !history) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !trackedRoi.current) {
          trackedRoi.current = true;

          const areas = Object.entries(history.by_area ?? {});
          let areasWithRoi = 0;
          let bestDelta = 0;
          let hasPositive = false;

          for (const [_area, scores] of areas) {
            const mid = Math.floor(scores.length / 2);
            if (mid < 1) continue;
            const before = scores.slice(0, mid).reduce((s, x) => s + x.score, 0) / mid;
            const after = scores.slice(mid).reduce((s, x) => s + x.score, 0) / (scores.length - mid);
            const delta = (after - before) * 100;
            if (delta > 0) { areasWithRoi++; hasPositive = true; }
            if (delta > bestDelta) bestDelta = delta;
          }

          trackEvent('caderno_roi_viewed', {
            areas_with_roi: areasWithRoi,
            best_delta_pp: Math.round(bestDelta),
            has_positive_roi: hasPositive,
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, [loading, history]);

  if (loading) return <RoiSkeleton />;

  // ─── Sparkline data ───
  const sparklineData = (history?.global ?? [])
    .slice()
    .sort((a, b) => new Date(a.finished_at).getTime() - new Date(b.finished_at).getTime())
    .map((g, i) => ({
      name: `#${i + 1}`,
      score: Math.round(g.score_global * 100),
      date: formatDate(g.finished_at),
    }));

  // ─── Area table rows ───
  interface AreaRowData {
    area: string;
    scoreBefore: number | null;
    scoreAfter: number | null;
    delta: number | null;
  }
  const areaRows: AreaRowData[] = Object.entries(history?.by_area ?? {}).map(
    ([area, scores]) => {
      const mid = Math.floor(scores.length / 2);
      const before =
        mid > 0
          ? scores.slice(0, mid).reduce((s, x) => s + x.score, 0) / mid
          : null;
      const after =
        scores.length - mid > 0
          ? scores.slice(mid).reduce((s, x) => s + x.score, 0) / (scores.length - mid)
          : null;
      const delta = before != null && after != null ? (after - before) * 100 : null;
      return { area, scoreBefore: before, scoreAfter: after, delta };
    },
  );

  const noData = !history || (sparklineData.length === 0 && areaRows.length === 0);

  return (
    <section
      ref={panelRef}
      aria-label="Painel de ROI — retorno sobre investimento no caderno"
      className="space-y-5"
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-flex items-center justify-center h-8 w-8 rounded-[10px] bg-success/10 text-success"
            aria-hidden
          >
            <TrendingUp className="h-4 w-4" />
          </span>
          <SectionHeader
            title="Retorno do caderno (ROI)"
            className="m-0 p-0 border-0"
          />
        </div>

        <UiTooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Como calculamos o ROI"
              onClick={() => setMethodologyOpen((o) => !o)}
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
          <TooltipContent side="left">Como calculamos</TooltipContent>
        </UiTooltip>
      </div>

      {/* ── Nota metodológica ── */}
      <AnimatePresence initial={false}>
        {methodologyOpen && (
          <motion.div
            key="method"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <p className="rounded-xl bg-[var(--c-surface-2)] border border-border px-4 py-3 text-caption text-muted-foreground leading-relaxed">
              Comparamos seu acerto em cada área nos simulados antes e depois de cada domínio
              registrado no caderno. O delta mostra quantos pontos percentuais seu acerto mudou.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Estado sem dados ── */}
      {noData ? (
        <CadernoCard className="px-6 py-10 text-center space-y-2">
          <p className="text-body font-semibold text-foreground">Sem dados de ROI ainda</p>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Domine questões do caderno e complete pelo menos um simulado depois para ver o
            impacto do seu estudo aqui.
          </p>
        </CadernoCard>
      ) : (
        <>
          {/* ── Sparkline global ── */}
          {sparklineData.length >= 2 && (
            <CadernoCard className="p-4 md:p-5">
              <p className="text-[13px] font-semibold text-foreground mb-0.5">
                Evolução do score global
              </p>
              <p className="text-caption text-muted-foreground mb-4">
                Score acumulado em simulados completados
              </p>
              <div className="h-[140px] md:h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={sparklineData}
                    margin={{ top: 4, right: 12, left: -8, bottom: 4 }}
                  >
                    <CartesianGrid {...getChartGridProps()} />
                    <XAxis dataKey="name" tick={getChartTickStyle()} tickLine={false} axisLine={false} />
                    <YAxis
                      domain={[0, 100]}
                      tick={getChartTickStyle()}
                      tickFormatter={(v) => `${v}%`}
                      tickLine={false}
                      axisLine={false}
                    />
                    {/* Linha de referência 50% */}
                    <ReferenceLine
                      y={50}
                      stroke={chartColors.muted}
                      strokeDasharray="4 3"
                      strokeOpacity={0.5}
                    />
                    <RechartsTooltip content={<SparklineTooltip />} cursor={{ stroke: chartColors.muted, strokeWidth: 1, strokeDasharray: '3 3' }} />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={chartColors.primary}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: chartColors.primary, stroke: 'var(--background)', strokeWidth: 2 }}
                      activeDot={{ r: 6, stroke: 'var(--background)', strokeWidth: 2 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CadernoCard>
          )}

          {/* ── Tabela por área ── */}
          {areaRows.length > 0 && (
            <CadernoCard className="overflow-hidden p-0">
              <div className="px-4 py-3 border-b border-border bg-[var(--c-surface-2)]/50">
                <p className="text-[13px] font-semibold text-foreground">Score por área</p>
                <p className="text-caption text-muted-foreground">
                  Antes e depois de dominar questões do caderno
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="border-b border-border/60 bg-[var(--c-surface-2)]/40">
                      <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Área
                      </th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Antes
                      </th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Depois
                      </th>
                      <th className="px-4 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Delta
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {areaRows
                      .sort((a, b) => (b.delta ?? 0) - (a.delta ?? 0))
                      .map((row) => (
                        <AreaRow
                          key={row.area}
                          area={row.area}
                          scoreBefore={row.scoreBefore}
                          scoreAfter={row.scoreAfter}
                          delta={row.delta}
                        />
                      ))}
                  </tbody>
                </table>
              </div>
            </CadernoCard>
          )}
        </>
      )}
    </section>
  );
}
