import { motion } from "framer-motion";
import { PremiumLink } from "@/components/premium/PremiumLink";
import { Sparkles, TrendingUp, Award, BarChart3 } from "lucide-react";

interface HomeHeroSectionProps {
  userName: string;
  simuladosRealizados: number;
  mediaAtual: number;
  lastScore: number | null;
  lastRankPosition: number | null;
  lastRankTotal: number | null;
  bestArea: string | null;
}

const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export function HomeHeroSection({
  userName,
  simuladosRealizados,
  mediaAtual,
  lastScore,
  lastRankPosition,
  lastRankTotal,
  bestArea,
}: HomeHeroSectionProps) {
  const hasHistory = simuladosRealizados > 0 && lastScore !== null;

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5"
      aria-label="Boas-vindas e status"
    >
      {/* Welcome card — rich gradient hero */}
      <motion.div
        className={hasHistory ? "lg:col-span-7" : "lg:col-span-12"}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[hsl(345,65%,28%)] via-[hsl(345,60%,22%)] to-[hsl(340,50%,16%)] p-6 md:p-7 lg:p-8 shadow-[0_8px_32px_-8px_hsl(345_65%_20%/0.4),0_2px_8px_-2px_hsl(345_65%_20%/0.2)]">
          {/* Decorative orbs */}
          <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-[hsl(345,60%,40%)] opacity-[0.12] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-[hsl(345,50%,50%)] opacity-[0.08] blur-3xl pointer-events-none" />
          <div className="absolute top-4 right-6 opacity-[0.06]">
            <Sparkles className="h-32 w-32 text-white" />
          </div>

          <div className="relative z-10">
            <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-white/50 mb-3">
              PLATAFORMA DE SIMULADOS
            </p>
            <h1 className="text-[28px] md:text-[32px] lg:text-[36px] font-bold tracking-[-0.025em] leading-[1.1] text-white mb-3">
              Bem-vindo de volta,{" "}
              <span className="text-white/90">{userName || "estudante"}</span>
            </h1>
            <p className="text-[14px] md:text-[15px] text-white/60 leading-relaxed max-w-lg">
              {simuladosRealizados > 0
                ? `Você já realizou ${simuladosRealizados} simulado${simuladosRealizados !== 1 ? "s" : ""}. Continue evoluindo.`
                : "Comece seu primeiro simulado para acompanhar sua evolução."}
            </p>
          </div>
        </div>
      </motion.div>

      {/* Last simulado summary — glassmorphic card */}
      {hasHistory && (
        <motion.div
          className="lg:col-span-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: easeOut }}
        >
          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-5 md:p-6 h-full flex flex-col shadow-[0_4px_20px_-4px_hsl(220_20%_10%/0.08),0_1px_3px_hsl(220_20%_10%/0.04)]">
            {/* Subtle accent glow */}
            <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-primary/[0.06] blur-2xl pointer-events-none" />

            <div className="relative z-10 flex-1 flex flex-col">
              <p className="text-[10px] uppercase tracking-[0.16em] font-semibold text-muted-foreground mb-4">
                Último simulado
              </p>
              <div className="space-y-3.5 flex-1">
                {/* Score */}
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" aria-hidden />
                    </div>
                    <span className="text-[13px] text-muted-foreground">Sua nota</span>
                  </div>
                  <span className="text-2xl font-bold text-primary tabular-nums">
                    {lastScore}%
                  </span>
                </div>

                {/* Ranking position */}
                {lastRankPosition !== null && lastRankTotal !== null && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <Award className="h-3.5 w-3.5 text-primary" aria-hidden />
                      </div>
                      <span className="text-[13px] text-muted-foreground">Posição no ranking</span>
                    </div>
                    <span className="text-lg font-semibold text-foreground tabular-nums">
                      #{lastRankPosition}
                      <span className="text-[12px] font-normal text-muted-foreground ml-1">
                        /{lastRankTotal}
                      </span>
                    </span>
                  </div>
                )}

                {/* Best area */}
                {bestArea && (
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                        <BarChart3 className="h-3.5 w-3.5 text-primary" aria-hidden />
                      </div>
                      <span className="text-[13px] text-muted-foreground">Área destaque</span>
                    </div>
                    <span className="text-[13px] font-semibold text-foreground">{bestArea}</span>
                  </div>
                )}
              </div>

              <div className="mt-4 pt-3 border-t border-border/40">
                <PremiumLink to="/desempenho" variant="tertiary" showArrow>
                  Ver desempenho completo
                </PremiumLink>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </section>
  );
}
