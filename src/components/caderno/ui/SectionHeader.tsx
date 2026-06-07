import * as React from "react";
import { cn } from "@/lib/utils";

export interface SectionHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  count?: number;
  action?: React.ReactNode;
  description?: string;
}

/**
 * Cabeçalho de seção: título + contagem + ação opcional à direita.
 * Tipografia heading-2 + overline.
 */
export const SectionHeader = React.forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({ title, count, action, description, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn("flex items-start justify-between gap-4", className)}
        {...props}
      >
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <h2 className="text-heading-2 font-semibold text-[var(--c-ink)] leading-tight">
              {title}
            </h2>
            {count !== undefined && (
              <span
                className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[var(--c-surface-2)] px-1.5 text-[11px] font-bold text-[var(--c-muted)]"
                aria-label={`${count} itens`}
              >
                {count}
              </span>
            )}
          </div>
          {description && (
            <p className="text-body-sm text-[var(--c-muted)]">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    );
  },
);
SectionHeader.displayName = "SectionHeader";
