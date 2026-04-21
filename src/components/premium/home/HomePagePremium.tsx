import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { BarChart3, AlertTriangle, CalendarDays, BookOpen, ArrowUpRight, Lock, Clock } from "lucide-react";
const PRO_ENAMED_URL = "https://sanarflix.com.br/sanarflix-pro-enamed";
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { useRanking } from "@/hooks/useRanking";
import { useSimuladoDetail } from "@/hooks/useSimuladoDetail";
import { useExamResult } from "@/hooks/useExamResult";
import { computePerformanceBreakdown } from "@/lib/resultHelpers";
import { deriveHomeHeroState } from "@/lib/home-hero-state";
import { canViewResults, formatDateShort as formatDateShortWithYear } from "@/lib/simulado-helpers";
import { HomeHeroSection } from "./HomeHeroSection";
import { NextSimuladoBanner } from "./NextSimuladoBanner";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { Skeleton } from "@/components/ui/skeleton";

const STAGGER_CHILDREN = 0.055;
const STAGGER_DELAY = 0.02;
const DURATION = 0.38;
const EASE = [0.22, 0.9, 0.35, 1.0] as const;

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

/** Linha única: em qual chave o aluno concorre (perfil de onboarding). */
function buildRankingCompetitionLine(
  specialty: string,
  institutions: string[],
): string {
  const spec = specialty.trim();
  const insts = institutions.map((i) => String(i).trim()).filter(Boolean);
  let instLabel = "";
  if (insts.length === 1) instLabel = insts[0];
  else if (insts.length === 2) instLabel = `${insts[0]} e ${insts[1]}`;
  else if (insts.length > 2)
    instLabel = `${insts[0]}, ${insts[1]} e mais ${insts.length - 2}`;

  if (spec && instLabel) return `${spec} · ${instLabel}`;
  if (spec) return spec;
  if (instLabel) return instLabel;
  return "Especialidade e instituições do seu perfil";
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
    userSpecialty,
    userInstitutions,
  } = useRanking();

  // Compute worstArea from last simulado
  const lastSimuladoId = summary?.last_simulado_id ?? null;
  const { questions: lastQuestions } = useSimuladoDetail(lastSimuladoId ?? undefined);
  const { examState: lastExamState } = useExamResult(lastSimuladoId ?? undefined);

  const worstArea = useMemo(() => {
    if (!lastExamState || !lastQuestions.length) return null;
    if (lastExamState.status !== 'submitted' && lastExamState.status !== 'expired') return null;
    const breakdown = computePerformanceBreakdown(lastExamState, lastQuestions);
    const byArea = breakdown.byArea;
    return byArea.length > 0 ? byArea[byArea.length - 1].area : null;
  }, [lastExamState, lastQuestions]);

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
    const completed = simulados.filter((s) => canViewResults(s.status));
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

  // Detect most-recent closed_waiting simulado where the student has finished.
  // Used to show a pending banner when they have prior released results.
  const pendingSimulado = useMemo(
    () =>
      simulados
        .filter((s) => s.status === "closed_waiting" && s.userState?.finished)
        .sort(
          (a, b) =>
            Date.parse(b.executionWindowEnd) - Date.parse(a.executionWindowEnd),
        )[0] ?? null,
    [simulados],
  );

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
  /** Até 6 notas, da esquerda para a direita: mais antiga → mais recente (última à direita). */
  const recentScores = useMemo(() => {
    if (history.length === 0) return [];
    const asc = [...history].sort((a, b) => {
      const ta = Date.parse(a.finished_at);
      const tb = Date.parse(b.finished_at);
      const na = Number.isFinite(ta) ? ta : 0;
      const nb = Number.isFinite(tb) ? tb : 0;
      return na - nb;
    });
    return asc
      .slice(-6)
      .map((entry) =>
        Math.max(0, Math.min(100, Math.round(Number(entry.score_percentage))))
      );
  }, [history]);
  const scoreDelta = useMemo(() => {
    if (recentScores.length < 2) return null;
    return (
      recentScores[recentScores.length - 1] -
      recentScores[recentScores.length - 2]
    );
  }, [recentScores]);

  const heroState = useMemo(
    () =>
      deriveHomeHeroState({
        userName,
        isOnboardingComplete,
        simulados,
        simuladosRealizados: stats.simuladosRealizados,
        mediaAtual: stats.mediaAtual,
        lastScore,
        recentScores,
      }),
    [
      isOnboardingComplete,
      lastScore,
      recentScores,
      simulados,
      stats.mediaAtual,
      stats.simuladosRealizados,
      userName,
    ],
  );

  const rankPosition = currentUser?.position ?? null;
  const rankTotal = rankingStats?.totalCandidatos ?? null;

  const rankingCompetitionLine = useMemo(
    () => buildRankingCompetitionLine(userSpecialty, userInstitutions),
    [userSpecialty, userInstitutions]
  );

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
      variants={skipHomeStagger ? undefined : containerVariants}
      initial={prefersReducedMotion ? false : skipHomeStagger ? { opacity: 0 } : "hidden"}
      animate={skipHomeStagger ? { opacity: 1 } : "visible"}
      transition={skipHomeStagger ? { duration: 0.28, ease: "easeOut" } : undefined}
      className="space-y-4 md:space-y-6"
    >
      {/* Layer 0: Notification banner — always on top */}
      <motion.div variants={itemVariants}>
        <NextSimuladoBanner simulados={simulados} />
      </motion.div>

      {/* Layer 1: Hero premium — full width */}
      <motion.div variants={itemVariants}>
        <HomeHeroSection heroState={heroState} />
        {pendingSimulado && (recentScores.length > 0 || stats.simuladosRealizados > 0) && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-muted bg-muted/40 px-4 py-2.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              Resultado do <strong className="font-medium text-foreground">{pendingSimulado.title}</strong> disponível em{" "}
              {formatDateShortWithYear(pendingSimulado.resultsReleaseAt)}
            </span>
          </div>
        )}
      </motion.div>

      {/* Layer 2: KPI grid (left) + "Seu caminho até aqui" (right) */}
      <motion.div variants={itemVariants}>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5 lg:items-stretch">
          <div className="lg:col-span-5 lg:flex lg:min-h-0 lg:flex-col">
            <KpiGridSection
              lastScore={lastScore}
              worstArea={worstArea}
              nextWindowDate={nextWindowDate}
              nextSimuladoTitle={nextSimulado?.title ?? null}
              pendingErrors={null}
              segment={segment}
            />
          </div>
          <div className="lg:col-span-7 lg:min-h-0 min-w-0">
            <HeroPerformanceCard
              lastScore={lastScore}
              scoreDelta={scoreDelta}
              rankPosition={rankPosition}
              rankTotal={rankTotal}
              recentScores={recentScores}
              rankingCompetitionLine={rankingCompetitionLine}
              hasRankingConfig={simuladosWithResults.length > 0}
            />
          </div>
        </div>
      </motion.div>

      {segment !== "pro" && (
        <motion.div variants={itemVariants}>
          <UpgradeBanner />
        </motion.div>
      )}
    </motion.div>
  );
}

