import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { HomeHeroSection } from "./HomeHeroSection";
import { UpcomingSimulationCard } from "./UpcomingSimulationCard";
import { KpiGrid } from "./KpiGrid";
import { UpgradeBanner } from "@/components/UpgradeBanner";

/** Compact spacing for above-the-fold dashboard */
const SECTION_SPACING = "mb-5 md:mb-6";
const STAGGER_CHILDREN = 0.06;
const STAGGER_DELAY = 0.04;
const DURATION = 0.45;
const EASE = [0.25, 0.46, 0.45, 0.94] as const;

export function HomePagePremium() {
  const prefersReducedMotion = useReducedMotion();
  const { profile, isOnboardingComplete } = useUser();
  const { simulados, loading } = useSimulados();
  const { summary, history } = useUserPerformance();

  const stats = useMemo(() => {
    const completed = simulados.filter((s) => s.userState?.finished);
    const fallbackCount = completed.length;
    const fallbackAvg =
      fallbackCount > 0
        ? Math.round(
            completed.reduce((sum, s) => sum + (s.userState?.score ?? 0), 0) /
              fallbackCount
          )
        : 0;

    const count = summary?.total_attempts ?? fallbackCount;
    const avg = summary?.avg_score ? Math.round(summary.avg_score) : fallbackAvg;
    return {
      simuladosRealizados: count,
      mediaAtual: avg,
      simuladosNoAno: simulados.length,
    };
  }, [simulados, summary?.avg_score, summary?.total_attempts]);

  const nextSimulationDate = useMemo(() => {
    const now = Date.now();
    const upcoming = simulados
      .map((simulado) => simulado.executionWindowStart)
      .filter((date) => {
        const timestamp = Date.parse(date);
        return Number.isFinite(timestamp) && timestamp > now;
      })
      .sort((a, b) => Date.parse(a) - Date.parse(b));

    return upcoming[0] ?? null;
  }, [simulados]);

  const userName = profile?.name?.split(" ")[0] || "estudante";
  const segment = profile?.segment ?? "guest";

  const latestScore = history[0] ? Math.round(Number(history[0].score_percentage)) : null;
  const previousScore = history[1] ? Math.round(Number(history[1].score_percentage)) : null;
  const insightCopy =
    latestScore != null && previousScore != null
      ? latestScore > previousScore
        ? `Seu último simulado subiu ${latestScore - previousScore} pontos.`
        : latestScore < previousScore
          ? `Seu último simulado caiu ${previousScore - latestScore} pontos.`
          : "Seu último simulado manteve a mesma pontuação do anterior."
      : "Seu próximo ganho vem de rotina consistente e revisão objetiva dos erros recorrentes.";
  const statusInsight =
    latestScore != null
      ? `Último simulado: ${latestScore}%. Mantenha frequência semanal para sustentar evolução.`
      : "Mantenha frequência semanal para transformar sua média em tendência de alta.";

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
        hidden: { opacity: 0, y: 14 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: DURATION, ease: EASE },
        },
      };

  if (!isOnboardingComplete) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: EASE }}
        className={SECTION_SPACING}
      >
        <UpgradeBanner />
        <div className="rounded-3xl border-2 border-dashed border-[rgba(142,31,61,0.25)] bg-[rgba(142,31,61,0.06)] p-8 text-center">
          <h2 className="text-2xl font-semibold text-[#1A2233] mb-2">
            Complete seu perfil
          </h2>
          <p className="text-[#5F6778] mb-6 max-w-md mx-auto">
            Informe especialidade e instituições para personalizar rankings e
            desempenho.
          </p>
          <Link
            to="/onboarding"
            className="inline-flex items-center gap-2 rounded-xl bg-[#8E1F3D] text-white px-5 py-2.5 font-medium hover:bg-[#A3294B] transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.28)] focus-visible:ring-offset-2"
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
      initial="hidden"
      animate="visible"
      className="space-y-5 md:space-y-6"
    >
      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <HomeHeroSection
          userName={userName}
          simuladosRealizados={stats.simuladosRealizados}
          mediaAtual={stats.mediaAtual}
          insightCopy={insightCopy}
          statusInsight={statusInsight}
        />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <UpcomingSimulationCard
          simuladosRealizados={stats.simuladosRealizados}
          nextSimulationDate={nextSimulationDate}
        />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <KpiGrid
          simuladosRealizados={stats.simuladosRealizados}
          mediaAtual={stats.mediaAtual}
          simuladosNoAno={stats.simuladosNoAno}
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
