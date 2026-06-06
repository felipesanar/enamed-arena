import { Suspense } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PageLoadingSkeleton } from "@/components/premium/PageLoadingSkeleton";
import { PREMIUM_MOTION_EASE, PREMIUM_ROUTE_SPRING } from "@/components/premium/PageTransition";

/**
 * Rotas que compartilham a casca persistente do Caderno (TabBar fixo via
 * CadernoLayout). Colapsamos todas num único key de transição para que a
 * AnimatePresence NÃO remonte a subárvore ao trocar de aba — caso contrário o
 * TabBar "some e reaparece" a cada navegação. O conteúdo de cada aba anima pelo
 * próprio <PageTransition> da página. `revisao` fica de fora (sessão sem TabBar).
 */
const CADERNO_TABS_RE =
  /^\/caderno(\/(favoritos|anotacoes|flashcards|insights|treino|reta-final))?\/?$/;

function routeKeyFor(pathname: string, search: string): string {
  if (CADERNO_TABS_RE.test(pathname)) return "caderno-tabs";
  return `${pathname}${search}`;
}

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

  const routeKey = routeKeyFor(location.pathname, location.search);

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