function HeroPerformanceCard({
  lastScore,
  scoreDelta,
  rankPosition,
  rankTotal,
  recentScores,
  rankingCompetitionLine,
  hasRankingConfig,
}: {
  lastScore: number | null;
  scoreDelta: number | null;
  rankPosition: number | null;
  rankTotal: number | null;
  recentScores: number[];
  rankingCompetitionLine: string;
  hasRankingConfig: boolean;
}) {
  const hasScore = lastScore !== null;
  const safeScore = lastScore ?? 0;
  const historyMode =
    recentScores.length === 0
      ? "none"
      : recentScores.length === 1
      ? "single"
      : "multi";

  /**
   * Multi: esquerda → direita = mais antigo → mais recente (destaque à direita).
   * Single: 1º resultado à esquerda; placeholders à direita (evita “única barra” no fim).
   * None: placeholders; destaque à esquerda como início da jornada.
   */
  const chartBars = (() => {
    if (historyMode === "multi") return recentScores;
    if (historyMode === "single")
      return [safeScore, 16, 22, 18, 28, 24];
    return [12, 18, 15, 22, 26, 30];
  })();
  const maxBar = Math.max(...chartBars, 1);
  const focusIdx =
    historyMode === "multi" ? chartBars.length - 1 : 0;

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
    <div className="relative overflow-hidden rounded-[22px] border border-white/[0.07] bg-[linear-gradient(148deg,#0C1220_0%,#11192A_38%,#2E0C1E_72%,#3F1028_100%)] p-4 md:p-5 shadow-[0_20px_40px_-20px_rgba(10,14,26,0.85),0_8px_20px_-12px_rgba(60,12,32,0.45)] lg:h-full">
          {/* Atmospheric layers */}
          <div className="pointer-events-none absolute -right-14 -top-14 h-44 w-44 rounded-full bg-[rgba(232,56,98,0.16)] blur-[60px]" />
          <div className="pointer-events-none absolute -left-10 -bottom-10 h-36 w-36 rounded-full bg-[rgba(12,18,32,0.55)] blur-[40px]" />
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_18%_12%,rgba(255,255,255,0.09)_0%,transparent_55%)]" />
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

          <div className="relative z-10 space-y-3">
            <div className="flex items-end justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[18px] sm:text-[20px] md:text-[22px] font-bold leading-none tracking-[-0.02em] text-white">
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
              className="mt-4 flex items-end gap-[3px] sm:gap-[6px]"
              style={{ height: 76 }}
              aria-hidden
            >
              {chartBars.map((val, idx) => {
                const isFocused = idx === focusIdx;
                const pct = Math.max(18, Math.round((val / maxBar) * 100));
                const isReal =
                  historyMode === "multi" ||
                  (historyMode === "single" && idx === 0);

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
                  ? historyMode === "multi"
                    ? `${idx + 1}º (esquerda = mais antigo): ${val}%`
                    : `1º resultado: ${val}%`
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

            {/* Ranking snapshot */}
            {!hasRankingConfig ? (
              /* Empty state: no simulados with released results yet */
              <div className="mt-3 rounded-xl border border-[rgba(245,241,238,0.12)] bg-[rgba(245,241,238,0.06)] p-4 text-center">
                <p className="text-[13px] font-semibold text-[rgba(245,241,238,0.85)] mb-1">
                  Você ainda não configurou seu ranking
                </p>
                <p className="text-[11px] text-[rgba(245,241,238,0.55)] leading-relaxed mb-3">
                  Escolha um ranking para acompanhar sua evolução e ver sua posição entre os participantes.
                </p>
                <Link
                  to="/ranking"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[rgba(232,56,98,0.3)] bg-[rgba(232,56,98,0.15)] px-3.5 py-1.5 text-[12px] font-semibold text-[#e83862] no-underline transition-colors hover:bg-[rgba(232,56,98,0.22)]"
                >
                  Ir para o Ranking →
                </Link>
              </div>
            ) : rankPosition === null ? (
              /* Has results but user not yet ranked */
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
              /* Ranked: show position with descriptive label */
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
                  <p
                    className="text-[10px] leading-snug text-[rgba(245,241,238,0.78)] max-md:line-clamp-2 md:truncate"
                    title={`Sua chave no ranking: ${rankingCompetitionLine}`}
                  >
                    <span className="text-[rgba(245,241,238,0.55)]">
                      Sua chave no ranking:{" "}
                    </span>
                    {rankingCompetitionLine}
                  </p>
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

            <Link
              to="/ranking"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-semibold text-white/70 hover:text-white transition-colors duration-200 no-underline group"
            >
              Ver ranking completo
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
  );
}

function KpiGridSection({
  lastScore,
  worstArea,
  nextWindowDate,
  nextSimuladoTitle,
  pendingErrors,
  segment,
}: {
  lastScore: number | null;
  worstArea: string | null;
  nextWindowDate: string | null;
  nextSimuladoTitle: string | null;
  pendingErrors: number | null;
  segment: string;
}) {
  const isPro = segment === "pro";

  const lastSimuladoAria = [
    "Desempenho",
    lastScore !== null ? `nota ${lastScore}%` : "sem nota ainda",
  ].join(", ");

  const windowAria = nextWindowDate
    ? `Próximo simulado, janela em ${nextWindowDate}`
    : "Simulados, nenhuma data futura listada";

  const cadernoAria =
    pendingErrors !== null && pendingErrors > 0
      ? `Caderno de erros, ${pendingErrors} questões pendentes`
      : "Caderno de erros, revisar questões marcadas";

  const kpis = [
    {
      key: "last",
      title: "Último resultado",
      value: lastScore !== null ? `${lastScore}%` : "—",
      hint:
        lastScore !== null
          ? "Nota do último simulado concluído."
          : "Conclua um simulado para registrar sua primeira nota.",
      footnote: "Ver evolução e histórico",
      valueKind: "percent" as const,
      ariaLabel: lastSimuladoAria,
      to: "/desempenho",
      icon: BarChart3,
      locked: false,
    },
    {
      key: "ranking",
      title: "Especialidade de atenção",
      value: worstArea ?? "—",
      hint:
        worstArea !== null
          ? "Sugerido com base no seu último desempenho por especialidade."
          : "Complete um simulado para ver onde investir estudo.",
      footnote: "Abrir análise por especialidade",
      valueKind: "text" as const,
      ariaLabel: `Especialidade de atenção: ${worstArea ?? "sem dados ainda"}`,
      to: "/desempenho",
      icon: AlertTriangle,
      locked: false,
    },
    {
      key: "window",
      title: "Próximo simulado",
      value: nextWindowDate ?? "—",
      hint:
        nextSimuladoTitle !== null
          ? nextSimuladoTitle
          : nextWindowDate !== null
            ? "Início da janela de execução."
            : "Nenhum simulado futuro na lista no momento.",
      footnote: "Ver agenda de simulados",
      valueKind: "date" as const,
      ariaLabel: windowAria,
      to: "/simulados",
      icon: CalendarDays,
      locked: false,
    },
    {
      key: "caderno",
      title: "Caderno de erros",
      value: pendingErrors !== null ? String(pendingErrors) : "Revisar",
      hint: isPro
        ? "Questões marcadas para revisão comentada."
        : "Disponível para assinantes SanarFlix PRO.",
      footnote: isPro ? "Continuar revisão" : "Conhecer o PRO",
      valueKind: pendingErrors !== null && pendingErrors > 0 ? ("count" as const) : ("cta" as const),
      ariaLabel: cadernoAria,
      to: "/caderno-erros",
      icon: BookOpen,
      locked: !isPro,
    },
  ];

  return (
    <div className="grid w-full grid-cols-2 auto-rows-fr gap-2 sm:gap-2 min-h-0 lg:h-full lg:min-h-0 lg:flex-1">
      {kpis.map((kpi) => {
        const isPercent = kpi.valueKind === "percent";
        const isTextValue = kpi.valueKind === "text";
        const isDate = kpi.valueKind === "date";
        const isCount = kpi.valueKind === "count";

        const cardInner = (
          <div className="relative flex h-full w-full min-h-0 flex-col overflow-hidden rounded-[16px] border border-primary/20 bg-[linear-gradient(165deg,rgba(142,31,61,0.06)_0%,#FFFFFF_44%,#FAF5F7_100%)] p-2.5 sm:p-3 shadow-[0_8px_18px_-14px_hsl(345_60%_30%/0.35),0_2px_6px_hsl(220_20%_10%/0.04)] transition-all duration-[240ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-0.5 hover:border-primary/28 hover:shadow-[0_12px_22px_-16px_hsl(345_60%_30%/0.42),0_4px_10px_-8px_hsl(345_60%_30%/0.12)]">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
            <div className="pointer-events-none absolute -right-5 -top-5 h-16 w-16 rounded-full bg-primary/[0.05] blur-xl" />
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

            {kpi.locked && (
              <div className="group/lock absolute inset-0 z-20 rounded-[16px] bg-background/40 backdrop-blur-[1px] flex items-center justify-center cursor-pointer">
                <div className="flex flex-col items-center gap-1.5 rounded-xl border border-primary/20 bg-white/90 px-3 py-2 shadow-sm transition-all duration-200 group-hover/lock:scale-105 group-hover/lock:shadow-md">
                  <Lock className="h-4 w-4 text-primary" aria-hidden />
                  <span className="text-[9px] font-bold text-primary/75 uppercase tracking-[0.14em]">
                    PRO
                  </span>
                </div>
                <div className="pointer-events-none absolute inset-x-2 bottom-2 rounded-lg border border-primary/15 bg-white/95 px-2.5 py-2 opacity-0 shadow-lg transition-all duration-200 group-hover/lock:opacity-100 group-hover/lock:translate-y-0 translate-y-1">
                  <p className="text-[10px] font-semibold text-foreground leading-tight mb-0.5">Exclusivo para assinantes PRO</p>
                  <p className="text-[9px] text-muted-foreground leading-snug">Assine o SanarFlix Pro e desbloqueie o Caderno de Erros e recursos avançados.</p>
                </div>
              </div>
            )}

            <div className="relative z-10 flex min-h-0 flex-1 flex-col">
              <div className="mb-1.5 flex shrink-0 items-start justify-between gap-1.5">
                <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-primary/18 bg-gradient-to-br from-primary/[0.1] to-primary/[0.18] shadow-[0_6px_14px_-10px_hsl(345_65%_30%/0.4)]">
                  <kpi.icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                </div>
                <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/50 bg-white/90 text-muted-foreground/65 shadow-sm transition-all duration-200 group-hover:border-primary/25 group-hover:text-primary">
                  <ArrowUpRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden />
                </span>
              </div>

              <p className="mb-1 line-clamp-2 text-[10px] font-semibold leading-tight tracking-wide text-muted-foreground sm:text-[11px]">
                {kpi.title}
              </p>

              <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 border-t border-primary/[0.1] pt-2">
                <p
                  className={[
                    "font-extrabold tracking-[-0.03em] text-foreground",
                    isPercent || isDate || isCount
                      ? "text-[clamp(1.2rem,2.4vw+0.55rem,1.65rem)] leading-[1.08] tabular-nums"
                      : isTextValue
                        ? "text-[clamp(0.8125rem,1.2vw+0.5rem,1.0625rem)] font-bold leading-snug line-clamp-2 break-words"
                        : "text-[clamp(1rem,2vw+0.45rem,1.35rem)] font-bold leading-tight",
                  ].join(" ")}
                >
                  {kpi.value}
                </p>
                <p className="line-clamp-2 text-[11px] leading-snug text-muted-foreground sm:text-body-sm sm:leading-snug">
                  {kpi.hint}
                </p>
              </div>

              <div className="mt-auto shrink-0 pt-1.5">
                <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold leading-none tracking-wide text-primary sm:text-[11px]">
                  {kpi.footnote}
                  <span aria-hidden className="text-primary/55">→</span>
                </span>
              </div>
            </div>
          </div>
        );

        const aria = `${kpi.title}. ${kpi.ariaLabel}. Valor: ${kpi.value}. ${kpi.hint}`;

        if (kpi.locked) {
          return (
            <a
              key={kpi.key}
              href={PRO_ENAMED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full min-h-0 no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-[16px]"
              aria-label={`${kpi.title} — exclusivo Aluno PRO. ${kpi.hint}`}
            >
              {cardInner}
            </a>
          );
        }

        return (
          <Link
            key={kpi.key}
            to={kpi.to}
            className="group flex h-full min-h-0 no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-[16px]"
            aria-label={aria}
          >
            {cardInner}
          </Link>
        );
      })}
    </div>
  );
}

function HomePageSkeleton() {
  return (
    <div className="space-y-5 md:space-y-6 animate-fade-in">
      {/* Banner skeleton */}
      <Skeleton className="h-[72px] rounded-[20px]" />

      {/* Hero skeleton — full width */}
      <Skeleton className="h-[220px] rounded-[28px] bg-primary/[0.06]" />

      {/* KPI grid + performance card skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5">
        <div className="lg:col-span-5">
          <Skeleton className="h-[260px] rounded-[22px] bg-muted/60" />
        </div>
        <div className="lg:col-span-7">
          <Skeleton className="h-[260px] rounded-[22px] bg-muted/40" />
        </div>
      </div>
    </div>
  );
}
