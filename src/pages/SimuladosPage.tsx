import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { SimuladoCard } from "@/components/SimuladoCard";
import { SectionHeader } from "@/components/SectionHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { useSimulados } from "@/hooks/useSimulados";
import { Calendar, Clock, FileText, Info } from "lucide-react";
import { motion } from "framer-motion";

export default function SimuladosPage() {
  const { simulados, loading, error } = useSimulados();

  const available = simulados.filter(s => s.status === 'available' || s.status === 'in_progress');
  const upcoming = simulados.filter(s => s.status === 'upcoming');
  const past = simulados.filter(s => s.status === 'completed' || s.status === 'results_available' || s.status === 'closed_waiting');

  if (loading) {
    return (
      <AppLayout>
        <PageHeader title="Calendário de Simulados" subtitle="Carregando simulados..." badge="Simulados ENAMED 2026" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <PageHeader
        title="Calendário de Simulados"
        subtitle="7 simulados ao longo do ano para acompanhar sua evolução."
        badge="Simulados ENAMED 2026"
      />

      {/* Info banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <PremiumCard className="p-4 md:p-5 border-info/20 bg-info/5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-body font-medium text-foreground mb-1">Como funciona</p>
              <p className="text-body-sm text-muted-foreground">
                Cada simulado possui uma janela de execução definida. O resultado, gabarito comentado e ranking são liberados após o encerramento da janela. Não é possível pausar a prova após iniciá-la.
              </p>
            </div>
          </div>
        </PremiumCard>
      </motion.div>

      {/* Available now */}
      {available.length > 0 && (
        <div className="mb-8">
          <SectionHeader title="Disponíveis agora" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {available.map((sim, i) => (
              <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* Past simulados */}
      {past.length > 0 && (
        <div className="mb-8">
          <SectionHeader title="Realizados" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {past.map((sim, i) => (
              <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <SectionHeader title="Próximos" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcoming.map((sim, i) => (
              <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline summary */}
      <div className="mt-8">
        <SectionHeader title="Cronograma 2026" />
        <PremiumCard className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3">#</th>
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3">Simulado</th>
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3 hidden sm:table-cell">Janela</th>
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3 hidden md:table-cell">Resultado</th>
                  <th className="text-right text-overline uppercase text-muted-foreground px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {simulados.map(sim => {
                  const startDate = new Date(sim.executionWindowStart);
                  const endDate = new Date(sim.executionWindowEnd);
                  const resultsDate = new Date(sim.resultsReleaseAt);
                  const fmtShort = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

                  return (
                    <tr key={sim.id} className="border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3">
                        <span className="text-body font-bold text-primary">#{sim.sequenceNumber}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="text-body font-medium text-foreground">{sim.title}</span>
                      </td>
                      <td className="px-5 py-3 hidden sm:table-cell">
                        <span className="text-body-sm text-muted-foreground">
                          {fmtShort(startDate)} – {fmtShort(endDate)}
                        </span>
                      </td>
                      <td className="px-5 py-3 hidden md:table-cell">
                        <span className="text-body-sm text-muted-foreground">{fmtShort(resultsDate)}</span>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <span className={`inline-flex items-center text-caption font-semibold px-2 py-0.5 rounded ${
                          sim.status === 'available' ? 'bg-success/10 text-success' :
                          sim.status === 'completed' || sim.status === 'results_available' ? 'bg-primary/10 text-primary' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {sim.status === 'available' ? 'Aberto' :
                           sim.status === 'completed' || sim.status === 'results_available' ? 'Concluído' :
                           sim.status === 'closed_waiting' ? 'Encerrado' :
                           'Em breve'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </PremiumCard>
      </div>
    </AppLayout>
  );
}
