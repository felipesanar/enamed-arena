/**
 * RoiPanel — Painel de ROI do Caderno de Erros v2.
 *
 * Consome getAreaScoreHistory para exibir:
 *   1. Sparkline de evolução global de score.
 *   2. Tabela por área com delta antes/depois de dominar questões.
 *   3. Estado vazio informativo.
 *
 * Rastreia caderno_roi_viewed (IntersectionObserver) e caderno_roi_area_expanded.
 */

import { useEffect, useRef, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { ChevronDown, ChevronUp, TrendingUp, Info } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';

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

function deltaClass(delta: number) {
  if (delta >= 5) return 'text-success font-bold';
  if (delta < -5) return 'text-destructive font-bold';
  return 'text-muted-foreground';
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
  } catch {
    return iso;
  }
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
      className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors cursor-default"
      onClick={handleExpand}
    >
      <td className="py-2.5 pr-4 text-[13px] font-medium text-foreground">{area}</td>
      <td className="py-2.5 pr-4 text-center text-caption tabular-nums text-muted-foreground">
        {scoreBefore != null ? toPercent(scoreBefore) : '—'}
      </td>
      <td className="py-2.5 pr-4 text-center text-caption tabular-nums text-muted-foreground">
        {scoreAfter != null ? toPercent(scoreAfter) : '—'}
      </td>
      <td className="py-2.5 text-center text-caption tabular-nums">
        {delta != null ? (
          <span className={deltaClass(delta)}>{deltaLabel(delta)}</span>
        ) : (
          <span className="text-muted-foreground/50">—</span>
        )}
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

          // Calcular métricas para o evento
          const areas = Object.entries(history.by_area ?? {});
          let areasWithRoi = 0;
          let bestDelta = 0;
          let hasPositive = false;

          for (const [_area, scores] of areas) {
            // Tentativa simples: metade inicial vs metade final
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

  const noData = !loading && (!history || (sparklineData.length === 0 && areaRows.length === 0));

  // ─── Skeleton ───
  if (loading) {
    return (
      <section aria-label="Painel de ROI — carregando" className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-[180px] w-full rounded-2xl" />
        <Skeleton className="h-32 w-full rounded-2xl" />
      </section>
    );
  }

  return (
    <section
      ref={panelRef}
      aria-label="Painel de ROI — retorno sobre investimento no caderno"
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success shrink-0" aria-hidden />
          <h2 className="text-heading-3 font-bold text-foreground">
            Retorno do caderno (ROI)
          </h2>
        </div>
        <UiTooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Como calculamos o ROI"
              onClick={() => setMethodologyOpen((o) => !o)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors"
            >
              <Info className="h-4 w-4" aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">Como calculamos</TooltipContent>
        </UiTooltip>
      </div>

      {/* Nota metodológica (colapsável) */}
      <AnimatePresence initial={false}>
        {methodologyOpen && (
          <motion.div
            key="method"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="rounded-xl bg-muted/50 border border-border px-4 py-3 text-caption text-muted-foreground leading-relaxed">
              Comparamos seu acerto em cada área nos simulados antes e depois de cada domínio
              registrado no caderno. O delta mostra quantos pontos percentuais seu acerto mudou.
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Estado sem dados */}
      {noData ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/50 px-6 py-10 text-center space-y-2">
          <p className="text-body font-medium text-foreground">Sem dados de ROI ainda</p>
          <p className="text-caption text-muted-foreground max-w-sm mx-auto">
            Domine questões do caderno e complete pelo menos um simulado depois para ver o
            impacto do seu estudo aqui.
          </p>
        </div>
      ) : (
        <>
          {/* Sparkline global */}
          {sparklineData.length >= 2 && (
            <div className="rounded-2xl border border-border bg-card p-4 md:p-5">
              <p className="text-body-sm font-semibold text-foreground mb-4">
                Evolução do score global
              </p>
              <div className="h-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid {...getChartGridProps()} />
                    <XAxis dataKey="name" tick={getChartTickStyle()} />
                    <YAxis
                      domain={[0, 100]}
                      tick={getChartTickStyle()}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip
                      contentStyle={getChartTooltipContentStyle()}
                      formatter={(v: number) => [`${v}%`, 'Score']}
                      labelFormatter={(label, payload) => {
                        const p = payload?.[0]?.payload as { date?: string };
                        return p?.date ? `${label} · ${p.date}` : label;
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke={chartColors.primary}
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: chartColors.primary, stroke: '#fff', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Tabela por área */}
          {areaRows.length > 0 && (
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-body-sm font-semibold text-foreground">Score por área</p>
                <p className="text-caption text-muted-foreground">
                  Antes e depois de dominar questões do caderno
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[360px]">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
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
                  <tbody className="px-4">
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
            </div>
          )}
        </>
      )}
    </section>
  );
}
