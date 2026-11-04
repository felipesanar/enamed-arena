import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc, from, catalog } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), catalog: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));
vi.mock('@/services/editionsApi', () => ({ editionsApi: { getExamEditions: catalog } }));
import { cutoffApi } from '@/services/cutoffApi';

describe('edition cutoff API', () => {
  beforeEach(() => { rpc.mockReset(); from.mockReset(); catalog.mockReset(); });
  it('requires an explicit edition and never falls back globally', async () => {
    await expect(cutoffApi.getScores('spec', ['inst'], '')).rejects.toThrow();
    expect(rpc).not.toHaveBeenCalled();
  });
  it('sends reference edition and preserves source metadata', async () => {
    const rows = [{ reference_edition_id: 'ed', reference_label: 'Processo X', source: 'Edital X' }];
    rpc.mockResolvedValue({ data: rows, error: null });
    expect(await cutoffApi.getScores('spec', ['inst'], 'ed')).toEqual(rows);
    expect(rpc).toHaveBeenCalledWith('get_cutoff_scores', { p_specialty_id: 'spec', p_institution_ids: ['inst'], p_reference_edition_id: 'ed' });
  });
  it('does not expose scores returned for a different edition', async () => {
    rpc.mockResolvedValue({ data: [{ reference_edition_id: 'other' }], error: null });
    expect(await cutoffApi.getScores('spec', ['inst'], 'ed')).toEqual([]);
  });
  it('retains legacy context arguments when flag is off, explicit otherwise', async () => {
    rpc.mockResolvedValue({ data: {}, error: null });
    await cutoffApi.getUserContext('u');
    expect(rpc).toHaveBeenLastCalledWith('get_user_cutoff_context', { p_user_id: 'u' });
    await cutoffApi.getUserContext('u', 'ed');
    expect(rpc).toHaveBeenLastCalledWith('get_user_cutoff_context', { p_user_id: 'u', p_reference_edition_id: 'ed' });
  });
  it('does not read the all-cutoff table when the catalog reference is unknown', async () => {
    catalog.mockResolvedValue([{ id: 'ed', cutoff_reference_label: null }]);
    expect(await cutoffApi.getAllScores('ed')).toEqual([]);
    expect(from).not.toHaveBeenCalled();
  });
  it('filters the all-cutoff table by exact reference and takes the label from catalog, not exam year', async () => {
    catalog.mockResolvedValue([{ id: 'ed', label: 'ENAMED 2027', cutoff_reference_label: 'Processo X' }]);
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn(), range: vi.fn().mockResolvedValue({ data: [{ reference_edition_id: 'ed', source: 'Edital X' }, { reference_edition_id: 'old' }], error: null }) };
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.order.mockReturnValue(query); from.mockReturnValue(query);
    expect(await cutoffApi.getAllScores('ed')).toEqual([{ reference_edition_id: 'ed', reference_label: 'Processo X', source: 'Edital X' }]);
    expect(query.eq).toHaveBeenCalledWith('reference_edition_id', 'ed');
    expect(query.select).toHaveBeenCalledWith(expect.stringContaining('specialty_id'));
  });
});
