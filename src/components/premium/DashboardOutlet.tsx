import { Suspense } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PageLoadingSkeleton } from "@/components/premium/PageLoadingSkeleton";
import { PREMIUM_MOTION_EASE, PREMIUM_ROUTE_SPRING } from "@/components/premium/PageTransition";

/**
 * Outlet do dashboard com transição entre rotas (fade + slide + leve escala),
 * com mola premium e `Suspense` dentro do bloco animado para lazy routes.
 */
export function DashboardOutlet() {
  const location = useLocation();
  const outlet = useOutlet();
  const reduced = useReducedMotion();

  if (outlet == null) {
    return null;
  }

  const routeKey = `${location.pathname}${location.search}`;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={routeKey}
        className="min-h-0 w-full min-w-0 overflow-x-hidden"
        role="presentation"
        initial={
          reduced
            ? false
            : {
                opacity: 0,
                y: 22,
                scale: 0.988,
              }
        }
        animate={
          reduced
            ? { opacity: 1, y: 0, scale: 1 }
            : {
                opacity: 1,
                y: 0,
                scale: 1,
              }
        }
        exit={
          reduced
            ? undefined
            : {
                opacity: 0,
                y: -16,
                scale: 0.992,
              }
        }
        transition={
          reduced
            ? { duration: 0 }
            : {
                opacity: {
                  duration: 0.38,
                  ease: PREMIUM_MOTION_EASE,
                },
                y: PREMIUM_ROUTE_SPRING,
                scale: {
                  type: "spring",
                  stiffness: 380,
                  damping: 36,
                  mass: 0.75,
                },
              }
        }
      >
        <Suspense fallback={<PageLoadingSkeleton />}>{outlet}</Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
