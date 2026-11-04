import { createContext, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { cutoffApi } from '@/services/cutoffApi';
import { useAppConfig } from '@/hooks/useAppConfig';

export interface CutoffScope {
  editionsUi?: boolean;
  referenceEditionId?: string | null;
  enabled?: boolean;
  cutoffContext?: CutoffContext | null;
}

/** Page-owned scope lets existing ranking composition opt in without changing its queries/UI. */
export const CutoffScopeContext = createContext<CutoffScope>({});
export const useCutoffScope = () => useContext(CutoffScopeContext);

/** A pending/failed flag is not a confirmed legacy mode. */
export function useCutoffEditionFlag() {
  const { user, loading } = useAuth();
  const editionsUi = useAppConfig('editions_ui');
  const state = useQueryClient().getQueryState(['app-config', user?.id ?? null, 'editions_ui']);
  return { editionsUi, ready: !!user && !loading && state?.status === 'success',
    loading: !!user && (loading || !state || state.status === 'pending') };
}

export interface CutoffMatch {
  user_institution: string;
  matched_institution: string;
  practice_scenario: string | null;
  specialty: string;
  cutoff_general: number | null;
  cutoff_quota: number | null;
  reference_edition_id?: string | null;
  reference_label?: string | null;
  source?: string | null;
}

export interface CutoffStats {
  count: number;
  min?: number;
  max?: number;
  avg?: number;
  median?: number;
}

export interface CutoffContext {
  has_target_cutoff: boolean;
  /** 'matched' | 'no_match' | 'no_onboarding' | 'incomplete_onboarding' | 'unauthorized' */
  reason: string;
  specialty: string | null;
  target_institutions: string[] | null;
  matches: CutoffMatch[];
  unmatched_institutions: string[];
  stats: CutoffStats;
  reference_edition_id?: string | null;
  reference_label?: string | null;
  reference_reason?: string;
  mode?: 'legacy' | 'reference' | 'empty';
}

/**
 * Busca contexto de nota de corte personalizado pra o usuário, combinando
 * onboarding (especialidade + instituições alvo) com a tabela
 * enamed_cutoff_scores. Quando não há match, a IA do Prof. Sanor se
 * comporta diferente (sugere completar o onboarding em vez de inventar meta).
 */
export function useCutoffContext(options?: CutoffScope) {
  const { user } = useAuth();
  const inherited = useCutoffScope();
  const flag = useCutoffEditionFlag();
  const { referenceEditionId, enabled: requested = true } = options ?? inherited;
  const editionsUi = flag.editionsUi;
  const enabled = requested && flag.ready && !!user && (!editionsUi || !!referenceEditionId);
  const query = useQuery({
    queryKey: ['user-cutoff-context', user?.id ?? null, editionsUi ? referenceEditionId ?? null : 'legacy'],
    queryFn: () => cutoffApi.getUserContext(user!.id, editionsUi ? referenceEditionId! : undefined),
    enabled, retry: false, staleTime: 5 * 60 * 1000,
  });
  const matchesReference = !editionsUi || query.data?.reference_edition_id === referenceEditionId;
  return { cutoffContext: enabled && query.isSuccess && matchesReference ? query.data : null,
    loading: requested && (flag.loading || (enabled && query.isPending)) };
}
