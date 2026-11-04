import { supabase } from '@/integrations/supabase/client';
import { editionsApi } from '@/services/editionsApi';
import type { ConfiguredEditionRankingPolicy, CutoffScoreHistory, EditionRanking, PercentileHistory } from '@/types/edition-analysis';

async function assertIdentity(expectedUserId: string) {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!expectedUserId || data.session?.user.id !== expectedUserId) throw new Error('A conta mudou. Atualize a consulta.');
}

async function read<T>(userId: string, name: string, args: Record<string, unknown>): Promise<T> {
  await assertIdentity(userId);
  const { data, error } = await supabase.rpc(name as never, args as never);
  if (error) throw error;
  await assertIdentity(userId);
  if (data === null) throw new Error('Resposta de análise indisponível.');
  return data as unknown as T;
}

function requireId(value: string) { if (!value) throw new Error('Selecione uma referência explícita.'); }

export const editionAnalysisApi = {
  // Null deliberately means the caller's longitudinal percentile history.
  getMyPercentileHistory: (userId: string) => read<PercentileHistory>(userId, 'get_my_percentile_history', { p_edition_id: null }),
  async getEditions(userId: string) {
    await assertIdentity(userId);
    const editions = await editionsApi.getExamEditions();
    await assertIdentity(userId);
    return editions;
  },
  getEditionRanking(userId: string, editionId: string, offset = 0) {
    requireId(editionId);
    if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Página inválida.');
    return read<EditionRanking>(userId, 'get_edition_ranking', { p_edition_id: editionId, p_limit: 50, p_offset: offset });
  },
  getCutoffHistory(userId: string, reference: { institutionId: string; specialtyId: string; practiceScenario?: string | null }) {
    requireId(reference.institutionId); requireId(reference.specialtyId);
    return read<CutoffScoreHistory>(userId, 'get_cutoff_score_history', { p_institution_id: reference.institutionId,
      p_specialty_id: reference.specialtyId, p_practice_scenario: reference.practiceScenario ?? null });
  },
  async configureRanking(userId: string, config: { editionId: string; bestN: number; minimumSimulados: number; enabled: boolean; reason: string }) {
    requireId(config.editionId);
    if (![config.bestN, config.minimumSimulados].every(n => Number.isSafeInteger(n) && n > 0 && n <= 2147483647)
      || config.minimumSimulados > config.bestN || !config.reason.trim() || typeof config.enabled !== 'boolean') throw new Error('Informe uma política válida e sua justificativa.');
    return read<ConfiguredEditionRankingPolicy>(userId, 'admin_configure_edition_ranking', { p_edition_id: config.editionId,
      p_best_n: config.bestN, p_minimum_simulados: config.minimumSimulados, p_enabled: config.enabled, p_reason: config.reason.trim() });
  },
};
