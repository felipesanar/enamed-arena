import { LucideIcon } from "lucide-react";
import { PremiumCard } from "./PremiumCard";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string | null;
  delay?: number;
}

export function StatCard({ label, value, icon: Icon, trend, delay = 0 }: StatCardProps) {
  console.log('[StatCard] Rendering:', label);

  return (
    <PremiumCard delay={delay} className="p-4 md:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-9 w-9 rounded-lg bg-accent flex items-center justify-center">
          <Icon className="h-[18px] w-[18px] text-primary" />
        </div>
        {trend && (
          <span className="text-caption font-semibold text-success">{trend}</span>
        )}
      </div>
      <p className="text-heading-2 text-foreground">{value}</p>
      <p className="text-body-sm text-muted-foreground mt-0.5">{label}</p>
    </PremiumCard>
  );
}
