import { useQuery } from '@tanstack/react-query';
import { fetchCutoffScores, type CutoffScoreRow } from '@/services/rankingApi';

export interface CutoffScoresResult {
  loading: boolean;
  cutoffs: CutoffScoreRow[];
}

/**
 * Notas de corte de todas as instituições-alvo do usuário.
 * Desabilitada sem especialidade definida ou sem instituições.
 */
export function useCutoffScores(
  specialtyId: string | null,
  institutionIds: string[],
): CutoffScoresResult {
  const enabled = Boolean(specialtyId) && institutionIds.length > 0;

  const { isLoading, data } = useQuery({
    queryKey: ['cutoff-scores', specialtyId, institutionIds.join(',')],
    queryFn: () => fetchCutoffScores(specialtyId!, institutionIds),
    staleTime: Infinity,
    enabled,
  });

  return { loading: enabled && isLoading, cutoffs: data ?? [] };
}
