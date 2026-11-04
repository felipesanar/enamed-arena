/**
 * Hook for loading simulados from Supabase.
 * Uses React Query for caching across pages.
 */
import { useMemo, useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { simuladosApi, type AttemptRow } from '@/services/simuladosApi';
import { pickMostRelevantAttempt } from '@/lib/attempt-helpers';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import type { SimuladoWithStatus, SimuladoUserState } from '@/types';
import { enrichSimulado } from '@/lib/simulado-helpers';
import { useAppConfig } from '@/hooks/useAppConfig';

async function fetchSimuladosData(userId: string | undefined, editionsUi: boolean) {
  const [simuladoConfigs, onlineAttempts, offlineAttempts] = await Promise.all([
    simuladosApi.listSimulados(editionsUi),
    userId ? simuladosApi.getUserAttempts(userId, ['online', 'presencial']) : Promise.resolve([]),
    userId ? simuladosApi.getUserAttempts(userId, 'offline') : Promise.resolve([]),
  ]);
  logger.log('[useSimulados] Loaded', simuladoConfigs.length, 'simulados,', onlineAttempts.length, 'online +', offlineAttempts.length, 'offline attempts');
  return { configs: simuladoConfigs, onlineAttempts, offlineAttempts };
}

function attemptToUserState(attempt: AttemptRow): SimuladoUserState {
  return {
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
  };
}

export function useSimulados() {
  const { user, loading: authLoading } = useAuth();
  const editionsUi = useAppConfig('editions_ui');
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['simulados', user?.id, editionsUi],
    queryFn: () => fetchSimuladosData(user?.id, editionsUi),
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000,
  });

  const configs = data?.configs;
  const onlineAttempts = data?.onlineAttempts;
  const offlineAttempts = data?.offlineAttempts;

  const simulados: SimuladoWithStatus[] = useMemo(() => {
    if (!user || authLoading || !configs) return [];
    return configs.map(config => {
      const onlineAttempt = onlineAttempts?.find(a => a.simulado_id === config.id);
      const offlineAttempt = offlineAttempts?.find(a => a.simulado_id === config.id);
      // Pick the most relevant attempt: prefer a finished one from either type
      const attempt = pickMostRelevantAttempt(onlineAttempt, offlineAttempt);
      const userState = attempt ? attemptToUserState(attempt) : undefined;
      return enrichSimulado(config, userState, now);
    });
  }, [configs, onlineAttempts, offlineAttempts, user, authLoading, now]);

  const getSimuladoById = useCallback((id: string): SimuladoWithStatus | null => {
    return simulados.find(s => s.id === id || s.slug === id) || null;
  }, [simulados]);

  return {
    simulados,
    editionsUi,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : 'Erro ao carregar simulados') : null,
    refetch,
    getSimuladoById,
    dataSource: 'supabase' as const,
  };
}
