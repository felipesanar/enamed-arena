import { ReactNode } from "react";

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={`flex items-center justify-between mb-4 ${className ?? ''}`}>
      <h2 className="text-heading-3 text-foreground">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}
