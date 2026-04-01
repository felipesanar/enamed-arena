import type { Variants } from "framer-motion";

export const AUTH_EASE_STANDARD = [0.32, 0.72, 0.2, 1] as const;
export const AUTH_EASE_SOFT = [0.25, 0.46, 0.45, 0.94] as const;

export const AUTH_DURATION_FAST = 0.22;
export const AUTH_DURATION_BASE = 0.36;
export const AUTH_DURATION_SLOW = 0.56;

export const authPageReveal: Variants = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: { duration: AUTH_DURATION_SLOW, ease: AUTH_EASE_STANDARD },
  },
};

export const authStaggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.05,
    },
  },
};

export const authItemReveal: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: AUTH_DURATION_BASE, ease: AUTH_EASE_STANDARD },
  },
};
