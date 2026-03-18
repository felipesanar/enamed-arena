import { BookOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

export function SidebarProSection() {
  return (
    <div className="space-y-1.5">
      <p className="px-3 py-1.5 text-[10px] uppercase tracking-[0.14em] font-semibold text-white/40">
        PRO EXCLUSIVO
      </p>
      <NavLink
        to="/caderno-erros"
        className={({ isActive }) =>
          cn(
            "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[15px] font-medium transition-all duration-[220ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]",
            "text-white/70 hover:bg-white/[0.06] hover:text-white",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]",
            isActive &&
              "bg-white/[0.1] text-white border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] before:absolute before:left-2 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-[#8E1F3D] before:opacity-90"
          )
        }
      >
        <BookOpen className="h-[18px] w-[18px] shrink-0 opacity-90" aria-hidden />
        <span className="flex items-center gap-2">
          Caderno de Erros
          <span className="rounded-full border border-[rgba(142,31,61,0.32)] bg-[rgba(142,31,61,0.14)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#d4899a]">
            PRO
          </span>
        </span>
      </NavLink>
    </div>
  );
}
