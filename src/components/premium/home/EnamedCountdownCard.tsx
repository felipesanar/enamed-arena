import { useEffect, useMemo, useRef } from "react";
import { Link } from "react-router-dom";
import { Flame, ArrowUpRight } from "lucide-react";
import { ENAMED_DATE } from "@/components/caderno/PageHero";
import { useCadernoRoutes } from "@/hooks/useCadernoRoutes";
import { useHasAccess } from "@/contexts/UserContext";
import { trackEvent } from "@/lib/analytics";

/** Janela em que a contagem regressiva passa a ser exibida na home. */
const COUNTDOWN_WINDOW_DAYS = 90;

function daysUntilEnamed(): number {
  const now = Date.now();
  const diff = ENAMED_DATE.getTime() - now;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * EnamedCountdownCard — "Reta Final".
 *
 * Surface da home para PRO + Caderno v2: mostra os dias restantes até o ENAMED
 * com CTA para o War Room. Só renderiza dentro da janela sensata (<= 90 dias)
 * e quando o aluno tem acesso PRO + flag v2 ativa. Caso contrário, nada.
 */
export function EnamedCountdownCard() {
  const caderno = useCadernoRoutes();
  const hasCadernoAccess = useHasAccess("cadernoErros");
  const enabled = hasCadernoAccess && caderno.v2;

  const daysUntil = useMemo(() => daysUntilEnamed(), []);
  const withinWindow = daysUntil >= 0 && daysUntil <= COUNTDOWN_WINDOW_DAYS;
  const shouldRender = enabled && withinWindow;

  const trackedRef = useRef(false);
  useEffect(() => {
    if (!shouldRender || trackedRef.current) return;
    trackedRef.current = true;
    trackEvent("caderno_home_countdown_viewed", { days_until: daysUntil });
  }, [shouldRender, daysUntil]);

  if (!shouldRender) return null;

  const daysLabel = daysUntil === 1 ? "Falta 1 dia" : `Faltam ${daysUntil} dias`;

  return (
    <Link
      to={caderno.retaFinal}
      className="group flex h-full min-h-0 no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-[16px]"
      aria-label={`Reta Final. ${daysLabel} para o ENAMED. Abrir War Room.`}
    >
      <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-primary/20 bg-[linear-gradient(165deg,hsl(var(--primary)/0.08)_0%,hsl(var(--card))_46%,hsl(var(--muted)/0.3)_100%)] p-3 sm:p-3.5 shadow-[0_8px_18px_-14px_hsl(var(--primary)/0.35),0_2px_6px_hsl(220_20%_10%/0.04)] dark:shadow-[0_8px_18px_-14px_rgba(0,0,0,0.5),0_2px_6px_rgba(0,0,0,0.25)] transition-all duration-[240ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-primary/28 hover:shadow-[0_12px_22px_-16px_hsl(var(--primary)/0.42),0_4px_10px_-8px_hsl(var(--primary)/0.12)]">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
        <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-primary/[0.06] blur-xl" />

        <div className="relative z-10 flex min-h-0 flex-1 flex-col">
          <div className="mb-1.5 flex shrink-0 items-start justify-between gap-1.5">
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/18 bg-gradient-to-br from-primary/[0.1] to-primary/[0.18] shadow-[0_6px_14px_-10px_hsl(345_65%_30%/0.4)]">
              <Flame className="h-3.5 w-3.5 text-primary" aria-hidden />
            </div>
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-card/90 text-muted-foreground/65 shadow-sm transition-all duration-200 group-hover:border-primary/25 group-hover:text-primary">
              <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
            </span>
          </div>

          <p className="mb-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.12em] text-primary sm:text-[11px]">
            Reta Final
          </p>

          <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 border-t border-primary/[0.1] pt-2">
            <p className="font-extrabold tracking-[-0.03em] text-foreground text-[clamp(1.05rem,2vw+0.5rem,1.45rem)] leading-[1.1]">
              {daysLabel} para o ENAMED
            </p>
            <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-body-sm sm:leading-snug">
              Ative o modo War Room e priorize seus pontos fracos no sprint final.
            </p>
          </div>

          <div className="mt-auto shrink-0 pt-1.5">
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none tracking-wide text-primary sm:text-[11px]">
              Abrir War Room
              <span aria-hidden className="text-primary/55">→</span>
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
