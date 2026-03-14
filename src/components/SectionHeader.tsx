import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
}

export function SectionHeader({ title, action, className }: SectionHeaderProps) {
  return (
    <div className={cn("flex items-center justify-between mb-4 mt-2", className)}>
      <h2 className="text-heading-3 text-foreground">{title}</h2>
      {action && <div>{action}</div>}
    </div>
  );
}