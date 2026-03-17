/**
 * Hook for loading simulados from Supabase.
 * Uses React Query for caching across pages.
 */
import { useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { simuladosApi, type AttemptRow } from '@/services/simuladosApi';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { SimuladoConfig, SimuladoWithStatus, SimuladoUserState } from '@/types';
import { enrichSimulado } from '@/lib/simulado-helpers';

async function fetchSimuladosData(userId: string | undefined) {
  const [simuladoConfigs, userAttempts] = await Promise.all([
    simuladosApi.listSimulados(),
    userId ? simuladosApi.getUserAttempts(userId) : Promise.resolve([]),
  ]);
  logger.log('[useSimulados] Loaded', simuladoConfigs.length, 'simulados,', userAttempts.length, 'attempts');
  return { configs: simuladoConfigs, attempts: userAttempts };
}

function attemptToUserState(attempt: AttemptRow): SimuladoUserState {
  return {
    simuladoId: attempt.simulado_id,
    started: true,
    startedAt: attempt.started_at,
    finished: attempt.status === 'submitted' || attempt.status === 'expired',
    finishedAt: attempt.finished_at || undefined,
    score: attempt.score_percentage != null ? Math.round(Number(attempt.score_percentage)) : undefined,
  };
}

export function useSimulados() {
  const { user } = useAuth();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['simulados', user?.id],
    queryFn: () => fetchSimuladosData(user?.id),
    staleTime: 5 * 60 * 1000,
  });

  const configs = data?.configs ?? [];
  const attempts = data?.attempts ?? [];

  const simulados: SimuladoWithStatus[] = useMemo(() => {
    return configs.map(config => {
      const attempt = attempts.find(a => a.simulado_id === config.id);
      const userState = attempt ? attemptToUserState(attempt) : undefined;
      return enrichSimulado(config, userState);
    });
  }, [configs, attempts]);

  const getSimuladoById = useCallback((id: string): SimuladoWithStatus | null => {
    return simulados.find(s => s.id === id) || null;
  }, [simulados]);

  return {
    simulados,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Erro ao carregar simulados') : null,
    refetch,
    getSimuladoById,
    dataSource: 'supabase' as const,
  };
}
