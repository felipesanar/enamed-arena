import { motion } from "framer-motion";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { PremiumLink } from "@/components/premium/PremiumLink";

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
      {/* Welcome card */}
      <motion.div
        className={hasHistory ? "lg:col-span-7" : "lg:col-span-12"}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: easeOut }}
      >
        <SurfaceCard radius="hero" className="p-5 md:p-6 lg:p-7">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-2">
            PLATAFORMA DE SIMULADOS
          </p>
          <h1 className="text-[30px] md:text-[34px] lg:text-[36px] font-semibold tracking-[-0.02em] leading-[1.08] text-foreground mb-2">
            Bem-vindo de volta,{" "}
            <span className="text-foreground">{userName || "estudante"}</span>
          </h1>
          <p className="text-[14px] md:text-[15px] text-muted-foreground leading-relaxed mb-4">
            {simuladosRealizados > 0
              ? `Você já realizou ${simuladosRealizados} simulado${simuladosRealizados !== 1 ? "s" : ""}.`
              : "Comece seu primeiro simulado para acompanhar sua evolução."}
          </p>
        </SurfaceCard>
      </motion.div>

      {/* Last simulado summary — only shown when there's history */}
      {hasHistory && (
        <motion.div
          className="lg:col-span-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.42, delay: 0.06, ease: easeOut }}
        >
          <SurfaceCard radius="large" className="p-5 md:p-6 h-full flex flex-col">
            <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-4">
              Último simulado
            </p>
            <div className="space-y-4 flex-1">
              {/* Score */}
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-muted-foreground">Sua nota</span>
                <span className="text-2xl font-bold text-primary tabular-nums">
                  {lastScore}%
                </span>
              </div>

              {/* Ranking position */}
              {lastRankPosition !== null && lastRankTotal !== null && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Posição no ranking</span>
                  <span className="text-lg font-semibold text-foreground tabular-nums">
                    #{lastRankPosition}
                    <span className="text-[13px] font-normal text-muted-foreground ml-1">
                      de {lastRankTotal}
                    </span>
                  </span>
                </div>
              )}

              {/* Best area */}
              {bestArea && (
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-muted-foreground">Grande Área destaque</span>
                  <span className="text-[13px] font-semibold text-foreground">{bestArea}</span>
                </div>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-border/50">
              <PremiumLink to="/desempenho" variant="secondary" showArrow>
                Ver desempenho completo
              </PremiumLink>
            </div>
          </SurfaceCard>
        </motion.div>
      )}
    </section>
  );
}
