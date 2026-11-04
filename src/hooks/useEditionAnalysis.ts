import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAppConfig } from '@/hooks/useAppConfig';
import { editionAnalysisApi } from '@/services/editionAnalysisApi';

function useScope(requested = true) {
  const { user, loading } = useAuth();
  const feature = useAppConfig('editions_ui');
  return { userId: user?.id ?? null, enabled: requested && feature && !!user && !loading };
}

export function usePercentileHistory() {
  const { userId, enabled } = useScope();
  const query = useQuery({ queryKey: ['my-percentile-history', userId], enabled, retry: false, staleTime: 5 * 60 * 1000,
    queryFn: () => editionAnalysisApi.getMyPercentileHistory(userId!) });
  return { ...query, data: enabled && query.isSuccess ? query.data : undefined, isPending: enabled && query.isPending };
}

export function useAnalysisEditions(requested = true) {
  const { userId, enabled } = useScope(requested);
  const query = useQuery({ queryKey: ['analysis-editions', userId], enabled, retry: false, staleTime: 5 * 60 * 1000,
    queryFn: () => editionAnalysisApi.getEditions(userId!) });
  return { ...query, data: enabled && query.isSuccess ? query.data : undefined, isPending: enabled && query.isPending };
}

export function useEditionRanking(editionId: string | null, offset: number) {
  const { userId, enabled } = useScope(!!editionId);
  const query = useQuery({ queryKey: ['edition-ranking', userId, editionId, offset], enabled, retry: false, staleTime: 5 * 60 * 1000,
    queryFn: () => editionAnalysisApi.getEditionRanking(userId!, editionId!, offset) });
  return { ...query, data: enabled && query.isSuccess && query.data.edition_id === editionId ? query.data : undefined,
    isPending: enabled && query.isPending };
}

export function useCutoffHistory(reference: { institutionId: string; specialtyId: string; practiceScenario?: string | null } | null) {
  const { userId, enabled } = useScope(!!reference?.institutionId && !!reference?.specialtyId);
  const query = useQuery({ queryKey: ['cutoff-score-history', userId, reference?.institutionId ?? null,
    reference?.specialtyId ?? null, reference?.practiceScenario ?? null], enabled, retry: false, staleTime: 5 * 60 * 1000,
    queryFn: () => editionAnalysisApi.getCutoffHistory(userId!, reference!) });
  return { ...query, data: enabled && query.isSuccess ? query.data : undefined, isPending: enabled && query.isPending };
}
