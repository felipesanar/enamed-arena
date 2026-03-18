import { Calendar, BookOpen, GitCompareArrows } from "lucide-react";
import { SectionHeader } from "@/components/premium/SectionHeader";
import { QuickActionCard } from "./QuickActionCard";

export function QuickActionsSection() {
  return (
    <section aria-labelledby="quick-actions-heading">
      <SectionHeader
        id="quick-actions-heading"
        title="Continue sua preparação"
        eyebrow="Ações rápidas"
        className="mb-6"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
        <QuickActionCard
          title="Calendário"
          copy="Planeje sua rotina e antecipe o próximo simulado."
          ctaLabel="Abrir calendário"
          to="/simulados"
          icon={Calendar}
        />
        <QuickActionCard
          title="Caderno de Erros"
          copy="Transforme erros em avanço e acelere sua evolução."
          ctaLabel="Abrir caderno"
          to="/caderno-erros"
          icon={BookOpen}
        />
        <QuickActionCard
          title="Comparativo"
          copy="Entenda como seu desempenho se posiciona em relação à comunidade."
          ctaLabel="Ver comparativo"
          to="/comparativo"
          icon={GitCompareArrows}
        />
      </div>
    </section>
  );
}
