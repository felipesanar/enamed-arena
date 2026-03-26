import { CalendarDays } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { PremiumLink } from "@/components/premium/PremiumLink";

interface NextSimuladoBannerProps {
  nextWindowStart: string | null;
  nextWindowEnd: string | null;
}

function formatDateShort(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

export function NextSimuladoBanner({
  nextWindowStart,
  nextWindowEnd,
}: NextSimuladoBannerProps) {
  if (!nextWindowStart || !nextWindowEnd) {
    return (
      <SurfaceCard radius="large" className="p-4 md:p-5 border-primary/20 bg-accent/30">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-foreground mb-1">
              Nenhum simulado disponível no momento
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Fique atento ao calendário para a próxima janela de execução.
            </p>
          </div>
          <PremiumLink to="/simulados" variant="secondary" showArrow className="shrink-0">
            Ver calendário
          </PremiumLink>
        </div>
      </SurfaceCard>
    );
  }

  const start = formatDateShort(nextWindowStart);
  const end = formatDateShort(nextWindowEnd);

  return (
    <SurfaceCard radius="large" className="p-4 md:p-5 border-primary/20 bg-accent/30">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground mb-1">
              Próximo simulado: {start} a {end}
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Realize o simulado na janela de execução para ter seu resultado computado no ranking nacional.
            </p>
          </div>
        </div>
        <PremiumLink to="/simulados" variant="primary" showArrow className="shrink-0">
          Ver simulados
        </PremiumLink>
      </div>
    </SurfaceCard>
  );
}
