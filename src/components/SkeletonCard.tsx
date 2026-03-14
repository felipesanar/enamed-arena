import { cn } from "@/lib/utils";

interface SkeletonCardProps {
  className?: string;
  lines?: number;
}

export function SkeletonCard({ className, lines = 3 }: SkeletonCardProps) {
  return (
    <div className={cn("premium-card p-5 md:p-6", className)}>
      <div className="animate-pulse space-y-3">
        <div className="h-4 w-1/3 bg-muted rounded-md" />
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className={cn("h-3 bg-muted rounded-md", i === lines - 1 && "w-2/3")} />
        ))}
      </div>
    </div>
  );
}