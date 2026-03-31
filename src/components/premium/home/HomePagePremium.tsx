import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import type { SegmentFilter } from '@/services/rankingApi';
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { useRanking } from "@/hooks/useRanking";
import { HomeHeroSection } from "./HomeHeroSection";
import { NextSimuladoBanner } from "./NextSimuladoBanner";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { Skeleton } from "@/components/ui/skeleton";

const STAGGER_CHILDREN = 0.07;
const STAGGER_DELAY = 0.03;
const DURATION = 0.5;
const EASE = [0.25, 0.46, 0.45, 0.94] as const;

const HOME_STAGGER_KEY = "ea_home_stagger_done";

function hasHomeStaggerBeenSeen() {
  try {
    return typeof sessionStorage !== "undefined" && sessionStorage.getItem(HOME_STAGGER_KEY) === "1";
  } catch {
    return false;
  }
}

function formatDateShort(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

export function HomePagePremium() {
  const prefersReducedMotion = useReducedMotion();
  const [skipHomeStagger] = useState(() => hasHomeStaggerBeenSeen());
  const { profile, isOnboardingComplete } = useUser();
  const { simulados, loading: simuladosLoading } = useSimulados();
  const { summary, history, loading: perfLoading } = useUserPerformance();
  const {
    currentUser,
    stats: rankingStats,
    loading: rankingLoading,
    simuladosWithResults,
    selectedSimuladoId,
    segmentFilter,
  } = useRanking();

  useEffect(() => {
    return () => {
      try {
        sessionStorage.setItem(HOME_STAGGER_KEY, "1");
      } catch {
        /* ignore quota / private mode */
      }
    };
  }, []);

  const isLoading = simuladosLoading || perfLoading || rankingLoading;

  const stats = useMemo(() => {
    const completed = simulados.filter((s) => s.userState?.finished);
    const fallbackCount = completed.length;
    const fallbackAvg =
      fallbackCount > 0
        ? Math.round(
            completed.reduce(
              (sum, s) => sum + (s.userState?.score ?? 0),
              0
            ) / fallbackCount
          )
        : 0;

    const count = summary?.total_attempts ?? fallbackCount;
    const avg = summary?.avg_score ? Math.round(summary.avg_score) : fallbackAvg;
    return { simuladosRealizados: count, mediaAtual: avg };
  }, [simulados, summary?.avg_score, summary?.total_attempts]);

  const nextSimulado = useMemo(() => {
    const now = Date.now();
    return (
      simulados
        .filter((s) => {
          const start = Date.parse(s.executionWindowStart);
          const end = Date.parse(s.executionWindowEnd);
          return (
            (Number.isFinite(start) && start > now) ||
            (Number.isFinite(end) && end > now)
          );
        })
        .sort(
          (a, b) =>
            Date.parse(a.executionWindowStart) -
            Date.parse(b.executionWindowStart)
        )[0] ?? null
    );
  }, [simulados]);

  const nextWindowDate = nextSimulado
    ? `${formatDateShort(nextSimulado.executionWindowStart)}`
    : null;

  const userName = profile?.name?.split(" ")[0] || "estudante";
  const segment = profile?.segment ?? "guest";
  const lastScore =
    history[0] ? Math.round(Number(history[0].score_percentage)) : null;
  const recentScores = useMemo(
    () =>
      history
        .slice(0, 6)
        .map((entry) =>
          Math.max(0, Math.min(100, Math.round(Number(entry.score_percentage))))
        )
        .reverse(),
    [history]
  );
  const scoreDelta = useMemo(() => {
    if (recentScores.length < 2) return null;
    return (
      recentScores[recentScores.length - 1] -
      recentScores[recentScores.length - 2]
    );
  }, [recentScores]);

  const rankPosition = currentUser?.position ?? null;
  const rankTotal = rankingStats?.totalCandidatos ?? null;
  const selectedRankingTitle = useMemo(() => {
    if (!selectedSimuladoId) return null;
    return (
      simuladosWithResults.find((s) => s.id === selectedSimuladoId)?.title ?? null
    );
  }, [selectedSimuladoId, simuladosWithResults]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: prefersReducedMotion
      ? { opacity: 1 }
      : {
          opacity: 1,
          transition: {
            staggerChildren: STAGGER_CHILDREN,
            delayChildren: STAGGER_DELAY,
          },
        },
  };

  const itemVariants = prefersReducedMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 16, scale: 0.98 },
        visible: {
          opacity: 1,
          y: 0,
          scale: 1,
          transition: { duration: DURATION, ease: EASE },
        },
      };

  if (isLoading) {
    return <HomePageSkeleton />;
  }

  if (!isOnboardingComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className="mb-6 md:mb-7"
      >
        <UpgradeBanner />
        <div className="rounded-3xl border-2 border-dashed border-primary/25 bg-primary/[0.04] p-8 text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            Complete seu perfil
          </h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Informe especialidade e instituições para personalizar rankings e
            desempenho.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 font-medium hover:bg-wine-hover transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Ir ao perfil
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial={skipHomeStagger || prefersReducedMotion ? false : "hidden"}
      animate="visible"
      className="space-y-4 max-md:space-y-4 md:space-y-6"
    >
      {/* Layer 0: Notification banner — always on top */}
      <motion.div variants={itemVariants}>
        <NextSimuladoBanner simulados={simulados} />
      </motion.div>

      {/* Layer 1: Hero premium */}
      <motion.div variants={itemVariants}>
        <HomeHeroSection
          userName={userName}
          simuladosRealizados={stats.simuladosRealizados}
          mediaAtual={stats.mediaAtual}
          lastScore={lastScore}
          lastRankPosition={rankPosition}
          lastRankTotal={rankTotal}
          bestArea={null}
          recentScores={recentScores}
          nextWindowDate={nextWindowDate}
          pendingErrors={null}
        />
      </motion.div>

      {/* Layer 2: Card de performance (diagonal abaixo da hero) */}
      <motion.div variants={itemVariants}>
        <HeroPerformanceCard
          lastScore={lastScore}
          scoreDelta={scoreDelta}
          rankPosition={rankPosition}
          rankTotal={rankTotal}
          recentScores={recentScores}
          rankingTitle={selectedRankingTitle}
          segmentFilter={segmentFilter}
        />
      </motion.div>

      {segment !== "pro" && (
        <motion.div variants={itemVariants}>
          <UpgradeBanner />
        </motion.div>
      )}
    </motion.div>
  );
}

