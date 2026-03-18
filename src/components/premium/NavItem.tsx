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
          "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
          "text-white/70 hover:bg-white/[0.06] hover:text-white",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]",
          isActive &&
            "bg-white/[0.1] text-white border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] before:absolute before:left-2 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-[#8E1F3D] before:opacity-90",
          className
        )
      }
    >
      <Icon className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
      <span>{label}</span>
    </NavLink>
  );
}
