import { PageHeader } from "@/components/PageHeader";
import { SimuladoCard } from "@/components/SimuladoCard";
import { SectionHeader } from "@/components/SectionHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import { Link } from "react-router-dom";
import { useSimulados } from "@/hooks/useSimulados";
import { Calendar, Clock, FileText, Info } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function SimuladosPage() {
  const prefersReducedMotion = useReducedMotion();
  const { simulados, loading, error, refetch } = useSimulados();

  const available = simulados.filter(s => s.status === 'available' || s.status === 'in_progress');
  const upcoming = simulados.filter(s => s.status === 'upcoming');
  const past = simulados.filter(s => s.status === 'completed' || s.status === 'results_available' || s.status === 'closed_waiting');
  /** Próximo simulado: disponível agora ou primeiro próximo */
  const nextSimulado = available[0] ?? upcoming[0] ?? null;

  if (loading) {
    return (
      <>
        <PageHeader title="Calendário de Simulados" subtitle="Carregando simulados..." badge="Simulados ENAMED 2026" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Calendário de Simulados" badge="Simulados ENAMED 2026" />
        <EmptyState
          variant="error"
          title="Não foi possível carregar os simulados"
          description={error}
          onRetry={() => refetch()}
          backHref="/"
          backLabel="Voltar ao início"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Calendário de Simulados"
        subtitle="100 questões inéditas distribuídas no modelo ENAMED elaboradas pelos professores do SanarFlix PRO, com base na prevalência INEP e nas Diretrizes Curriculares Nacionais."
        badge="Simulados ENAMED 2026"
      />

      {/* Hero: Seu próximo simulado (Fase C) */}
      {nextSimulado && (
        <motion.section
          initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
          className="mb-8"
          aria-label="Seu próximo simulado"
        >
          <SectionHeader title="Seu próximo simulado" className="mb-4" />
          <SimuladoCard simulado={nextSimulado} delay={0} />
        </motion.section>
      )}

      {/* Como funciona — compacto */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : 0.05 }}
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

      {/* Disponíveis agora (excluindo o que já está no hero quando é o mesmo) */}
      {available.length > 0 && (
        <div className="mb-8">
          <SectionHeader title="Disponíveis agora" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {available.map((sim, i) => (
              <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* Próximos (timeline) */}
      {upcoming.length > 0 && (
        <div className="mb-8">
          <SectionHeader title="Próximos na sua linha do tempo" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcoming.map((sim, i) => (
              <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* Anteriores */}
      {past.length > 0 && (
        <div className="mb-8">
          <SectionHeader title="Anteriores" className="mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {past.map((sim, i) => (
              <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
            ))}
          </div>
        </div>
      )}

      {/* Cronograma */}
      <div className="section-breathe">
        <SectionHeader title="Cronograma 2026" className="mb-4" />
        {/* Mobile: card list (touch-friendly, no horizontal scroll) */}
        <div className="md:hidden space-y-3">
          {simulados.map((sim) => {
            const startDate = new Date(sim.executionWindowStart);
            const endDate = new Date(sim.executionWindowEnd);
            const fmtShort = (d: Date) => d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
            const statusLabel =
              sim.status === 'available' ? 'Aberto' :
              sim.status === 'completed' || sim.status === 'results_available' ? 'Concluído' :
              sim.status === 'closed_waiting' ? 'Encerrado' : 'Em breve';
            const statusClass =
              sim.status === 'available' ? 'bg-success/10 text-success' :
              sim.status === 'completed' || sim.status === 'results_available' ? 'bg-primary/10 text-primary' :
              'bg-muted text-muted-foreground';
            return (
              <Link
                key={sim.id}
                to={`/simulados/${sim.id}`}
                className="block rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.998]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="text-body font-bold text-primary">#{sim.sequenceNumber}</span>
                    <p className="text-body font-medium text-foreground truncate mt-0.5">{sim.title}</p>
                    <p className="text-body-sm text-muted-foreground mt-1">
                      {fmtShort(startDate)} – {fmtShort(endDate)}
                    </p>
                  </div>
                  <span className={`shrink-0 text-caption font-semibold px-2 py-1 rounded ${statusClass}`}>
                    {statusLabel}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        {/* Desktop: table */}
        <PremiumCard className="p-0 overflow-hidden hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3">#</th>
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3">Simulado</th>
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3 sm:table-cell">Janela</th>
                  <th className="text-left text-overline uppercase text-muted-foreground px-5 py-3 md:table-cell">Resultado</th>
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
                      <td className="px-5 py-3">
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
    </>
  );
}
