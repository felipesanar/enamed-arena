import { describe, it, expect } from 'vitest';
import type { Flashcard } from '@/types/caderno';
import {
  REVIEW_MODE_CONFIGS,
  HARD_EASE_THRESHOLD,
  SHUFFLE_POOL_SIZE,
  TIMED_SESSION_SECONDS,
  filterFreePool,
  filterHardCards,
  shuffleCards,
  buildReviewPool,
} from './flashcardReviewModes';

/** Factory de flashcard com defaults seguros. */
function makeCard(overrides: Partial<Flashcard> = {}): Flashcard {
  return {
    id: 'c1',
    deck_id: 'd1',
    user_id: 'u1',
    front_md: 'Pergunta',
    back_md: 'Resposta',
    front_image_url: null,
    back_image_url: null,
    entry_id: null,
    question_id: null,
    srs_due_at: null,
    srs_interval: 0,
    srs_reps: 0,
    srs_ease: 2.5,
    mastered_at: null,
    created_at: '2026-06-01T00:00:00Z',
    updated_at: '2026-06-01T00:00:00Z',
    deleted_at: null,
    ...overrides,
  };
}

describe('REVIEW_MODE_CONFIGS', () => {
  const otherModes = (except: string) =>
    (Object.keys(REVIEW_MODE_CONFIGS) as Array<keyof typeof REVIEW_MODE_CONFIGS>).filter((m) => m !== except);

  it('só o modo due grava SRS', () => {
    expect(REVIEW_MODE_CONFIGS.due.writesSrs).toBe(true);
    otherModes('due').forEach((m) => {
      expect(REVIEW_MODE_CONFIGS[m].writesSrs).toBe(false);
    });
  });
  it('só o modo reversed inverte a direção', () => {
    expect(REVIEW_MODE_CONFIGS.reversed.reversed).toBe(true);
    otherModes('reversed').forEach((m) => {
      expect(REVIEW_MODE_CONFIGS[m].reversed).toBe(false);
    });
  });
  it('só o modo timed tem timer', () => {
    expect(REVIEW_MODE_CONFIGS.timed.timerSeconds).toBe(TIMED_SESSION_SECONDS);
    otherModes('timed').forEach((m) => {
      expect(REVIEW_MODE_CONFIGS[m].timerSeconds).toBeNull();
    });
  });
});

describe('filterFreePool', () => {
  it('exclui cards dominados', () => {
    const cards = [
      makeCard({ id: 'a' }),
      makeCard({ id: 'b', mastered_at: '2026-06-01T00:00:00Z' }),
    ];
    expect(filterFreePool(cards).map((c) => c.id)).toEqual(['a']);
  });
});

describe('filterHardCards', () => {
  it('inclui cards revisados com ease baixo', () => {
    const card = makeCard({ srs_due_at: '2026-06-10T00:00:00Z', srs_ease: HARD_EASE_THRESHOLD });
    expect(filterHardCards([card])).toHaveLength(1);
  });
  it('inclui cards errados (reps zerados pelo lapso) com ease baixo', () => {
    const card = makeCard({ srs_reps: 0, srs_due_at: '2026-06-10T00:00:00Z', srs_ease: 1.5 });
    expect(filterHardCards([card])).toHaveLength(1);
  });
  it('exclui cards nunca revisados (srs_due_at null)', () => {
    const card = makeCard({ srs_reps: 0, srs_due_at: null, srs_ease: 1.5 });
    expect(filterHardCards([card])).toHaveLength(0);
  });
  it('exclui cards com ease acima do threshold', () => {
    const card = makeCard({ srs_reps: 3, srs_due_at: '2026-06-10T00:00:00Z', srs_ease: 2.5 });
    expect(filterHardCards([card])).toHaveLength(0);
  });
  it('exclui cards dominados', () => {
    const card = makeCard({
      srs_reps: 3,
      srs_due_at: '2026-06-10T00:00:00Z',
      srs_ease: 1.8,
      mastered_at: '2026-06-01T00:00:00Z',
    });
    expect(filterHardCards([card])).toHaveLength(0);
  });
});

describe('shuffleCards', () => {
  it('preserva todos os elementos', () => {
    const cards = ['a', 'b', 'c', 'd'].map((id) => makeCard({ id }));
    const shuffled = shuffleCards(cards, () => 0.5);
    expect(shuffled.map((c) => c.id).sort()).toEqual(['a', 'b', 'c', 'd']);
  });
  it('não muta o array original', () => {
    const cards = ['a', 'b', 'c'].map((id) => makeCard({ id }));
    const original = [...cards];
    shuffleCards(cards, () => 0);
    expect(cards).toEqual(original);
  });
});

describe('buildReviewPool', () => {
  const cards = [
    makeCard({ id: 'novo', srs_reps: 0, srs_ease: 2.5 }),
    makeCard({ id: 'dificil', srs_reps: 2, srs_due_at: '2026-06-10T00:00:00Z', srs_ease: 1.9 }),
    makeCard({ id: 'dominado', mastered_at: '2026-06-01T00:00:00Z' }),
    ...Array.from({ length: 12 }, (_, i) =>
      makeCard({ id: `extra-${i}`, srs_reps: 1, srs_ease: 2.5 }),
    ),
  ];

  it('free: todos os não-dominados', () => {
    const pool = buildReviewPool('free', cards);
    expect(pool).toHaveLength(14);
    expect(pool.find((c) => c.id === 'dominado')).toBeUndefined();
  });
  it('hard: só os difíceis', () => {
    expect(buildReviewPool('hard', cards).map((c) => c.id)).toEqual(['dificil']);
  });
  it('shuffle: no máximo SHUFFLE_POOL_SIZE cards', () => {
    expect(buildReviewPool('shuffle', cards, () => 0.5)).toHaveLength(SHUFFLE_POOL_SIZE);
  });
  it('shuffle: pool menor que o limite retorna o pool inteiro', () => {
    const few = cards.slice(0, 3);
    expect(buildReviewPool('shuffle', few, () => 0.5)).toHaveLength(2);
  });
  it('reversed: mesmo pool do free', () => {
    expect(buildReviewPool('reversed', cards)).toHaveLength(14);
  });
  it('timed: pool inteiro embaralhado (preserva elementos)', () => {
    const pool = buildReviewPool('timed', cards, () => 0.5);
    expect(pool.map((c) => c.id).sort()).toEqual(
      buildReviewPool('free', cards).map((c) => c.id).sort(),
    );
  });
  it('due: retorna [] — pool do due vem de getDueFlashcards(), não daqui', () => {
    expect(buildReviewPool('due', cards)).toEqual([]);
  });
});
