/**
 * Hook to load a single simulado + its questions from Supabase.
 * Uses React Query for caching — avoids redundant fetches across pages.
 */
import { useQuery } from '@tanstack/react-query';
import { simuladosApi } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { Question, SimuladoWithStatus, SimuladoUserState } from '@/types';
import { enrichSimulado } from '@/lib/simulado-helpers';
import { pickMostRelevantAttempt } from '@/lib/attempt-helpers';
import { useAppConfig } from '@/hooks/useAppConfig';

interface UseSimuladoDetailReturn {
  simulado: SimuladoWithStatus | null;
  questions: Question[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

async function fetchSimuladoDetail(routeRef: string, userId: string | undefined, includeCorrectAnswers: boolean, editionsUi: boolean) {
  const config = await simuladosApi.getSimulado(routeRef, editionsUi);
  if (!config) {
    return { simulado: null, questions: [] as Question[] };
  }

  const canonicalId = config.id;
  const [questionData, onlineAttempt, offlineAttempt] = await Promise.all([
    simuladosApi.getQuestions(canonicalId, includeCorrectAnswers),
    userId ? simuladosApi.getAttempt(canonicalId, userId, ['online', 'presencial']) : Promise.resolve(null),
    userId ? simuladosApi.getAttempt(canonicalId, userId, 'offline') : Promise.resolve(null),
  ]);

  const attempt = pickMostRelevantAttempt(onlineAttempt, offlineAttempt);

  const userState: SimuladoUserState | undefined = attempt
    ? {
        simuladoId: attempt.simulado_id,
        started: true,
        startedAt: attempt.started_at,
        finished: attempt.status === 'submitted' || attempt.status === 'expired',
        finishedAt: attempt.finished_at || undefined,
        score: attempt.score_percentage != null ? Math.round(Number(attempt.score_percentage)) : undefined,
        attemptType:
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((attempt as any).attempt_type as 'online' | 'offline' | 'presencial' | undefined) ??
          (attempt.status === 'offline_pending' ? 'offline' : 'online'),
        attemptStatus: attempt.status,
        effectiveDeadline: attempt.effective_deadline,
        isWithinWindow: attempt.is_within_window,
      }
    : undefined;

  logger.log('[useSimuladoDetail] Loaded simulado:', config.title, 'questions:', questionData.length);
  return { simulado: enrichSimulado(config, userState), questions: questionData };
}

export function useSimuladoDetail(simuladoId: string | undefined, includeCorrectAnswers = false): UseSimuladoDetailReturn {
  const { user, loading: authLoading } = useAuth();
  const editionsUi = useAppConfig('editions_ui');

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['simulado', simuladoId, user?.id, includeCorrectAnswers, editionsUi],
    queryFn: () => fetchSimuladoDetail(simuladoId!, user?.id, includeCorrectAnswers, editionsUi),
    enabled: !!simuladoId && !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
  });

  return {
    simulado: user && !authLoading ? data?.simulado ?? null : null,
    questions: user && !authLoading ? data?.questions ?? [] : [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Erro ao carregar simulado') : null,
    refetch,
  };
}
