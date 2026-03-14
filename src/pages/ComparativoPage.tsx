import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { ProGate } from '@/components/ProGate';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { getSimulados } from '@/data/mock';
import { getQuestionsForSimulado } from '@/data/mock-questions';
import { useExamStorage } from '@/hooks/useExamStorage';
import { canViewResults } from '@/lib/simulado-helpers';
import {
  computeSimuladoScore,
  computePerformanceBreakdown,
  computeComparativeInsights,
  type SimuladoComparativeEntry,
  type ComparativeInsight,
} from '@/lib/result-helpers';
import { cn } from '@/lib/utils';
import {
  BarChart3, TrendingUp, TrendingDown, Activity, Trophy,
  AlertTriangle, Target, Star, Minus, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar,
} from 'recharts';

function InsightCard({ insight, delay }: { insight: ComparativeInsight; delay: number }) {
  const iconMap = {
    improvement: TrendingUp,
    decline: TrendingDown,
    consistent: Activity,
    best: Star,
    worst: AlertTriangle,
  };
  const colorMap = {
    improvement: 'text-success border-success/20 bg-success/[0.03]',
    decline: 'text-destructive border-destructive/20 bg-destructive/[0.03]',
    consistent: 'text-info border-info/20 bg-info/[0.03]',
    best: 'text-warning border-warning/20 bg-warning/[0.03]',
    worst: 'text-muted-foreground border-border bg-muted/30',
  };
  const Icon = iconMap[insight.type];
  const color = colorMap[insight.type];

  return (
    <PremiumCard delay={delay} className={cn('p-4 md:p-5', color)}>
      <div className="flex items-start gap-3">
        <div className="h-9 w-9 rounded-xl bg-card flex items-center justify-center shrink-0">
          <Icon className="h-[18px] w-[18px]" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-body font-semibold text-foreground">{insight.title}</p>
            {insight.value && (
              <span className="text-heading-3 font-bold tabular-nums shrink-0">{insight.value}</span>
            )}
          </div>
          <p className="text-body-sm text-muted-foreground">{insight.description}</p>
        </div>
      </div>
    </PremiumCard>
  );
}

/** Hook to compute comparative data across all completed simulados */
function useComparativeData(): { entries: SimuladoComparativeEntry[]; insights: ComparativeInsight[] } {
  const simulados = useMemo(() => getSimulados(), []);
  const completed = simulados.filter(s => canViewResults(s.status));

  const entries: SimuladoComparativeEntry[] = useMemo(() => {
    return completed.map(sim => {
      const questions = getQuestionsForSimulado(sim.id);
      const storageKey = `enamed_exam_${sim.id}`;
      let raw: string | null = null;
      try { raw = localStorage.getItem(storageKey); } catch {}
      if (!raw) return null;

      const state = JSON.parse(raw);
      if (state.status !== 'submitted' && state.status !== 'expired') return null;

      const breakdown = computePerformanceBreakdown(state, questions);
      const areaScores: Record<string, number> = {};
      breakdown.byArea.forEach(a => { areaScores[a.area] = a.score; });

      return {
        simuladoId: sim.id,
        title: sim.title,
        sequenceNumber: sim.sequenceNumber,
        percentageScore: breakdown.overall.percentageScore,
        totalCorrect: breakdown.overall.totalCorrect,
        totalQuestions: breakdown.overall.totalQuestions,
        completedAt: state.lastSavedAt || state.startedAt,
        areaScores,
      } as SimuladoComparativeEntry;
    }).filter(Boolean) as SimuladoComparativeEntry[];
  }, [completed]);

  const insights = useMemo(() => computeComparativeInsights(entries), [entries]);

  return { entries, insights };
}

export default function ComparativoPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].comparativo;

  console.log('[ComparativoPage] Rendering, segment:', segment, 'hasAccess:', hasAccess);

  if (!hasAccess) {
    return (
      <AppLayout>
        <PageHeader
          title="Comparativo entre Simulados"
          subtitle="Acompanhe sua evolução ao longo dos simulados."
          badge="Análise Comparativa"
        />
        <ProGate
          icon={BarChart3}
          feature="Comparativo entre Simulados"
          description="Compare seu desempenho entre diferentes simulados, identifique padrões e acompanhe sua evolução ao longo do tempo. Disponível para assinantes SanarFlix."
          requiredSegment="standard"
          currentSegment={segment}
        />
      </AppLayout>
    );
  }

  return <ComparativoContent />;
}

