import { LucideIcon, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { UserSegment } from "@/types";

interface ProBadgeProps {
  size?: "sm" | "md";
}

export function ProBadge({ size = "sm" }: ProBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center font-bold uppercase tracking-wider bg-primary/10 text-primary rounded",
      size === "sm" && "text-[10px] px-1.5 py-0.5",
      size === "md" && "text-[11px] px-2 py-1",
    )}>
      PRO
    </span>
  );
}

interface ProGateProps {
  feature: string;
  description: string;
  icon?: LucideIcon;
  requiredSegment?: UserSegment;
  currentSegment?: UserSegment;
}

export function ProGate({ 
  feature, 
  description, 
  icon: Icon = Lock,
  requiredSegment = 'pro',
  currentSegment = 'guest',
}: ProGateProps) {
  console.log('[ProGate] Rendering gate for:', feature, '| required:', requiredSegment, '| current:', currentSegment);

  const upgradeLabel = requiredSegment === 'pro' ? 'PRO: ENAMED' : 'SanarFlix Padrão';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col items-center justify-center text-center py-16 px-6 max-w-lg mx-auto"
    >
      <div className="h-16 w-16 rounded-2xl bg-accent flex items-center justify-center mb-5">
        <Icon className="h-8 w-8 text-primary" />
      </div>
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-overline uppercase text-primary">Exclusivo {upgradeLabel}</span>
      </div>
      <h3 className="text-heading-2 text-foreground mb-2">{feature}</h3>
      <p className="text-body text-muted-foreground mb-8 leading-relaxed">{description}</p>
      <button className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors duration-150 shadow-sm">
        <Sparkles className="h-4 w-4" />
        Conhecer o {upgradeLabel}
      </button>
    </motion.div>
  );
}
