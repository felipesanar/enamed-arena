import { SectionHeader } from "@/components/premium/SectionHeader";
import { InsightCard } from "./InsightCard";

function getInsights(simuladosCount: number) {
  return [
    {
      title: "Sua base ainda é inicial",
      text: `Com apenas ${simuladosCount} simulado${simuladosCount !== 1 ? "s" : ""}, o foco agora é ganhar amostra. Mais 2 tentativas tornam sua leitura muito mais confiável.`,
    },
    {
      title: "Revisão gera mais retorno agora",
      text: "Antes de perseguir volume, consolide seus erros e fortaleça retenção.",
    },
    {
      title: "Seu comparativo vai ganhar valor em breve",
      text: "Quanto mais histórico você constrói, mais útil fica a leitura de tendência.",
    },
  ];
}

interface InsightsSectionProps {
  simuladosRealizados?: number;
}

export function InsightsSection({ simuladosRealizados = 1 }: InsightsSectionProps) {
  const insights = getInsights(simuladosRealizados);
  return (
    <section aria-labelledby="insights-heading">
      <SectionHeader
        id="insights-heading"
        title="Leituras do seu momento"
        eyebrow="Inteligência"
        className="mb-6"
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6">
        {insights.map((item) => (
          <InsightCard key={item.title} title={item.title} text={item.text} />
        ))}
      </div>
    </section>
  );
}
