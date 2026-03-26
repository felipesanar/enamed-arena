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
  const insightPrincipal =
    simuladosRealizados < 3
      ? "Priorize constância nas próximas tentativas para consolidar sua linha de base."
      : "Você já tem base suficiente para ajustar estratégia por padrão de erro.";
  const insightSecundario =
    mediaAtual < 60
      ? "Revise os temas com menor acerto antes do próximo simulado."
      : "Mantenha a revisão ativa para sustentar sua evolução.";

  return (
    <section aria-labelledby="kpi-heading">
      <SectionHeader
        id="kpi-heading"
        title="Desempenho"
        eyebrow="Visão geral + inteligência"
        className="mb-4"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
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
      <div className="mt-3 rounded-2xl border border-[#E8E1E5] bg-white/80 p-3 md:p-4">
        <p className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#8C93A3] mb-2">
          Inteligência do momento
        </p>
        <p className="text-[13px] text-[#1A2233] leading-relaxed mb-1">
          {insightPrincipal}
        </p>
        <p className="text-[12px] text-[#5F6778] leading-relaxed">
          {insightSecundario}
        </p>
      </div>
    </section>
  );
}
