import { useQuery } from '@tanstack/react-query';
import { fetchCutoffScores, type CutoffScoreRow } from '@/services/rankingApi';
import { cutoffApi } from '@/services/cutoffApi';
import { useCutoffEditionFlag, useCutoffScope, type CutoffScope } from '@/hooks/useCutoffContext';
import { useAuth } from '@/contexts/AuthContext';

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
  options?: CutoffScope,
): CutoffScoresResult {
  const inherited = useCutoffScope();
  const flag = useCutoffEditionFlag();
  const { referenceEditionId, enabled: requested = true } = options ?? inherited;
  const editionsUi = flag.editionsUi;
  const { user } = useAuth();
  const enabled = requested && flag.ready && Boolean(specialtyId) && institutionIds.length > 0 && !!user
    && (!editionsUi || !!referenceEditionId);

  const { isLoading, data } = useQuery({
    queryKey: ['cutoff-scores', user?.id ?? null, specialtyId, institutionIds.join(','), editionsUi ? referenceEditionId ?? null : 'legacy'],
    queryFn: () => editionsUi ? cutoffApi.getScores(specialtyId!, institutionIds, referenceEditionId!) : fetchCutoffScores(specialtyId!, institutionIds),
    staleTime: Infinity,
    enabled,
  });

  return { loading: enabled && isLoading, cutoffs: enabled ? data ?? [] : [] };
}
