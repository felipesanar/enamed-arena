import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface QuickActionCardProps {
  title: string;
  copy: string;
  ctaLabel: string;
  to: string;
  icon: LucideIcon;
  className?: string;
}

export function QuickActionCard({
  title,
  copy,
  ctaLabel,
  to,
  icon: Icon,
  className,
}: QuickActionCardProps) {
  return (
    <Link
      to={to}
      className={cn("block h-full group no-underline", className)}
      aria-label={`${title}: ${ctaLabel}`}
    >
      <div className="relative overflow-hidden rounded-2xl border border-border/50 bg-card/90 backdrop-blur-sm p-6 md:p-7 h-full flex flex-col shadow-[0_2px_12px_-4px_hsl(220_20%_10%/0.06),0_1px_2px_hsl(220_20%_10%/0.03)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:shadow-[0_8px_28px_-8px_hsl(220_20%_10%/0.1),0_2px_6px_hsl(220_20%_10%/0.04)] hover:border-primary/20">
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/[0.08] to-primary/[0.14] border border-primary/15 mb-5 shadow-[0_2px_6px_-2px_hsl(345_65%_30%/0.12)]">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <h3 className="text-[16px] font-semibold text-foreground mb-1.5 leading-tight">
            {title}
          </h3>
          <p className="text-[13px] text-muted-foreground leading-relaxed flex-1 mb-5">
            {copy}
          </p>
          <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-primary group-hover:gap-2.5 transition-all duration-200">
            {ctaLabel}
            <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
