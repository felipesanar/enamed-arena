import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { SimuladoCard } from "@/components/SimuladoCard";
import { SIMULADOS } from "@/data/mock";

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
        {SIMULADOS.map((sim, i) => (
          <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
        ))}
      </div>
    </AppLayout>
  );
}
