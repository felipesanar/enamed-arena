import { Calendar, BookOpen, GitCompareArrows, Target, ArrowRight, CheckCircle2 } from "lucide-react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { SectionHeader } from "@/components/premium/SectionHeader";
import { QuickActionCard } from "./QuickActionCard";
import { useHasAccess, useUser } from "@/contexts/UserContext";
import { useCadernoV2Flag } from "@/hooks/useCadernoV2Flag";
import { simuladosApi } from "@/services/simuladosApi";

function useDueEntriesCount(userId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["notebook-due-count", userId],
    queryFn: async () => {
      if (!userId) return 0;
      const entries = await simuladosApi.getErrorNotebook(userId);
      const now = new Date();
      const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
      return entries.filter((e: any) => {
        const srsDueAt = e.srs_due_at as string | null | undefined;
        if (srsDueAt) {
          return new Date(srsDueAt) <= todayEnd;
        }
        // Fallback: pending (not resolved/deleted)
        return !e.resolved_at;
      }).length;
    },
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}

function ReviewTodayCard() {
  const { profile } = useUser();
  const hasCadernoAccess = useHasAccess("cadernoErros");
  const cadernoV2Flag = useCadernoV2Flag();
  const enabled = hasCadernoAccess && cadernoV2Flag && !!profile?.id;
  const { data: dueCount, isLoading } = useDueEntriesCount(profile?.id, enabled);

  if (!hasCadernoAccess || !cadernoV2Flag) return null;

  const count = dueCount ?? 0;
  const hasItems = count > 0;

  return (
    <Link
      to="/caderno/revisao?mode=due"
      className="block h-full group no-underline"
      aria-label={
        hasItems
          ? `Para revisar hoje: ${count} ${count === 1 ? "questão devida" : "questões devidas"}`
          : "Caderno em dia — nenhuma questão devida hoje"
      }
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-primary/20 bg-[linear-gradient(180deg,hsl(var(--card))_0%,hsl(var(--muted)/0.3)_100%)] p-6 shadow-[0_14px_28px_-24px_rgba(58,22,34,0.5),0_2px_8px_rgba(58,22,34,0.05)] dark:shadow-[0_14px_28px_-24px_rgba(0,0,0,0.5),0_2px_8px_rgba(0,0,0,0.3)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-primary/28 hover:shadow-[0_20px_34px_-24px_rgba(58,22,34,0.62),0_6px_14px_-10px_rgba(58,22,34,0.14)] dark:hover:shadow-[0_20px_34px_-24px_rgba(0,0,0,0.6),0_6px_14px_-10px_rgba(0,0,0,0.35)] md:p-7">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/18 bg-gradient-to-br from-primary/[0.1] to-primary/[0.16] shadow-[0_8px_16px_-10px_hsl(345_65%_30%/0.42)]">
            <Target className="h-5 w-5 text-primary" aria-hidden />
          </div>

          <h3 className="mb-1.5 text-[17px] font-semibold leading-tight tracking-[-0.012em] text-foreground">
            Para revisar hoje
          </h3>

          <div className="mb-5 flex-1">
            {isLoading ? (
              <div className="h-4 w-24 animate-pulse rounded-md bg-muted" />
            ) : hasItems ? (
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                <span className="text-primary font-bold text-[15px]">{count}</span>{" "}
                {count === 1 ? "questão devida" : "questões devidas"} no seu caderno.
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-[13px] leading-relaxed text-muted-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                Caderno em dia — nenhuma revisão pendente.
              </p>
            )}
          </div>

          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary group-hover:gap-2.5 transition-all duration-200">
            {hasItems ? "Revisar agora" : "Ver caderno"}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

export function QuickActionsSection() {
  const hasCadernoAccess = useHasAccess("cadernoErros");
  const cadernoV2Flag = useCadernoV2Flag();
  const showReviewCard = hasCadernoAccess && cadernoV2Flag;

  return (
    <section aria-labelledby="quick-actions-heading">
      <SectionHeader
        id="quick-actions-heading"
        title="Continue sua preparação"
        eyebrow="Ações rápidas"
        className="mb-6"
      />
      <div className={`grid grid-cols-1 gap-5 md:gap-6 ${showReviewCard ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        <QuickActionCard
          title="Calendário"
          copy="Planeje sua rotina e antecipe o próximo simulado."
          ctaLabel="Abrir calendário"
          to="/simulados"
          icon={Calendar}
        />
        <QuickActionCard
          title="Caderno de Erros"
          copy="Transforme erros em avanço e acelere sua evolução."
          ctaLabel="Abrir caderno"
          to={showReviewCard ? "/caderno" : "/caderno-erros"}
          icon={BookOpen}
        />
        <QuickActionCard
          title="Comparativo"
          copy="Entenda como seu desempenho se posiciona em relação à comunidade."
          ctaLabel="Ver comparativo"
          to="/comparativo"
          icon={GitCompareArrows}
        />
        {showReviewCard && <ReviewTodayCard />}
      </div>
    </section>
  );
}
