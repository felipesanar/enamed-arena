import { LucideIcon, Lock, Sparkles, ArrowRight, Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { UserSegment } from "@/types";
import { trackEvent } from "@/lib/analytics";

interface ProGateProps {
  feature: string;
  description: string;
  icon?: LucideIcon;
  requiredSegment?: UserSegment;
  currentSegment?: UserSegment;
  /** Route for the upgrade CTA. */
  ctaTo?: string;
  /** Benefícios em destaque (Fase E — preview visual do valor) */
  benefits?: string[];
}

export function ProGate({
  feature,
  description,
  icon: Icon = Lock,
  requiredSegment = 'pro',
  currentSegment = 'guest',
  ctaTo = 'https://sanarflix.com.br/sanarflix-pro-enamed',
  benefits,
}: ProGateProps) {
  const prefersReducedMotion = useReducedMotion();
  const upgradeLabel = requiredSegment === 'pro' ? 'PRO: ENAMED' : 'SanarFlix';

  return (
    <motion.div
      initial={prefersReducedMotion ? false : { opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: prefersReducedMotion ? 0 : 0.4 }}
      className="relative overflow-hidden"
    >
      <div className="flex flex-col items-center justify-center text-center py-20 px-6 max-w-lg mx-auto">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-3xl bg-accent flex items-center justify-center">
            <Icon className="h-9 w-9 text-primary" />
          </div>
          <div className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center">
            <Lock className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-overline uppercase text-primary font-bold tracking-wider">
            Exclusivo {upgradeLabel}
          </span>
        </div>
        
        <h3 className="text-heading-1 text-foreground mb-3">{feature}</h3>
        <p className="text-body-lg text-muted-foreground mb-8 leading-relaxed max-w-md">{description}</p>

        {benefits && benefits.length > 0 && (
          <div className="w-full max-w-sm mb-8 rounded-xl border border-primary/15 bg-primary/[0.03] p-4 text-left">
            <p className="text-caption font-semibold text-foreground mb-3 uppercase tracking-wide">O que você passa a ter:</p>
            <ul className="space-y-2">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-body-sm text-muted-foreground">
                  <span className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-primary" aria-hidden />
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>
        )}

        <a
          href={ctaTo}
          target="_blank"
          rel="noreferrer"
          onClick={() =>
            trackEvent("upsell_clicked", {
              source: "pro_gate",
              feature,
              current_segment: currentSegment,
              required_segment: requiredSegment,
              cta_to: ctaTo,
            })
          }
          className={cn("inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-primary text-primary-foreground !text-white text-body-lg font-semibold hover:bg-wine-hover transition-all duration-200 shadow-sm hover:shadow-md group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.995]")}
        >
          <Sparkles className="h-5 w-5" aria-hidden />
          Conhecer o {upgradeLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </a>
        
        <p className="text-caption text-muted-foreground mt-4">
          {requiredSegment === 'pro' 
            ? 'Caderno de Erros, comparativos e muito mais.'
            : 'Comparativos, ranking completo e mais.'}
        </p>
      </div>
    </motion.div>
  );
}