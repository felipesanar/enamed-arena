/**
 * Motion system da landing — SanarFlix Simulados.
 * Easing, viewport triggers e variantes reutilizáveis para entradas, stagger e hover.
 */

/** Easing premium — usado em toda a landing para consistência */
export const EASE = [0.32, 0.72, 0.2, 1] as const;
export const EASE_SMOOTH = [0.25, 0.46, 0.45, 0.94] as const;

/** Durações (segundos) */
export const DURATION_FAST = 0.28;
export const DURATION_NORMAL = 0.42;
export const DURATION_SLOW = 0.55;

/**
 * Viewport para scroll reveal — dispara quando o elemento está ~80px antes de entrar
 * na viewport (bottom), ou quando 20% dele já está visível.
 * Evita entrada tarde demais e "pipocagem" brusca.
 */
export const VIEWPORT_REVEAL = {
  once: true,
  margin: "0px 0px -80px 0px",
  amount: 0.2,
} as const;

/** Header de seção — trigger um pouco mais antecipado */
export const VIEWPORT_HEADER = {
  once: true,
  margin: "0px 0px -100px 0px",
  amount: 0.15,
} as const;

/** Transição padrão para entradas */
export const TRANSITION_REVEAL = {
  duration: DURATION_NORMAL,
  ease: EASE,
} as const;

/** Variantes de container para stagger */
export const containerReveal = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.05 },
  },
};

/** Item padrão: fade + subir levemente */
export const itemReveal = {
  hidden: { opacity: 0, y: 20 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_NORMAL, ease: EASE },
  },
};

/** Item mais sutil (decorativo) */
export const itemRevealSubtle = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: DURATION_FAST, ease: EASE },
  },
};

/** Header de seção: eyebrow → título → descrição (stagger interno) */
export const headerReveal = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.02 },
  },
};

export const headerItemReveal = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: DURATION_NORMAL, ease: EASE } },
};

/** Spring para movimentos orgânicos */
export const SPRING_GENTLE = { type: "spring", stiffness: 120, damping: 20 } as const;
export const SPRING_SNAPPY = { type: "spring", stiffness: 200, damping: 22 } as const;

/** Duração para hero-level */
export const DURATION_CINEMATIC = 0.75;

/** Variante: entrada da esquerda */
export const itemRevealLeft = {
  hidden: { opacity: 0, x: -24 },
  show: { opacity: 1, x: 0, transition: { duration: DURATION_NORMAL, ease: EASE } },
};

/** Variante: entrada da direita */
export const itemRevealRight = {
  hidden: { opacity: 0, x: 24 },
  show: { opacity: 1, x: 0, transition: { duration: DURATION_NORMAL, ease: EASE } },
};

/** Variante: scale + fade (para elementos de destaque) */
export const itemRevealScale = {
  hidden: { opacity: 0, scale: 0.92 },
  show: { opacity: 1, scale: 1, transition: { duration: DURATION_SLOW, ease: EASE } },
};

/** Container com stagger mais lento (para seções densas) */
export const containerRevealSlow = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
};
