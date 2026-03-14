import { LucideIcon, AlertTriangle } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
}

export function EmptyState({ icon: Icon = AlertTriangle, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-heading-3 text-foreground mb-1">{title}</h3>
      <p className="text-body text-muted-foreground max-w-sm">{description}</p>
    </div>
  );
}
