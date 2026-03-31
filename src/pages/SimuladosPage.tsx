import { useMemo } from "react";
import { PageHeader } from "@/components/PageHeader";
import { SimuladoCard } from "@/components/SimuladoCard";
import { SectionHeader } from "@/components/SectionHeader";
import { PremiumCard } from "@/components/PremiumCard";
import { SkeletonCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import { Link } from "react-router-dom";
import { useSimulados } from "@/hooks/useSimulados";
import { Info } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";

export default function SimuladosPage() {
  const prefersReducedMotion = useReducedMotion();
  const { simulados, loading, error, refetch } = useSimulados();

  // Sections
  const active = useMemo(
    () => simulados.filter(s => s.status === "available" || s.status === "available_late" || s.status === "in_progress"),
    [simulados]
  );
  const upcoming = useMemo(
    () => simulados.filter(s => s.status === "upcoming"),
    [simulados]
  );
  const past = useMemo(
    () => simulados.filter(s => s.status === "completed" || s.status === "results_available" || s.status === "closed_waiting"),
    [simulados]
  );

  if (loading) {
    return (
      <>
        <PageHeader title="Simulados" badge="ENAMED 2026" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <PageHeader title="Simulados" badge="ENAMED 2026" />
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
        title="Simulados"
        subtitle="100 questões inéditas no modelo ENAMED, elaboradas pelos professores do SanarFlix PRO."
        badge="ENAMED 2026"
      />

      {/* Como funciona — topo */}
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
        className="mb-8"
      >
        <PremiumCard className="p-4 md:p-5 border-info/20 bg-info/5">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-body font-medium text-foreground mb-1">Como funciona</p>
              <p className="text-body-sm text-muted-foreground">
                Cada simulado possui uma janela de execução definida. Realize dentro da janela para entrar no ranking nacional. Após a janela, é possível fazer como treino. Resultado, gabarito e ranking são liberados após o encerramento. Não é possível pausar a prova após iniciá-la.
              </p>
            </div>
          </div>
        </PremiumCard>
      </motion.div>

      {/* Simulados Ativos */}
      {active.length > 0 && (
        <Section title="Simulados ativos" delay={0.05} reduced={prefersReducedMotion}>
          {active.map((sim, i) => (
            <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
          ))}
        </Section>
      )}

      {/* Próximos */}
      {upcoming.length > 0 && (
        <Section title="Próximos" delay={0.1} reduced={prefersReducedMotion}>
          {upcoming.map((sim, i) => (
            <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
          ))}
        </Section>
      )}

      {/* Anteriores */}
      {past.length > 0 && (
        <Section title="Anteriores" delay={0.15} reduced={prefersReducedMotion}>
          {past.map((sim, i) => (
            <SimuladoCard key={sim.id} simulado={sim} delay={i * 0.06} />
          ))}
        </Section>
      )}

      {simulados.length === 0 && (
        <EmptyState
          title="Nenhum simulado disponível"
          description="Fique atento — novos simulados serão publicados em breve."
          backHref="/"
          backLabel="Voltar ao início"
        />
      )}
    </>
  );
}

function Section({
  title,
  delay,
  reduced,
  children,
}: {
  title: string;
  delay: number;
  reduced: boolean | null;
  children: React.ReactNode;
}) {
  return (
    <motion.section
      initial={reduced ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.4, delay: reduced ? 0 : delay }}
      className="mb-8"
    >
      <SectionHeader title={title} className="mb-4" />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {children}
      </div>
    </motion.section>
  );
}