function ComparativoContent() {
  const { entries, insights } = useComparativeData();

  if (entries.length < 2) {
    return (
      <AppLayout>
        <PageHeader
          title="Comparativo entre Simulados"
          subtitle="Acompanhe sua evolução ao longo dos simulados."
          badge="Análise Comparativa"
        />
        <EmptyState
          icon={BarChart3}
          title="Dados insuficientes"
          description="Complete ao menos 2 simulados para visualizar o comparativo de evolução. Continue praticando!"
        />
      </AppLayout>
    );
  }

  // Chart data
  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const scoreChartData = sorted.map(e => ({
    name: `#${e.sequenceNumber}`,
    score: e.percentageScore,
    acertos: e.totalCorrect,
  }));

  // Area evolution data
  const allAreas = Array.from(new Set(sorted.flatMap(e => Object.keys(e.areaScores))));
  const areaChartData = sorted.map(e => {
    const row: Record<string, any> = { name: `#${e.sequenceNumber}` };
    allAreas.forEach(a => { row[a] = e.areaScores[a] ?? 0; });
    return row;
  });

  const areaColors = ['hsl(345, 65%, 30%)', 'hsl(210, 80%, 52%)', 'hsl(152, 60%, 36%)', 'hsl(38, 92%, 50%)', 'hsl(280, 60%, 50%)'];

  const avg = Math.round(sorted.reduce((a, e) => a + e.percentageScore, 0) / sorted.length);

  return (
    <AppLayout>
      <PageHeader
        title="Comparativo entre Simulados"
        subtitle="Acompanhe sua evolução ao longo dos simulados."
        badge="Análise Comparativa"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Simulados', value: String(sorted.length), icon: Target },
          { label: 'Média geral', value: `${avg}%`, icon: BarChart3 },
          { label: 'Melhor nota', value: `${Math.max(...sorted.map(e => e.percentageScore))}%`, icon: Trophy },
          { label: 'Último', value: `${sorted[sorted.length - 1].percentageScore}%`, icon: Activity },
        ].map((stat, i) => (
          <PremiumCard key={stat.label} delay={i * 0.06} className="p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-8 w-8 rounded-lg bg-accent flex items-center justify-center">
                <stat.icon className="h-4 w-4 text-primary" />
              </div>
            </div>
            <p className="text-heading-2 text-foreground">{stat.value}</p>
            <p className="text-caption text-muted-foreground">{stat.label}</p>
          </PremiumCard>
        ))}
      </div>

      {/* Insights */}
      <SectionHeader title="Insights de Evolução" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {insights.map((insight, i) => (
          <InsightCard key={insight.title} insight={insight} delay={i * 0.06} />
        ))}
      </div>

      {/* Score evolution chart */}
      <SectionHeader title="Evolução do Score" />
      <PremiumCard className="p-5 md:p-6 mb-8">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={scoreChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(220 10% 46%)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(220 10% 46%)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(0 0% 100%)',
                  border: '1px solid hsl(220 12% 90%)',
                  borderRadius: '12px',
                  fontSize: 13,
                }}
              />
              <Line
                type="monotone"
                dataKey="score"
                name="Score (%)"
                stroke="hsl(345, 65%, 30%)"
                strokeWidth={3}
                dot={{ fill: 'hsl(345, 65%, 30%)', r: 5, strokeWidth: 2, stroke: '#fff' }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      {/* Area evolution chart */}
      <SectionHeader title="Evolução por Grande Área" />
      <PremiumCard className="p-5 md:p-6 mb-8">
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={areaChartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 12% 90%)" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'hsl(220 10% 46%)' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: 'hsl(220 10% 46%)' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(0 0% 100%)',
                  border: '1px solid hsl(220 12% 90%)',
                  borderRadius: '12px',
                  fontSize: 13,
                }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              {allAreas.map((area, i) => (
                <Bar
                  key={area}
                  dataKey={area}
                  name={area}
                  fill={areaColors[i % areaColors.length]}
                  radius={[4, 4, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </PremiumCard>

      {/* Per-simulado comparison table */}
      <SectionHeader title="Detalhamento por Simulado" />
      <PremiumCard className="p-0 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5">Simulado</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">Score</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">Acertos</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5 hidden sm:table-cell">Variação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => {
                const prev = i > 0 ? sorted[i - 1] : null;
                const diff = prev ? entry.percentageScore - prev.percentageScore : 0;
                return (
                  <tr key={entry.simuladoId} className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-body font-medium text-foreground">{entry.title}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-body font-semibold text-primary tabular-nums">{entry.percentageScore}%</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-body-sm text-muted-foreground tabular-nums">{entry.totalCorrect}/{entry.totalQuestions}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                      {i === 0 ? (
                        <span className="text-caption text-muted-foreground">—</span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-1 text-caption font-semibold text-success">
                          <ArrowUpRight className="h-3 w-3" /> +{diff}%
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-1 text-caption font-semibold text-destructive">
                          <ArrowDownRight className="h-3 w-3" /> {diff}%
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-caption text-muted-foreground">
                          <Minus className="h-3 w-3" /> 0%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </PremiumCard>
    </AppLayout>
  );
}
