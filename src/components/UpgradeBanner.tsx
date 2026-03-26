import { motion, useReducedMotion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { trackEvent } from "@/lib/analytics";

interface UpgradeBannerProps {
  title?: string;
  description?: string;
  ctaText?: string;
  ctaTo?: string;
}

export function UpgradeBanner({
  title = "Desbloqueie o acesso completo",
  description = "Com o PRO: ENAMED, você tem acesso ao Caderno de Erros, comparativos entre simulados e muito mais.",
  ctaText = "Conhecer o PRO: ENAMED",
  ctaTo = "https://sanarflix.com.br/sanarflix-pro-enamed",
}: UpgradeBannerProps) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-accent/60 via-card to-accent/30 p-6 md:p-8"
    >
      <div className="absolute top-0 right-0 w-56 h-56 bg-primary/[0.04] rounded-full -translate-y-1/2 translate-x-1/2 blur-sm" aria-hidden />
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/[0.03] rounded-full translate-y-1/2 -translate-x-1/2 blur-sm" aria-hidden />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-5">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-6 w-6 text-primary" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-heading-3 text-foreground mb-1">{title}</h3>
          <p className="text-body text-muted-foreground leading-relaxed">{description}</p>
        </div>
        <a
          href={ctaTo}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackEvent("upsell_clicked", {
              source: "upgrade_banner",
              title,
              ctaTo,
            })
          }
          className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-all duration-200 shrink-0 group shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]"
        >
          {ctaText}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </a>
      </div>
    </motion.div>
  );
}