import * as React from "react";
import { cn } from "@/lib/utils";

export interface CadernoCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** `interactive` adiciona hover com elevação (desktop). */
  variant?: "base" | "interactive";
  /** Borda wine para destaque de protagonista. */
  hero?: boolean;
  asChild?: boolean;
}

/**
 * Card base do Caderno v3.
 * - radius 20px, shadow-sm, dark-ready.
 * - variante `interactive`: hover sobe 2px + shadow-md (desktop).
 */
export const CadernoCard = React.forwardRef<HTMLDivElement, CadernoCardProps>(
  ({ className, variant = "base", hero = false, children, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Base
          "rounded-[var(--c-radius-card)] border bg-[var(--c-surface)] text-[var(--c-ink)]",
          "shadow-[var(--c-shadow-sm)]",
          "transition-all",
          // Duration e ease do contrato
          "duration-[var(--c-duration-base)]",
          // Borda padrão
          "border-[var(--c-border)]",
          // Hero: borda wine — cor via style inline (var+opacity não funciona no Tailwind v3)
          hero && "shadow-[var(--c-shadow-glow)]",
          // Interactive
          variant === "interactive" && [
            "cursor-pointer",
            "hover:shadow-[var(--c-shadow-md)] hover:-translate-y-[2px]",
            // Respeitar prefers-reduced-motion
            "motion-reduce:hover:translate-y-0",
          ],
          className,
        )}
        style={
          hero
            ? {
                borderColor: 'color-mix(in srgb, var(--c-wine-500) 30%, transparent)',
                ...style,
              }
            : style
        }
        {...props}
      >
        {children}
      </div>
    );
  },
);
CadernoCard.displayName = "CadernoCard";
