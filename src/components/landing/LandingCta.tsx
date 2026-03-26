import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VIEWPORT_REVEAL, DURATION_NORMAL, EASE } from "@/lib/landingMotion";
import { NEXT_SIMULADO } from "@/lib/landingMockData";
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
          className="relative rounded-3xl border border-border overflow-hidden p-8 md:p-12 lg:p-14 bg-card/80 shadow-2xl"
          style={{
            background:
              "radial-gradient(circle at 20% 10%, hsl(var(--primary) / 0.15), transparent 28%), radial-gradient(circle at 80% 15%, hsl(var(--wine-glow) / 0.1), transparent 22%), hsl(var(--card) / 0.9)",
          }}
        >
          <p className="text-overline uppercase tracking-[0.12em] text-muted-foreground mb-4">
            Próximo passo
          </p>
          <p className="text-body-sm text-primary font-medium mb-2">
            {NEXT_SIMULADO.title} · {NEXT_SIMULADO.questions} questões · {NEXT_SIMULADO.date} · {NEXT_SIMULADO.inscritos} inscritos
          </p>
          <h2
            id="cta-heading"
            className="text-heading-1 md:text-[2.5rem] lg:text-[3.5rem] xl:text-[4rem] font-bold text-foreground max-w-[12ch] leading-[0.94] tracking-tight"
          >
            Participe do próximo simulado.
          </h2>
          <p className="mt-5 text-body-lg text-muted-foreground max-w-[36rem] leading-relaxed">
            Cadastre-se, escolha seu simulado e comece a medir sua performance com a profundidade que um simulado comum nunca entrega.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
              <Button
                size="lg"
                className="min-h-[56px] px-8 rounded-full font-semibold bg-primary text-primary-foreground hover:bg-wine-hover shadow-lg shadow-primary/30 hover:shadow-xl hover:shadow-primary/35 hover:-translate-y-1 transition-all duration-300"
                asChild
              >
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2"
                  onClick={() => trackEvent("lead_captured", { source: "landing_cta_primary" })}
                >
                  Quero participar
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="min-h-[56px] px-8 rounded-full font-semibold border-border bg-transparent hover:bg-muted/50 hover:border-primary/20 transition-all duration-300"
                asChild
              >
                <Link to="/login" onClick={() => trackEvent("lead_captured", { source: "landing_cta_secondary" })}>
                  Já tenho conta — Entrar
                </Link>
              </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
