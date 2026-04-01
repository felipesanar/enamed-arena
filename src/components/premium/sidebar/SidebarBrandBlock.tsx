import { Stethoscope } from "lucide-react";

export function SidebarBrandBlock() {
  return (
    <div className="flex items-center gap-3 px-0.5 [@media(max-height:700px)]:gap-2">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/[0.1] bg-[linear-gradient(135deg,#6A1E38_0%,#4A1528_100%)] shadow-[0_4px_12px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.08)] [@media(max-height:700px)]:h-8 [@media(max-height:700px)]:w-8">
        <Stethoscope className="h-[18px] w-[18px] text-white/90 [@media(max-height:700px)]:h-4 [@media(max-height:700px)]:w-4" aria-hidden />
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-white/40">
          SANARFLIX
        </span>
        <span className="text-[14px] font-bold leading-tight tracking-[-0.02em] text-white [@media(max-height:700px)]:text-[12px]">
          PRO: ENAMED
        </span>
        <span className="mt-1.5 inline-flex w-fit items-center rounded-md border border-white/[0.12] bg-[linear-gradient(135deg,rgba(255,255,255,0.1)_0%,rgba(255,255,255,0.06)_100%)] px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.14em] text-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] [@media(max-height:700px)]:mt-1 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-0">
          Pro
        </span>
      </div>
    </div>
  );
}
