/**
 * Exam state types — adapted from SanarFlix Academy's battle-tested model.
 * Key improvements: 5 alternatives (A-E), high-confidence flags, typed for this platform.
 */

export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'expired';
export type AlternativeLetter = 'A' | 'B' | 'C' | 'D' | 'E';

export interface ExamAnswer {
  questionId: string;
  selectedOption: string | null; // option id
  markedForReview: boolean;
  highConfidence: boolean;
  eliminatedAlternatives: string[]; // option ids
}

export interface ExamState {
  simuladoId: string;
  currentQuestionIndex: number;
  answers: Record<string, ExamAnswer>;
  tabExitCount: number;
  fullscreenExitCount: number;
  startedAt: string; // ISO
  effectiveDeadline: string; // ISO — absolute deadline (min of personal + window)
  lastSavedAt: string; // ISO
  status: AttemptStatus;
}

export interface ExamSummary {
  total: number;
  answered: number;
  unanswered: number;
  markedForReview: number;
  highConfidence: number;
  unansweredIndices: number[]; // 0-based indices of unanswered questions
}

export function computeExamSummary(
  state: ExamState,
  questionIds: string[]
): ExamSummary {
  const answered = questionIds.filter(id => !!state.answers[id]?.selectedOption).length;
  const unansweredIndices = questionIds
    .map((id, i) => ({ id, i }))
    .filter(({ id }) => !state.answers[id]?.selectedOption)
    .map(({ i }) => i);
  return {
    total: questionIds.length,
    answered,
    unanswered: questionIds.length - answered,
    markedForReview: questionIds.filter(id => state.answers[id]?.markedForReview).length,
    highConfidence: questionIds.filter(id => state.answers[id]?.highConfidence).length,
    unansweredIndices,
  };
}
