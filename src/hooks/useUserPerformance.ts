import { useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/hooks/useAppConfig';
import { useUserEdition } from '@/hooks/useUserEdition';
import { simuladosApi } from '@/services/simuladosApi';

export function useUserPerformance() {
  const { user, loading: authLoading } = useAuth();
  const editionsUi = useAppConfig('editions_ui');
  const { userEdition } = useUserEdition(editionsUi);
  const userId = user?.id;
  const editionId = editionsUi ? userEdition?.id : undefined;
  const enabled = !!userId && !authLoading && (!editionsUi || !!editionId);
  const query = useQuery({
    queryKey: ['user-performance', userId, editionsUi ? editionId ?? null : 'legacy'],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [summary, history] = await Promise.all(editionId ? [
        simuladosApi.getUserPerformanceSummary(userId!, editionId),
        simuladosApi.getUserPerformanceHistory(userId!, null, editionId),
      ] : [
        simuladosApi.getUserPerformanceSummary(userId!),
        simuladosApi.getUserPerformanceHistory(userId!, 12),
      ]);
      return { summary, history };
    },
  });
  const { refetch: refetchQuery } = query;
  const refetch = useCallback(async () => { if (enabled) await refetchQuery(); }, [enabled, refetchQuery]);
  return {
    loading: enabled && query.isLoading,
    summary: enabled ? query.data?.summary ?? null : null,
    history: enabled ? query.data?.history ?? [] : [],
    error: enabled && query.error ? (query.error instanceof Error ? query.error.message : 'Erro ao carregar desempenho') : null,
    refetch,
  };
}
