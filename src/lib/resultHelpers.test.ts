import { describe, it, expect } from 'vitest';
import { computeSimuladoScore, computePerformanceBreakdown } from './resultHelpers';
import type { ExamState } from '@/types/exam';
import type { Question } from '@/types';

function makeQuestion(
  id: string,
  correctOptionId: string,
  area = 'Área A',
  theme = 'Tema 1',
): Question {
  return {
    id,
    number: 1,
    text: 'Question text',
    area,
    theme,
    options: [
      { id: 'opt1', label: 'A', text: 'Opt 1' },
      { id: 'opt2', label: 'B', text: 'Opt 2' },
    ],
    correctOptionId,
  };
}

function makeState(answers: Record<string, string | null>): ExamState {
  const state: ExamState = {
    simuladoId: 's1',
    currentQuestionIndex: 0,
    answers: {},
    tabExitCount: 0,
    fullscreenExitCount: 0,
    startedAt: new Date().toISOString(),
    effectiveDeadline: new Date().toISOString(),
    lastSavedAt: new Date().toISOString(),
    status: 'in_progress',
  };
  Object.entries(answers).forEach(([questionId, selectedOptionId]) => {
    state.answers[questionId] = {
      questionId,
      selectedOption: selectedOptionId,
      markedForReview: false,
      highConfidence: false,
      eliminatedAlternatives: [],
    };
  });
  return state;
}

describe('computeSimuladoScore', () => {
  it('returns 0 when no questions', () => {
    const state = makeState({});
    const result = computeSimuladoScore(state, []);
    expect(result.totalQuestions).toBe(0);
    expect(result.percentageScore).toBe(0);
    expect(result.totalCorrect).toBe(0);
    expect(result.totalAnswered).toBe(0);
  });

  it('computes correct score when all answers correct', () => {
    const questions: Question[] = [
      makeQuestion('q1', 'opt1'),
      makeQuestion('q2', 'opt2'),
    ];
    const state = makeState({ q1: 'opt1', q2: 'opt2' });
    const result = computeSimuladoScore(state, questions);
    expect(result.totalQuestions).toBe(2);
    expect(result.totalCorrect).toBe(2);
    expect(result.totalAnswered).toBe(2);
    expect(result.percentageScore).toBe(100);
  });

  it('computes partial score and unanswered', () => {
    const questions: Question[] = [
      makeQuestion('q1', 'opt1'),
      makeQuestion('q2', 'opt2'),
    ];
    const state = makeState({ q1: 'opt1', q2: 'opt1' }); // q2 wrong
    const result = computeSimuladoScore(state, questions);
    expect(result.totalQuestions).toBe(2);
    expect(result.totalCorrect).toBe(1);
    expect(result.totalAnswered).toBe(2);
    expect(result.totalUnanswered).toBe(0);
    expect(result.percentageScore).toBe(50);
  });

  it('counts unanswered when answer missing', () => {
    const questions: Question[] = [makeQuestion('q1', 'opt1')];
    const state = makeState({});
    const result = computeSimuladoScore(state, questions);
    expect(result.totalAnswered).toBe(0);
    expect(result.totalUnanswered).toBe(1);
    expect(result.percentageScore).toBe(0);
  });
});

describe('computePerformanceBreakdown', () => {
  it('returns overall and byArea and byTheme', () => {
    const questions: Question[] = [
      makeQuestion('q1', 'opt1', 'Clínica', 'Cardio'),
      makeQuestion('q2', 'opt2', 'Clínica', 'Cardio'),
      makeQuestion('q3', 'opt1', 'Cirurgia', 'Geral'),
    ];
    const state = makeState({ q1: 'opt1', q2: 'opt1', q3: 'opt1' }); // 2/3 correct (q2 wrong)
    const breakdown = computePerformanceBreakdown(state, questions);
    expect(breakdown.overall.totalQuestions).toBe(3);
    expect(breakdown.overall.totalCorrect).toBe(2);
    expect(breakdown.byArea).toHaveLength(2); // Clínica, Cirurgia
    const clinica = breakdown.byArea.find(a => a.area === 'Clínica');
    expect(clinica?.questions).toBe(2);
    expect(clinica?.correct).toBe(1);
    expect(clinica?.score).toBe(50);
    expect(breakdown.byTheme.length).toBeGreaterThanOrEqual(1);
  });
});
