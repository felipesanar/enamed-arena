import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FilterChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  count?: number;
  label: string;
}

/**
 * Chip de filtro para o Caderno v3.
 * Estado ativo SEMPRE visível: cor wine + borda + check + count opcional.
 * a11y: role="checkbox" com aria-checked.
 */
export const FilterChip = React.forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ active = false, count, label, className, onClick, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        role="checkbox"
        aria-checked={active}
        aria-label={count !== undefined ? `${label}, ${count} itens` : label}
        onClick={onClick}
        className={cn(
          // Base
          "inline-flex h-8 items-center gap-1.5 rounded-[var(--c-radius-pill)] border px-3",
          "text-xs font-semibold transition-all",
          "duration-[var(--c-duration-fast)] ease-[var(--c-ease-standard)]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50 focus-visible:ring-offset-1",
          "cursor-pointer select-none",
          // Inativo
          !active && [
            "border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-muted)]",
            "hover:border-[var(--c-wine-300)] hover:text-[var(--c-wine-600)]",
          ],
          // Ativo
          active && [
            "border-[var(--c-wine-500)] bg-[var(--c-wine-50)] text-[var(--c-wine-700)]",
            "dark:bg-[var(--c-wine-900)]/40 dark:text-[var(--c-wine-300)]",
          ],
          className,
        )}
        {...props}
      >
        {active && (
          <Check
            className="h-3 w-3 shrink-0 text-[var(--c-wine-600)]"
            aria-hidden="true"
            strokeWidth={2.5}
          />
        )}
        <span>{label}</span>
        {count !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-bold leading-none",
              active
                ? "bg-[var(--c-wine-500)] text-white"
                : "bg-[var(--c-surface-2)] text-[var(--c-muted)]",
            )}
          >
            {count}
          </span>
        )}
      </button>
    );
  },
);
FilterChip.displayName = "FilterChip";
