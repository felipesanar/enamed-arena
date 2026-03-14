import { LucideIcon, Lock, Sparkles, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { UserSegment } from "@/types";

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
  const upgradeLabel = requiredSegment === 'pro' ? 'PRO: ENAMED' : 'SanarFlix';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
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
        <p className="text-body-lg text-muted-foreground mb-10 leading-relaxed max-w-md">{description}</p>
        
        <button className="inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl bg-primary text-primary-foreground text-body-lg font-semibold hover:bg-wine-hover transition-all duration-200 shadow-sm hover:shadow-md group">
          <Sparkles className="h-5 w-5" />
          Conhecer o {upgradeLabel}
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
        
        <p className="text-caption text-muted-foreground mt-4">
          {requiredSegment === 'pro' 
            ? 'Caderno de Erros, comparativos e muito mais.'
            : 'Comparativos, ranking completo e mais.'}
        </p>
      </div>
    </motion.div>
  );
}