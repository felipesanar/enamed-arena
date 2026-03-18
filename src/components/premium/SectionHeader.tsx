import { cn } from "@/lib/utils";

interface SectionHeaderProps {
  id?: string;
  title: string;
  /** Optional eyebrow above title */
  eyebrow?: string;
  className?: string;
}

export function SectionHeader({
  id,
  title,
  eyebrow,
  className,
}: SectionHeaderProps) {
  return (
    <header className={cn("mb-6", className)}>
      {eyebrow && (
        <p className="text-[11px] uppercase tracking-[0.12em] font-semibold text-[#8C93A3] mb-1.5">
          {eyebrow}
        </p>
      )}
      <h2
        id={id}
        className={cn(
          "text-xl md:text-2xl font-semibold tracking-[-0.02em] text-[#1A2233] leading-tight",
          eyebrow && "mt-0"
        )}
      >
        {title}
      </h2>
    </header>
  );
}
