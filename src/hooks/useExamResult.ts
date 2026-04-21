/**
 * Hook to load a completed exam attempt with answers from Supabase.
 * Used by ResultadoPage, CorrecaoPage, DesempenhoPage.
 * This hook only trusts server-side persisted data.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { pickMostRelevantAttempt } from '@/lib/attempt-helpers';
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

  // Counter used to ignore out-of-order responses when simuladoId/user change
  // during an inflight fetch.
  const reqIdRef = useRef(0);

  const fetchData = useCallback(async () => {
    if (!simuladoId || !user) {
      setAttempt(null);
      setExamState(null);
      setAttemptId(null);
      setAttemptQuestionResults({});
      setError(null);
      setLoading(false);
      return;
    }

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const config = await simuladosApi.getSimulado(simuladoId);
      if (reqId !== reqIdRef.current) return;
      if (!config) {
        setAttempt(null);
        setExamState(null);
        setAttemptId(null);
        setAttemptQuestionResults({});
        return;
      }

      const [onlineAttempt, offlineAttempt] = await Promise.all([
        simuladosApi.getAttempt(config.id, user.id, 'online'),
        simuladosApi.getAttempt(config.id, user.id, 'offline'),
      ]);
      if (reqId !== reqIdRef.current) return;

      const chosen = pickMostRelevantAttempt(onlineAttempt, offlineAttempt) ?? null;
      if (!chosen) {
        setAttempt(null);
        setExamState(null);
        setAttemptId(null);
        setAttemptQuestionResults({});
        return;
      }

      const [answerRows, questionResults] = await Promise.all([
        simuladosApi.getAnswers(chosen.id),
        simuladosApi.getAttemptQuestionResults(chosen.id),
      ]);
      if (reqId !== reqIdRef.current) return;

      const questionResultsMap = questionResults.reduce<Record<string, AttemptQuestionResultRow>>((acc, row) => {
        acc[row.question_id] = row;
        return acc;
      }, {});

      setAttempt(chosen);
      setAttemptId(chosen.id);
      setAttemptQuestionResults(questionResultsMap);
      setExamState(answersToExamState(chosen, answerRows));
    } catch (err: unknown) {
      if (reqId !== reqIdRef.current) return;
      logger.error('[useExamResult] Error:', err);
      setError(err instanceof Error ? err.message : 'Erro ao carregar resultado');
      // Do NOT clear previously-loaded data; the UI may prefer to show stale
      // data with a non-blocking error banner. Consumers can choose via `error`.
    } finally {
      if (reqId === reqIdRef.current) {
        setLoading(false);
      }
    }
  }, [simuladoId, user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { examState, attempt, attemptId, attemptQuestionResults, loading, error, refetch: fetchData };
}
