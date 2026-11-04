import { supabase } from '@/integrations/supabase/client';
import type { CutoffScoreRow } from '@/services/rankingApi';
import type { CutoffContext } from '@/hooks/useCutoffContext';
import { editionsApi } from '@/services/editionsApi';

export interface ReferencedCutoffScore extends CutoffScoreRow {
  reference_edition_id: string | null;
  reference_label: string | null;
  source: string | null;
}

// Narrow boundary for the additive RPC arguments not yet in generated types.
const client = supabase as unknown as {
  rpc(name: 'get_cutoff_scores' | 'get_user_cutoff_context', args: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export const cutoffApi = {
  async getAllScores(editionId: string): Promise<ReferencedCutoffScore[]> {
    if (!editionId) throw new Error('Explicit cutoff reference required');
    const catalog = await editionsApi.getExamEditions();
    const edition = catalog.find(item => item.id === editionId);
    if (!edition?.cutoff_reference_label?.trim()) return [];
    const referenceLabel = edition.cutoff_reference_label;
    const all: ReferencedCutoffScore[] = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('enamed_cutoff_scores')
        .select('institution_id,institution_name,practice_scenario,specialty_name,cutoff_score_general,cutoff_score_quota,reference_edition_id,source')
        .eq('reference_edition_id', editionId)
        .order('institution_name').order('specialty_name').order('practice_scenario')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as ReferencedCutoffScore[];
      all.push(...rows.filter(row => row.reference_edition_id === editionId)
        .map(row => ({ ...row, reference_label: referenceLabel })));
      if (rows.length < pageSize) break;
    }
    return all;
  },
  async getScores(specialtyId: string, institutionIds: string[], editionId: string): Promise<ReferencedCutoffScore[]> {
    if (!editionId) throw new Error('Explicit cutoff reference required');
    const { data, error } = await client.rpc('get_cutoff_scores', {
      p_specialty_id: specialtyId, p_institution_ids: institutionIds, p_reference_edition_id: editionId,
    });
    if (error) throw error;
    return ((data ?? []) as ReferencedCutoffScore[]).filter(row => row.reference_edition_id === editionId);
  },
  async getUserContext(userId: string, editionId?: string): Promise<CutoffContext | null> {
    const { data, error } = await client.rpc('get_user_cutoff_context', {
      p_user_id: userId, ...(editionId ? { p_reference_edition_id: editionId } : {}),
    });
    if (error) throw error;
    return data as CutoffContext | null;
  },
};
