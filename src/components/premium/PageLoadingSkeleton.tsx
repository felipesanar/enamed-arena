import { cn } from "@/lib/utils";

function ShimmerBar({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl bg-muted/60 relative overflow-hidden",
        className,
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
    </div>
  );
}

export function PageLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      {/* Header area */}
      <div className="flex flex-col gap-2">
        <ShimmerBar className="h-7 w-48" />
        <ShimmerBar className="h-4 w-72" />
      </div>

      {/* Cards row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <ShimmerBar key={i} className="h-28 rounded-2xl" />
        ))}
      </div>

      {/* Content block */}
      <ShimmerBar className="h-64 rounded-2xl" />
    </div>
  );
}
