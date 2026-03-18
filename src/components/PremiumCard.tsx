import { motion, useReducedMotion } from "framer-motion";
import { forwardRef, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PremiumCardVariant = "content" | "hero";

interface PremiumCardProps {
  children: ReactNode;
  className?: string;
  /** content = listas/blocos de apoio (default). hero = protagonista único por tela. */
  variant?: PremiumCardVariant;
  interactive?: boolean;
  delay?: number;
}

export const PremiumCard = forwardRef<HTMLDivElement, PremiumCardProps>(
  ({ children, className, variant = "content", interactive = false, delay = 0 }, ref) => {
    const prefersReducedMotion = useReducedMotion();
    const baseClass =
      variant === "hero"
        ? "premium-card-hero"
        : interactive
          ? "premium-card-interactive"
          : "premium-card";

    return (
      <motion.div
        ref={ref}
        initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: prefersReducedMotion ? 0 : 0.4, delay: prefersReducedMotion ? 0 : delay, ease: "easeOut" }}
        className={cn(
          baseClass,
          variant === "hero" && "p-6 md:p-8",
          className
        )}
      >
        {children}
      </motion.div>
    );
  }
);

PremiumCard.displayName = "PremiumCard";
