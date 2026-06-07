/**
 * Unit tests for src/lib/triageHeuristic.ts
 *
 * Tests the deterministic fallback heuristic defined in spec 04 §5.
 * The module `triageHeuristic.ts` is created by a parallel agent.
 * These tests are written against the expected signature:
 *
 *   heuristicReason(question: ClassifyQuestionInput): DbReason
 *
 * where ClassifyQuestionInput matches the interface in spec 04 §4.2.
 * Tests will pass once the module exists — they are intentionally
 * forward-compatible and do NOT create the module themselves.
 *
 * Rules (spec 04 §5, in priority order):
 *   R1: isCorrect && confidence==='baixa'           → guessed_correctly
 *   R2: !isCorrect && confidence==='alta'           → confused_alternatives
 *   R3: !isCorrect && user/correct options adjacent → confused_alternatives
 *   R4: !userOptionLabel                            → did_not_know
 *   R5: residual fallback                           → did_not_know
 */

import { describe, it, expect } from 'vitest';
import { heuristicReason } from './triageHeuristic';
import type { DbReason } from './errorNotebookReasons';

// ---------------------------------------------------------------------------
// Type (mirrors spec 04 §4.2 ClassifyQuestionInput — inline to avoid circular dep)
// ---------------------------------------------------------------------------

interface ClassifyQuestionInput {
  questionId: string;
  questionNumber: number;
  questionStem: string;
  options: { label: string; text: string }[];
  correctOptionLabel: string;
  userOptionLabel: string | null;
  isCorrect: boolean;
  confidence: 'baixa' | 'media' | 'alta' | null;
  area: string;
  theme: string;
  explanation: string | null;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

const BASE_OPTIONS = [
  { label: 'A', text: 'Opt A' },
  { label: 'B', text: 'Opt B' },
  { label: 'C', text: 'Opt C' },
  { label: 'D', text: 'Opt D' },
  { label: 'E', text: 'Opt E' },
];

function makeQuestion(
  overrides: Partial<ClassifyQuestionInput> = {},
): ClassifyQuestionInput {
  return {
    questionId: 'q1',
    questionNumber: 1,
    questionStem: 'Qual o tratamento de 1ª linha?',
    options: BASE_OPTIONS,
    correctOptionLabel: 'C',
    userOptionLabel: 'A',
    isCorrect: false,
    confidence: null,
    area: 'Cardiologia',
    theme: 'HAS',
    explanation: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// R1 — acertou com baixa confiança → guessed_correctly
// ---------------------------------------------------------------------------

describe('R1: correct answer with baixa confidence → guessed_correctly', () => {
  it('correct + baixa → guessed_correctly', () => {
    const q = makeQuestion({ isCorrect: true, confidence: 'baixa', userOptionLabel: 'C' });
    expect(heuristicReason(q)).toBe<DbReason>('guessed_correctly');
  });

  it('correct + media confidence → does NOT trigger R1', () => {
    const q = makeQuestion({ isCorrect: true, confidence: 'media', userOptionLabel: 'C' });
    const result = heuristicReason(q);
    expect(result).not.toBe<DbReason>('guessed_correctly');
  });

  it('correct + alta confidence → does NOT trigger R1', () => {
    const q = makeQuestion({ isCorrect: true, confidence: 'alta', userOptionLabel: 'C' });
    const result = heuristicReason(q);
    expect(result).not.toBe<DbReason>('guessed_correctly');
  });

  it('correct + null confidence → does NOT trigger R1', () => {
    const q = makeQuestion({ isCorrect: true, confidence: null, userOptionLabel: 'C' });
    const result = heuristicReason(q);
    expect(result).not.toBe<DbReason>('guessed_correctly');
  });
});

// ---------------------------------------------------------------------------
// R2 — errou com alta confiança → confused_alternatives
// ---------------------------------------------------------------------------

describe('R2: wrong answer with alta confidence → confused_alternatives', () => {
  it('wrong + alta + non-adjacent options → confused_alternatives', () => {
    // A vs C are not adjacent → R3 won't fire, R2 fires
    const q = makeQuestion({ isCorrect: false, confidence: 'alta', userOptionLabel: 'A', correctOptionLabel: 'C' });
    expect(heuristicReason(q)).toBe<DbReason>('confused_alternatives');
  });

  it('wrong + media → does NOT trigger R2', () => {
    const q = makeQuestion({ isCorrect: false, confidence: 'media', userOptionLabel: 'A', correctOptionLabel: 'C' });
    const result = heuristicReason(q);
    // R2 requires alta; media falls through to R3/R4/R5
    expect(result).not.toBe<DbReason>('confused_alternatives'); // unless R3 fires
    // A→C are 2 apart, so R3 doesn't fire either; result should be did_not_know
    expect(result).toBe<DbReason>('did_not_know');
  });

  it('wrong + null confidence → does NOT trigger R2', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'A', correctOptionLabel: 'C' });
    const result = heuristicReason(q);
    expect(result).not.toBe<DbReason>('confused_alternatives');
  });
});

// ---------------------------------------------------------------------------
// R3 — errou alternativas adjacentes → confused_alternatives
// ---------------------------------------------------------------------------

