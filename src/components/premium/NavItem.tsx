import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface NavItemProps {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  className?: string;
  /** Rail estreito: só ícone + tooltip à direita. */
  collapsed?: boolean;
}

const navLinkBase =
  "relative flex items-center rounded-xl border border-transparent text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-[color,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019] before:pointer-events-none before:absolute before:z-[1] before:rounded-full before:bg-[linear-gradient(180deg,#E83862_0%,#B7214A_100%)] before:shadow-[0_0_10px_rgba(232,56,98,0.45)] before:content-[''] before:origin-center before:opacity-0 before:scale-y-[0.35] before:transition-[opacity,transform] before:duration-300 before:ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:before:transition-none motion-reduce:before:duration-0";

const barExpanded =
  "gap-2.5 px-3 py-2.5 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:text-[12px] before:left-1.5 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2";
const barCollapsed =
  "mx-auto h-11 w-11 shrink-0 justify-center px-0 py-0 before:left-0 before:top-1/2 before:h-6 before:w-[3px] before:-translate-y-1/2";

const activeBar =
  "border-white/[0.14] bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_10px_-4px_rgba(0,0,0,0.4)] before:opacity-100 before:scale-y-100";

export function NavItem({ to, end, icon: Icon, label, className, collapsed }: NavItemProps) {
  const link = (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(navLinkBase, collapsed ? barCollapsed : barExpanded, isActive && activeBar, className)
      }
    >
      <Icon
        className={cn(
          "shrink-0 transition-opacity duration-300",
          collapsed
            ? "h-[20px] w-[20px] text-white/80"
            : "h-[18px] w-[18px] opacity-85 [@media(max-height:700px)]:h-4 [@media(max-height:700px)]:w-4",
        )}
        strokeWidth={1.8}
        aria-hidden
      />
      {collapsed ? (
        <span className="sr-only">{label}</span>
      ) : (
        <span className="transition-colors duration-300">{label}</span>
      )}
    </NavLink>
  );

  if (!collapsed) return link;

  return (
    <Tooltip delayDuration={200}>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent
        side="right"
        sideOffset={10}
        className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
