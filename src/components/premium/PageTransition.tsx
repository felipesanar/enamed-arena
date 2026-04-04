import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrap page content to get a smooth fade + slide-up entrance.
 * Respects prefers-reduced-motion.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0 : 0.35, ease }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Stagger container — use with StaggerItem for sequential reveal.
 */
export function StaggerContainer({
  children,
  className,
  stagger = 0.06,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: {
          transition: {
            staggerChildren: reduced ? 0 : stagger,
          },
        },
      }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();

  return (
    <motion.div
      className={className}
      variants={{
        hidden: reduced ? { opacity: 1 } : { opacity: 0, y: 10 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.35, ease },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
