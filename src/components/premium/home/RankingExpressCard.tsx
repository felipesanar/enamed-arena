import { Trophy, ArrowRight, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useRanking } from "@/hooks/useRanking";
import { useUser } from "@/contexts/UserContext";
import { useUserPerformance } from "@/hooks/useUserPerformance";

export function RankingExpressCard() {
  const { currentUser, loading, simuladosWithResults } = useRanking();
  const { onboarding } = useUser();
  const { history } = useUserPerformance();

  const specialty = onboarding?.specialty || null;
  const institutions = onboarding?.targetInstitutions || [];

  // Mock data for preview — remove when real data is available
  const mockPosition = currentUser?.position ?? 12;
  const mockLastScore = history?.[0] ? Math.round(Number(history[0].score_percentage)) : 78;
  const hasRanking = true; // force visible for preview
  const hasSimulados = simuladosWithResults.length > 0;

  return (
    <Link
      to="/ranking"
      className="block h-full group no-underline"
      aria-label="Ver ranking completo"
    >
      <div className="relative overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/[0.03] via-card to-card h-full flex flex-col shadow-[0_2px_16px_-4px_hsl(345_60%_30%/0.08),0_1px_3px_hsl(220_20%_10%/0.04)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:shadow-[0_12px_36px_-8px_hsl(345_60%_30%/0.14),0_4px_8px_hsl(220_20%_10%/0.05)] hover:border-primary/30">
        {/* Decorative accent bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/60 via-primary/40 to-transparent" />

        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1 p-6 md:p-7 pt-7 md:pt-8">
          <div className="flex items-start justify-between mb-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/[0.10] to-primary/[0.18] border border-primary/15 shadow-[0_4px_12px_-4px_hsl(345_65%_30%/0.15)]">
              <Trophy className="h-5.5 w-5.5 text-primary" aria-hidden />
            </div>
            {hasRanking && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/[0.08] border border-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary tracking-wide uppercase">
                Ativo
              </span>
            )}
          </div>

          <h3 className="text-[17px] font-bold text-foreground mb-3 leading-tight tracking-tight">
            Ranking
          </h3>

          {loading ? (
            <div className="flex-1 mb-5 space-y-3">
              <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
              <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            </div>
          ) : hasRanking ? (
            <div className="flex-1 mb-5 space-y-3">
              {/* Position + Score row */}
              <div className="flex items-end gap-4">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Posição</p>
                  <span className="text-3xl font-extrabold text-primary tabular-nums leading-none">
                    #{mockPosition}
                  </span>
                </div>
                {mockLastScore !== null && (
                  <div className="pb-0.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Última nota</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary/60" aria-hidden />
                      <span className="text-lg font-bold text-foreground tabular-nums leading-none">
                        {mockLastScore}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Specialty & Institutions */}
              <div className="space-y-0.5">
                {specialty && (
                  <p className="text-[12px] text-muted-foreground leading-snug">
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
