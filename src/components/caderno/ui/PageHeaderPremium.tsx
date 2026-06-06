import * as React from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileAppBar } from "./MobileAppBar";

export interface PageHeaderStat {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  color?: string;
}

export interface PageHeaderPremiumProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Título principal da página. */
  title: string;
  /** Subtítulo/descrição (desktop). */
  subtitle?: string;
  /** Tiles de estatística. */
  stats?: PageHeaderStat[];
  /** Ação primária (botão, etc.). */
  primaryAction?: React.ReactNode;
  /** Callback para voltar (mobile — exibe botão no MobileAppBar). */
  onBack?: () => void;
}

/**
 * Header premium de página do Caderno v3.
 * Desktop: título + tiles de stat em linha + ação primária à direita.
 * Mobile: MobileAppBar compacto (título + 1 ação) + stats abaixo.
 */
export const PageHeaderPremium = React.forwardRef<HTMLDivElement, PageHeaderPremiumProps>(
  ({ title, subtitle, stats, primaryAction, onBack, className, ...props }, ref) => {
    const isMobile = useIsMobile();

    if (isMobile) {
      return (
        <div ref={ref} className={cn("flex flex-col", className)} {...props}>
          <MobileAppBar
            title={title}
            onBack={onBack}
            action={primaryAction}
          />
          {/* Stats em linha scrollável abaixo da app bar */}
          {stats && stats.length > 0 && (
            <div className="flex gap-5 overflow-x-auto px-4 py-3 settings-nav-scroll border-b border-[var(--c-border)] bg-[var(--c-surface)]">
              {stats.map((stat, i) => (
                <div key={i} className="flex shrink-0 flex-col gap-0.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--c-muted)]">
                    {stat.label}
                  </span>
                  <span
                    className="text-kpi-sm font-bold tabular-nums leading-none"
                    style={{ color: stat.color ?? "var(--c-ink)" }}
                  >
                    {stat.value}
                    {stat.suffix && (
                      <span className="ml-0.5 text-sm font-semibold text-[var(--c-muted)]">
                        {stat.suffix}
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Desktop
    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col gap-4 pb-6",
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-6">
          {/* Título + subtítulo */}
          <div className="flex flex-col gap-1">
            <h1 className="text-heading-1 font-bold tracking-tight text-[var(--c-ink)]">
              {title}
            </h1>
            {subtitle && (
              <p className="text-body text-[var(--c-muted)]">{subtitle}</p>
            )}
          </div>
          {/* Ação primária */}
          {primaryAction && <div className="shrink-0">{primaryAction}</div>}
        </div>

        {/* Stats tiles em linha */}
        {stats && stats.length > 0 && (
          <div
            className="flex flex-wrap gap-x-8 gap-y-3"
            role="region"
            aria-label="Estatísticas"
          >
            {stats.map((stat, i) => (
              <div key={i} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--c-muted)]">
                  {stat.label}
                </span>
                <div className="flex items-baseline gap-0.5">
                  <span
                    className="text-kpi font-extrabold tabular-nums leading-none"
                    style={{ color: stat.color ?? "var(--c-ink)" }}
                  >
                    {stat.value}
                  </span>
                  {stat.suffix && (
                    <span className="text-base font-semibold text-[var(--c-muted)]">
                      {stat.suffix}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
);
PageHeaderPremium.displayName = "PageHeaderPremium";
