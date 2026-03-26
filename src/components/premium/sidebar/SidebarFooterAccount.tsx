import { Link } from "react-router-dom";
import { Settings, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/contexts/AuthContext";
import { useUser } from "@/contexts/UserContext";
import { cn } from "@/lib/utils";

export function SidebarFooterAccount() {
  const { signOut } = useAuth();
  const { profile } = useUser();
  const name = profile?.name || "Usuário";
  const email = profile?.email || "";
  const initial = name[0]?.toUpperCase() || "U";

  return (
    <div className="mt-auto">
      <div className="mb-2.5 flex items-center gap-2.5 px-0.5 [@media(max-height:700px)]:mb-2 [@media(max-height:700px)]:gap-2">
        <Avatar className="h-8 w-8 rounded-lg border border-white/10 bg-[#12203A] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] [@media(max-height:700px)]:h-7 [@media(max-height:700px)]:w-7">
          <AvatarFallback className="rounded-lg bg-[#12203A] text-xs font-semibold text-white/95">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12px] font-medium text-white [@media(max-height:700px)]:text-[11px]">
            {name}
          </p>
          <p className="truncate text-[10px] text-white/50 [@media(max-height:700px)]:text-[9px]">
            {email}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-0.5 [@media(max-height:700px)]:gap-0">
        <Link
          to="/configuracoes"
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-white/70 transition-colors duration-[220ms] ease-out hover:bg-white/[0.06] hover:text-white [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-1 [@media(max-height:700px)]:text-[11px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]"
          )}
        >
          <Settings className="h-3.5 w-3.5 shrink-0 opacity-90 [@media(max-height:700px)]:h-3 [@media(max-height:700px)]:w-3" aria-hidden />
          Configurações
        </Link>
        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] text-white/50 transition-colors duration-[220ms] ease-out hover:bg-white/[0.06] hover:text-white/75 [@media(max-height:700px)]:gap-1 [@media(max-height:700px)]:px-1.5 [@media(max-height:700px)]:py-1 [@media(max-height:700px)]:text-[11px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]"
          )}
          aria-label="Sair"
        >
          <LogOut className="h-3.5 w-3.5 shrink-0 opacity-90 [@media(max-height:700px)]:h-3 [@media(max-height:700px)]:w-3" aria-hidden />
          Sair
        </button>
      </div>
    </div>
  );
}
