import { Suspense } from "react";
import { useOutlet, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PageLoadingSkeleton } from "@/components/premium/PageLoadingSkeleton";

const ease = [0.25, 0.46, 0.45, 0.94] as const;

export function DashboardOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const prefersReducedMotion = useReducedMotion();

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="h-full"
        initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={prefersReducedMotion ? undefined : { opacity: 0 }}
        transition={{
          duration: prefersReducedMotion ? 0 : 0.28,
          ease,
        }}
      >
        <Suspense fallback={<PageLoadingSkeleton />}>
          {outlet}
        </Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
