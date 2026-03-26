import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { HomeHeroSection } from "./HomeHeroSection";
import { NextSimuladoBanner } from "./NextSimuladoBanner";
import { UpgradeBanner } from "@/components/UpgradeBanner";

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
    };
  }, [simulados, summary?.avg_score, summary?.total_attempts]);

  // Find next upcoming simulado window
  const nextSimulado = useMemo(() => {
    const now = Date.now();
    const upcoming = simulados
      .filter((s) => {
        const start = Date.parse(s.executionWindowStart);
        const end = Date.parse(s.executionWindowEnd);
        return (Number.isFinite(start) && start > now) || (Number.isFinite(end) && end > now);
      })
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart));
    return upcoming[0] ?? null;
  }, [simulados]);

  const userName = profile?.name?.split(" ")[0] || "estudante";
  const segment = profile?.segment ?? "guest";

  const lastScore = history[0] ? Math.round(Number(history[0].score_percentage)) : null;

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
      initial="hidden"
      animate="visible"
      className="space-y-5 md:space-y-6"
    >
      {/* Next simulado banner — always on top */}
      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <NextSimuladoBanner
          nextWindowStart={nextSimulado?.executionWindowStart ?? null}
          nextWindowEnd={nextSimulado?.executionWindowEnd ?? null}
        />
      </motion.div>

      {/* Welcome + last simulado summary */}
      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <HomeHeroSection
          userName={userName}
          simuladosRealizados={stats.simuladosRealizados}
          mediaAtual={stats.mediaAtual}
          lastScore={lastScore}
          lastRankPosition={null}
          lastRankTotal={null}
          bestArea={null}
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
