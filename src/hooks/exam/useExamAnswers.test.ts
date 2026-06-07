import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExamAnswers } from './useExamAnswers';
import type { ExamState, ExamAnswer } from '@/types/exam';
import type { Question } from '@/types';

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { toast } from '@/hooks/use-toast';

// ── Fixtures ────────────────────────────────────────────────────────────────
const q1 = {
  id: 'q1',
  options: [{ id: 'opt-a' }, { id: 'opt-b' }, { id: 'opt-c' }],
} as unknown as Question;

function baseState(overrides: Partial<ExamState> = {}): ExamState {
  return {
    status: 'in_progress',
    currentQuestionIndex: 1,
    answers: {},
    ...overrides,
  } as ExamState;
}

/** Cria o hook com mocks; captura o updater passado para updateState. */
function setup(args: Partial<Parameters<typeof useExamAnswers>[0]> = {}) {
  const markAnswerDirty = vi.fn();
  const setShowNavigator = vi.fn();
  let lastUpdater: ((prev: ExamState) => ExamState) | null = null;
  const updateState = vi.fn((updater: (prev: ExamState) => ExamState) => {
    lastUpdater = updater;
  });
  const { result } = renderHook(() =>
    useExamAnswers({
      currentQuestion: q1,
      currentIndex: 1,
      questionsLength: 3,
      updateState,
      markAnswerDirty,
      setShowNavigator,
      ...args,
    }),
  );
  return {
    result,
    markAnswerDirty,
    setShowNavigator,
    updateState,
    apply: (state: ExamState) => {
      if (!lastUpdater) throw new Error('updateState não foi chamado');
      return lastUpdater(state);
    },
  };
}

describe('useExamAnswers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('handleSelectOption marca dirty e seta selectedOption', () => {
    const h = setup();
    act(() => h.result.current.handleSelectOption('opt-b'));
    expect(h.markAnswerDirty).toHaveBeenCalledWith('q1');
    const next = h.apply(baseState());
    expect(next.answers['q1'].selectedOption).toBe('opt-b');
  });

  it('handleEliminateOption alterna a alternativa eliminada (add e remove)', () => {
    const h = setup();
    // add
    act(() => h.result.current.handleEliminateOption('opt-c'));
    let next = h.apply(baseState());
    expect(next.answers['q1'].eliminatedAlternatives).toEqual(['opt-c']);
    // remove (estado já contém opt-c)
    act(() => h.result.current.handleEliminateOption('opt-c'));
    next = h.apply(baseState({
      answers: { q1: { questionId: 'q1', selectedOption: null, markedForReview: false, highConfidence: false, eliminatedAlternatives: ['opt-c'] } as ExamAnswer },
    }));
    expect(next.answers['q1'].eliminatedAlternatives).toEqual([]);
  });

  it('toggleReview inverte markedForReview e dispara toast', () => {
    const h = setup();
    act(() => h.result.current.toggleReview());
    const next = h.apply(baseState());
    expect(next.answers['q1'].markedForReview).toBe(true);
    expect(toast).toHaveBeenCalledWith({ title: 'Questão marcada para revisão' });
  });

  it('toggleHighConfidence inverte highConfidence', () => {
    const h = setup();
    act(() => h.result.current.toggleHighConfidence());
    const next = h.apply(baseState());
    expect(next.answers['q1'].highConfidence).toBe(true);
  });

  it('handleNavigate seta o índice e fecha o navegador', () => {
    const h = setup();
    act(() => h.result.current.handleNavigate(2));
    expect(h.setShowNavigator).toHaveBeenCalledWith(false);
    const next = h.apply(baseState());
    expect(next.currentQuestionIndex).toBe(2);
  });

  it('handlePrev/handleNext respeitam os limites', () => {
    // No meio (index 1 de 3): ambos navegam
    const mid = setup({ currentIndex: 1, questionsLength: 3 });
    act(() => mid.result.current.handleNext());
    expect(mid.apply(baseState()).currentQuestionIndex).toBe(2);

    // Primeira questão: handlePrev é no-op (não chama updateState)
    const first = setup({ currentIndex: 0, questionsLength: 3 });
    act(() => first.result.current.handlePrev());
    expect(first.updateState).not.toHaveBeenCalled();

    // Última questão: handleNext é no-op
    const last = setup({ currentIndex: 2, questionsLength: 3 });
    act(() => last.result.current.handleNext());
    expect(last.updateState).not.toHaveBeenCalled();
  });

  it('é no-op quando não há currentQuestion', () => {
    const h = setup({ currentQuestion: undefined });
    act(() => h.result.current.handleSelectOption('opt-a'));
    act(() => h.result.current.toggleReview());
    expect(h.markAnswerDirty).not.toHaveBeenCalled();
    expect(h.updateState).not.toHaveBeenCalled();
  });
});
