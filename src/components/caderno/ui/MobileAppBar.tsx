import * as React from "react";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MobileAppBarProps extends React.HTMLAttributes<HTMLElement> {
  /** Título exibido na app bar. */
  title: string;
  /** Callback para botão voltar. Se omitido, botão não é renderizado. */
  onBack?: () => void;
  /** Ação à direita (ícone/botão). */
  action?: React.ReactNode;
}

/**
 * App bar mobile sticky do Caderno v3.
 * Sticky no topo, altura mínima 56px, alvo ≥44px para voltar.
 */
export const MobileAppBar = React.forwardRef<HTMLElement, MobileAppBarProps>(
  ({ title, onBack, action, className, ...props }, ref) => {
    return (
      <header
        ref={ref}
        className={cn(
          "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-[var(--c-border)] bg-[var(--c-surface)] px-4",
          // Glass suave
          "backdrop-blur-[var(--c-glass-blur)] bg-opacity-90",
          className,
        )}
        {...props}
      >
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Voltar"
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--c-radius-control)]",
              "text-[var(--c-muted)] transition-colors duration-[var(--c-duration-fast)]",
              "hover:bg-[var(--c-surface-2)] hover:text-[var(--c-ink)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--c-wine-500)]/50",
            )}
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" strokeWidth={2} />
          </button>
        )}
        <h1 className="flex-1 truncate text-heading-3 font-semibold text-[var(--c-ink)]">
          {title}
        </h1>
        {action && <div className="shrink-0">{action}</div>}
      </header>
    );
  },
);
MobileAppBar.displayName = "MobileAppBar";
