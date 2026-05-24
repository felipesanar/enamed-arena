import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { trackEvent } from '@/lib/analytics';
import { PageTransition } from '@/components/premium/PageTransition';
import { PageHeader } from '@/components/PageHeader';
import { PremiumCard } from '@/components/PremiumCard';
import { EmptyState } from '@/components/EmptyState';
import { ProGate } from '@/components/ProGate';
import { SkeletonCard } from '@/components/SkeletonCard';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { SEGMENT_ACCESS } from '@/types';
import { useComparativeData } from '@/hooks/useComparativeData';
import {
  BarChart3, ArrowUpRight, ArrowDownRight, Minus, ChevronDown, ChevronUp,
} from 'lucide-react';

import { ComparativoHero } from '@/components/comparativo/ComparativoHero';
import { ComparativoKpiRow } from '@/components/comparativo/ComparativoKpiRow';
import { ComparativoEvolutionChart } from '@/components/comparativo/ComparativoEvolutionChart';
import { ComparativoSpecialtyRadar } from '@/components/comparativo/ComparativoSpecialtyRadar';
import { ComparativoBehaviorCards } from '@/components/comparativo/ComparativoBehaviorCards';
import { ComparativoActionableInsights } from '@/components/comparativo/ComparativoActionableInsights';

export default function ComparativoPage() {
  const { profile } = useUser();
  const segment = profile?.segment ?? 'guest';
  const hasAccess = SEGMENT_ACCESS[segment].comparativo;

  if (!hasAccess) {
    return (
      <>
        <PageHeader
          title="Comparativo entre Simulados"
          subtitle="Acompanhe sua evolução ao longo dos simulados."
          badge="Análise Comparativa"
        />
        <ProGate
          icon={BarChart3}
          feature="Comparativo entre Simulados"
          description="Compare seu desempenho entre diferentes simulados, identifique padrões de evolução e acompanhe seu progresso ao longo do tempo."
          requiredSegment="standard"
          currentSegment={segment}
          benefits={[
            "Análise IA da sua trajetória entre provas",
            "Radar de especialidades sobrepondo simulados",
            "Insights acionáveis baseados em comportamento + performance",
            "Drilldown por simulado com snapshot detalhado",
          ]}
        />
      </>
    );
  }

  return <ComparativoContent />;
}

function ComparativoContent() {
  const { entries, allSlots, loading } = useComparativeData();
  const { profile } = useUser();
  const [showDetails, setShowDetails] = useState(false);

  // Sort ascending by sequenceNumber for everything downstream
  const sorted = useMemo(
    () => [...entries].sort((a, b) => a.sequenceNumber - b.sequenceNumber),
    [entries],
  );

  const compTracked = useRef(false);
  useEffect(() => {
    if (loading || compTracked.current) return;
    compTracked.current = true;
    trackEvent('comparativo_viewed', {
      simulados_count: entries.length,
      segment: profile?.segment ?? 'guest',
    });
  }, [loading, entries.length, profile?.segment]);

  if (loading) {
    return (
      <>
        <PageHeader title="Comparativo entre Simulados" subtitle="Carregando..." badge="Análise Comparativa" />
        <div className="space-y-4">
          <SkeletonCard className="h-[160px] rounded-[22px]" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <SkeletonCard className="h-[180px]" />
            <SkeletonCard className="h-[180px]" />
          </div>
          <SkeletonCard className="h-[320px]" />
        </div>
      </>
    );
  }

  if (sorted.length < 2) {
    return (
      <>
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
      </>
    );
  }

  return (
    <PageTransition>
      <PageHeader
        title="Comparativo entre Simulados"
        subtitle="Sua evolução ao longo dos simulados."
        subtitlePlacement="inline-end"
        badge="Análise Comparativa"
      />

      {/* KPIs no topo — largura total */}
      <div className="mb-6">
        <ComparativoKpiRow entries={sorted} />
      </div>

      {/* Prof. Sanor (esquerda) + Gráfico de evolução (direita) lado a lado em desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 mb-6 items-start">
        <div className="lg:col-span-5 min-w-0">
          <ComparativoHero
            studentName={profile?.name ?? 'Aluno'}
            entries={sorted}
            totalSimuladosPlatform={allSlots.length}
            intendedSpecialty={null /* TODO: vir do onboarding_profiles.specialty quando útil */}
          />
        </div>
        <div className="lg:col-span-7 min-w-0">
          <ComparativoEvolutionChart entries={sorted} allSlots={allSlots} />
        </div>
      </div>

      {/* INSIGHTS ACIONÁVEIS — o que fazer agora (sobe pra logo após o panorama) */}
      <div className="mb-6">
        <ComparativoActionableInsights entries={sorted} />
      </div>

      {/* ESPECIALIDADES — radar + variação por área (drill-down do score) */}
      <div className="mb-6">
        <ComparativoSpecialtyRadar entries={sorted} />
      </div>

      {/* COMPORTAMENTO — como você se comportou nas provas */}
      <div className="mb-6">
        <ComparativoBehaviorCards entries={sorted} />
      </div>

      {/* DETALHAMENTO (collapsible) */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => setShowDetails(s => !s)}
          className="text-body font-semibold text-foreground -ml-3"
        >
          Detalhamento por simulado
          {showDetails ? (
            <ChevronUp className="h-4 w-4 ml-1.5" />
          ) : (
            <ChevronDown className="h-4 w-4 ml-1.5" />
          )}
        </Button>

        {showDetails && (
          <PremiumCard className="p-0 overflow-hidden mt-3">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3.5">Simulado</th>
                    <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5">Score</th>
                    <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5 hidden sm:table-cell">Acertos</th>
                    <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3.5 hidden md:table-cell">Variação</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((entry, i) => {
                    const prev = i > 0 ? sorted[i - 1] : null;
                    const diff = prev ? entry.percentageScore - prev.percentageScore : 0;
                    return (
                      <tr key={entry.simuladoId} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-5 py-3.5">
                          <Link
                            to={`/desempenho?simulado=${entry.simuladoId}`}
                            className="text-body font-medium text-foreground hover:text-primary transition-colors inline-flex items-center gap-1.5 group"
                          >
                            <span className="text-caption text-muted-foreground tabular-nums">#{entry.sequenceNumber}</span>
                            {entry.title}
                            <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <span className="text-body font-bold text-primary tabular-nums">{entry.percentageScore}%</span>
                        </td>
                        <td className="px-5 py-3.5 text-right hidden sm:table-cell">
                          <span className="text-body-sm text-muted-foreground tabular-nums">
                            {entry.totalCorrect}/{entry.totalQuestions}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right hidden md:table-cell">
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
        )}
      </div>
    </PageTransition>
  );
}