describe('R3: adjacent options → confused_alternatives', () => {
  it('B vs C (adjacent, diff=1) → confused_alternatives', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'B', correctOptionLabel: 'C' });
    expect(heuristicReason(q)).toBe<DbReason>('confused_alternatives');
  });

  it('C vs D (adjacent, diff=1) → confused_alternatives', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'C', correctOptionLabel: 'D' });
    expect(heuristicReason(q)).toBe<DbReason>('confused_alternatives');
  });

  it('A vs B (adjacent, diff=1) → confused_alternatives', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'A', correctOptionLabel: 'B' });
    expect(heuristicReason(q)).toBe<DbReason>('confused_alternatives');
  });

  it('D vs E (adjacent, diff=1) → confused_alternatives', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'D', correctOptionLabel: 'E' });
    expect(heuristicReason(q)).toBe<DbReason>('confused_alternatives');
  });

  it('A vs C (diff=2) → does NOT trigger R3', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'A', correctOptionLabel: 'C' });
    const result = heuristicReason(q);
    expect(result).not.toBe<DbReason>('confused_alternatives');
  });

  it('A vs E (diff=4) → does NOT trigger R3', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'A', correctOptionLabel: 'E' });
    const result = heuristicReason(q);
    expect(result).not.toBe<DbReason>('confused_alternatives');
  });

  it('R2 fires before R3 when wrong + alta + adjacent', () => {
    const q = makeQuestion({ isCorrect: false, confidence: 'alta', userOptionLabel: 'B', correctOptionLabel: 'C' });
    // R2 fires first; both would produce 'confused_alternatives' anyway
    expect(heuristicReason(q)).toBe<DbReason>('confused_alternatives');
  });
});

// ---------------------------------------------------------------------------
// R4 — em branco (no option) → did_not_know
// ---------------------------------------------------------------------------

describe('R4: blank answer → did_not_know', () => {
  it('null userOptionLabel → did_not_know', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: null });
    expect(heuristicReason(q)).toBe<DbReason>('did_not_know');
  });

  it('R4 fires regardless of confidence when userOptionLabel is null', () => {
    const q = makeQuestion({ isCorrect: false, confidence: 'alta', userOptionLabel: null });
    // R2 requires userOptionLabel to be present (wrong answer is still answered)
    // R4: no option → did_not_know
    expect(heuristicReason(q)).toBe<DbReason>('did_not_know');
  });
});

// ---------------------------------------------------------------------------
// R5 — residual fallback → did_not_know
// ---------------------------------------------------------------------------

describe('R5: residual fallback → did_not_know', () => {
  it('wrong + media + non-adjacent → did_not_know', () => {
    const q = makeQuestion({ isCorrect: false, confidence: 'media', userOptionLabel: 'A', correctOptionLabel: 'D' });
    expect(heuristicReason(q)).toBe<DbReason>('did_not_know');
  });

  it('wrong + null + non-adjacent → did_not_know', () => {
    const q = makeQuestion({ isCorrect: false, confidence: null, userOptionLabel: 'A', correctOptionLabel: 'E' });
    expect(heuristicReason(q)).toBe<DbReason>('did_not_know');
  });

  it('correct + null + answered → not guessed_correctly (no low conf declared)', () => {
    // Per spec 1.6: absence of confidence does NOT imply baixa
    const q = makeQuestion({ isCorrect: true, confidence: null, userOptionLabel: 'C' });
    const result = heuristicReason(q);
    // spec says: correct + null → not automatically guessed_correctly
    expect(result).not.toBe<DbReason>('guessed_correctly');
  });
});

// ---------------------------------------------------------------------------
// Priority ordering
// ---------------------------------------------------------------------------

describe('priority ordering: R1 fires before R2', () => {
  it('correct + baixa → R1 (guessed_correctly), not R2', () => {
    // R1: isCorrect=true, confidence='baixa' → guessed_correctly
    // R2 would not apply anyway (isCorrect=true), but R1 takes it
    const q = makeQuestion({ isCorrect: true, confidence: 'baixa', userOptionLabel: 'C' });
    expect(heuristicReason(q)).toBe<DbReason>('guessed_correctly');
  });
});

// ---------------------------------------------------------------------------
// Return type contract
// ---------------------------------------------------------------------------

describe('return type: always a valid DbReason', () => {
  const VALID_REASONS: DbReason[] = [
    'did_not_know',
    'did_not_remember',
    'reading_error',
    'confused_alternatives',
    'guessed_correctly',
    'did_not_understand',
  ];

  const scenarios: Array<Partial<ClassifyQuestionInput>> = [
    { isCorrect: true,  confidence: 'baixa', userOptionLabel: 'C' },
    { isCorrect: false, confidence: 'alta',  userOptionLabel: 'A',  correctOptionLabel: 'D' },
    { isCorrect: false, confidence: null,    userOptionLabel: 'B',  correctOptionLabel: 'C' },
    { isCorrect: false, confidence: null,    userOptionLabel: null },
    { isCorrect: false, confidence: 'media', userOptionLabel: 'A',  correctOptionLabel: 'E' },
    { isCorrect: true,  confidence: 'alta',  userOptionLabel: 'C' },
    { isCorrect: true,  confidence: null,    userOptionLabel: 'C' },
  ];

  scenarios.forEach((overrides, idx) => {
    it(`scenario ${idx + 1} returns a valid DbReason`, () => {
      const q = makeQuestion(overrides);
      const result = heuristicReason(q);
      expect(VALID_REASONS).toContain(result);
    });
  });
});
