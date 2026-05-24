import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface CutoffMatch {
  user_institution: string;
  matched_institution: string;
  practice_scenario: string | null;
  specialty: string;
  cutoff_general: number | null;
  cutoff_quota: number | null;
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
}

/**
 * Busca contexto de nota de corte personalizado pra o usuário, combinando
 * onboarding (especialidade + instituições alvo) com a tabela
 * enamed_cutoff_scores. Quando não há match, a IA do Prof. Sanor se
 * comporta diferente (sugere completar o onboarding em vez de inventar meta).
 */
export function useCutoffContext() {
  const { user } = useAuth();
  const userId = user?.id;
  const [data, setData] = useState<CutoffContext | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    // RPC nova: get_user_cutoff_context retorna jsonb.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('get_user_cutoff_context', { p_user_id: userId })
      .then(({ data: row, error }: { data: unknown; error: { message: string } | null }) => {
        if (cancelled) return;
        if (error) {
          logger.error('[useCutoffContext] error:', error);
          setData(null);
          return;
        }
        setData(row as CutoffContext);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { cutoffContext: data, loading };
}
