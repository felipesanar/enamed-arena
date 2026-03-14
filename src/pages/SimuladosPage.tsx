import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Calendar, Clock, FileText } from "lucide-react";

const simulados = [
  { id: 1, title: "Simulado ENAMED #1", date: "18 Jan 2026", status: "completed" as const, questions: 120, duration: "5h" },
  { id: 2, title: "Simulado ENAMED #2", date: "15 Fev 2026", status: "completed" as const, questions: 120, duration: "5h" },
  { id: 3, title: "Simulado ENAMED #3", date: "22 Mar 2026", status: "available" as const, questions: 120, duration: "5h" },
  { id: 4, title: "Simulado ENAMED #4", date: "19 Abr 2026", status: "upcoming" as const, questions: 120, duration: "5h" },
  { id: 5, title: "Simulado ENAMED #5", date: "17 Mai 2026", status: "upcoming" as const, questions: 120, duration: "5h" },
  { id: 6, title: "Simulado ENAMED #6", date: "21 Jun 2026", status: "locked" as const, questions: 120, duration: "5h" },
  { id: 7, title: "Simulado ENAMED #7", date: "19 Jul 2026", status: "locked" as const, questions: 120, duration: "5h" },
];

export default function SimuladosPage() {
  console.log('[SimuladosPage] Rendering');

  return (
    <AppLayout>
      <PageHeader
        title="Calendário de Simulados"
        subtitle="7 simulados ao longo do ano para acompanhar sua evolução."
        badge="Simulados ENAMED 2026"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {simulados.map((sim, i) => (
          <PremiumCard key={sim.id} interactive delay={i * 0.06} className="flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div className="h-10 w-10 rounded-lg bg-primary/8 flex items-center justify-center">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <StatusBadge status={sim.status} />
            </div>
            <h3 className="text-heading-3 text-foreground mb-1">{sim.title}</h3>
            <div className="flex items-center gap-4 text-body-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {sim.date}
              </span>
              <span className="flex items-center gap-1.5">
                <FileText className="h-3.5 w-3.5" />
                {sim.questions}q
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {sim.duration}
              </span>
            </div>
            <div className="mt-auto pt-4">
              {sim.status === "available" && (
                <button className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors">
                  Iniciar Simulado
                </button>
              )}
              {sim.status === "completed" && (
                <button className="w-full py-2.5 rounded-xl bg-secondary text-secondary-foreground text-body font-medium hover:bg-muted transition-colors">
                  Ver Resultado
                </button>
              )}
              {(sim.status === "upcoming" || sim.status === "locked") && (
                <div className="w-full py-2.5 rounded-xl bg-muted text-muted-foreground text-body text-center font-medium">
                  Indisponível
                </div>
              )}
            </div>
          </PremiumCard>
        ))}
      </div>
    </AppLayout>
  );
}
