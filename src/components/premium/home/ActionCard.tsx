import { Link } from "react-router-dom";
import { ArrowRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CardVariant = "highlight" | "routine" | "performance" | "context";

interface ActionCardProps {
  title: string;
  copy: string;
  ctaLabel: string;
  to: string;
  icon: LucideIcon;
  variant?: CardVariant;
  kpiValue?: string | number;
  kpiLabel?: string;
  className?: string;
}

const variantStyles: Record<
  CardVariant,
  { container: string; icon: string; cta: string }
> = {
  highlight: {
    container:
      "border-primary/20 bg-[linear-gradient(165deg,rgba(142,31,61,0.06)_0%,#FFFFFF_40%,#FBF7F9_100%)] shadow-[0_16px_34px_-20px_hsl(345_60%_30%/0.45),0_2px_8px_hsl(220_20%_10%/0.05)] hover:border-primary/30 hover:shadow-[0_22px_40px_-20px_hsl(345_60%_30%/0.55),0_6px_14px_-8px_hsl(345_60%_30%/0.15)]",
    icon: "from-primary/[0.1] to-primary/[0.18] border-primary/16",
    cta: "text-primary",
  },
  routine: {
    container:
      "border-[#E9E1E6] bg-[linear-gradient(180deg,#FFFFFF_0%,#FCFAFB_100%)] shadow-[0_10px_24px_-20px_rgba(58,22,34,0.4),0_2px_6px_rgba(58,22,34,0.04)] hover:border-primary/20 hover:shadow-[0_16px_30px_-20px_rgba(58,22,34,0.52),0_4px_10px_-6px_rgba(58,22,34,0.1)]",
    icon: "from-primary/[0.06] to-primary/[0.12] border-primary/10",
    cta: "text-primary",
  },
  performance: {
    container:
      "border-white/[0.08] bg-[linear-gradient(155deg,#1A0A12_0%,#2D0F1C_50%,#3D1426_100%)] text-white shadow-[0_20px_36px_-24px_rgba(40,10,22,0.8),0_4px_12px_-6px_rgba(40,10,22,0.4)] hover:shadow-[0_26px_42px_-24px_rgba(40,10,22,0.9),0_8px_18px_-8px_rgba(40,10,22,0.5)]",
    icon: "from-white/[0.08] to-white/[0.14] border-white/[0.1]",
    cta: "text-white/80 hover:text-white",
  },
  context: {
    container:
      "border-[#E8E1E5]/60 bg-[#FCFAFB]/80 shadow-[0_4px_12px_-8px_rgba(30,20,26,0.08)] hover:border-[#E8E1E5] hover:shadow-[0_8px_20px_-12px_rgba(30,20,26,0.12)]",
    icon: "from-muted/60 to-muted/40 border-border/60",
    cta: "text-muted-foreground hover:text-foreground",
  },
};

export function ActionCard({
  title,
  copy,
  ctaLabel,
  to,
  icon: Icon,
  variant = "routine",
  kpiValue,
  kpiLabel,
  className,
}: ActionCardProps) {
  const styles = variantStyles[variant];
  const isDark = variant === "performance";

  return (
    <Link
      to={to}
      className={cn("block h-full group no-underline", className)}
      aria-label={`${title}: ${ctaLabel}`}
    >
      <div
        className={cn(
          "relative flex h-full flex-col overflow-hidden rounded-[22px] border p-5 md:p-6 transition-all duration-[280ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:-translate-y-1",
          styles.container
        )}
      >
        {variant === "highlight" && (
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary/60 via-primary/30 to-transparent" />
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative z-10 flex flex-col flex-1">
          <div className="flex items-start justify-between mb-4">
            <div
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br border shadow-sm",
                styles.icon
              )}
            >
              <Icon
                className={cn(
                  "h-5 w-5",
                  isDark ? "text-white/80" : "text-primary"
                )}
                aria-hidden
              />
            </div>
            {kpiValue !== undefined && (
              <div className="text-right">
                <p
                  className={cn(
                    "text-[24px] font-extrabold leading-none tracking-[-0.03em] tabular-nums",
                    isDark ? "text-white" : "text-foreground"
                  )}
                >
                  {kpiValue}
                </p>
                {kpiLabel && (
                  <p
                    className={cn(
                      "text-[10px] mt-0.5",
                      isDark
                        ? "text-white/50"
                        : "text-muted-foreground/60"
                    )}
                  >
                    {kpiLabel}
                  </p>
                )}
              </div>
            )}
          </div>

          <h3
            className={cn(
              "mb-1.5 text-[16px] font-bold leading-tight tracking-[-0.01em]",
              isDark ? "text-white" : "text-foreground"
            )}
          >
            {title}
          </h3>
          <p
            className={cn(
              "mb-5 flex-1 text-[13px] leading-relaxed",
              isDark ? "text-white/55" : "text-muted-foreground"
            )}
          >
            {copy}
          </p>

          <span
            className={cn(
              "inline-flex items-center gap-2 text-[13px] font-semibold transition-all duration-200 group-hover:gap-2.5",
              styles.cta
            )}
          >
            {ctaLabel}
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </div>
    </Link>
  );
}
