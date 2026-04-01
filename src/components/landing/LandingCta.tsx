import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  VIEWPORT_REVEAL,
  VIEWPORT_HEADER,
  DURATION_NORMAL,
  EASE,
  headerReveal,
  headerItemReveal,
} from "@/lib/landingMotion";
import { trackEvent } from "@/lib/analytics";

export function LandingCta() {
  return (
    <section
      id="cta-final"
      className="relative py-16 md:py-20 px-4 md:px-6"
      aria-labelledby="cta-heading"
    >
      <div className="max-w-[1280px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={VIEWPORT_REVEAL}
          transition={{ duration: DURATION_NORMAL, ease: EASE }}
          className={cn(
            "relative overflow-hidden rounded-[1.75rem] border text-center",
            "border-primary/18 bg-card/[0.78] backdrop-blur-[6px]",
            "shadow-[0_32px_88px_-32px_rgba(0,0,0,0.58),0_0_0_1px_hsl(var(--primary)/0.07),inset_0_1px_0_rgba(255,255,255,0.07)]",
            "p-8 md:p-12 lg:p-14",
          )}
          style={{
            background: [
              "radial-gradient(ellipse 120% 80% at 50% -20%, hsl(var(--primary) / 0.14), transparent 55%)",
              "radial-gradient(circle at 12% 18%, hsl(var(--brand-sanar-dark) / 0.35), transparent 42%)",
              "radial-gradient(circle at 88% 22%, hsl(var(--landing-accent-mid) / 0.14), transparent 38%)",
              "radial-gradient(circle at 50% 120%, hsl(var(--primary) / 0.08), transparent 45%)",
              "hsl(var(--card) / 0.88)",
            ].join(", "),
          }}
        >
          <div className="pointer-events-none absolute inset-0 rounded-[1.75rem]" aria-hidden>
            <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent md:inset-x-14" />
            <div
              className="absolute -top-28 left-1/2 h-[13rem] w-[min(92%,28rem)] -translate-x-1/2 rounded-full opacity-[0.55] blur-3xl"
              style={{ background: "hsl(var(--primary) / 0.22)" }}
            />
            <div
              className="absolute -bottom-20 right-[-10%] h-44 w-44 rounded-full opacity-30 blur-3xl md:right-[8%]"
              style={{ background: "hsl(var(--landing-accent-mid) / 0.35)" }}
            />
            <div
              className="absolute inset-0 rounded-[1.75rem] opacity-[0.35]"
              style={{
                backgroundImage: [
                  "linear-gradient(rgba(255,255,255,0.028) 1px, transparent 1px)",
                  "linear-gradient(90deg, rgba(255,255,255,0.028) 1px, transparent 1px)",
                ].join(", "),
                backgroundSize: "28px 28px",
                maskImage: "radial-gradient(ellipse 75% 70% at 50% 42%, black 0%, transparent 72%)",
              }}
            />
          </div>

          <div className="relative z-[1] mx-auto flex max-w-[40rem] flex-col items-center">
            <motion.header
              variants={headerReveal}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT_HEADER}
              className="mb-10 w-full md:mb-11"
            >
              <motion.p
                variants={headerItemReveal}
                className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/22 bg-primary/[0.08] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-landing-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <Sparkles className="h-3.5 w-3.5 opacity-90" aria-hidden />
                Próximo passo
              </motion.p>
              <motion.h2
                variants={headerItemReveal}
                id="cta-heading"
                className="w-full text-balance text-[2.125rem] font-bold leading-[1.05] tracking-tight text-foreground sm:text-[2.5rem] md:text-[3.25rem] lg:text-[3.75rem]"
              >
                Participe do{" "}
                <span className="text-gradient-wine">próximo simulado</span>.
              </motion.h2>
              <div
                className="mx-auto mt-6 h-px w-12 rounded-full bg-gradient-to-r from-transparent via-primary/45 to-transparent md:mt-7"
                aria-hidden
              />
              <motion.p
                variants={headerItemReveal}
                id="cta-final-desc"
                className="mx-auto mt-6 w-full max-w-[36rem] text-pretty text-body-lg leading-relaxed text-muted-foreground/88 md:mt-7"
              >
                Cadastre-se, escolha seu simulado e comece a medir sua performance com a profundidade que um simulado
                comum nunca entrega.
              </motion.p>
            </motion.header>

            <motion.div
              variants={headerItemReveal}
              initial="hidden"
              whileInView="show"
              viewport={VIEWPORT_HEADER}
              className="flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:flex-wrap sm:justify-center sm:gap-4"
            >
              <Button
                size="lg"
                className="group min-h-[3.25rem] rounded-2xl px-8 font-semibold shadow-[0_10px_40px_-8px_hsl(var(--primary)/0.55),0_4px_14px_-4px_hsl(var(--primary)/0.35)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-wine-hover hover:shadow-[0_14px_48px_-10px_hsl(var(--primary)/0.6),0_6px_18px_-4px_hsl(var(--primary)/0.38)]"
                asChild
              >
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center gap-2"
                  aria-describedby="cta-final-desc"
                  onClick={() => trackEvent("lead_captured", { source: "landing_cta_primary" })}
                >
                  Quero participar
                  <ArrowRight
                    className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-[3.25rem] rounded-2xl border-primary/22 bg-card/30 px-8 font-semibold text-foreground backdrop-blur-sm transition-all duration-300 hover:border-primary/38 hover:bg-primary/[0.07] hover:text-foreground"
                asChild
              >
                <Link
                  to="/login"
                  className="inline-flex items-center justify-center"
                  aria-describedby="cta-final-desc"
                  onClick={() => trackEvent("lead_captured", { source: "landing_cta_secondary" })}
                >
                  Já tenho conta — Entrar
                </Link>
              </Button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
