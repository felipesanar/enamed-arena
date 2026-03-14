import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { BarChart3, TrendingUp, BookOpen, Stethoscope } from "lucide-react";
import { AREA_PERFORMANCE, USER_STATS } from "@/data/mock";

export default function DesempenhoPage() {
  console.log('[DesempenhoPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Desempenho"
        subtitle="Acompanhe sua performance detalhada por área e tema."
        badge="Análise de Performance"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard label="Média Geral" value={`${USER_STATS.averageScore}%`} icon={BarChart3} delay={0} />
        <StatCard label="Evolução" value={USER_STATS.scoreTrend} icon={TrendingUp} delay={0.08} />
        <StatCard label="Questões Feitas" value="240" icon={BookOpen} delay={0.16} />
      </div>

      <SectionHeader title="Desempenho por Grande Área" />
      <div className="space-y-3">
        {AREA_PERFORMANCE.map((area, i) => (
          <PremiumCard key={area.area} delay={i * 0.06} className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-body font-medium text-foreground">{area.area}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body-sm text-muted-foreground">{area.correct}/{area.questions} questões</span>
                <span className="text-heading-3 text-foreground">{area.score}%</span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-700 ease-out"
                style={{ width: `${area.score}%` }}
              />
            </div>
          </PremiumCard>
        ))}
      </div>
    </AppLayout>
  );
}
