import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: "available" | "upcoming" | "completed" | "locked" | "live";
  className?: string;
}

const statusConfig = {
  available: { label: "Disponível", className: "bg-success/10 text-success" },
  upcoming: { label: "Em breve", className: "bg-info/10 text-info" },
  completed: { label: "Concluído", className: "bg-muted text-muted-foreground" },
  locked: { label: "Bloqueado", className: "bg-muted text-muted-foreground" },
  live: { label: "Ao vivo", className: "bg-destructive/10 text-destructive" },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  return (
    <span className={cn(
      "inline-flex items-center text-caption font-semibold px-2.5 py-1 rounded-md",
      config.className,
      className
    )}>
      {status === "live" && (
        <span className="h-1.5 w-1.5 rounded-full bg-destructive mr-1.5 animate-pulse" />
      )}
      {config.label}
    </span>
  );
}
