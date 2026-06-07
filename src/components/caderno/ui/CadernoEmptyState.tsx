import * as React from "react";
import { cn } from "@/lib/utils";

export interface CadernoEmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ícone ou ilustração (ReactNode). */
  icon?: React.ReactNode;
  title: string;
  description?: string;
  /** CTA principal. */
  action?: React.ReactNode;
  /** Celebratório (ex: zero pendentes). */
  variant?: "default" | "celebratory";
}

/**
 * Estado vazio ilustrado do Caderno v3.
 * Variante `celebratory` para "zero pendentes".
 */
export const CadernoEmptyState = React.forwardRef<HTMLDivElement, CadernoEmptyStateProps>(
  ({ icon, title, description, action, variant = "default", className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center gap-4 rounded-[var(--c-radius-card)] border border-dashed border-[var(--c-border)] bg-[var(--c-surface)] px-6 py-12 text-center",
          variant === "celebratory" && "border-[var(--c-wine-300)] bg-[var(--c-wine-50)] dark:bg-[#1A0818]",
          className,
        )}
        aria-live="polite"
        {...props}
      >
        {icon && (
          <div
            className={cn(
              "flex h-16 w-16 items-center justify-center rounded-2xl text-3xl",
              variant === "celebratory"
                ? "bg-[var(--c-wine-100)] dark:bg-[color-mix(in_srgb,var(--c-wine-900)_40%,transparent)]"
                : "bg-[var(--c-surface-2)]",
            )}
            aria-hidden="true"
          >
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h3
            className={cn(
              "text-heading-3 font-semibold",
              variant === "celebratory" ? "text-[var(--c-wine-700)] dark:text-[var(--c-wine-300)]" : "text-[var(--c-ink)]",
            )}
          >
            {title}
          </h3>
          {description && (
            <p className="max-w-sm text-body-sm text-[var(--c-muted)]">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
    );
  },
);
CadernoEmptyState.displayName = "CadernoEmptyState";
