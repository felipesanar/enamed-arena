import { renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useExamAnswers } from '@/hooks/exam/useExamAnswers';
it('does not dirty answers, mutate state or navigate when disabled', () => {
  const updateState = vi.fn(), markAnswerDirty = vi.fn(), setShowNavigator = vi.fn();
  const { result } = renderHook(() => useExamAnswers({ disabled: true, currentQuestion: { id: 'q' } as any,
    currentIndex: 1, questionsLength: 3, updateState, markAnswerDirty, setShowNavigator }));
  result.current.handleSelectOption('a'); result.current.handleEliminateOption('a');
  result.current.handleSetConfidence('alta'); result.current.toggleReview(); result.current.toggleHighConfidence();
  result.current.handleNavigate(2); result.current.handlePrev(); result.current.handleNext();
  expect(updateState).not.toHaveBeenCalled(); expect(markAnswerDirty).not.toHaveBeenCalled();
  expect(setShowNavigator).not.toHaveBeenCalled();
});
