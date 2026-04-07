import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Collapsed rail alinhado ao frame Figma (node 1:80): fundo #270812, item ativo com
 * barra vertical #ebbac0 + label uppercase 10px; inativos só ícone a ~60% opacidade.
 */
export const PREMIUM_RAIL_ICON_STROKE = 1.65;

const labelMicro =
  "text-[10px] font-medium uppercase leading-[15px] tracking-[0.5px]";

export type PremiumSidebarRailItemProps = {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  /** Screen reader + tooltip */
  label: string;
  tooltip?: string;
  variant?: "default" | "pro";
  /** Navegação: label visível só quando ativo. Rodapé: label sempre (Figma Setting/Logout). */
  labelVisibility?: "active-only" | "always";
  /** Texto curto sob o ícone (maiúsculas no CSS). Default: primeiras letras do label. */
  microLabel?: string;
  className?: string;
};

export function PremiumSidebarRailItem({
  to,
  end,
  icon: Icon,
  label,
  tooltip,
  variant = "default",
  labelVisibility = "active-only",
  microLabel,
  className,
}: PremiumSidebarRailItemProps) {
  const tip = tooltip ?? label;
  const short =
    microLabel ??
    (labelVisibility === "always" ? (label.split(" ")[0] ?? label) : label);

  const link = (
    <NavLink
      to={to}
      end={end}
      className={cn(
        "block w-full max-w-[80px] rounded-lg px-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ebbac0]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#270812]",
        className,
      )}
    >
      {({ isActive }) => {
        const showMicro =
          labelVisibility === "always" || (labelVisibility === "active-only" && isActive);
        const isProActive = variant === "pro" && isActive;

        return (
          <span
            className={cn(
              "relative flex w-full flex-col items-center gap-1 py-4 transition-opacity duration-200",
              !isActive && labelVisibility === "active-only" && "opacity-60 hover:opacity-90",
            )}
          >
            {/* Barra vertical ativa (Figma Vertical Divider) */}
            {isActive && (
              <span
                className="pointer-events-none absolute left-0 top-1/2 z-[2] h-8 w-[2px] -translate-y-1/2 rounded-full bg-[#ebbac0] shadow-[0_0_10px_0_#ebbac0]"
                aria-hidden
              />
            )}

            <Icon
              className={cn(
                "h-[18px] w-[18px] shrink-0",
                isActive
                  ? isProActive
                    ? "text-[#ffd9e0] drop-shadow-[0_0_12px_rgba(235,186,192,0.45)]"
                    : "text-[#ffd9e0] drop-shadow-[0_0_12px_rgba(235,186,192,0.4)]"
                  : "text-[#d4c2c5]",
              )}
              strokeWidth={PREMIUM_RAIL_ICON_STROKE}
              aria-hidden
            />

            {showMicro ? (
              <span
                className={cn(
                  labelMicro,
                  "max-w-[72px] truncate text-center",
                  isActive ? "text-[#ffd9e0]" : "text-[#d4c2c5]",
                )}
              >
                {short}
              </span>
            ) : null}

            <span className="sr-only">{label}</span>
          </span>
        );
      }}
    </NavLink>
  );

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}
