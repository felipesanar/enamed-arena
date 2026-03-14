import type { QuestionMark } from './index';

// ─── Attempt ───
export type AttemptStatus = 'not_started' | 'in_progress' | 'submitted' | 'expired';

export interface ExamAttempt {
  simuladoId: string;
  userId: string;
  status: AttemptStatus;
  startedAt: string; // ISO
  lastSavedAt: string; // ISO
  finishedAt?: string; // ISO
  totalDurationSeconds: number; // from config
  timeRemainingSeconds: number;
  currentQuestionIndex: number;
  answers: Record<string, string | null>; // questionId → selectedOptionId
  reviewFlags: Record<string, boolean>; // questionId → flagged
  highConfidenceFlags: Record<string, boolean>; // questionId → flagged
  emailReminderEnabled: boolean;
}

export interface ExamSummary {
  total: number;
  answered: number;
  unanswered: number;
  markedForReview: number;
  highConfidence: number;
}

export function computeExamSummary(
  attempt: ExamAttempt,
  questionIds: string[]
): ExamSummary {
  const answered = questionIds.filter(id => !!attempt.answers[id]).length;
  return {
    total: questionIds.length,
    answered,
    unanswered: questionIds.length - answered,
    markedForReview: questionIds.filter(id => attempt.reviewFlags[id]).length,
    highConfidence: questionIds.filter(id => attempt.highConfidenceFlags[id]).length,
  };
}
