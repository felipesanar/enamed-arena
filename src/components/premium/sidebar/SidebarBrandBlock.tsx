import { Stethoscope } from "lucide-react";

export function SidebarBrandBlock() {
  return (
    <div className="flex items-center gap-2.5 px-0.5 [@media(max-height:700px)]:gap-2">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/[0.12] bg-[#5A1A30] shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.06)] [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8">
        <Stethoscope className="h-4.5 w-4.5 text-white/95 [@media(max-height:700px)]:h-4 [@media(max-height:700px)]:w-4" aria-hidden />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-white/55">
          SANARFLIX
        </span>
        <span className="text-[13px] font-bold leading-tight tracking-[-0.02em] text-white [@media(max-height:700px)]:text-[12px]">
          PRO: ENAMED
        </span>
        <span className="mt-1 inline-flex w-fit items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/80 shadow-[0_0_0_1px_rgba(255,255,255,0.05)] [@media(max-height:700px)]:mt-0.5 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-0">
          Pro
        </span>
      </div>
    </div>
  );
}
