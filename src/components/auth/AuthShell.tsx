import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";
import { BackgroundGlowLayer } from "@/components/auth/BackgroundGlowLayer";
import { BrandHero } from "@/components/auth/BrandHero";
import { authPageReveal } from "@/components/auth/motion";

interface AuthShellProps {
  children: ReactNode;
  heroTitle?: string;
  heroSubtitle?: string;
  heroEyebrow?: string;
  mobileHero?: ReactNode;
  mobileFooter?: ReactNode;
}

export function AuthShell({ children, heroTitle, heroSubtitle, heroEyebrow, mobileHero, mobileFooter }: AuthShellProps) {
  const reducedMotion = useReducedMotion();

  return (
    <main className="relative min-h-screen overflow-hidden">
      <BackgroundGlowLayer />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-[1140px] items-center px-4 py-3 sm:px-5 md:px-6 lg:px-5">
        <div className="w-full">
          {mobileHero && <section className="mb-4 md:hidden">{mobileHero}</section>}

          <div className="grid w-full items-stretch gap-4 md:grid-cols-[1fr_1fr] lg:grid-cols-[1fr_1fr] xl:gap-5">
            <section className="hidden md:block">
              <BrandHero title={heroTitle} subtitle={heroSubtitle} eyebrow={heroEyebrow} />
            </section>

            <section className="flex items-center justify-center">
              <motion.div
                variants={authPageReveal}
                initial="hidden"
                animate="show"
                className="w-full max-w-[min(95vw,34rem)] rounded-[1.25rem] border border-auth-border-subtle bg-[linear-gradient(160deg,hsl(var(--auth-surface-soft))_0%,hsl(var(--auth-surface))_58%,hsl(var(--auth-surface))_100%)] p-5 shadow-auth-card backdrop-blur-xl md:max-w-[28rem] md:p-5 lg:max-w-[24.5rem] lg:p-4"
                transition={reducedMotion ? { duration: 0.15 } : undefined}
              >
                {children}
              </motion.div>
            </section>
          </div>

          {mobileFooter && <section className="mt-5 md:hidden">{mobileFooter}</section>}
        </div>
      </div>
    </main>
  );
}
