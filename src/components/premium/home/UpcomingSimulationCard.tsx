import { CalendarDays } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { PremiumLink } from "@/components/premium/PremiumLink";

interface UpcomingSimulationCardProps {
  simuladosRealizados: number;
  nextSimulationDate: string | null;
}

function formatNextDate(dateIso: string | null): string {
  if (!dateIso) return "Em breve";
  const parsed = new Date(dateIso);
  if (Number.isNaN(parsed.getTime())) return "Em breve";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(parsed);
}

export function UpcomingSimulationCard({
  simuladosRealizados,
  nextSimulationDate,
}: UpcomingSimulationCardProps) {
  const nextDate = formatNextDate(nextSimulationDate);

  return (
    <SurfaceCard radius="large" className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 md:gap-5 p-4 md:p-5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#F3ECEF] border border-[#E8E1E5]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <CalendarDays className="h-6 w-6 text-[#5F6778]" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg md:text-xl font-semibold text-[#1A2233] mb-1 leading-tight">
            Próximo simulado disponível
          </h2>
          <p className="text-[13px] text-[#5F6778] leading-relaxed mb-1">
            📅 {nextDate}
          </p>
          <p className="text-[13px] text-[#5F6778] leading-relaxed">
            Você já completou {simuladosRealizados} simulado
            {simuladosRealizados !== 1 ? "s" : ""}. O próximo estará disponível em{" "}
            {nextDate}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5 shrink-0">
          <PremiumLink to="/simulados" variant="primary" showArrow>
            Ver cronograma
          </PremiumLink>
        </div>
      </div>
    </SurfaceCard>
  );
}
