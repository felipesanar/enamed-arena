import { useQuery } from '@tanstack/react-query';
import { fetchCutoffScore, type CutoffScoreRow } from '@/services/rankingApi';

export interface CutoffScoreResult {
  loading: boolean;
  cutoff: CutoffScoreRow | null;
}

/**
 * Queries enamed_cutoff_scores for a single specialty + institution combination.
 * staleTime: Infinity — cutoff scores are static reference data.
 * Query is disabled when either specialty or institution is empty.
 */
export function useCutoffScore(
  specialty: string,
  institution: string,
): CutoffScoreResult {
  const enabled = Boolean(specialty?.trim() && institution?.trim());

  const { isLoading, data } = useQuery({
    queryKey: [
      'cutoff-score',
      specialty?.trim().toLowerCase(),
      institution?.trim().toLowerCase(),
    ],
    queryFn: () => fetchCutoffScore(specialty, institution),
    staleTime: Infinity,
    enabled,
  });

  return {
    loading: enabled && isLoading,
    cutoff: data ?? null,
  };
}
