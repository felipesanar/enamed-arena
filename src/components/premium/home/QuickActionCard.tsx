import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
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
      className={cn("block h-full group", className)}
      aria-label={`${title}: ${ctaLabel}`}
    >
      <SurfaceCard
        radius="large"
        interactive
        className="p-6 md:p-7 h-full flex flex-col transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]"
      >
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[rgba(142,31,61,0.08)] border border-[rgba(142,31,61,0.16)] mb-5">
          <Icon className="h-6 w-6 text-[#8E1F3D]" aria-hidden />
        </div>
        <h3 className="text-lg font-semibold text-[#1A2233] mb-2 leading-tight">
          {title}
        </h3>
        <p className="text-[14px] text-[#5F6778] leading-relaxed flex-1 mb-5">
          {copy}
        </p>
        <span className="inline-flex items-center gap-2 text-[14px] font-semibold text-[#8E1F3D] group-hover:gap-3 transition-all duration-[220ms] ease-out">
          {ctaLabel}
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </SurfaceCard>
    </Link>
  );
}
