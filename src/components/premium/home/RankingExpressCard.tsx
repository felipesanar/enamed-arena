import { Trophy, ArrowRight, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";
import { useRanking } from "@/hooks/useRanking";
import { useUser } from "@/contexts/UserContext";

export function RankingExpressCard() {
  const { currentUser, loading, simuladosWithResults } = useRanking();
  const { onboarding } = useUser();

  const specialty = onboarding?.specialty || null;
  const institutions = onboarding?.targetInstitutions || [];

  const hasRanking = currentUser != null && currentUser.position != null;
  const latestSimulado = simuladosWithResults[0];
  const simuladoTitle = latestSimulado?.title ?? null;

  return (
    <Link
      to="/ranking"
      className="block h-full group no-underline"
      aria-label="Ver ranking completo"
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-primary/24 bg-[linear-gradient(165deg,rgba(142,31,61,0.08)_0%,#FFFFFF_42%,#FBF7F9_100%)] shadow-[0_16px_34px_-24px_hsl(345_60%_30%/0.5),0_2px_8px_hsl(220_20%_10%/0.05)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-primary/35 hover:shadow-[0_24px_40px_-24px_hsl(345_60%_30%/0.62),0_8px_16px_-12px_hsl(345_60%_30%/0.2)]">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary/70 via-primary/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.05] to-transparent opacity-0 transition-opacity duration-300 pointer-events-none group-hover:opacity-100" />

        <div className="relative z-10 flex flex-1 flex-col p-6 pt-7 md:p-7 md:pt-8">
          <div className="mb-4 flex items-start justify-between">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/18 bg-gradient-to-br from-primary/[0.12] to-primary/[0.2] shadow-[0_10px_20px_-14px_hsl(345_65%_30%/0.6)]">
              <Trophy className="h-5 w-5 text-primary" aria-hidden />
            </div>
            {hasRanking && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/[0.08] border border-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary tracking-wide uppercase">
                Ativo
              </span>
            )}
          </div>

          <h3 className="mb-1 text-[17px] font-bold leading-tight tracking-[-0.015em] text-foreground">
            Ranking
          </h3>
          {simuladoTitle && hasRanking && (
            <p className="text-[12px] text-muted-foreground mb-3">{simuladoTitle}</p>
          )}

          {loading ? (
            <div className="mb-5 flex-1 space-y-3">
              <div className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
              <div className="h-4 w-28 rounded bg-muted animate-pulse" />
            </div>
          ) : hasRanking ? (
            <div className="mb-5 flex-1 space-y-3">
              <div className="flex items-end gap-4 rounded-xl border border-[#E8DEE3] bg-white/88 px-3 py-2.5">
                <div>
                  <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Posição</p>
                  <span className="text-3xl font-extrabold text-primary tabular-nums leading-none">
                    #{currentUser.position}
                  </span>
                </div>
                {currentUser.score != null && (
                  <div className="pb-0.5">
                    <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-0.5">Nota</p>
                    <div className="flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-primary/60" aria-hidden />
                      <span className="text-lg font-bold text-foreground tabular-nums leading-none">
                        {Math.round(currentUser.score)}%
                      </span>
                    </div>
                  </div>
                )}
              </div>

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
              Complete um simulado dentro da janela de execução para aparecer no ranking.
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
