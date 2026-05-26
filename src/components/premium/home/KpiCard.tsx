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
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted/70 border border-border/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
        <span className="text-[10px] uppercase tracking-[0.12em] font-semibold text-muted-foreground rounded-full border border-border/80 bg-background/60 px-2.5 py-1">
          {tag}
        </span>
      </div>
      <p className="text-[12px] font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-3xl md:text-4xl font-semibold tracking-[-0.03em] text-foreground mb-2 leading-tight">
        {value}
      </p>
      <p className="text-[13px] text-muted-foreground leading-snug">{supportingText}</p>
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
