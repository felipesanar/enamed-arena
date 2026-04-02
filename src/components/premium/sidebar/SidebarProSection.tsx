import { BookOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative flex items-center rounded-xl border border-transparent text-[13px] font-medium",
    "[@media(max-height:700px)]:gap-2 [@media(max-height:700px)]:px-2 [@media(max-height:700px)]:py-1.5 [@media(max-height:700px)]:text-[12px]",
    "text-white/60 hover:bg-white/[0.06] hover:text-white/85",
    "transition-[color,background-color,border-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019]",
    "before:pointer-events-none before:absolute before:left-1.5 before:top-1/2 before:z-[1] before:h-5 before:w-[3px] before:-translate-y-1/2 before:rounded-full before:bg-[linear-gradient(180deg,#E83862_0%,#B7214A_100%)] before:shadow-[0_0_10px_rgba(232,56,98,0.45)] before:content-[''] before:origin-center before:opacity-0 before:scale-y-[0.35] before:transition-[opacity,transform] before:duration-300 before:ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:before:transition-none motion-reduce:before:duration-0",
    isActive &&
      "border-white/[0.14] bg-white/[0.12] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_2px_10px_-4px_rgba(0,0,0,0.4)] before:opacity-100 before:scale-y-100",
  );

export function SidebarProSection({ collapsed }: { collapsed?: boolean }) {
  if (collapsed) {
    const rail = (
      <NavLink
        to="/caderno-erros"
        className={({ isActive }) =>
          cn(
            linkClass({ isActive }),
            "mx-auto h-12 w-12 justify-center gap-0 px-0 py-0 before:left-0 before:h-6",
          )
        }
      >
        <BookOpen className="h-[18px] w-[18px] shrink-0 opacity-85" aria-hidden />
        <span className="sr-only">Caderno de Erros, recurso PRO</span>
      </NavLink>
    );

    return (
      <div className="space-y-1">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>{rail}</TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
          >
            Caderno de Erros · PRO
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="space-y-1.5 [@media(max-height:700px)]:space-y-0.5">
      <NavLink
        to="/caderno-erros"
        className={({ isActive }) =>
          cn(
            linkClass({ isActive }),
            "gap-2.5 px-3 py-2.5",
          )
        }
      >
        <BookOpen className="h-[18px] w-[18px] shrink-0 opacity-85 [@media(max-height:700px)]:h-4 [@media(max-height:700px)]:w-4" aria-hidden />
        <span className="flex items-center gap-2">
          Caderno de Erros
          <span className="rounded-md border border-[rgba(232,56,98,0.25)] bg-[rgba(232,56,98,0.1)] px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-[#E8839B] [@media(max-height:700px)]:px-1 [@media(max-height:700px)]:py-0">
            PRO
          </span>
        </span>
      </NavLink>
    </div>
  );
}
