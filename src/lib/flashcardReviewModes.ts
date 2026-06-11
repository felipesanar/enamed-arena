/**
 * flashcardReviewModes — config e filtros de pool dos modos de revisão.
 *
 * Funções puras (testáveis sem DOM). Só o modo `due` grava SRS;
 * os demais são treino (estado local + analytics).
 * O pool do modo `due` vem de simuladosApi.getDueFlashcards() — não daqui.
 */

import type { Flashcard, ReviewMode } from '@/types/caderno';

/** Ease ≤ threshold marca card como "difícil" (SM-2: errei/difícil abaixam o ease). */
export const HARD_EASE_THRESHOLD = 2.1;
/** Tamanho da sessão aleatória. */
export const SHUFFLE_POOL_SIZE = 10;
/** Duração da sessão cronometrada (segundos). */
export const TIMED_SESSION_SECONDS = 5 * 60;

export interface ReviewModeConfig {
  id: ReviewMode;
  label: string;
  description: string;
  /** true = mostra o verso primeiro (verso → frente). */
  reversed: boolean;
  /** Só `due` persiste o agendamento via scheduleFlashcardReview. */
  writesSrs: boolean;
  /** Duração em segundos, ou null para sessão sem timer. */
  timerSeconds: number | null;
}

export const REVIEW_MODE_CONFIGS: Record<ReviewMode, ReviewModeConfig> = {
  due: {
    id: 'due',
    label: 'Revisar devidos',
    description: 'Repetição espaçada — os cards na hora certa de lembrar.',
    reversed: false,
    writesSrs: true,
    timerSeconds: null,
  },
  free: {
    id: 'free',
    label: 'Estudo livre',
    description: 'Todos os cards do deck, sem afetar o agendamento.',
    reversed: false,
    writesSrs: false,
    timerSeconds: null,
  },
  hard: {
    id: 'hard',
    label: 'Difíceis',
    description: 'Foco nos cards que você errou ou achou difícil.',
    reversed: false,
    writesSrs: false,
    timerSeconds: null,
  },
  shuffle: {
    id: 'shuffle',
    label: 'Aleatório',
    description: `Sessão rápida com ${SHUFFLE_POOL_SIZE} cards sorteados.`,
    reversed: false,
    writesSrs: false,
    timerSeconds: null,
  },
  reversed: {
    id: 'reversed',
    label: 'Invertido',
    description: 'Veja a resposta e lembre a pergunta.',
    reversed: true,
    writesSrs: false,
    timerSeconds: null,
  },
  timed: {
    id: 'timed',
    label: 'Cronometrado',
    description: 'O máximo de cards em 5 minutos.',
    reversed: false,
    writesSrs: false,
    timerSeconds: TIMED_SESSION_SECONDS,
  },
};

/** Pool base de treino: cards não-dominados. */
export function filterFreePool(cards: Flashcard[]): Flashcard[] {
  return cards.filter((c) => !c.mastered_at);
}

/** Cards difíceis: já revisados (reps > 0), ease baixo, não-dominados. */
export function filterHardCards(cards: Flashcard[]): Flashcard[] {
  return cards.filter(
    (c) => !c.mastered_at && c.srs_reps > 0 && c.srs_ease <= HARD_EASE_THRESHOLD,
  );
}

/** Fisher–Yates imutável. `rng` injetável para testes. */
export function shuffleCards<T>(items: T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Monta o pool de cards do modo a partir da lista visível (deck atual ou todos).
 * Para `due`, retorna [] — a página usa getDueFlashcards().
 */
export function buildReviewPool(
  mode: ReviewMode,
  cards: Flashcard[],
  rng: () => number = Math.random,
): Flashcard[] {
  switch (mode) {
    case 'free':
    case 'reversed':
      return filterFreePool(cards);
    case 'hard':
      return filterHardCards(cards);
    case 'shuffle':
      return shuffleCards(filterFreePool(cards), rng).slice(0, SHUFFLE_POOL_SIZE);
    case 'timed':
      return shuffleCards(filterFreePool(cards), rng);
    case 'due':
    default:
      return [];
  }
}
