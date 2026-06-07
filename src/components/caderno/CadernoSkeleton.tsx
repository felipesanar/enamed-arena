/**
 * CadernoSkeleton — skeleton de página completa do Caderno v2.
 * Mostrado durante o fetch inicial (hero + chips + cards).
 * Spec 05 §4: sem texto "Carregando…" isolado — indicador visual obrigatório.
 */

import { SkeletonCard } from '@/components/SkeletonCard';

export function CadernoSkeleton() {
  return (
    <div className="space-y-5 animate-pulse" aria-busy="true" aria-label="Carregando caderno…">
      {/* Hero dark skeleton */}
      <SkeletonCard className="h-[220px] rounded-[22px]" />

      {/* Tab bar skeleton */}
      <div className="flex gap-4 border-b border-border pb-0">
        {[80, 72, 80, 88, 68].map((w, i) => (
          <div key={i} className="mb-[-1px] h-8 rounded-t-lg bg-muted/60" style={{ width: w }} />
        ))}
      </div>

      {/* Filter chips skeleton — 2 rows */}
      <div className="flex flex-col gap-2.5 pt-1">
        <div className="flex items-center gap-2">
          <div className="h-5 w-[44px] rounded-md bg-muted/50" />
          {[72, 64, 72, 60, 68].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-muted/60" style={{ width: w }} />
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-5 w-[44px] rounded-md bg-muted/50" />
          {[56, 96, 80].map((w, i) => (
            <div key={i} className="h-8 rounded-full bg-muted/60" style={{ width: w }} />
          ))}
        </div>
        <div className="h-9 rounded-xl bg-muted/50" />
      </div>

      {/* Section header + cards */}
      <div className="space-y-2">
        <div className="mb-3 h-4 w-40 rounded-md bg-muted/50" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex h-[64px] items-stretch gap-3 rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="w-[3px] shrink-0 self-stretch rounded-full bg-muted/60" />
            <div className="flex flex-1 flex-col justify-center gap-2">
              <div className="h-3 w-2/5 rounded-md bg-muted/60" />
              <div className="h-2.5 w-3/5 rounded-md bg-muted/40" />
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="h-6 w-14 rounded-full bg-muted/60" />
              <div className="h-7 w-7 rounded-[8px] bg-muted/60" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
