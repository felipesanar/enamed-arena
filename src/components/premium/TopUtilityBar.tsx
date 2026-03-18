import { Link } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { SEGMENT_LABELS } from "@/types";
import { cn } from "@/lib/utils";

interface TopUtilityBarProps {
  sectionLabel?: string;
  className?: string;
}

export function TopUtilityBar({ sectionLabel, className }: TopUtilityBarProps) {
  const { profile, isOnboardingComplete } = useUser();
  const segment = profile?.segment ?? "guest";

  return (
    <header
      className={cn(
        "flex h-12 shrink-0 items-center justify-between px-0 text-sm",
        className
      )}
      aria-label="Barra de contexto"
    >
      <div className="flex items-center gap-3">
        {sectionLabel && (
          <span className="text-[#5F6778] font-medium">{sectionLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-3">
        {!isOnboardingComplete && (
          <Link
            to="/onboarding"
            className="text-[13px] font-semibold text-[#8E1F3D] hover:text-[#A3294B] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(142,31,61,0.28)] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F7F5F7] rounded-lg px-2 py-1"
          >
            Completar perfil
          </Link>
        )}
        <span
          className="hidden sm:inline text-[12px] text-[#8C93A3]"
          aria-label="Segmento"
        >
          {SEGMENT_LABELS[segment]}
        </span>
        <div className="h-9 w-9 rounded-xl bg-[rgba(142,31,61,0.1)] border border-[rgba(142,31,61,0.18)] flex items-center justify-center shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]">
          <span className="text-[13px] font-bold text-[#8E1F3D]">
            {profile?.name?.[0]?.toUpperCase() || "U"}
          </span>
        </div>
      </div>
    </header>
  );
}
