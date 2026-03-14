import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn("premium-card p-5 md:p-6 animate-pulse", className)}>
      <div className="h-4 w-1/3 bg-muted rounded mb-4" />
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className={cn("h-3 bg-muted rounded mb-2", i === lines - 1 && "w-2/3")} />
      ))}
    </div>
  );
}
