import { motion } from "framer-motion";
import { authItemReveal, authStaggerContainer } from "@/components/auth/motion";
import { RankingClimbWidget } from "@/components/auth/RankingClimbWidget";

interface BrandHeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

export function BrandHero({
  title = "Performance Medica de Elite em Suas Maos.",
  subtitle = "A preparacao definitiva para o ENAMED, redesenhada para o seu sucesso.",
}: BrandHeroProps) {
  const words = title.split(" ");
  const lastWord = words[words.length - 1];
  const beforeLast = words.slice(0, -1).join(" ");

  return (
    <motion.div
      variants={authStaggerContainer}
      initial="hidden"
      animate="show"
      className="relative isolate flex h-full flex-col justify-center overflow-hidden rounded-[1.7rem] border border-[hsl(var(--auth-border-strong))] bg-[linear-gradient(154deg,hsl(var(--auth-hero-surface))_0%,hsl(var(--auth-bg-soft)/0.92)_52%,hsl(var(--auth-bg-base)/0.96)_100%)] p-5 shadow-auth-ambient backdrop-blur-2xl md:p-6"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[1.7rem] border border-[hsl(var(--primary)/0.22)]" />
      <div className="pointer-events-none absolute -inset-px rounded-[1.8rem] bg-[radial-gradient(130%_90%_at_100%_0%,hsl(var(--primary)/0.24),transparent_58%)] opacity-85" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,hsl(var(--auth-text-primary)/0.45),transparent)]" />
      <div className="relative space-y-2.5">
        <motion.h1
          variants={authItemReveal}
          className="max-w-[14ch] text-[clamp(2.15rem,4.2vw,3.15rem)] font-bold leading-[0.93] tracking-tight text-auth-hero-headline"
        >
          <span>{beforeLast} </span>
          <span className="text-auth-hero-keyword">
            {lastWord}
          </span>
        </motion.h1>
        <motion.p variants={authItemReveal} className="max-w-[38ch] text-body font-medium leading-relaxed text-auth-hero-subtitle">
          {subtitle.includes("ENAMED") ? (
            <>
              {subtitle.split("ENAMED")[0]}
              <span className="text-auth-hero-keyword">ENAMED</span>
              {subtitle.split("ENAMED")[1]}
            </>
          ) : (
            subtitle
          )}
        </motion.p>
      </div>

      <motion.div variants={authItemReveal} className="mt-6">
        <RankingClimbWidget />
      </motion.div>
    </motion.div>
  );
}
