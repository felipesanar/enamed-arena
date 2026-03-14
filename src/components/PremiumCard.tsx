import { motion } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  delay?: number;
}

export const PremiumCard = forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ children, className, interactive = false, delay = 0 }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay, ease: "easeOut" }}
        className={cn(
          interactive ? "premium-card-interactive" : "premium-card",
          className
        )}
      >
        {children}
      </motion.div>
    );
  }
);

PremiumCard.displayName = "PremiumCard";
