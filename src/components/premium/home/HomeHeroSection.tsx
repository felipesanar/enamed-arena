import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { MetricPill } from "@/components/premium/MetricPill";
import { PremiumLink } from "@/components/premium/PremiumLink";

interface HomeHeroSectionProps {
  userName: string;
  simuladosRealizados: number;
  mediaAtual: number;
  insightCopy: string;
  statusInsight: string;
}

const easeOut = [0.25, 0.46, 0.45, 0.94];

export function HomeHeroSection({
  userName,
  simuladosRealizados,
  mediaAtual,
  insightCopy,
  statusInsight,
}: HomeHeroSectionProps) {
  return (
    <section
      className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10"
      aria-label="Boas-vindas e status"
    >
      {/* Left: main hero panel — more breath, cockpit metrics */}
      <motion.div
        className="lg:col-span-7"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: easeOut }}
      >
        <SurfaceCard radius="hero" className="p-8 md:p-10 lg:p-12">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#8C93A3] mb-3">
            PLATAFORMA DE SIMULADOS
          </p>
          <h1 className="text-[40px] md:text-[44px] lg:text-[48px] font-semibold tracking-[-0.03em] leading-[1.05] text-[#1A2233] mb-4">
            Bem-vindo de volta,{" "}
            <span className="text-[#1A2233]">{userName || "estudante"}</span>
          </h1>
          <p className="text-[15px] md:text-base text-[#5F6778] leading-relaxed max-w-xl mb-8">
            Seu desempenho começa a ganhar forma. Agora o foco é construir
            consistência, revisar com inteligência e acelerar sua evolução.
          </p>
          {/* Cockpit-style metrics */}
          <div className="flex flex-wrap gap-2 mb-8">
            <MetricPill>{simuladosRealizados} simulado realizado</MetricPill>
            <MetricPill>{mediaAtual}% média atual</MetricPill>
            <MetricPill>Ranking disponível</MetricPill>
            <MetricPill accent>Caderno de Erros ativo</MetricPill>
          </div>
          <div className="flex flex-wrap gap-3 mb-6">
            <PremiumLink to="/simulados" variant="primary" showArrow>
              Ver calendário
            </PremiumLink>
            <PremiumLink to="/caderno-erros" variant="secondary">
              Abrir Caderno de Erros
            </PremiumLink>
          </div>
          <p className="text-[13px] text-[#8C93A3] leading-relaxed border-l-2 border-[rgba(142,31,61,0.2)] pl-4">
            {insightCopy}
          </p>
        </SurfaceCard>
      </motion.div>

      {/* Right: status panel with radial score — more presence */}
      <motion.div
        className="lg:col-span-5"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.08, ease: easeOut }}
      >
        <SurfaceCard radius="large" className="p-8 md:p-9 h-full flex flex-col">
          <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-[#8C93A3] mb-8">
            Status atual
          </p>
          <div className="flex flex-col items-center flex-1">
            <div className="relative w-40 h-40 md:w-44 md:h-44 mb-6">
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
                <span className="text-4xl md:text-5xl font-semibold tracking-[-0.03em] text-[#1A2233]">
                  {mediaAtual}%
                </span>
              </div>
            </div>
            <p className="text-[13px] font-medium text-[#5F6778] mb-4">
              Média geral atual
            </p>
            <ul className="text-[13px] text-[#5F6778] space-y-1.5 mb-6 text-center">
              <li>{simuladosRealizados} simulado feito</li>
              <li>Início da jornada</li>
              <li>Ranking liberado</li>
            </ul>
            <p className="text-[13px] text-[#8C93A3] leading-relaxed text-center max-w-xs">
              {statusInsight}
            </p>
          </div>
        </SurfaceCard>
      </motion.div>
    </section>
  );
}
