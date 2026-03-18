import { Link } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: string | number;
  supportingText: string;
  tag: string;
  icon: LucideIcon;
  href?: string;
  className?: string;
}

export function KpiCard({
  label,
  value,
  supportingText,
  tag,
  icon: Icon,
  href,
  className,
}: KpiCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#F3ECEF] border border-[#E8E1E5]/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
          <Icon className="h-5 w-5 text-[#5F6778]" aria-hidden />
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-[#8C93A3] rounded-full border border-[#E8E1E5]/80 bg-[#FCFAFB] px-2.5 py-1">
          {tag}
        </span>
      </div>
      <p className="text-[12px] font-medium text-[#5F6778] mb-1">{label}</p>
      <p className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-[#1A2233] mb-2 leading-tight">
        {value}
      </p>
      <p className="text-[13px] text-[#8C93A3] leading-snug">{supportingText}</p>
    </>
  );

  if (href) {
    return (
      <Link
        to={href}
        className={cn("block h-full", className)}
        aria-label={`${label}: ${value}`}
      >
        <SurfaceCard radius="large" interactive className="p-6 h-full">
          {content}
        </SurfaceCard>
      </Link>
    );
  }

  return (
    <SurfaceCard radius="large" interactive className="p-6 h-full">
      {content}
    </SurfaceCard>
  );
}
