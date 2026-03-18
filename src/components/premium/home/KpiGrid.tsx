import { Target, TrendingUp, Trophy, Calendar } from "lucide-react";
import { SectionHeader } from "@/components/premium/SectionHeader";
import { KpiCard } from "./KpiCard";

interface KpiGridProps {
  simuladosRealizados: number;
  mediaAtual: number;
  simuladosNoAno: number;
}

export function KpiGrid({
  simuladosRealizados,
  mediaAtual,
  simuladosNoAno,
}: KpiGridProps) {
  const currentYear = new Date().getFullYear();

  return (
    <section aria-labelledby="kpi-heading">
      <SectionHeader
        id="kpi-heading"
        title="Sua evolução em números"
        eyebrow="Métricas"
        className="mb-6"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 md:gap-6">
      <KpiCard
        icon={Target}
        label="Simulados realizados"
        value={simuladosRealizados}
        supportingText="Seu histórico começou a ser construído"
        tag="Base inicial"
      />
      <KpiCard
        icon={TrendingUp}
        label="Média atual"
        value={`${mediaAtual}%`}
        supportingText="Sua linha de base já foi registrada"
        tag="Primeiro marco"
      />
      <KpiCard
        icon={Trophy}
        label="Ranking"
        value="Ver posição"
        supportingText="Compare seu momento com outros alunos"
        tag="Comparativo"
        href="/ranking"
      />
      <KpiCard
        icon={Calendar}
        label="Simulados no ano"
        value={simuladosNoAno}
        supportingText={`Seu ciclo de ${currentYear} já começou`}
        tag="Temporada atual"
      />
      </div>
    </section>
  );
}
