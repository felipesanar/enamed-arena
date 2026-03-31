import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { useUser } from "@/contexts/UserContext";
import { useSimulados } from "@/hooks/useSimulados";
import { useUserPerformance } from "@/hooks/useUserPerformance";
import { HomeHeroSection } from "./HomeHeroSection";
import { NextSimuladoBanner } from "./NextSimuladoBanner";
import { QuickActionCard } from "./QuickActionCard";
import { RankingExpressCard } from "./RankingExpressCard";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { Calendar, BookOpen } from "lucide-react";

const SECTION_SPACING = "mb-5 md:mb-6";
const STAGGER_CHILDREN = 0.06;
const STAGGER_DELAY = 0.04;
const DURATION = 0.45;
const EASE = [0.25, 0.46, 0.45, 0.94] as const;

function formatDateShort(dateIso: string): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(d);
}

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
    return { simuladosRealizados: count, mediaAtual: avg };
  }, [simulados, summary?.avg_score, summary?.total_attempts]);

  // Next upcoming simulado for the calendar card
  const nextSimulado = useMemo(() => {
    const now = Date.now();
    return simulados
      .filter((s) => {
        const start = Date.parse(s.executionWindowStart);
        const end = Date.parse(s.executionWindowEnd);
        return (Number.isFinite(start) && start > now) || (Number.isFinite(end) && end > now);
      })
      .sort((a, b) => Date.parse(a.executionWindowStart) - Date.parse(b.executionWindowStart))[0] ?? null;
  }, [simulados]);

  const calendarCopy = nextSimulado
    ? `Próxima janela: ${formatDateShort(nextSimulado.executionWindowStart)} a ${formatDateShort(nextSimulado.executionWindowEnd)}`
    : "Nenhuma janela próxima.";

  const userName = profile?.name?.split(" ")[0] || "estudante";
  const segment = profile?.segment ?? "guest";
  const lastScore = history[0] ? Math.round(Number(history[0].score_percentage)) : null;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: prefersReducedMotion
      ? { opacity: 1 }
      : {
          opacity: 1,
          transition: { staggerChildren: STAGGER_CHILDREN, delayChildren: STAGGER_DELAY },
        },
  };

  const itemVariants = prefersReducedMotion
    ? {}
    : {
        hidden: { opacity: 0, y: 14 },
        visible: { opacity: 1, y: 0, transition: { duration: DURATION, ease: EASE } },
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
            Informe especialidade e instituições para personalizar rankings e desempenho.
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

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <NextSimuladoBanner simulados={simulados} />
      </motion.div>

      <motion.div variants={itemVariants} className={SECTION_SPACING}>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-5">
          <QuickActionCard
            title="Calendário"
            copy={calendarCopy}
            ctaLabel="Abrir calendário"
            to="/simulados"
            icon={Calendar}
          />
          <QuickActionCard
            title="Caderno de Erros"
            copy="Revise seus erros e acelere sua evolução."
            ctaLabel="Abrir caderno"
            to="/caderno-erros"
            icon={BookOpen}
          />
          <RankingExpressCard />
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
