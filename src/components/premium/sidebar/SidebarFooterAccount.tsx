import { Link } from "react-router-dom";
import { Settings, LogOut } from "lucide-react";
import { SANARFLIX_MARK_SRC } from "@/components/brand/BrandMark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";
import type { UserSegment } from "@/types";

const railIconBtn =
  "flex h-11 w-11 items-center justify-center rounded-xl text-white/70 transition-all duration-200 hover:bg-white/[0.08] hover:text-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019]";

const segmentColors: Record<string, string> = {
  pro: "#e83862",
  standard: "#3b82f6",
  guest: "#6b7280",
};

export function SidebarFooterAccount({ collapsed }: { collapsed?: boolean }) {
  const { signOut } = useAuth();
  const { profile } = useUser();
  const segment = (profile?.segment ?? "guest") as UserSegment;
  const isPro = segment === "pro";
  const isSanarflixStudent = segment === "standard";
  const name = profile?.name || "Usuário";
  const email = profile?.email || "";
  const initial = name[0]?.toUpperCase() || "U";
  const dotColor = segmentColors[segment] || segmentColors.guest;

  if (collapsed) {
    return (
      <div className="mt-auto flex flex-col items-center gap-3">
        {/* Avatar with online-style segment dot */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link
              to="/configuracoes"
              className="group relative flex h-11 w-11 items-center justify-center"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4A1528_0%,#361019_100%)] shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)] ring-1 ring-white/[0.08] transition-all duration-200 group-hover:ring-white/[0.16] group-hover:shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
                <Avatar className="h-9 w-9 rounded-lg bg-transparent shadow-none ring-0">
                  <AvatarFallback className="rounded-lg bg-transparent text-[12px] font-bold text-white/90">
                    {initial}
                  </AvatarFallback>
                </Avatar>
              </div>
              {/* Segment indicator dot */}
              <span
                className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-[#361019]"
                style={{ backgroundColor: dotColor }}
              />
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="max-w-[220px] border-white/10 bg-[#2a0c15] text-left text-xs text-white/95 shadow-lg"
          >
            <p className="font-semibold text-white">{name}</p>
            {email ? <p className="mt-0.5 text-[10px] text-white/50">{email}</p> : null}
            {isPro && <p className="mt-1 text-[10px] font-semibold text-[#E8839B]">PRO</p>}
          </TooltipContent>
        </Tooltip>

        {/* Settings */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <Link to="/configuracoes" className={railIconBtn} aria-label="Configurações">
              <Settings className="h-[20px] w-[20px] text-white" strokeWidth={1.8} aria-hidden />
            </Link>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
          >
            Configurações
          </TooltipContent>
        </Tooltip>

        {/* Logout */}
        <Tooltip delayDuration={200}>
          <TooltipTrigger asChild>
            <button type="button" onClick={signOut} className={railIconBtn} aria-label="Sair">
              <LogOut className="h-[20px] w-[20px] text-white/70" strokeWidth={1.8} aria-hidden />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            sideOffset={10}
            className="border-white/10 bg-[#2a0c15] text-xs font-medium text-white/95 shadow-lg"
          >
            Sair
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }

  return (
    <div className="mt-auto">
      <div className="mb-3 flex items-center gap-3 px-0.5 [@media(max-height:700px)]:mb-2 [@media(max-height:700px)]:gap-2">
        <Avatar className="h-9 w-9 rounded-xl border border-white/[0.1] bg-[linear-gradient(135deg,#4A1528_0%,#361019_100%)] shadow-[0_2px_8px_rgba(0,0,0,0.25),inset_0_1px_0_rgba(255,255,255,0.05)] ring-2 ring-white/[0.06] ring-offset-1 ring-offset-transparent [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7">
          <AvatarFallback className="rounded-xl bg-transparent text-[11px] font-bold text-white/90">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-[12px] font-semibold text-white/90 [@media(max-height:700px)]:text-[11px]">
              {name}
            </p>
            {isPro && (
              <span
                className="shrink-0 rounded-md border border-[rgba(232,56,98,0.25)] bg-[rgba(232,56,98,0.1)] px-1.5 py-0.5 text-[8px] font-bold uppercase leading-none tracking-[0.14em] text-[#E8839B] [@media(max-height:700px)]:px-1 [@media(max-height:700px)]:py-0 [@media(max-height:700px)]:text-[7px]"
                title="Assinante PRO"
              >
                PRO
              </span>
            )}
            {isSanarflixStudent && (
              <span
                className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-white/20 bg-white/[0.08] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-white/5 [@media(max-height:700px)]:p-px"
                title="Aluno SanarFlix"
              >
                <img
                  src={SANARFLIX_MARK_SRC}
                  alt=""
                  width={16}
                  height={16}
                  draggable={false}
                  decoding="async"
                  className="h-3.5 w-3.5 rounded-sm object-contain [@media(max-height:700px)]:h-3 [@media(max-height:700px)]:w-3"
                />
              </span>
            )}
          </div>
          <p className="mt-0.5 min-w-0 truncate text-[10px] text-white/40 [@media(max-height:700px)]:text-[9px]">
            {email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-0.5 [@media(max-height:700px)]:gap-0">
        <Link
          to="/configuracoes"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-white/55 transition-all duration-[220ms] ease-out hover:bg-white/[0.06] hover:text-white/80 [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-1 [@media(max-height:700px)]:text-[11px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019]",
          )}
        >
          <Settings className="h-3.5 w-3.5 shrink-0 opacity-80 [@media(max-height:700px)]:h-3 [@media(max-height:700px)]:w-3" aria-hidden />
          Configurações
        </Link>
        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-white/40 transition-all duration-[220ms] ease-out hover:bg-white/[0.06] hover:text-white/65 [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-1 [@media(max-height:700px)]:text-[11px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#361019]",
          )}
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0 opacity-80 [@media(max-height:700px)]:h-3 [@media(max-height:700px)]:w-3" aria-hidden />
          Sair
        </button>
      </div>
    </div>
  );
}
