import { CalendarDays, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

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
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-r from-muted/60 via-card to-muted/40 p-4 md:p-5 shadow-[0_2px_12px_-4px_hsl(220_20%_10%/0.06)]">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-3 flex-1">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted-foreground/10 border border-muted-foreground/10">
              <CalendarDays className="h-5 w-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <p className="text-[14px] font-semibold text-foreground mb-0.5">
                Nenhum simulado disponível no momento
              </p>
              <p className="text-[13px] text-muted-foreground leading-relaxed">
                Fique atento ao calendário para a próxima janela.
              </p>
            </div>
          </div>
          <Link
            to="/simulados"
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-muted-foreground hover:text-foreground transition-colors shrink-0"
          >
            Ver calendário
            <ArrowRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    );
  }

  const start = formatDateShort(nextWindowStart);
  const end = formatDateShort(nextWindowEnd);

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/[0.07] via-accent/60 to-primary/[0.04] border border-primary/15 p-4 md:p-5 shadow-[0_2px_12px_-4px_hsl(345_65%_30%/0.08)]">
      {/* Decorative shimmer */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/[0.03] to-transparent pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/15 shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.15)]">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-foreground mb-0.5">
              Próximo simulado: <span className="text-primary font-bold">{start} a {end}</span>
            </p>
            <p className="text-[13px] text-muted-foreground leading-relaxed">
              Realize na janela de execução para entrar no ranking nacional.
            </p>
          </div>
        </div>
        <Link
          to="/simulados"
          className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-4 py-2 text-[13px] font-semibold shadow-[0_2px_8px_-2px_hsl(345_65%_30%/0.3)] hover:shadow-[0_4px_14px_-2px_hsl(345_65%_30%/0.35)] hover:brightness-110 transition-all duration-200 active:scale-[0.98] shrink-0 no-underline"
        >
          Ver simulados
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
