import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { EmptyState } from "@/components/EmptyState";
import { BarChart3, TrendingUp, BookOpen, Stethoscope } from "lucide-react";

const areaPerformance = [
  { area: "Clínica Médica", score: 78, questions: 30, color: "bg-primary" },
  { area: "Cirurgia", score: 65, questions: 25, color: "bg-info" },
  { area: "Pediatria", score: 82, questions: 20, color: "bg-success" },
  { area: "Ginecologia e Obstetrícia", score: 71, questions: 25, color: "bg-warning" },
  { area: "Medicina Preventiva", score: 88, questions: 20, color: "bg-wine-glow" },
];

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
        {[
          { label: "Média Geral", value: "72%", icon: BarChart3 },
          { label: "Evolução", value: "+5%", icon: TrendingUp },
          { label: "Questões Feitas", value: "240", icon: BookOpen },
        ].map((item, i) => (
          <PremiumCard key={item.label} delay={i * 0.08} className="flex items-center gap-4 p-5">
            <div className="h-11 w-11 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
              <item.icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-heading-2 text-foreground">{item.value}</p>
              <p className="text-body-sm text-muted-foreground">{item.label}</p>
            </div>
          </PremiumCard>
        ))}
      </div>

      <h2 className="text-heading-3 text-foreground mb-4">Desempenho por Grande Área</h2>
      <div className="space-y-3">
        {areaPerformance.map((area, i) => (
          <PremiumCard key={area.area} delay={i * 0.06} className="p-4 md:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Stethoscope className="h-4 w-4 text-muted-foreground" />
                <span className="text-body font-medium text-foreground">{area.area}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-body-sm text-muted-foreground">{area.questions} questões</span>
                <span className="text-heading-3 text-foreground">{area.score}%</span>
              </div>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${area.color} transition-all duration-700 ease-out`}
                style={{ width: `${area.score}%` }}
              />
            </div>
          </PremiumCard>
        ))}
      </div>
    </AppLayout>
  );
}
