import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { PremiumSidebarRailItem } from "@/components/premium/sidebar/PremiumSidebarRailItem";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  className?: string;
  collapsed?: boolean;
}

/* ── Base link ── */
const navLinkBase =
  "relative flex items-center gap-2.5 rounded-xl border border-transparent px-3 py-2.5 text-[13px] font-medium text-white/70 hover:bg-white/[0.08] hover:text-white/90 transition-[color,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019] before:pointer-events-none before:absolute before:left-1.5 before:top-1/2 before:z-[1] before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[linear-gradient(180deg,#E83862_0%,#B7214A_100%)] before:shadow-[0_0_10px_rgba(232,56,98,0.45)] before:content-[''] before:origin-center before:opacity-0 before:scale-y-[0.35] before:transition-[opacity,transform] before:duration-300 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:text-[12px]";

const barExpanded =
  "gap-2.5 px-3 py-2.5 [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:text-[12px] before:left-1.5 before:top-1/2 before:h-5 before:w-[3px] before:-translate-y-1/2";

const activeBar =
  "border-white/[0.14] bg-[linear-gradient(135deg,rgba(255,255,255,0.11)_0%,rgba(255,255,255,0.06)_100%)] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_2px_10px_-4px_rgba(0,0,0,0.4)] before:opacity-100 before:scale-y-100";

export function NavItem({ to, end, icon: Icon, label, className, collapsed }: NavItemProps) {
  if (collapsed) {
    return (
      <PremiumSidebarRailItem
        to={to}
        end={end}
        icon={Icon}
        label={label}
        className={className}
      />
    );
  }

  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(navLinkBase, barExpanded, isActive && activeBar, className)
      }
    >
      <Icon
        className="h-[18px] w-[18px] shrink-0 opacity-85 transition-[opacity,transform] duration-300 [@media(max-height:700px)]:h-4 [@media(max-height:700px)]:w-4"
        aria-hidden
      />
      <span className="transition-colors duration-300">{label}</span>
    </NavLink>
  );
}
