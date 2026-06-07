import * as React from "react";
import { cn } from "@/lib/utils";

export interface SegmentedTabItem {
  value: string;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

export interface SegmentedTabsProps {
  items: SegmentedTabItem[];
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  /** Permite scroll horizontal em mobile. Default: true. */
  scrollable?: boolean;
}

/**
 * Segmented control scrollável para tabs do Caderno v3.
 * Desktop: horizontal fixo. Mobile: scroll horizontal (scrollable=true).
 * a11y: role="tablist" com aria-selected.
 */
export function SegmentedTabs({
  items,
  value,
  onValueChange,
  className,
  scrollable = true,
}: SegmentedTabsProps) {
  return (
    <div
      className={cn(
        "flex gap-1 rounded-[var(--c-radius-control)] bg-[var(--c-surface-2)] p-1",
        scrollable && "overflow-x-auto settings-nav-scroll",
        className,
      )}
      role="tablist"
      aria-label="Seções do Caderno"
    >
      {items.map((item) => {
        const isActive = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-controls={`caderno-panel-${item.value}`}
            id={`caderno-tab-${item.value}`}
            onClick={() => onValueChange(item.value)}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-[calc(var(--c-radius-control)-2px)] px-3 py-1.5",
              "text-xs font-semibold whitespace-nowrap transition-all",
              "duration-[var(--c-duration-fast)] ease-[var(--c-ease-standard)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--c-wine-500)_50%,transparent)]",
              "min-h-[44px]",
              isActive
                ? "bg-[var(--c-surface)] text-[var(--c-ink)] shadow-[var(--c-shadow-sm)]"
                : "text-[var(--c-muted)] hover:text-[var(--c-ink)]",
            )}
          >
            {item.icon && <span aria-hidden="true">{item.icon}</span>}
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 text-[10px] font-bold leading-4",
                  isActive
                    ? "bg-[var(--c-wine-500)] text-white"
                    : "bg-[var(--c-border)] text-[var(--c-muted)]",
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
