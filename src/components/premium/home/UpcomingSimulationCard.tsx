import { CalendarDays } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { PremiumLink } from "@/components/premium/PremiumLink";

export function UpcomingSimulationCard() {
  return (
    <SurfaceCard radius="large" className="overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center gap-6 md:gap-8 p-6 md:p-8">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F3ECEF] border border-[#E8E1E5]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <CalendarDays className="h-7 w-7 text-[#5F6778]" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-semibold text-[#1A2233] mb-1.5 leading-tight">
            Nenhum simulado disponível neste momento
          </h2>
          <p className="text-[15px] text-[#5F6778] leading-relaxed">
            A próxima janela ainda não foi liberada. Até lá, aproveite para
            revisar seu Caderno de Erros, acompanhar seu posicionamento e
            preparar sua próxima tentativa com mais precisão.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 shrink-0">
          <PremiumLink to="/simulados" variant="primary" showArrow>
            Ver calendário
          </PremiumLink>
          <PremiumLink to="/caderno-erros" variant="secondary">
            Revisar erros
          </PremiumLink>
        </div>
      </div>
    </SurfaceCard>
  );
}
