import React from 'react';

export function RankingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-40 rounded-2xl bg-muted animate-pulse" />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
        <div className="h-16 rounded-2xl bg-muted animate-pulse" />
      </div>
      <div className="h-12 rounded-2xl bg-muted animate-pulse" />
      <div className="h-64 rounded-2xl bg-muted animate-pulse" />
    </div>
  );
}
