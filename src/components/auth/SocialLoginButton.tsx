import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SocialLoginButtonProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}

export function SocialLoginButton({ icon, label, onClick, disabled, active }: SocialLoginButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex h-10 w-full items-center justify-center gap-2 rounded-md border px-2.5 text-[12px] font-semibold uppercase tracking-[0.03em] transition-all duration-200 lg:h-9",
        "border-auth-border-subtle bg-auth-surface-soft text-auth-text-primary",
        "hover:border-auth-border-strong hover:bg-auth-surface-soft/90 hover:-translate-y-0.5",
        "active:translate-y-0 active:scale-[0.995]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0",
        "disabled:cursor-not-allowed disabled:opacity-55",
        active ? "border-primary/40 bg-primary/10" : ""
      )}
    >
      <span className="text-auth-text-muted transition-colors group-hover:text-auth-text-primary">{icon}</span>
      <span>{label}</span>
    </button>
  );
}
