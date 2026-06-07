import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Linha de skeleton animada — bloco base reutilizável.
 */
export function SkeletonLine({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--c-surface-2)]",
        className,
      )}
      aria-hidden="true"
      {...props}
    />
  );
}

/**
 * Skeleton de card de questão do caderno.
 */
export function CadernoCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-[var(--c-radius-card)] border border-[var(--c-border)] bg-[var(--c-surface)] p-5",
        className,
      )}
      aria-busy="true"
      aria-label="Carregando questão..."
      role="status"
    >
      {/* Badge de causa */}
      <SkeletonLine className="h-5 w-16 rounded-full" />
      {/* Título */}
      <div className="flex flex-col gap-2">
        <SkeletonLine className="h-4 w-full" />
        <SkeletonLine className="h-4 w-5/6" />
        <SkeletonLine className="h-4 w-3/4" />
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <SkeletonLine className="h-3 w-24" />
        <SkeletonLine className="h-8 w-20 rounded-full" />
      </div>
    </div>
  );
}

/**
 * Skeleton de stat tile.
 */
export function StatTileSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      aria-busy="true"
      role="status"
      aria-label="Carregando estatística..."
    >
      <SkeletonLine className="h-3 w-16" />
      <SkeletonLine className="h-8 w-12" />
    </div>
  );
}

/**
 * Grid de skeletons para listagem inicial do caderno.
 */
export function CadernoSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3" aria-label="Carregando caderno..." role="status">
      {Array.from({ length: count }).map((_, i) => (
        <CadernoCardSkeleton key={i} />
      ))}
      <span className="sr-only">Carregando...</span>
    </div>
  );
}
