import { cn } from "@/lib/utils";

interface MetricPillProps {
  children: React.ReactNode;
  className?: string;
  /** Accent (burgundy) variant */
  accent?: boolean;
}

export function MetricPill({ children, className, accent }: MetricPillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors duration-200",
        accent
          ? "border-[rgba(142,31,61,0.24)] bg-[rgba(142,31,61,0.08)] text-[#8E1F3D]"
          : "border-[#E8E1E5]/80 bg-[#F7F5F7] text-[#5F6778]",
        className
      )}
    >
      {children}
    </span>
  );
}
