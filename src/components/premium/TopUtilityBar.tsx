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
  const initial = profile?.name?.[0]?.toUpperCase() || "U";

  return (
    <header
      className={cn(
        "flex h-10 shrink-0 items-center justify-end gap-2 px-0 text-sm",
        className
      )}
      aria-label="Barra de contexto"
    >
      {!isOnboardingComplete && (
        <Link
          to="/onboarding"
          className="text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md px-1.5 py-0.5"
        >
          Completar perfil
        </Link>
      )}

      <span
        className="hidden sm:inline rounded-md border border-[#E8E1E5]/70 bg-white/70 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70 backdrop-blur-sm"
        aria-label="Segmento"
      >
        {SEGMENT_LABELS[segment]}
      </span>

      <Link
        to="/configuracoes"
        className="flex h-8 w-8 rounded-lg border border-primary/15 bg-[linear-gradient(135deg,rgba(142,31,61,0.08)_0%,rgba(142,31,61,0.04)_100%)] items-center justify-center shadow-[0_2px_8px_-4px_rgba(142,31,61,0.2),inset_0_1px_0_rgba(255,255,255,0.5)] hover:bg-[linear-gradient(135deg,rgba(142,31,61,0.12)_0%,rgba(142,31,61,0.06)_100%)] hover:border-primary/25 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        aria-label="Abrir configurações"
      >
        <span className="text-[11px] font-bold text-primary/90">
          {initial}
        </span>
      </Link>
    </header>
  );
}
