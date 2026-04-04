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

interface UseSimuladoDetailReturn {
  simulado: SimuladoWithStatus | null;
  questions: Question[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

async function fetchSimuladoDetail(routeRef: string, userId: string | undefined, includeCorrectAnswers = false) {
  const config = await simuladosApi.getSimulado(routeRef);
  if (!config) {
    return { simulado: null, questions: [] as Question[] };
  }

  const canonicalId = config.id;
  const [questionData, attempt] = await Promise.all([
    simuladosApi.getQuestions(canonicalId, includeCorrectAnswers),
    userId ? simuladosApi.getAttempt(canonicalId, userId, 'online') : Promise.resolve(null),
  ]);

  const userState: SimuladoUserState | undefined = attempt
    ? {
        simuladoId: attempt.simulado_id,
        started: true,
        startedAt: attempt.started_at,
        finished: attempt.status === 'submitted' || attempt.status === 'expired',
        finishedAt: attempt.finished_at || undefined,
        score: attempt.score_percentage != null ? Math.round(Number(attempt.score_percentage)) : undefined,
      }
    : undefined;

  logger.log('[useSimuladoDetail] Loaded simulado:', config.title, 'questions:', questionData.length);
  return { simulado: enrichSimulado(config, userState), questions: questionData };
}

export function useSimuladoDetail(simuladoId: string | undefined, includeCorrectAnswers = false): UseSimuladoDetailReturn {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['simulado', simuladoId, user?.id, includeCorrectAnswers],
    queryFn: () => fetchSimuladoDetail(simuladoId!, user?.id, includeCorrectAnswers),
    enabled: !!simuladoId,
    staleTime: 5 * 60 * 1000,
  });

  return {
    simulado: data?.simulado ?? null,
    questions: data?.questions ?? [],
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Erro ao carregar simulado') : null,
    refetch,
  };
}
