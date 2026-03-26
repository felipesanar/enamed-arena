import { Trophy, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useRanking } from "@/hooks/useRanking";
import { useUser } from "@/contexts/UserContext";

export function RankingExpressCard() {
  const { currentUser, loading, simuladosWithResults } = useRanking();
  const { onboarding } = useUser();

  const specialty = onboarding?.specialty || null;
  const institutions = onboarding?.targetInstitutions || [];
  const hasRanking = !loading && currentUser;
  const hasSimulados = simuladosWithResults.length > 0;

  return (
    <Link
      to="/ranking"
      className="block h-full group no-underline"
      aria-label="Ver ranking completo"
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/90 backdrop-blur-sm p-6 md:p-7 h-full flex flex-col shadow-[0_2px_12px_-4px_hsl(220_20%_10%/0.06),0_1px_2px_hsl(220_20%_10%/0.03)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:shadow-[0_8px_28px_-8px_hsl(220_20%_10%/0.1),0_2px_6px_hsl(220_20%_10%/0.04)] hover:border-primary/20">
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.14] border border-primary/15 mb-5 shadow-[0_2px_6px_-2px_hsl(345_65%_30%/0.12)]">
            <Trophy className="h-5 w-5 text-primary" aria-hidden />
          </div>

          <h3 className="text-[16px] font-semibold text-foreground mb-1.5 leading-tight">
            Ranking
          </h3>

          {loading ? (
            <div className="flex-1 mb-5 space-y-2">
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            </div>
          ) : hasRanking ? (
            <div className="flex-1 mb-5">
              <div className="flex items-baseline gap-1.5 mb-2">
                <span className="text-3xl font-bold text-primary tabular-nums leading-none">
                  #{currentUser.position}
                </span>
              </div>

              {specialty && (
                <p className="text-[12px] text-muted-foreground leading-snug mb-0.5">
                  <span className="font-medium text-foreground/80">{specialty}</span>
                </p>
              )}

              {institutions.length > 0 && (
                <p className="text-[12px] text-muted-foreground truncate leading-snug">
                  {institutions.slice(0, 2).join(", ")}
                  {institutions.length > 2 && ` +${institutions.length - 2}`}
                </p>
              )}
            </div>
          ) : (
            <p className="text-[13px] text-muted-foreground leading-relaxed flex-1 mb-5">
              {hasSimulados
                ? "Realize um simulado para aparecer no ranking."
                : "Seu ranking aparecerá aqui após o primeiro simulado."}
            </p>
          )}

          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary group-hover:gap-2.5 transition-all duration-200">
            Ver ranking completo
            <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
