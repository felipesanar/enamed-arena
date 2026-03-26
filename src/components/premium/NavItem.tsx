import { NavLink } from "react-router-dom";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItemProps {
  to: string;
  end?: boolean;
  icon: LucideIcon;
  label: string;
  className?: string;
}

export function NavItem({ to, end, icon: Icon, label, className }: NavItemProps) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] [@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:text-[12px]",
          "text-white/70 hover:bg-white/[0.06] hover:text-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]",
          isActive &&
            "border border-white/[0.08] bg-white/[0.1] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] before:absolute before:left-1.5 before:top-1/2 before:h-4 before:w-0.5 before:-translate-y-1/2 before:rounded-full before:bg-[#8E1F3D] before:opacity-90",
          className
        )
      }
    >
      <Icon className="h-4 w-4 shrink-0 opacity-90 [@media(max-height:700px)]:h-3.5 [@media(max-height:700px)]:w-3.5" aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}
