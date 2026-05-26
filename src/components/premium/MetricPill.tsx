import { cn } from "@/lib/utils";

interface MetricPillProps {
  children: React.ReactNode;
  className?: string;
  /** Accent (burgundy) variant */
  accent?: boolean;
}

export function MetricPill({ children, className, accent }: MetricPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
        accent
          ? "border-primary/25 bg-primary/[0.08] text-primary"
          : "border-border/80 bg-muted/60 text-muted-foreground",
        className
      )}
    >
      {children}
    </span>
  );
}
