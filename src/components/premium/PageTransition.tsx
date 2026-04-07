import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

/** Curva alinhada à sidebar / layout premium (mesmo feeling em toda a área logada). */
export const PREMIUM_MOTION_EASE = [0.32, 0.72, 0, 1] as const;

/** Transição de rota: mola suave + pouco amortecimento (fluida, sem “bounce” exagerado). */
export const PREMIUM_ROUTE_SPRING = {
  type: "spring" as const,
  stiffness: 280,
  damping: 32,
  mass: 0.88,
};

/** Micro-interações do rail (barra / ícone): mais rápida e “snappy”. */
export const PREMIUM_RAIL_SPRING = {
  type: "spring" as const,
  stiffness: 420,
  damping: 34,
  mass: 0.65,
};

const staggerEase = [0.25, 0.46, 0.45, 0.94] as const;

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

/**
 * Wrapper semântico para páginas. A animação entre rotas fica em `DashboardOutlet`
 * (`AnimatePresence`) para evitar duplo fade/slide. Use isto só para agrupar conteúdo.
 */
export function PageTransition({ children, className }: PageTransitionProps) {
  return <div className={className}>{children}</div>;
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
          transition: { duration: 0.35, ease: staggerEase },
        },
      }}
    >
      {children}
    </motion.div>
  );
}
