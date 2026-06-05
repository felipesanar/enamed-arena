import { SkeletonCard } from '@/components/SkeletonCard';

/* ──────────────────────────────────────────────────────────────────────────
 * Loading / Empty skeletons
 * ────────────────────────────────────────────────────────────────────────── */

export function CadernoSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <SkeletonCard className="h-[200px] rounded-[22px]" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-8 w-20 rounded-full bg-muted/60" />
        ))}
      </div>
      <SkeletonCard className="h-[220px] rounded-[20px]" />
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} className="h-[60px] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
