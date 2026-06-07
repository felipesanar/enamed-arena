import * as React from "react";
import { cn } from "@/lib/utils";
import { getReasonMeta } from "@/lib/errorNotebookReasons";

export interface CauseBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  reason: string;
  size?: "sm" | "md";
}

/**
 * Badge colorido para a causa do erro.
 * Lê `getReasonMeta` para obter cores e label.
 * Cores vindas dos CSS vars --c-cause-* do caderno-theme.css.
 */
export const CauseBadge = React.forwardRef<HTMLSpanElement, CauseBadgeProps>(
  ({ reason, size = "md", className, ...props }, ref) => {
    const meta = getReasonMeta(reason);

    return (
      <span
        ref={ref}
        role="img"
        aria-label={`Causa: ${meta.badge}`}
        className={cn(
          "inline-flex items-center rounded-[var(--c-radius-pill)] border font-semibold",
          "transition-colors duration-[var(--c-duration-fast)]",
          size === "sm" ? "px-2 py-0.5 text-[10px] leading-4" : "px-2.5 py-1 text-xs leading-4",
          className,
        )}
        style={{
          backgroundColor: meta.colorBg,
          borderColor: meta.colorBorder,
          color: meta.colorText,
        }}
        {...props}
      >
        {meta.badge}
      </span>
    );
  },
);
CauseBadge.displayName = "CauseBadge";

export interface CauseBarProps extends React.HTMLAttributes<HTMLDivElement> {
  reason: string;
  /** Porcentagem 0–100. */
  value: number;
  label?: string;
  showLabel?: boolean;
}

/**
 * Barra horizontal com cor da causa do erro + label opcional.
 */
export const CauseBar = React.forwardRef<HTMLDivElement, CauseBarProps>(
  ({ reason, value, label, showLabel = true, className, ...props }, ref) => {
    const meta = getReasonMeta(reason);
    const pct = Math.min(100, Math.max(0, value));

    return (
      <div ref={ref} className={cn("flex flex-col gap-1", className)} {...props}>
        {showLabel && (
          <div className="flex items-center justify-between">
            <span
              className="text-[11px] font-semibold"
              style={{ color: meta.colorText }}
            >
              {label ?? meta.badge}
            </span>
            <span className="text-[11px] text-[var(--c-muted)]">{pct}%</span>
          </div>
        )}
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ backgroundColor: meta.colorBg }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label ?? meta.badge}: ${pct}%`}
        >
          <div
            className="h-full rounded-full transition-all duration-[var(--c-duration-slow)] ease-[var(--c-ease-standard)]"
            style={{
              width: `${pct}%`,
              backgroundColor: meta.colorBase,
            }}
          />
        </div>
      </div>
    );
  },
);
CauseBar.displayName = "CauseBar";
