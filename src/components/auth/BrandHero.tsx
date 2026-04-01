import { motion } from "framer-motion";
import { authItemReveal, authStaggerContainer } from "@/components/auth/motion";

interface BrandHeroProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
}

export function BrandHero({
  eyebrow,
  title = "Estude com direção",
  subtitle = "Realize simulados e compare seu desempenho no ranking nacional.",
}: BrandHeroProps) {
  const words = title.split(" ");
  const lastWord = words[words.length - 1];
  const beforeLast = words.slice(0, -1).join(" ");

  return (
    <motion.div
      variants={authStaggerContainer}
      initial="hidden"
      animate="show"
      className="relative isolate flex h-full flex-col justify-center overflow-hidden rounded-[1.7rem] border border-[hsl(var(--auth-border-strong))] bg-[linear-gradient(154deg,hsl(var(--auth-hero-surface))_0%,hsl(var(--auth-bg-soft)/0.92)_52%,hsl(var(--auth-bg-base)/0.96)_100%)] p-7 shadow-auth-ambient backdrop-blur-2xl md:p-8"
    >
      <div className="pointer-events-none absolute inset-0 rounded-[1.7rem] border border-[hsl(var(--primary)/0.22)]" />
      <div className="pointer-events-none absolute -inset-px rounded-[1.8rem] bg-[radial-gradient(130%_90%_at_100%_0%,hsl(var(--primary)/0.24),transparent_58%)] opacity-85" />
      <div className="pointer-events-none absolute inset-x-6 top-0 h-px bg-[linear-gradient(90deg,transparent,hsl(var(--auth-text-primary)/0.45),transparent)]" />

      <div className="relative flex flex-col gap-4">
        {/* Eyebrow */}
        {eyebrow && (
          <motion.p
            variants={authItemReveal}
            className="text-[10px] font-semibold uppercase tracking-[0.20em] text-[hsl(var(--auth-text-primary)/0.45)]"
          >
            {eyebrow}
          </motion.p>
        )}

        {/* Title */}
        <motion.h1
          variants={authItemReveal}
          className="text-[clamp(2.4rem,4.6vw,3.4rem)] font-bold leading-[0.92] tracking-tight text-auth-hero-headline"
        >
          {beforeLast && <span>{beforeLast} </span>}
          <span className="text-auth-hero-keyword">{lastWord}</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          variants={authItemReveal}
          className="max-w-[34ch] text-[1rem] font-medium leading-relaxed text-auth-hero-subtitle"
        >
          {subtitle}
        </motion.p>
      </div>
    </motion.div>
  );
}
