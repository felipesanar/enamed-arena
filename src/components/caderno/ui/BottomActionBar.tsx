import * as React from "react";
import { cn } from "@/lib/utils";

export interface BottomActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Ações a serem renderizadas na barra. */
  children: React.ReactNode;
}

/**
 * Barra de ação sticky na parte inferior (thumb-zone mobile).
 * Posicionada acima do MobileBottomNav (z-30, acima do nav z-40 quando necessário).
 * Inclui safe-area-inset-bottom para dispositivos com notch.
 */
export const BottomActionBar = React.forwardRef<HTMLDivElement, BottomActionBarProps>(
  ({ children, className, style, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          // Sticky na base, acima do bottom nav (adicionar mb conforme necessário)
          "fixed inset-x-0 bottom-[calc(56px+env(safe-area-inset-bottom,0px))] z-30",
          "border-t border-[var(--c-border)]",
          "backdrop-blur-[var(--c-glass-blur)]",
          "px-4 py-3 shadow-[0_-4px_16px_-4px_rgba(0,0,0,.08)]",
          className,
        )}
        style={{
          background: 'color-mix(in srgb, var(--c-surface) 95%, transparent)',
          ...style,
        }}
        role="toolbar"
        aria-label="Ações"
        {...props}
      >
        <div className="flex items-center gap-3">
          {children}
        </div>
      </div>
    );
  },
);
BottomActionBar.displayName = "BottomActionBar";
