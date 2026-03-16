import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/AppLayout';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { SectionHeader } from '@/components/SectionHeader';
import { EmptyState } from '@/components/EmptyState';
import { ProGate } from '@/components/ProGate';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { useSimulados } from '@/hooks/useSimulados';
import { canViewResults } from '@/lib/simulado-helpers';
import {
  computeComparativeInsights,
  type SimuladoComparativeEntry,
  type ComparativeInsight,
} from '@/lib/resultHelpers';
import { cn } from '@/lib/utils';
import {
  BarChart3, TrendingUp, TrendingDown, Activity, Trophy,
  AlertTriangle, Target, Star, Minus, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, BarChart, Bar,
} from 'recharts';
import { Link } from 'react-router-dom';

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
        <div className="h-10 w-10 rounded-xl bg-card flex items-center justify-center shrink-0 border border-border/30">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-body font-semibold text-foreground">{insight.title}</p>
            {insight.value && (
              <span className="text-heading-3 font-bold tabular-nums shrink-0">{insight.value}</span>
            )}
          </div>
          <p className="text-body-sm text-muted-foreground leading-relaxed">{insight.description}</p>
        </div>
      </div>
    </PremiumCard>
  );
}

/** Build comparative data from Supabase attempts */
function useComparativeData() {
  const { simulados, loading } = useSimulados();

  const completed = useMemo(
    () => simulados.filter(s => canViewResults(s.status) && s.userState?.score != null),
    [simulados],
  );

  const entries: SimuladoComparativeEntry[] = useMemo(() => {
    return completed.map(sim => {
      const score = sim.userState!.score!;
      return {
        simuladoId: sim.id,
        title: sim.title,
        sequenceNumber: sim.sequenceNumber,
        percentageScore: score,
        totalCorrect: 0, // detailed breakdown requires fetching answers per attempt
        totalQuestions: sim.questionsCount,
        completedAt: sim.userState!.finishedAt || sim.userState!.startedAt || '',
        areaScores: {},
      } as SimuladoComparativeEntry;
    });
  }, [completed]);

  const insights = useMemo(() => computeComparativeInsights(entries), [entries]);

  return { entries, insights, loading };
}

export default function ComparativoPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].comparativo;

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
          description="Compare seu desempenho entre diferentes simulados, identifique padrões de evolução e acompanhe seu progresso ao longo do tempo. Disponível para assinantes SanarFlix."
          requiredSegment="standard"
          currentSegment={segment}
        />
      </AppLayout>
    );
  }

  return <ComparativoContent />;
}

function ComparativoContent() {
  const { entries, insights, loading } = useComparativeData();

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Comparativo entre Simulados" subtitle="Carregando..." badge="Análise Comparativa" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      </AppLayout>
    );
  }

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
          title="Dados insuficientes para comparar"
          description="Complete ao menos 2 simulados para visualizar seu comparativo de evolução. Continue praticando e acompanhe seu progresso aqui."
          action={
            <Link
              to="/simulados"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors"
            >
              Ver simulados
            </Link>
          }
        />
      </AppLayout>
    );
  }

  const sorted = [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
  const scoreChartData = sorted.map(e => ({
    name: `#${e.sequenceNumber}`,
    score: e.percentageScore,
  }));

  const avg = Math.round(sorted.reduce((a, e) => a + e.percentageScore, 0) / sorted.length);

  return (
    <AppLayout>
      <PageHeader
        title="Comparativo entre Simulados"
        subtitle="Acompanhe sua evolução ao longo dos simulados."
        badge="Análise Comparativa"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-8">
        {[
          { label: 'Simulados', value: String(sorted.length), icon: Target },
          { label: 'Média geral', value: `${avg}%`, icon: BarChart3 },
          { label: 'Melhor nota', value: `${Math.max(...sorted.map(e => e.percentageScore))}%`, icon: Trophy },
          { label: 'Último score', value: `${sorted[sorted.length - 1].percentageScore}%`, icon: Activity },
        ].map((stat, i) => (
          <PremiumCard key={stat.label} delay={i * 0.06} className="p-4">
            <div className="flex items-center gap-2.5 mb-2">
              <div className="h-9 w-9 rounded-xl bg-accent flex items-center justify-center">
                <stat.icon className="h-[18px] w-[18px] text-primary" />
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
        <div className="h-[280px] md:h-[320px]">
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

      {/* Per-simulado comparison table */}
      <SectionHeader title="Detalhamento por Simulado" />
      <PremiumCard className="p-0 overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-muted/20">
                <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5">Simulado</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">Score</th>
                <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5 hidden sm:table-cell">Variação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((entry, i) => {
                const prev = i > 0 ? sorted[i - 1] : null;
                const diff = prev ? entry.percentageScore - prev.percentageScore : 0;
                return (
                  <tr key={entry.simuladoId} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-5 py-3.5">
                      <span className="text-body font-medium text-foreground">{entry.title}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-body font-bold text-primary tabular-nums">{entry.percentageScore}%</span>
                    </td>
                    <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                      {i === 0 ? (
                        <span className="text-caption text-muted-foreground">—</span>
                      ) : diff > 0 ? (
                        <span className="inline-flex items-center gap-1 text-caption font-bold text-success">
                          <ArrowUpRight className="h-3 w-3" /> +{diff}%
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-1 text-caption font-bold text-destructive">
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
