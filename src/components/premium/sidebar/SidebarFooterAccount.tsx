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
    <div className="border-t border-white/[0.06] pt-5 mt-auto">
      <div className="flex items-center gap-3 px-1 mb-4">
        <Avatar className="h-10 w-10 rounded-xl border border-white/10 bg-[#12203A] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <AvatarFallback className="rounded-xl bg-[#12203A] text-sm font-semibold text-white/95">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-white truncate">{name}</p>
          <p className="text-[11px] text-white/50 truncate">{email}</p>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Link
          to="/configuracoes"
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-white/70 hover:bg-white/[0.06] hover:text-white transition-colors duration-[220ms] ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]"
          )}
        >
          <Settings className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Configurações
        </Link>
        <button
          type="button"
          onClick={signOut}
          className={cn(
            "flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] text-white/50 hover:bg-white/[0.06] hover:text-white/75 transition-colors duration-[220ms] ease-out",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07111F]"
          )}
          aria-label="Sair"
        >
          <LogOut className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
          Sair
        </button>
      </div>
    </div>
  );
}
