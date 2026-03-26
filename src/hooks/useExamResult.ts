/**
 * Hook to load a completed exam attempt with answers from Supabase.
 * Used by ResultadoPage, CorrecaoPage, DesempenhoPage.
 * This hook only trusts server-side persisted data.
 */
import { useState, useEffect, useCallback } from 'react';
import { simuladosApi, type AttemptRow, type AnswerRow } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import type { ExamState, ExamAnswer } from '@/types/exam';

function answersToExamState(attempt: AttemptRow, answerRows: AnswerRow[]): ExamState {
  const answers: Record<string, ExamAnswer> = {};
  answerRows.forEach(a => {
    answers[a.question_id] = {
      questionId: a.question_id,
      selectedOption: a.selected_option_id,
      markedForReview: a.marked_for_review,
      highConfidence: a.high_confidence,
      eliminatedAlternatives: a.eliminated_options || [],
    };
  });

  return {
    simuladoId: attempt.simulado_id,
    currentQuestionIndex: attempt.current_question_index,
    answers,
    tabExitCount: attempt.tab_exit_count,
    fullscreenExitCount: attempt.fullscreen_exit_count,
    startedAt: attempt.started_at,
    effectiveDeadline: attempt.effective_deadline,
    lastSavedAt: attempt.last_saved_at,
    status: attempt.status as ExamState['status'],
  };
}

export function useExamResult(simuladoId: string | undefined) {
  const [examState, setExamState] = useState<ExamState | null>(null);
  const [attempt, setAttempt] = useState<AttemptRow | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    if (!simuladoId || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const attempt = await simuladosApi.getAttempt(simuladoId, user.id);
      if (!attempt) {
        setAttempt(null);
        setExamState(null);
        setLoading(false);
        return;
      }

      setAttempt(attempt);
      setAttemptId(attempt.id);
      const answerRows = await simuladosApi.getAnswers(attempt.id);

      setExamState(answersToExamState(attempt, answerRows));
    } catch (err: any) {
      console.error('[useExamResult] Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [simuladoId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { examState, attempt, attemptId, loading, error, refetch: fetchData };
}
