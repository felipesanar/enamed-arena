import React from 'react';

export function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="text-overline font-bold uppercase tracking-wider text-muted-foreground">
        {title}
      </span>
      {action}
    </div>
  );
}

export function AreaGridSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title}>
      <SectionHeader title={title} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export function EmptyDrill({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-6 py-10 text-body-sm text-muted-foreground">
      {label}
    </div>
  );
}
