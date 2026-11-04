import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, auth: { getSession: mocks.getSession } } }));
import { editionAnalysisApi } from './editionAnalysisApi';
const emptyHistory = { items: [], metadata: { metric: 'top_percentile', small_sample_threshold: 30, warning: '', psychometric_comparable: false } };
beforeEach(() => { vi.clearAllMocks(); mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null }); });
describe('edition analysis RPC boundary', () => {
  it('requests the caller longitudinal history with intentional null edition and no user parameter', async () => {
    mocks.rpc.mockResolvedValue({ data: emptyHistory, error: null });
    expect(await editionAnalysisApi.getMyPercentileHistory('owner')).toEqual(emptyHistory);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_my_percentile_history', { p_edition_id: null });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('preserves an unconfigured/disabled policy as null instead of inventing N', async () => {
    const data = { status: 'unconfigured', edition_id: 'edition', policy: null, population: 0, items: [] };
    mocks.rpc.mockResolvedValue({ data, error: null });
    expect(await editionAnalysisApi.getEditionRanking('owner', 'edition', 50)).toEqual(data);
    expect(mocks.rpc).toHaveBeenCalledWith('get_edition_ranking', { p_edition_id: 'edition', p_limit: 50, p_offset: 50 });
  });
  it('forwards canonical reference IDs and preserves empty scenario as distinct from all scenarios', async () => {
    const data = { items: [], legacy_unknown_count: 1, trend_comparable: false, metadata: { reference_only: true, source_version_available: false, warning: '' } };
    mocks.rpc.mockResolvedValue({ data, error: null });
    await editionAnalysisApi.getCutoffHistory('owner', { institutionId: 'institution', specialtyId: 'specialty', practiceScenario: '' });
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('get_cutoff_score_history', { p_institution_id: 'institution', p_specialty_id: 'specialty', p_practice_scenario: '' });
  });
  it('discards a completed response after an account switch', async () => {
    mocks.rpc.mockResolvedValue({ data: emptyHistory, error: null });
    mocks.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'owner' } } }, error: null })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'other' } } }, error: null });
    await expect(editionAnalysisApi.getMyPercentileHistory('owner')).rejects.toThrow(/conta/i);
  });
  it('does not query data for a logged-out or mismatched caller', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });
    await expect(editionAnalysisApi.getMyPercentileHistory('owner')).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not mask RPC permission/schema errors with legacy or raw score reads', async () => {
    const error = { code: '42501', message: 'Denied' }; mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(editionAnalysisApi.getMyPercentileHistory('owner')).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledTimes(1); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('requires an explicit justified policy and sends only one configuration mutation', async () => {
    await expect(editionAnalysisApi.configureRanking('owner', { editionId: 'edition', bestN: 0, minimumSimulados: 1, enabled: true, reason: 'x' })).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
    const error = { code: '55P03' }; mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(editionAnalysisApi.configureRanking('owner', { editionId: 'edition', bestN: 3, minimumSimulados: 2, enabled: true, reason: ' Editorial ' })).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('admin_configure_edition_ranking', { p_edition_id: 'edition', p_best_n: 3, p_minimum_simulados: 2, p_enabled: true, p_reason: 'Editorial' });
  });
});
