import { Target, ChevronRight } from "lucide-react";

interface SidebarContextCardProps {
  simuladosRealizados?: number;
  mediaAtual?: number;
  proximoPasso?: string;
}

export function SidebarContextCard({
  simuladosRealizados = 1,
  mediaAtual = 10,
  proximoPasso = "revisar erros",
}: SidebarContextCardProps) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0B1630]/90 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_2px_8px_rgba(0,0,0,0.12)]">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.06] border border-white/[0.04]">
          <Target className="h-4 w-4 text-white/55" aria-hidden />
        </div>
        <span className="text-[11px] uppercase tracking-[0.12em] font-semibold text-white/50">
          Seu momento
        </span>
      </div>
      <ul className="space-y-2 text-[13px] text-white/85">
        <li className="flex items-center gap-2">
          <span className="text-white/50 tabular-nums">{simuladosRealizados}</span>
          <span>simulado realizado</span>
        </li>
        <li className="flex items-center gap-2">
          <span className="text-white/50 font-medium tabular-nums">{mediaAtual}%</span>
          <span>média atual</span>
        </li>
        <li className="pt-2 mt-2 border-t border-white/[0.06] flex items-center gap-1.5 text-white/70">
          <ChevronRight className="h-3.5 w-3.5 text-[#8E1F3D]/80 shrink-0" aria-hidden />
          <span className="text-[12px] font-medium">Próximo: {proximoPasso}</span>
        </li>
      </ul>
    </div>
  );
}
