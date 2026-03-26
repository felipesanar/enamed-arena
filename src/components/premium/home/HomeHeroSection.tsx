import { motion } from "framer-motion";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { PremiumLink } from "@/components/premium/PremiumLink";

interface HomeHeroSectionProps {
  userName: string;
  simuladosRealizados: number;
  mediaAtual: number;
  insightCopy: string;
  statusInsight: string;
}

const easeOut = [0.25, 0.46, 0.45, 0.94] as const;

export function HomeHeroSection({
  userName,
  simuladosRealizados,
  mediaAtual,
  insightCopy,
  statusInsight,
}: HomeHeroSectionProps) {
  const nivel = mediaAtual >= 75 ? "Avançado" : mediaAtual >= 50 ? "Intermediário" : "Inicial";

  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-5"
      aria-label="Boas-vindas e status"
    >
      <motion.div
        className="lg:col-span-8"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: easeOut }}
      >
        <SurfaceCard radius="hero" className="p-5 md:p-6 lg:p-7">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#8C93A3] mb-2">
            PLATAFORMA DE SIMULADOS
          </p>
          <h1 className="text-[30px] md:text-[34px] lg:text-[36px] font-semibold tracking-[-0.02em] leading-[1.08] text-[#1A2233] mb-2">
            Bem-vindo de volta,{" "}
            <span className="text-[#1A2233]">{userName || "estudante"}</span>
          </h1>
          <p className="text-[14px] md:text-[15px] text-[#5F6778] leading-relaxed mb-3">
            Você está no nível {nivel} · {simuladosRealizados} simulados feitos.
          </p>
          <p className="text-[13px] text-[#8C93A3] leading-relaxed border-l-2 border-[rgba(142,31,61,0.2)] pl-3 mb-4">
            {insightCopy}
          </p>
          <div className="flex flex-wrap gap-2.5 mb-3">
            <PremiumLink to="/simulados" variant="primary" showArrow>
              Ir para o próximo simulado
            </PremiumLink>
            <PremiumLink to="/desempenho" variant="secondary">
              Ver meu desempenho
            </PremiumLink>
          </div>
          <p className="text-[12px] text-[#8C93A3] leading-relaxed">
            {statusInsight}
          </p>
        </SurfaceCard>
      </motion.div>

      <motion.div
        className="lg:col-span-4"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, delay: 0.06, ease: easeOut }}
      >
        <SurfaceCard radius="large" className="p-5 md:p-6 h-full flex flex-col">
          <p className="text-[10px] uppercase tracking-[0.14em] font-semibold text-[#8C93A3] mb-4">
            Status atual
          </p>
          <div className="flex flex-col items-center flex-1 justify-center">
            <div className="relative w-28 h-28 md:w-32 md:h-32 mb-3">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#E8E1E5"
                  strokeWidth="6"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="#8E1F3D"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray="264"
                  initial={{ strokeDashoffset: 264 }}
                  animate={{ strokeDashoffset: 264 - (mediaAtual * 2.64) }}
                  transition={{ duration: 0.9, ease: easeOut }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-2xl md:text-3xl font-semibold tracking-[-0.02em] text-[#1A2233]">
                  {mediaAtual}%
                </span>
              </div>
            </div>
            <p className="text-[12px] font-medium text-[#5F6778] mb-2">
              Média geral atual
            </p>
            <p className="text-[12px] text-[#8C93A3] leading-relaxed text-center max-w-xs">
              {statusInsight}
            </p>
          </div>
        </SurfaceCard>
      </motion.div>
    </section>
  );
}
