/**
 * Hook to load a completed exam attempt with answers from Supabase.
 * Used by ResultadoPage, CorrecaoPage, DesempenhoPage.
 * Falls back to localStorage if DB answers are empty but attempt is submitted.
 */
import { useState, useEffect, useCallback } from 'react';
import { simuladosApi, type AttemptRow, type AnswerRow } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import type { ExamState, ExamAnswer } from '@/types/exam';

const STORAGE_PREFIX = 'enamed_exam_';

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

function loadLocalFallback(simuladoId: string): ExamState | null {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${simuladoId}`);
    if (!raw) return null;
    const state = JSON.parse(raw) as ExamState;
    if (Object.keys(state.answers || {}).length > 0) {
      console.log('[useExamResult] Using localStorage fallback with', Object.keys(state.answers).length, 'answers');
      return state;
    }
    return null;
  } catch {
    return null;
  }
}

export function useExamResult(simuladoId: string | undefined) {
  const [examState, setExamState] = useState<ExamState | null>(null);
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
        setExamState(null);
        setLoading(false);
        return;
      }

      setAttemptId(attempt.id);
      const answerRows = await simuladosApi.getAnswers(attempt.id);

      if (answerRows.length > 0) {
        setExamState(answersToExamState(attempt, answerRows));
        console.log('[useExamResult] Loaded', answerRows.length, 'answers from DB');
      } else {
        // DB has no answers — fallback to localStorage
        const localState = loadLocalFallback(simuladoId);
        if (localState) {
          setExamState({ ...localState, status: attempt.status as ExamState['status'] });
        } else {
          setExamState(answersToExamState(attempt, []));
        }
      }
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

  return { examState, attemptId, loading, error, refetch: fetchData };
}
