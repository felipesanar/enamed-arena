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
      <div className="relative flex h-full flex-col overflow-hidden rounded-[22px] border border-[#E9E1E6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAFB_100%)] p-6 shadow-[0_14px_28px_-24px_rgba(58,22,34,0.5),0_2px_8px_rgba(58,22,34,0.05)] transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1 hover:border-primary/24 hover:shadow-[0_20px_34px_-24px_rgba(58,22,34,0.62),0_6px_14px_-10px_rgba(58,22,34,0.14)] md:p-7">
        {/* Hover gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

        <div className="relative z-10 flex flex-col flex-1">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-primary/18 bg-gradient-to-br from-primary/[0.1] to-primary/[0.16] shadow-[0_8px_16px_-10px_hsl(345_65%_30%/0.42)]">
            <Icon className="h-5 w-5 text-primary" aria-hidden />
          </div>
          <h3 className="mb-1.5 text-[17px] font-semibold leading-tight tracking-[-0.012em] text-foreground">
            {title}
          </h3>
          <p className="mb-5 flex-1 text-[13px] leading-relaxed text-muted-foreground">
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
