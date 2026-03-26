import { GraduationCap } from "lucide-react";

export function SidebarBrandBlock() {
  return (
    <div className="flex items-center gap-2.5 px-0.5 [@media(max-height:700px)]:gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-[#12203A] shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] transition-transform duration-200 hover:scale-[1.02] [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8">
        <GraduationCap className="h-4 w-4 text-white/95 [@media(max-height:700px)]:h-3.5 [@media(max-height:700px)]:w-3.5" aria-hidden />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/55">
          SANARFLIX
        </span>
        <span className="text-[13px] font-bold leading-tight tracking-[-0.02em] text-white [@media(max-height:700px)]:text-[12px]">
          PRO: ENAMED
        </span>
        <span className="mt-1 inline-flex w-fit items-center rounded-full border border-[rgba(142,31,61,0.35)] bg-[rgba(142,31,61,0.14)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#d4899a] shadow-[0_0_0_1px_rgba(142,31,61,0.1)] [@media(max-height:700px)]:mt-0.5 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-0">
          Pro
        </span>
      </div>
    </div>
  );
}
