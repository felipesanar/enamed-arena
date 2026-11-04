/**
 * Hook to load a completed exam attempt with answers from Supabase.
 * Used by CorrecaoPage, DesempenhoPage.
 * This hook only trusts server-side persisted data.
 */
import { useLayoutEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { pickMostRelevantAttempt } from '@/lib/attempt-helpers';
import {
  simuladosApi,
  type AttemptRow,
  type AnswerRow,
  type AttemptQuestionResultRow,
} from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
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
      confidence: (a as any).confidence ?? null,
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
  const { user, loading: authLoading } = useAuth();
  const client = useQueryClient();
  const userId = user?.id;
  const enabled = !!simuladoId && !!userId && !authLoading;
  // Capability, not a frontend admin role, is the existing SQL preview permission.
  const access = useQuery({
    queryKey: ['exam-result-access', userId], enabled, staleTime: 5 * 60 * 1000, retry: false,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('admin_get_access');
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) as { capabilities?: string[] } | null;
      return row?.capabilities?.includes('results.view') === true;
    },
  });
  const preview = enabled && access.data === true;
  const queryKey = ['exam-result', userId, simuladoId, preview];
  const query = useQuery({
    queryKey, enabled: enabled && access.isFetched, staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const config = await simuladosApi.getSimulado(simuladoId!);
      if (!config) return null;
      const [online, offline] = await Promise.all([
        simuladosApi.getAttempt(config.id, userId!, ['online', 'presencial']),
        simuladosApi.getAttempt(config.id, userId!, 'offline'),
      ]);
      const chosen = pickMostRelevantAttempt(online, offline) ?? null;
      const releaseAt = Date.parse(config.resultsReleaseAt);
      const released = Number.isFinite(releaseAt) && Date.now() > releaseAt;
      if (!chosen) return { releaseAt, released, attempt: null, examState: null,
        attemptQuestionResults: {} as Record<string, AttemptQuestionResultRow> };
      const finished = chosen.status === 'submitted' || chosen.status === 'expired';
      const [answers, results] = await Promise.all([
        simuladosApi.getAnswers(chosen.id),
        (released || preview) && finished ? simuladosApi.getAttemptQuestionResults(chosen.id) : Promise.resolve([]),
      ]);
      return { releaseAt, released, attempt: released || preview ? chosen : { ...chosen, score_percentage: null, total_correct: null, total_answered: null }, examState: answersToExamState(chosen, answers),
        attemptQuestionResults: Object.fromEntries(results.map(row => [row.question_id, row])) as Record<string, AttemptQuestionResultRow> };
    },
  });
  const data = enabled && access.isFetched ? query.data : null;
  const released = !!data && Number.isFinite(data.releaseAt) && Date.now() > data.releaseAt;
  // A fresh pre-release cache must expire at release, even inside staleTime.
  // A clock/calendar change back before release clears correction data before paint.
  useLayoutEffect(() => {
    if (!enabled || !data || !Number.isFinite(data.releaseAt)) return;
    const queryKey = ['exam-result', userId, simuladoId, preview];
    const refresh = () => { void client.invalidateQueries({ queryKey, exact: true }); };
    if (released !== data.released) {
      if (!released && !preview) client.setQueryData(queryKey, { ...data, released: false,
        attempt: data.attempt ? { ...data.attempt, score_percentage: null, total_correct: null, total_answered: null } : null,
        attemptQuestionResults: {} });
      refresh();
      return;
    }
    if (!released) {
      let timer: ReturnType<typeof setTimeout>;
      const schedule = () => {
        timer = setTimeout(() => {
          if (Date.now() > data.releaseAt) refresh(); else schedule();
        }, Math.min(2_147_483_647, Math.max(1, data.releaseAt - Date.now() + 1)));
      };
      schedule();
      return () => clearTimeout(timer);
    }
  }, [client, userId, simuladoId, enabled, data, released, preview]);
  const { refetch: refetchQuery } = query;
  const { refetch: refetchAccess, isError: accessFailed } = access;
  const refetch = useCallback(async () => {
    if (!enabled) return;
    if (accessFailed) {
      await refetchAccess();
      return;
    }
    await refetchQuery();
  }, [enabled, accessFailed, refetchAccess, refetchQuery]);
  const attempt = data?.attempt ?? null;
  const error = access.error ?? query.error;
  return {
    examState: data?.examState ?? null,
    attempt: attempt && !released && !preview ? { ...attempt, score_percentage: null, total_correct: null, total_answered: null } : attempt,
    attemptId: attempt?.id ?? null,
    attemptQuestionResults: released || preview ? data?.attemptQuestionResults ?? {} : {},
    loading: enabled && (!access.isFetched || query.isLoading),
    error: enabled && error ? (error instanceof Error ? error.message : 'Erro ao carregar resultado') : null,
    refetch,
  };
}
