/**
 * useExamAnswers — handlers de resposta e navegação da prova.
 *
 * Extraído de useExamFlow (Fase 3 / REFACTOR_ROADMAP) para isolar a lógica de
 * mutação de resposta — a parte mais testável do motor de prova. Puro: recebe
 * deps explícitas e só compõe `useCallback`s. NÃO muda comportamento.
 *
 * Toda mutação passa por `updateState` (persist debounced) e marca a resposta
 * como "dirty" via `markAnswerDirty`, para o próximo sync enviar só a linha
 * alterada em vez de re-subir todas as respostas.
 */
import { useCallback } from 'react';
import type { Question } from '@/types';
import type { ExamState, ExamAnswer } from '@/types/exam';
import { toast } from '@/hooks/use-toast';

export interface UseExamAnswersArgs {
  currentQuestion: Question | undefined;
  currentIndex: number;
  questionsLength: number;
  updateState: (updater: (prev: ExamState) => ExamState) => void;
  markAnswerDirty: (questionId: string) => void;
  setShowNavigator: (v: boolean | ((prev: boolean) => boolean)) => void;
}

export interface UseExamAnswersReturn {
  handleSelectOption: (optionId: string) => void;
  handleEliminateOption: (optionId: string) => void;
  handleNavigate: (index: number) => void;
  handlePrev: () => void;
  handleNext: () => void;
  toggleReview: () => void;
  toggleHighConfidence: () => void;
}

/** Resposta default (não respondida) para uma questão ainda sem registro no estado. */
function emptyAnswer(questionId: string): ExamAnswer {
  return {
    questionId,
    selectedOption: null,
    markedForReview: false,
    highConfidence: false,
    eliminatedAlternatives: [],
  };
}

export function useExamAnswers({
  currentQuestion,
  currentIndex,
  questionsLength,
  updateState,
  markAnswerDirty,
  setShowNavigator,
}: UseExamAnswersArgs): UseExamAnswersReturn {
  const handleSelectOption = useCallback((optionId: string) => {
    if (!currentQuestion) return;
    // Single source of truth: updateState → debounced bulk upsert.
    markAnswerDirty(currentQuestion.id);
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? emptyAnswer(currentQuestion.id);
      return {
        ...prev,
        answers: {
          ...prev.answers,
          [currentQuestion.id]: { ...existing, selectedOption: optionId },
        },
      };
    });
  }, [currentQuestion, updateState, markAnswerDirty]);

  const handleEliminateOption = useCallback((optionId: string) => {
    if (!currentQuestion) return;
    markAnswerDirty(currentQuestion.id);
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? emptyAnswer(currentQuestion.id);
      const isEliminated = existing.eliminatedAlternatives.includes(optionId);
      const answer: ExamAnswer = {
        ...existing,
        eliminatedAlternatives: isEliminated
          ? existing.eliminatedAlternatives.filter(i => i !== optionId)
          : [...existing.eliminatedAlternatives, optionId],
      };
      return { ...prev, answers: { ...prev.answers, [currentQuestion.id]: answer } };
    });
  }, [currentQuestion, updateState, markAnswerDirty]);

  const handleNavigate = useCallback((index: number) => {
    updateState(prev => ({ ...prev, currentQuestionIndex: index }));
    setShowNavigator(false);
  }, [updateState, setShowNavigator]);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) handleNavigate(currentIndex - 1);
  }, [currentIndex, handleNavigate]);

  const handleNext = useCallback(() => {
    if (currentIndex < questionsLength - 1) handleNavigate(currentIndex + 1);
  }, [currentIndex, questionsLength, handleNavigate]);

  const toggleReview = useCallback(() => {
    if (!currentQuestion) return;
    markAnswerDirty(currentQuestion.id);
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? emptyAnswer(currentQuestion.id);
      const newVal = !existing.markedForReview;
      toast({ title: newVal ? 'Questão marcada para revisão' : 'Marcação removida' });
      return {
        ...prev,
        answers: { ...prev.answers, [currentQuestion.id]: { ...existing, markedForReview: newVal } },
      };
    });
  }, [currentQuestion, updateState, markAnswerDirty]);

  const toggleHighConfidence = useCallback(() => {
    if (!currentQuestion) return;
    markAnswerDirty(currentQuestion.id);
    updateState(prev => {
      const existing = prev.answers[currentQuestion.id] ?? emptyAnswer(currentQuestion.id);
      return {
        ...prev,
        answers: { ...prev.answers, [currentQuestion.id]: { ...existing, highConfidence: !existing.highConfidence } },
      };
    });
  }, [currentQuestion, updateState, markAnswerDirty]);

  return {
    handleSelectOption,
    handleEliminateOption,
    handleNavigate,
    handlePrev,
    handleNext,
    toggleReview,
    toggleHighConfidence,
  };
}
