import { supabase } from '@/integrations/supabase/client';
import type { ExamAnswer } from '@/types/exam';
import type { AnswerWriteMode } from '@/types/exam-runtime';

export class AnswerWriteMismatchError extends Error {
  constructor() { super('ANSWER_WRITE_MISMATCH'); }
}

/** Shared by normal bulk writes and unload keepalive. No transport-generated versions. */
export function answerRows(attemptId: string, answers: Record<string, ExamAnswer>, mode: AnswerWriteMode) {
  if (mode !== 'legacy' && mode !== 'v1') throw new Error('EXAM_RUNTIME_PENDING');
  return Object.entries(answers).map(([questionId, answer]) => ({
    attempt_id: attemptId,
    question_id: questionId,
    selected_option_id: answer.selectedOption,
    marked_for_review: answer.markedForReview,
    high_confidence: answer.highConfidence,
    eliminated_options: answer.eliminatedAlternatives || [],
    confidence: answer.confidence ?? null,
    ...(mode === 'v1' ? { client_updated_at: answer.clientUpdatedAt ?? null } : {}),
    answered_at: answer.selectedOption ? answer.answeredAt ?? null : null,
  }));
}

export function assertAnswerRowsAccepted(rows: ReturnType<typeof answerRows>, data: unknown): void {
  if (!Array.isArray(data) || data.length !== rows.length || !rows.every(row => {
    const accepted = data.find(value => value?.attempt_id === row.attempt_id && value?.question_id === row.question_id);
    return accepted && Object.entries(row).every(([key, expected]) => {
      const actual = accepted[key];
      if (key.endsWith('_at') && expected != null && actual != null) {
        return Date.parse(String(actual)) === Date.parse(String(expected));
      }
      return JSON.stringify(actual) === JSON.stringify(expected);
    });
  })) throw new AnswerWriteMismatchError();
}

export const examAnswersApi = {
  async bulkUpsertAnswers(attemptId: string, answers: Record<string, ExamAnswer>, mode: AnswerWriteMode): Promise<void> {
    const rows = answerRows(attemptId, answers, mode);
    if (!rows.length) return;
    const columns = 'attempt_id,question_id,selected_option_id,marked_for_review,high_confidence,eliminated_options,confidence,answered_at' +
      (mode === 'v1' ? ',client_updated_at' : '');
    const { data, error } = await supabase.from('answers').upsert(rows, { onConflict: 'attempt_id,question_id' }).select(columns);
    if (error) throw error;
    // A freshness-trigger no-op is HTTP 2xx with no returned row. Never ACK it.
    assertAnswerRowsAccepted(rows, data);
  },
};
