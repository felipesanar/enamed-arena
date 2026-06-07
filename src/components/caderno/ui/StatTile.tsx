import * as React from "react";
import { cn } from "@/lib/utils";

export interface StatTileProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Número/valor principal exibido em destaque (KPI). */
  value: React.ReactNode;
  /** Label overline acima do valor. */
  label: string;
  /** Cor de destaque opcional (CSS var ou hex). Ex: `var(--c-wine-500)`. */
  color?: string;
  /** Sufixo após o valor (ex: "%", "pts"). */
  suffix?: string;
  /** Tendência opcional: "up" | "down" | "neutral". */
  trend?: "up" | "down" | "neutral";
}

/**
 * Tile de estatística — número KPI grande + label overline.
 * Usado em PageHeaderPremium e dashboards.
 */
export const StatTile = React.forwardRef<HTMLDivElement, StatTileProps>(
  ({ value, label, color, suffix, trend, className, ...props }, ref) => {
    const trendColor =
      trend === "up"
        ? "var(--c-success, #16A34A)"
        : trend === "down"
        ? "var(--c-destructive, #DC2626)"
        : undefined;

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-0.5",
          className,
        )}
        {...props}
      >
        <span
          className="text-[10px] font-semibold uppercase leading-none tracking-[0.1em] text-[var(--c-muted)]"
        >
          {label}
        </span>
        <div className="flex items-baseline gap-0.5">
          <span
            className="text-kpi font-extrabold leading-none tabular-nums"
            style={{ color: trendColor ?? color ?? "var(--c-ink)" }}
          >
            {value}
          </span>
          {suffix && (
            <span
              className="text-base font-semibold"
              style={{ color: trendColor ?? color ?? "var(--c-muted)" }}
            >
              {suffix}
            </span>
          )}
        </div>
      </div>
    );
  },
);
StatTile.displayName = "StatTile";
