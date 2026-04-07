import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { PREMIUM_MOTION_EASE, PREMIUM_RAIL_SPRING } from "@/components/premium/PageTransition";

/**
 * Rail colapsado: item ativo com barra vertical #ebbac0.
 *
 * Layout: ícone numa camada `absolute inset-0 flex center` (sempre centrado na largura útil).
 * Barra numa segunda camada com `left-0` + `top/marginTop` — **sem** `-translate-y-1/2` no mesmo
 * nó que o Framer anima com `scaleY`, pois FM substitui `transform` e apaga o translate do Tailwind
 * (causa barra “entre” itens / desalinhada após transição de rota).
 * `AnimatePresence` usa `mode="sync"` — evita `popLayout` a interferir no fluxo flex.
 */
export const PREMIUM_RAIL_ICON_STROKE = 1.65;

const RAIL_BAR_H_PX = 32;
const RAIL_BAR_HALF = RAIL_BAR_H_PX / 2;

/** Referências estáveis para o Framer não repetir o pulse a cada render. */
const RAIL_ICON_ACTIVE = { scale: [1, 1.07, 1] };
const RAIL_ICON_IDLE = { scale: 1 };

export type PremiumSidebarRailItemProps = {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  /** Screen reader + tooltip */
  label: string;
  tooltip?: string;
  variant?: "default" | "pro";
  className?: string;
};

export function PremiumSidebarRailItem({
  to,
  end,
  icon: Icon,
  label,
  tooltip,
  variant = "default",
  className,
}: PremiumSidebarRailItemProps) {
  const tip = tooltip ?? label;
  const reduced = useReducedMotion();

  const link = (
    <NavLink
      to={to}
      end={end}
      className={cn(
        "flex w-full min-w-0 max-w-[80px] justify-center rounded-lg px-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ebbac0]/45 focus-visible:ring-offset-2 focus-visible:ring-offset-[#270812]",
        className,
      )}
    >
      {({ isActive }) => {
        const isProActive = variant === "pro" && isActive;

        return (
          <span
            className={cn(
              "relative flex w-full flex-col items-center py-2.5 motion-safe:transition-opacity motion-safe:duration-200 motion-reduce:transition-none",
              !isActive && "opacity-60 hover:opacity-90",
            )}
          >
            {/* Bloco só de ícone + barra: sem flex entre AnimatePresence e ícone (evita saltos). */}
            <span className="relative block h-[18px] w-full shrink-0 overflow-visible">
              <span className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
                <motion.span
                  className="inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center"
                  initial={false}
                  animate={reduced ? RAIL_ICON_IDLE : isActive ? RAIL_ICON_ACTIVE : RAIL_ICON_IDLE}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : isActive
                        ? {
                            duration: 0.52,
                            ease: PREMIUM_MOTION_EASE,
                            times: [0, 0.38, 1],
                          }
                        : PREMIUM_RAIL_SPRING
                  }
                >
                  <Icon
                    className={cn(
                      "h-[18px] w-[18px] motion-safe:transition-[color,filter] motion-safe:duration-200",
                      isActive
                        ? isProActive
                          ? "text-[#ffd9e0] drop-shadow-[0_0_12px_rgba(235,186,192,0.45)]"
                          : "text-[#ffd9e0] drop-shadow-[0_0_12px_rgba(235,186,192,0.4)]"
                        : "text-[#d4c2c5]",
                    )}
                    strokeWidth={PREMIUM_RAIL_ICON_STROKE}
                    aria-hidden
                  />
                </motion.span>
              </span>

              <AnimatePresence initial={false} mode="sync">
                {isActive && !reduced && (
                  <motion.span
                    key={`bar-${to}`}
                    layout={false}
                    className="pointer-events-none absolute left-0 z-[2] h-8 w-[2px] rounded-full bg-[#ebbac0] shadow-[0_0_10px_0_#ebbac0]"
                    style={{
                      top: "50%",
                      marginTop: -RAIL_BAR_HALF,
                      transformOrigin: "50% 50%",
                    }}
                    initial={{ scaleY: 0.32, opacity: 0 }}
                    animate={{ scaleY: 1, opacity: 1 }}
                    exit={{
                      scaleY: 0.45,
                      opacity: 0,
                      transition: { duration: 0.22, ease: PREMIUM_MOTION_EASE },
                    }}
                    transition={{
                      scaleY: { duration: 0.44, ease: PREMIUM_MOTION_EASE },
                      opacity: { duration: 0.32, ease: PREMIUM_MOTION_EASE },
                    }}
                    aria-hidden
                  />
                )}
              </AnimatePresence>

              {isActive && reduced && (
                <span
                  className="pointer-events-none absolute left-0 z-[2] h-8 w-[2px] rounded-full bg-[#ebbac0] shadow-[0_0_10px_0_#ebbac0]"
                  style={{ top: "50%", marginTop: -RAIL_BAR_HALF }}
                  aria-hidden
                />
              )}
            </span>

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
