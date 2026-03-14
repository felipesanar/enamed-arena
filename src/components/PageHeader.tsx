import { motion } from "framer-motion";
import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: ReactNode;
}

export function PageHeader({ title, subtitle, badge, action }: PageHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-8 md:mb-10"
    >
      <div>
        {badge && (
          <span className="text-overline uppercase text-primary font-bold tracking-wider mb-1.5 block">
            {badge}
          </span>
        )}
        <h1 className="text-heading-1 text-foreground">{title}</h1>
        {subtitle && (
          <p className="text-body-lg text-muted-foreground mt-1.5 max-w-2xl">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </motion.div>
  );
}