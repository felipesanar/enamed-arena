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
  return (
    <PremiumCard delay={delay} className="p-4 md:p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        {trend && (
          <span className="text-caption font-bold text-success bg-success/10 px-2 py-0.5 rounded-md">{trend}</span>
        )}
      </div>
      <p className="text-heading-2 text-foreground mb-0.5">{value}</p>
      <p className="text-body-sm text-muted-foreground">{label}</p>
    </PremiumCard>
  );
}