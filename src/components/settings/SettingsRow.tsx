import { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsRowProps {
  icon: LucideIcon;
  label: string;
  description?: string;
  /** Valor atual (lado direito — texto, chips, ou controle). */
  value?: ReactNode;
  /** Slot para ações (botão editar, toggle, link). */
  action?: ReactNode;
  /** Elemento renderizado abaixo da linha (expansão — ex.: editor inline). */
  expanded?: ReactNode;
  className?: string;
  /** Destaca a linha como crítica (ex.: zona de risco). */
  tone?: "default" | "danger";
  /** Remove a borda inferior — use no último item do grupo. */
  divider?: boolean;
}

/**
 * Linha de configuração padronizada: ícone + label/descrição + valor/ações.
 * Usada dentro de um `SettingsCardGroup` (que acumula as rows com divisores).
 */
export function SettingsRow({
  icon: Icon,
  label,
  description,
  value,
  action,
  expanded,
  className,
  tone = "default",
  divider = true,
}: SettingsRowProps) {
  const isDanger = tone === "danger";
  return (
    <div
      className={cn(
        "group relative px-5 py-4 transition-colors",
        divider && "border-b border-border/70 last:border-b-0",
        className,
      )}
    >
      <div className="flex items-start gap-4 flex-wrap sm:flex-nowrap">
        <span
          className={cn(
            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
            isDanger
              ? "bg-destructive/10 text-destructive"
              : "bg-accent text-primary",
          )}
          aria-hidden="true"
        >
          <Icon className="h-4 w-4" />
        </span>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "text-body font-semibold leading-tight",
              isDanger ? "text-destructive" : "text-foreground",
            )}
          >
            {label}
          </p>
          {description && (
            <p className="mt-1 text-body-sm text-muted-foreground leading-snug">
              {description}
            </p>
          )}
          {value && (
            <div className="mt-2 text-body-sm text-foreground">
              {value}
            </div>
          )}
        </div>

        {action && (
          <div className="shrink-0 flex items-center gap-2">{action}</div>
        )}
      </div>

      {expanded && <div className="mt-4 pl-0 sm:pl-[52px]">{expanded}</div>}
    </div>
  );
}

interface SettingsCardGroupProps {
  children: ReactNode;
  className?: string;
}

/** Cartão que agrupa várias `SettingsRow` como lista com divisores. */
export function SettingsCardGroup({ children, className }: SettingsCardGroupProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card overflow-hidden",
        "shadow-[0_1px_2px_rgba(20,20,30,0.03),0_8px_24px_-12px_rgba(20,20,30,0.06)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
