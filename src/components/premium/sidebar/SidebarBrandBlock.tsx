import { GraduationCap } from "lucide-react";

export function SidebarBrandBlock() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#12203A] border border-white/[0.08] shadow-[0_2px_8px_rgba(0,0,0,0.2),inset_0_1px_0_rgba(255,255,255,0.04)] transition-transform duration-200 hover:scale-[1.02]">
        <GraduationCap className="h-5 w-5 text-white/95" aria-hidden />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] uppercase tracking-[0.14em] font-semibold text-white/55">
          SANARFLIX
        </span>
        <span className="text-[15px] font-bold tracking-[-0.02em] text-white leading-tight">
          PRO: ENAMED
        </span>
        <span className="mt-1.5 inline-flex w-fit items-center rounded-full border border-[rgba(142,31,61,0.35)] bg-[rgba(142,31,61,0.14)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#d4899a] shadow-[0_0_0_1px_rgba(142,31,61,0.1)]">
          Pro
        </span>
      </div>
    </div>
  );
}
