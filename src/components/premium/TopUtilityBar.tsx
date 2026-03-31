import { Link } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_LABELS } from "@/types";
import { cn } from "@/lib/utils";

interface TopUtilityBarProps {
  className?: string;
}

export function TopUtilityBar({ className }: TopUtilityBarProps) {
  const { profile, isOnboardingComplete } = useUser();
  const segment = profile?.segment ?? "guest";

  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center justify-end gap-3 px-0 text-sm",
        className
      )}
      aria-label="Barra de contexto"
    >
      {!isOnboardingComplete && (
        <Link
          to="/onboarding"
          className="text-[13px] font-semibold text-primary hover:text-primary/80 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-lg px-2 py-1"
        >
          Completar perfil
        </Link>
      )}
      <span
        className="hidden sm:inline text-[12px] text-muted-foreground"
        aria-label="Segmento"
      >
        {SEGMENT_LABELS[segment]}
      </span>
      <Link
        to="/configuracoes"
        className="flex h-9 w-9 rounded-xl bg-primary/10 border border-primary/[0.18] items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] hover:bg-primary/15 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Abrir configurações"
      >
        <span className="text-[13px] font-bold text-primary">
          {profile?.name?.[0]?.toUpperCase() || "U"}
        </span>
      </Link>
    </header>
  );
}
