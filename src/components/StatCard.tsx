import { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { PremiumCard } from "./PremiumCard";

interface StatCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  trend?: string | null;
  delay?: number;
  href?: string;
}

export function StatCard({ label, value, icon: Icon, trend, delay = 0, href }: StatCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const content = (
    <>
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-accent flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" aria-hidden />
        </div>
        {trend && (
          <span className="text-caption font-bold text-success bg-success/10 px-2 py-0.5 rounded-md">
            {trend}
          </span>
        )}
      </div>
      <p className="text-heading-2 text-foreground mb-0.5 tabular-nums">{value}</p>
      <p className="text-body-sm text-muted-foreground">{label}</p>
    </>
  );

  if (href) {
    return (
      <motion.div
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : delay, ease: "easeOut" }}
      >
        <Link
          to={href}
          className="block premium-card-interactive rounded-xl border border-border bg-card p-4 md:p-5 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-[0.998]"
        >
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <PremiumCard delay={delay} className="p-4 md:p-5">
      {content}
    </PremiumCard>
  );
}