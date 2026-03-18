import { Link } from "react-router-dom";
import { LucideIcon, ArrowRight } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { cn } from "@/lib/utils";

interface ResumeCardProps {
  title: string;
  copy: string;
  ctaLabel: string;
  to: string;
  icon: LucideIcon;
  className?: string;
}

export function ResumeCard({
  title,
  copy,
  ctaLabel,
  to,
  icon: Icon,
  className,
}: ResumeCardProps) {
  return (
    <Link
      to={to}
      className={cn("block h-full group", className)}
      aria-label={`${title}: ${ctaLabel}`}
    >
      <SurfaceCard
        radius="large"
        interactive
        className="p-6 md:p-8 h-full flex flex-col"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#F3ECEF] border border-[#E8E1E5]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] mb-5">
          <Icon className="h-7 w-7 text-[#5F6778]" aria-hidden />
        </div>
        <h3 className="text-xl font-semibold text-[#1A2233] mb-2 leading-tight">
          {title}
        </h3>
        <p className="text-[15px] text-[#5F6778] leading-relaxed flex-1 mb-6">
          {copy}
        </p>
        <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-[#8E1F3D] group-hover:gap-3 transition-all duration-[220ms] ease-out">
          {ctaLabel}
          <ArrowRight className="h-4 w-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden />
        </span>
      </SurfaceCard>
    </Link>
  );
}
