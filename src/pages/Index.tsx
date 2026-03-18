import { AppLayout } from "@/components/AppLayout";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { PremiumCard } from "@/components/PremiumCard";
import { SectionHeader } from "@/components/SectionHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { SkeletonCard } from "@/components/SkeletonCard";
import { motion, useReducedMotion } from "framer-motion";
import {
  Calendar,
  BarChart3,
  Trophy,
  Clock,
  ArrowRight,
  TrendingUp,
  Target,
  Users,
  Sparkles,
  BookOpen,
  CalendarDays,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useSimulados } from "@/hooks/useSimulados";
import { formatDateShort } from "@/lib/simulado-helpers";
import { useUser } from "@/contexts/UserContext";
import { useMemo } from "react";

const SECTION_STAGGER = 0.06;
const MOTION_DURATION = 0.35;

export default function DashboardPage() {
  const prefersReducedMotion = useReducedMotion();
  const { profile, isOnboardingComplete } = useUser();
  const segment = profile?.segment ?? "guest";
  const { simulados, loading } = useSimulados();

  const motionTransition = useMemo(
    () =>
      prefersReducedMotion
        ? { duration: 0 }
        : { duration: MOTION_DURATION, ease: [0.25, 0.46, 0.45, 0.94] as const },
    [prefersReducedMotion]
  );

  const nextSimulado = useMemo(() => {
    return (
      simulados.find((s) => s.status === "available") ??
      simulados.find((s) => s.status === "upcoming") ??
      null
    );
  }, [simulados]);

  const recentSimulados = useMemo(() => {
    return simulados
      .filter((s) => s.status === "completed" || s.status === "results_available")
      .reverse();
  }, [simulados]);

  const userStats = useMemo(() => {
    const completed = simulados.filter((s) => s.userState?.finished);
    const completedCount = completed.length;
    const avgScore =
      completedCount > 0
        ? Math.round(
            completed.reduce((sum, s) => sum + (s.userState?.score ?? 0), 0) /
              completedCount
          )
        : 0;
    return {
      simuladosCompleted: completedCount,
      averageScore: avgScore,
    };
  }, [simulados]);

  const secondaryStats: Array<{
    label: string;
    value: string;
    icon: typeof TrendingUp;
    trend: string | null;
    href?: string;
  }> = [
    {
      label: "Média geral",
      value: `${userStats.averageScore}%`,
      icon: TrendingUp,
      trend: null,
    },
    {
      label: "Ranking",
      value: "Ver",
      icon: Trophy,
      trend: null,
      href: "/ranking",
    },
    {
      label: "Simulados no ano",
      value: String(simulados.length),
      icon: Users,
      trend: null,
    },
  ];

  const quickLinks = [
    {
      title: "Calendário",
      desc: "Ver todos os simulados",
      icon: Calendar,
      to: "/simulados",
    },
    { title: "Ranking", desc: "Sua posição geral", icon: Trophy, to: "/ranking" },
    {
      title: "Desempenho",
      desc: "Análise detalhada",
      icon: BarChart3,
      to: "/desempenho",
    },
    {
      title: "Caderno de Erros",
      desc: "Revisão inteligente",
      icon: BookOpen,
      to: "/caderno-erros",
    },
  ] as const;

  return (
    <AppLayout>
      <PageHeader
        title={
          isOnboardingComplete ? "Bem-vindo de volta" : "Bem-vindo ao SanarFlix Simulados"
        }
        subtitle={
          isOnboardingComplete
            ? "Acompanhe sua evolução e prepare-se para o próximo simulado."
            : "Complete seu perfil para personalizar rankings e recomendações."
        }
        badge="Plataforma de Simulados"
      />

      {/* ─── Hero: uma ação primária por vez ─── */}
      <section className="section-breathe" aria-label="Próximo passo">
        {!isOnboardingComplete && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={motionTransition}
          >
            <Link
              to="/onboarding"
              className="block rounded-2xl border-2 border-dashed border-primary/25 bg-accent/40 p-6 md:p-8 transition-all duration-200 hover:border-primary/45 hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
            >
              <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Sparkles className="h-6 w-6 text-primary" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-heading-3 text-foreground mb-1">
                    Complete seu perfil
                  </h2>
                  <p className="text-body text-muted-foreground">
                    Informe especialidade e instituições para personalizar rankings e
                    desempenho.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 text-body font-semibold text-primary shrink-0">
                  Ir ao perfil
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </Link>
          </motion.div>
        )}

        {isOnboardingComplete && (
          <>
            {loading ? (
              <div className="rounded-2xl overflow-hidden">
                <SkeletonCard className="rounded-2xl" lines={4} />
              </div>
            ) : nextSimulado ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionTransition}
              >
                <Link
                  to={`/simulados/${nextSimulado.id}`}
                  className="block relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-wine-hover p-6 md:p-8 text-primary-foreground transition-all duration-200 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/50 focus-visible:ring-offset-2 focus-visible:ring-offset-primary active:scale-[0.995]"
                >
                  <div
                    className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none"
                    aria-hidden
                  />
                  <div
                    className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none"
                    aria-hidden
                  />
                  <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-5">
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-body-sm text-primary-foreground/85 mb-2">
                        <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                        {nextSimulado.status === "available"
                          ? "Disponível agora"
                          : "Próximo simulado"}
                      </p>
                      <h2 className="text-heading-2 font-semibold mb-1 truncate">
                        {nextSimulado.title}
                      </h2>
                      <p className="text-body text-primary-foreground/85">
                        {formatDateShort(nextSimulado.executionWindowStart)} ·{" "}
                        {nextSimulado.questionsCount} questões ·{" "}
                        {nextSimulado.estimatedDuration}
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 bg-white/15 rounded-xl px-5 py-3 text-body font-semibold backdrop-blur-sm shrink-0">
                      <Clock className="h-4 w-4" aria-hidden />
                      {nextSimulado.status === "available"
                        ? "Iniciar agora"
                        : "Ver detalhes"}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </Link>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={motionTransition}
              >
                <Link
                  to="/simulados"
                  className="block rounded-2xl border border-border bg-card p-6 md:p-8 transition-all duration-200 hover:border-primary/20 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-5">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <CalendarDays className="h-6 w-6 text-muted-foreground" aria-hidden />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-heading-3 text-foreground mb-1">
                        Nenhum simulado disponível no momento
                      </h2>
                      <p className="text-body text-muted-foreground">
                        Confira o calendário para ver as próximas datas e se preparar.
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-2 text-body font-semibold text-primary shrink-0">
                      Ver calendário
                      <ArrowRight className="h-5 w-5" aria-hidden />
                    </span>
                  </div>
                </Link>
              </motion.div>
            )}
          </>
        )}
      </section>

      {/* ─── Resumo de evolução (hero stat + apoio) ─── */}
      <section className="section-breathe" aria-label="Sua evolução">
        <h2 className="sr-only">Sua evolução</h2>
        {loading ? (
          <>
            <div className="rounded-2xl border border-border bg-card p-6 md:p-8 mb-4 animate-pulse">
              <div className="h-12 w-12 rounded-xl bg-muted mb-4" />
              <div className="h-8 w-16 bg-muted rounded mb-2" />
              <div className="h-4 w-32 bg-muted rounded" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-border bg-card p-4 md:p-5 animate-pulse"
                >
                  <div className="h-10 w-10 rounded-xl bg-muted mb-3" />
                  <div className="h-6 w-16 bg-muted rounded mb-2" />
                  <div className="h-4 w-24 bg-muted rounded" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card p-6 md:p-8 mb-4 border-primary/10 bg-gradient-to-br from-accent/30 to-transparent"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-overline uppercase text-muted-foreground tracking-wide mb-1">
                    Sua evolução
                  </p>
                  <p className="text-body-sm text-muted-foreground mb-0.5">
                    Simulados realizados
                  </p>
                  <p className="text-display text-foreground tabular-nums">
                    {userStats.simuladosCompleted}
                  </p>
                </div>
                <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-7 w-7 text-primary" aria-hidden />
                </div>
              </div>
            </motion.div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {secondaryStats.map((stat, i) => (
                <StatCard
                  key={stat.label}
                  {...stat}
                  delay={SECTION_STAGGER * (i + 1)}
                />
              ))}
            </div>
          </>
        )}
      </section>

      {/* ─── Últimos simulados + Acesso rápido (menos peso visual) ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 section-breathe">
        <section aria-labelledby="ultimos-simulados-heading">
          <SectionHeader
            id="ultimos-simulados-heading"
            title="Últimos Simulados"
            className="mb-3"
          />
          <div className="space-y-3">
            {loading ? (
              [1, 2].map((i) => <SkeletonCard key={i} />)
            ) : recentSimulados.length > 0 ? (
              recentSimulados.map((sim, i) => (
                <Link
                  key={sim.id}
                  to={`/simulados/${sim.id}`}
                  className="block rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:shadow-md hover:border-border/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.998]"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                        <BarChart3 className="h-5 w-5 text-muted-foreground" aria-hidden />
                      </div>
                      <div className="min-w-0">
                        <p className="text-body font-medium text-foreground truncate">
                          {sim.title}
                        </p>
                        <p className="text-body-sm text-muted-foreground">
                          {formatDateShort(sim.executionWindowStart)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {sim.userState?.score !== undefined && (
                        <p className="text-heading-3 text-foreground tabular-nums">
                          {sim.userState.score}%
                        </p>
                      )}
                      <StatusBadge status={sim.status} />
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="rounded-xl border border-border bg-card p-8 text-center">
                <p className="text-body text-muted-foreground mb-4">
                  Nenhum simulado concluído ainda.
                </p>
                <Link
                  to="/simulados"
                  className="inline-flex items-center gap-2 text-body font-semibold text-primary hover:text-wine-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg py-2 px-3"
                >
                  Ver calendário
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="acesso-rapido-heading">
          <SectionHeader
            id="acesso-rapido-heading"
            title="Acesso Rápido"
            className="mb-3"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {quickLinks.map((item) => (
              <Link
                key={item.title}
                to={item.to}
                className="rounded-xl border border-border bg-card p-4 min-h-[88px] flex flex-col transition-all duration-200 hover:shadow-md hover:border-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.998]"
              >
                <item.icon
                  className="h-4 w-4 text-primary mb-2 shrink-0"
                  aria-hidden
                />
                <p className="text-body font-medium text-foreground mb-0.5">
                  {item.title}
                </p>
                <p className="text-body-sm text-muted-foreground mt-auto">
                  {item.desc}
                </p>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {segment !== "pro" && <UpgradeBanner />}
    </AppLayout>
  );
}
