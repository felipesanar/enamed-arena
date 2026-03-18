import { Lightbulb } from "lucide-react";
import { SurfaceCard } from "@/components/premium/SurfaceCard";
import { cn } from "@/lib/utils";

interface InsightCardProps {
  title: string;
  text: string;
  className?: string;
}

export function InsightCard({ title, text, className }: InsightCardProps) {
  return (
    <SurfaceCard
      radius="medium"
      className={cn("p-5 md:p-6 transition-colors duration-200", className)}
    >
      <div className="flex gap-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(142,31,61,0.08)] border border-[rgba(142,31,61,0.16)]">
          <Lightbulb className="h-5 w-5 text-[#8E1F3D]" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-[15px] font-semibold text-[#1A2233] mb-2 leading-tight">
            {title}
          </h3>
          <p className="text-[14px] text-[#5F6778] leading-relaxed">{text}</p>
        </div>
      </div>
    </SurfaceCard>
  );
}
