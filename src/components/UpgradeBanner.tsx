import { motion } from "framer-motion";
import { Sparkles, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

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
  ctaTo = "/configuracoes",
}: UpgradeBannerProps) {
  console.log('[UpgradeBanner] Rendering');

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-accent via-card to-accent p-6 md:p-8"
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-heading-3 text-foreground mb-1">{title}</h3>
          <p className="text-body text-muted-foreground">{description}</p>
        </div>
        <Link
          to={ctaTo}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors shrink-0"
        >
          {ctaText}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </motion.div>
  );
}