const SEGMENT_LABEL: Record<SegmentFilter, string> = {
  all: 'Geral',
  sanarflix: 'Aluno SanarFlix',
  pro: 'Aluno PRO',
};

function HeroPerformanceCard({
  lastScore,
  scoreDelta,
  rankPosition,
  rankTotal,
  recentScores,
  rankingTitle,
  segmentFilter,
}: {
  lastScore: number | null;
  scoreDelta: number | null;
  rankPosition: number | null;
  rankTotal: number | null;
  recentScores: number[];
  rankingTitle: string | null;
  segmentFilter: SegmentFilter;
}) {
  const hasScore = lastScore !== null;
  const safeScore = lastScore ?? 0;
  const historyMode =
    recentScores.length === 0
      ? "none"
      : recentScores.length === 1
      ? "single"
      : "multi";

  const chartBars = (() => {
    if (historyMode === "multi") return recentScores.slice(-6);
    if (historyMode === "single")
      return [16, 22, 18, 28, 24, safeScore];
    return [12, 18, 15, 22, 26, 30];
  })();
  const maxBar = Math.max(...chartBars, 1);
  const focusIdx = chartBars.length - 1;

  const progressPct = hasScore
    ? Math.max(14, Math.min(96, safeScore))
    : 18;

  const rankLabel =
    rankPosition !== null && rankTotal !== null
      ? `#${rankPosition} de ${rankTotal}`
      : null;

  const tierLabel = (() => {
    if (!hasScore) return "Faça 1 simulado para iniciar";
    const top = Math.max(1, 100 - safeScore);
    return `Top ${top}%`;
  })();

  const nextTier = hasScore
    ? `Próximo nível: Top ${Math.max(1, 100 - Math.min(100, safeScore + 10))}%`
    : "Seu primeiro marco te espera";

  const variationState = (() => {
    const pearl = {
      main: "text-[rgba(245,241,238,0.94)]",
      soft: "text-[rgba(245,241,238,0.82)]",
    };
    if (rankPosition === null) {
      return {
        value: "—",
        tone: pearl.soft,
        helper:
          "Você ainda não aparece no ranking desta prova. Conclua um simulado dentro da janela para gerar comparação.",
      };
    }
    if (scoreDelta === null || scoreDelta === 0) {
      return {
        value: "—",
        tone: pearl.main,
        helper:
          "Ainda não há histórico suficiente para medir mudança de posição entre rankings. Continue realizando os próximos simulados.",
      };
    }
    if (scoreDelta > 0) {
      return {
        value: "↑",
        tone: pearl.main,
        helper:
          "Seu desempenho recente indica evolução. Você está subindo no comparativo do ranking atual.",
      };
    }
    return {
      value: "↓",
      tone: pearl.main,
      helper:
        "Seu desempenho recente caiu em relação às tentativas anteriores. Revise os erros para recuperar posições.",
    };
  })();

  return (
    <div className="flex justify-end">
      <div className="w-full md:w-[56%] lg:w-[48%]">
        <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(148deg,#0C1220_0%,#11192A_38%,#2E0C1E_72%,#3F1028_100%)] p-4 md:p-5 shadow-[0_20px_40px_-20px_rgba(10,14,26,0.85),0_8px_20px_-12px_rgba(60,12,32,0.45)]">
          {/* Atmospheric layers */}
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[rgba(232,56,98,0.16)] blur-[60px]" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-[rgba(12,18,32,0.55)] blur-[40px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_18%_12%,rgba(255,255,255,0.09)_0%,transparent_55%)]" />
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="relative z-10">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-[20px] md:text-[22px] font-bold leading-none tracking-[-0.02em] text-white">
                  Seu caminho até aqui
                </p>
                <p className="mt-1 text-[11px] text-white/45">
                  {hasScore ? `Sua média: ${safeScore}%` : "Início da sua trajetória"}
                </p>
              </div>

              {scoreDelta !== null ? (
                <div
                  className={`mb-1.5 rounded-md border px-2 py-1 ${
                    scoreDelta > 0
                      ? "border-emerald-500/20 bg-emerald-500/[0.08]"
                      : scoreDelta < 0
                      ? "border-red-400/20 bg-red-400/[0.08]"
                      : "border-white/10 bg-white/[0.05]"
                  }`}
                >
                  <span
                    className={`text-[11px] font-semibold tabular-nums ${
                      scoreDelta > 0
                        ? "text-emerald-400"
                        : scoreDelta < 0
                        ? "text-red-400"
                        : "text-white/55"
                    }`}
                  >
                    {scoreDelta > 0 ? "+" : ""}
                    {scoreDelta}
                  </span>
                </div>
              ) : (
                <span className="mb-1.5 text-[11px] font-medium text-white/35">
                  {historyMode === "single"
                    ? "1º resultado"
                    : "início da jornada"}
                </span>
              )}
            </div>

            {/* Mini chart — 6 bars */}
            <div
              className="mt-4 flex items-end gap-1 max-md:gap-0.5 sm:gap-[6px]"
              style={{ height: 76 }}
              aria-hidden
            >
              {chartBars.map((val, idx) => {
                const isFocused = idx === focusIdx;
                const pct = Math.max(18, Math.round((val / maxBar) * 100));
                const isReal =
                  historyMode === "multi" ||
                  (historyMode === "single" && isFocused);

                let bg: string;
                let shadow: string | undefined;
                if (isFocused && isReal) {
                  bg = "linear-gradient(180deg, #E83862 0%, #A4153A 100%)";
                  shadow = "0 10px 18px -8px rgba(232,56,98,0.65)";
                } else if (isReal) {
                  bg =
                    "linear-gradient(180deg, rgba(232,56,98,0.55) 0%, rgba(164,21,58,0.35) 100%)";
                } else if (isFocused) {
                  bg = "rgba(255,255,255,0.18)";
                } else {
                  bg = "rgba(255,255,255,0.1)";
                }

                const tooltipText = isReal
                  ? `Tentativa ${idx + 1}: ${val}%`
                  : "Continue concluindo os simulados para preencher este histórico.";

                return (
                  <div
                    key={idx}
                    className="group/bar relative flex-1 flex flex-col items-center justify-end"
                    style={{ height: "100%" }}
                  >
                    <div
                      className="w-full rounded-[5px] transition-all duration-500"
                      style={{
                        height: `${pct}%`,
                        background: bg,
                        boxShadow: shadow,
                      }}
                    />
                    <span className="pointer-events-none absolute -top-11 left-1/2 z-20 w-max max-w-[180px] -translate-x-1/2 rounded-md border border-white/12 bg-[#0C1320]/95 px-2 py-1 text-[9px] leading-snug text-white/85 opacity-0 shadow-[0_8px_20px_-12px_rgba(0,0,0,0.65)] transition-opacity duration-200 group-hover/bar:opacity-100">
                      {tooltipText}
                    </span>
                    {isFocused && hasScore && (
                      <span className="absolute -top-4 text-[8px] font-bold text-[#E83862] tabular-nums">
                        {val}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Ranking snapshot */}
            {rankPosition === null ? (
              <div className="mt-3 rounded-xl border border-[rgba(245,241,238,0.12)] bg-[rgba(245,241,238,0.06)] p-4 text-center">
                <p className="text-[13px] font-semibold text-[rgba(245,241,238,0.85)] mb-1">
                  Veja como você está no ranking
                </p>
                <p className="text-[11px] text-[rgba(245,241,238,0.55)] leading-relaxed mb-3">
                  Acesse a aba Ranking para escolher um simulado e ver sua posição entre os participantes.
                </p>
                <Link
                  to="/ranking"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(232,56,98,0.3)] bg-[rgba(232,56,98,0.15)] px-3.5 py-1.5 text-[12px] font-semibold text-[#e83862] no-underline transition-colors hover:bg-[rgba(232,56,98,0.22)]"
                >
                  Ir para o Ranking →
                </Link>
              </div>
            ) : (
              <div className="mt-3 rounded-xl border border-[rgba(245,241,238,0.12)] bg-[rgba(245,241,238,0.06)] p-3 backdrop-blur-sm text-[rgba(245,241,238,0.92)]">
                <div className="mb-1 flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 text-[12px] leading-snug text-[rgba(245,241,238,0.96)]">
                    {rankPosition !== null && rankTotal !== null
                      ? `Você está em ${rankPosition}º de ${rankTotal} participantes`
                      : "Complete um simulado para entrar no ranking"}
                  </p>
                  <div className="shrink-0 text-right">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-[rgba(245,241,238,0.62)]">
                      Variação
                    </p>
                    <p className={`mt-0.5 text-[11px] font-bold tabular-nums ${variationState.tone}`}>
                      {variationState.value}
                    </p>
                  </div>
                </div>

                <div className="space-y-1">
                  {rankingTitle && (
                    <p className="text-[10px] leading-snug text-[rgba(245,241,238,0.78)] truncate">
                      {`${rankingTitle} · ${SEGMENT_LABEL[segmentFilter]}`}
                    </p>
                  )}
                  <p className="text-[9px] leading-snug text-[rgba(245,241,238,0.68)]">
                    {variationState.helper}
                  </p>
                </div>

                <div className="my-1.5 h-[3px] rounded-full bg-[rgba(245,241,238,0.14)] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#8E1F3D_0%,#E83862_100%)] transition-all duration-700"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="flex items-center justify-between gap-3 text-[10px] text-[rgba(245,241,238,0.88)]">
                  <span className="font-medium tabular-nums">
                    {rankLabel ?? "Sem colocação"}
                  </span>
                  <span className="truncate text-[rgba(245,241,238,0.72)]">
                    {rankPosition !== null ? tierLabel : nextTier}
                  </span>
                </div>
              </div>
            )}

            {/* CTA */}
            <Link
              to="/desempenho"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white transition-colors duration-200 no-underline group"
            >
              {hasScore
                ? "Ver desempenho completo"
                : "Iniciar jornada de desempenho"}
              <svg
                className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 12 12"
                aria-hidden
              >
                <path
                  d="M2.5 6h7M6.5 3l3 3-3 3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      {/* Banner skeleton — top */}
      <Skeleton className="h-[72px] rounded-[20px]" />

      {/* Hero skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        <div className="lg:col-span-7">
          <Skeleton className="h-[260px] rounded-[28px] bg-primary/[0.06]" />
        </div>
        <div className="lg:col-span-5">
          <Skeleton className="h-[260px] rounded-[28px] bg-muted/60" />
        </div>
      </div>

      {/* Performance card skeleton — offset right */}
      <div className="flex justify-end">
        <Skeleton className="h-[310px] w-full md:w-[56%] lg:w-[48%] rounded-[22px] bg-muted/40" />
      </div>

    </div>
  );
}
