import { LucideIcon, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProBadgeProps {
  size?: "sm" | "md";
}

export function ProBadge({ size = "sm" }: ProBadgeProps) {
  return (
    <span className={cn(
      "inline-flex items-center font-bold uppercase tracking-wider bg-primary/10 text-primary rounded",
      size === "sm" && "text-[10px] px-1.5 py-0.5",
      size === "md" && "text-[11px] px-2 py-1",
    )}>
      PRO
    </span>
  );
}

interface ProGateProps {
  feature: string;
  description: string;
  icon?: LucideIcon;
}

export function ProGate({ feature, description, icon: Icon = Lock }: ProGateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6 max-w-md mx-auto">
      <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-heading-3 text-foreground mb-2">{feature}</h3>
      <p className="text-body text-muted-foreground mb-6">{description}</p>
      <button className="inline-flex items-center justify-center px-6 py-3 rounded-xl bg-primary text-primary-foreground text-body font-semibold hover:bg-wine-hover transition-colors duration-150 shadow-sm">
        Conhecer o PRO: ENAMED
      </button>
    </div>
  );
}
