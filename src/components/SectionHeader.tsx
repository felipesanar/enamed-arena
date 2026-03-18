import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  title: string;
  action?: ReactNode;
  className?: string;
  id?: string;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  function SectionHeader({ title, action, className, id }, ref) {
    return (
      <div ref={ref} className={cn("flex items-center justify-between mb-4 mt-2", className)}>
        <h2 id={id} className="text-heading-3 text-foreground">{title}</h2>
        {action && <div>{action}</div>}
      </div>
    );
  }
);