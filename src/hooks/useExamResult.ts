/**
 * Hook to load a completed exam attempt with answers from Supabase.
 * Used by ResultadoPage, CorrecaoPage, DesempenhoPage.
 * This hook only trusts server-side persisted data.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  simuladosApi,
  type AttemptRow,
  type AnswerRow,
  type AttemptQuestionResultRow,
} from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
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
  const [attemptQuestionResults, setAttemptQuestionResults] = useState<Record<string, AttemptQuestionResultRow>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchData = useCallback(async () => {
    if (!simuladoId || !user) {
      setAttemptQuestionResults({});
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const config = await simuladosApi.getSimulado(simuladoId);
      if (!config) {
        setAttempt(null);
        setExamState(null);
        setAttemptQuestionResults({});
        setLoading(false);
        return;
      }

      const attempt = await simuladosApi.getAttempt(config.id, user.id, 'online');
      if (!attempt) {
        setAttempt(null);
        setExamState(null);
        setAttemptQuestionResults({});
        setLoading(false);
        return;
      }

      setAttempt(attempt);
      setAttemptId(attempt.id);
      const answerRows = await simuladosApi.getAnswers(attempt.id);
      const questionResults = await simuladosApi.getAttemptQuestionResults(attempt.id);
      const questionResultsMap = questionResults.reduce<Record<string, AttemptQuestionResultRow>>((acc, row) => {
        acc[row.question_id] = row;
        return acc;
      }, {});
      setAttemptQuestionResults(questionResultsMap);

      setExamState(answersToExamState(attempt, answerRows));
    } catch (err: unknown) {
      logger.error('[useExamResult] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar resultado');
    } finally {
      setLoading(false);
    }
  }, [simuladoId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { examState, attempt, attemptId, attemptQuestionResults, loading, error, refetch: fetchData };
}
