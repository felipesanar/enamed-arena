import { Link } from "react-router-dom";
import { PanelLeftClose, PanelLeft } from "lucide-react";
import { BrandIcon, BrandLogo } from "@/components/brand/BrandMark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type SidebarBrandBlockProps = {
  collapsed: boolean;
  onCollapse: () => void;
  onExpand: () => void;
};

const iconBtnClass =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04] text-white/65 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[color,background-color,border-color,box-shadow] duration-200 hover:border-white/[0.12] hover:bg-white/[0.08] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019]";

export function SidebarBrandBlock({ collapsed, onCollapse, onExpand }: SidebarBrandBlockProps) {
  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-2">
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link
              to="/"
              className="group relative flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.2] bg-white/[0.04] shadow-[inset_0_1px_0_rgba(255,255,255,0.09),0_2px_12px_rgba(0,0,0,0.2)] ring-1 ring-white/15 transition-all duration-200 hover:border-white/[0.28] hover:bg-white/[0.07] hover:ring-white/25 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
              aria-label="Ir para início"
            >
              {/* Single source of size: avoid `size` + className conflict from BrandIcon */}
              <BrandIcon alt="" className="h-8 w-8 max-h-8 max-w-8 rounded-xl object-contain" />
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
          >
            Início
          </TooltipContent>
        </Tooltip>

        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={onExpand}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-transparent text-white/40 transition-all duration-200 hover:border-white/[0.08] hover:bg-white/[0.06] hover:text-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019]"
              aria-label="Expandir menu lateral"
            >
              <PanelLeft className="h-[18px] w-[18px]" strokeWidth={1.75} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
          >
            Expandir menu
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 px-0.5">
      <div className="min-w-0 flex-1 pt-0.5">
        <BrandLogo
          tone="onDark"
          variant="lg"
          alt="SanarFlix PRO ENAMED"
          className="!h-10 !max-h-10 w-full max-w-[232px] object-contain object-left [@media(max-height:700px)]:!h-8 [@media(max-height:700px)]:!max-h-8"
        />
      </div>
      <button
        type="button"
        onClick={onCollapse}
        className={iconBtnClass}
        aria-label="Recolher menu lateral"
      >
        <PanelLeftClose className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}
