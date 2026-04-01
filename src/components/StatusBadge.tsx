import { cn } from "@/lib/utils";
import type { SimuladoStatus } from "@/types";
import { STATUS_CONFIG } from "@/lib/simulado-helpers";

interface StatusBadgeProps {
  status: SimuladoStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={cn(
      "inline-flex items-center text-caption font-semibold px-2.5 py-1 rounded-md",
      config.badgeClass,
      className
    )}>
      {(status === 'available' || status === 'available_late' || status === 'in_progress') && (
        <span
          className={cn(
            "h-1.5 w-1.5 rounded-full mr-1.5 animate-pulse",
            status === 'available' && "bg-success",
            status === 'available_late' && "bg-info",
            status === 'in_progress' && "bg-warning",
          )}
        />
      )}
      {config.label}
    </span>
  );
}
