import { LucideIcon, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { forwardRef, ReactNode } from "react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}

export const EmptyState = forwardRef<HTMLDivElement, EmptyStateProps>(
  ({ icon: Icon = AlertTriangle, title, description, action }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center justify-center text-center py-20 px-6"
      >
        <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center mb-5">
          <Icon className="h-7 w-7 text-muted-foreground" />
        </div>
        <h3 className="text-heading-2 text-foreground mb-2">{title}</h3>
        <p className="text-body text-muted-foreground max-w-md leading-relaxed">{description}</p>
        {action && <div className="mt-6">{action}</div>}
      </motion.div>
    );
  }
);

EmptyState.displayName = "EmptyState";
