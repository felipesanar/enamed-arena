import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { HomeHeroSection } from "./HomeHeroSection";
import { UpcomingSimulationCard } from "./UpcomingSimulationCard";
import { KpiGrid } from "./KpiGrid";
import { QuickActionsSection } from "./QuickActionsSection";
import { InsightsSection } from "./InsightsSection";
import { ResumeSection } from "./ResumeSection";
import { UpgradeBanner } from "@/components/UpgradeBanner";

/** Spacing system: 4/8/12/16/24/32 — section rhythm */
const SECTION_SPACING = "mb-8 md:mb-10";
const STAGGER_CHILDREN = 0.06;
const STAGGER_DELAY = 0.04;
const DURATION = 0.45;
const EASE = [0.25, 0.46, 0.45, 0.94];

export function HomePagePremium() {
  const prefersReducedMotion = useReducedMotion();
  const { profile, isOnboardingComplete } = useUser();
  const { simulados, loading } = useSimulados();

  const stats = useMemo(() => {
    const completed = simulados.filter((s) => s.userState?.finished);
    const count = completed.length;
    const avg =
      count > 0
        ? Math.round(
            completed.reduce((sum, s) => sum + (s.userState?.score ?? 0), 0) /
              count
          )
        : 0;
    return {
      simuladosRealizados: count,
      mediaAtual: avg,
      simuladosNoAno: simulados.length,
    };
  }, [simulados]);

  const userName = profile?.name?.split(" ")[0] || "estudante";
  const segment = profile?.segment ?? "guest";

  const insightCopy =
    "Seu histórico ainda é curto, mas já permite começar a comparar evolução, revisar padrões de erro e ajustar estratégia.";
  const statusInsight =
    "Seu maior ganho agora não vem de volume. Vem de repetição com revisão de erros.";

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
      className="space-y-8 md:space-y-10"
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
        <UpcomingSimulationCard />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <KpiGrid
          simuladosRealizados={stats.simuladosRealizados}
          mediaAtual={stats.mediaAtual}
          simuladosNoAno={stats.simuladosNoAno}
        />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <QuickActionsSection />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <InsightsSection simuladosRealizados={stats.simuladosRealizados} />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <ResumeSection />
      </motion.div>

      {segment !== "pro" && (
        <motion.div variants={itemVariants}>
          <UpgradeBanner />
        </motion.div>
      )}
    </motion.div>
  );
}
