import { motion } from "framer-motion";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
  delay?: number;
}

export function PremiumCard({ children, className, interactive = false, delay = 0 }: PremiumCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
      className={cn(
        interactive ? "premium-card-interactive" : "premium-card",
        "p-5 md:p-6",
        className
      )}
    >
      {children}
    </motion.div>
  );
}
