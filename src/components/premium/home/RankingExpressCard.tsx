import { Trophy } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { PremiumLink } from "@/components/premium/PremiumLink";
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
    <SurfaceCard radius="large" interactive className="p-6 md:p-7 h-full flex flex-col">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 mb-5">
        <Trophy className="h-6 w-6 text-primary" aria-hidden />
      </div>

      <h3 className="text-lg font-semibold text-foreground mb-2 leading-tight">
        Ranking
      </h3>

      {loading ? (
        <p className="text-[14px] text-muted-foreground leading-relaxed flex-1 mb-5">
          Carregando…
        </p>
      ) : hasRanking ? (
        <div className="flex-1 space-y-3 mb-5">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-primary tabular-nums">
              #{currentUser.position}
            </span>
          </div>

          {specialty && (
            <p className="text-[13px] text-muted-foreground">
              <span className="font-medium text-foreground">{specialty}</span>
            </p>
          )}

          {institutions.length > 0 && (
            <p className="text-[13px] text-muted-foreground truncate">
              {institutions.slice(0, 2).join(", ")}
              {institutions.length > 2 && ` +${institutions.length - 2}`}
            </p>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-muted-foreground leading-relaxed flex-1 mb-5">
          {hasSimulados
            ? "Realize um simulado para aparecer no ranking."
            : "Seu ranking aparecerá aqui após o primeiro simulado."}
        </p>
      )}

      <PremiumLink to="/ranking" variant="secondary" showArrow>
        Ver ranking completo
      </PremiumLink>
    </SurfaceCard>
  );
}
