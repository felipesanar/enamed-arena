import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), getSession: vi.fn(), drafts: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: mocks.rpc, from: mocks.from, auth: { getSession: mocks.getSession } } }));
vi.mock('@/admin/services/adminApi', () => ({ adminApi: { listSimulados: mocks.drafts } }));
import { questionBankApi } from './questionBankApi';
beforeEach(() => { vi.clearAllMocks(); mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner' } } }, error: null }); });
describe('question bank scoped administrative RPCs', () => {
  it('paginates identities without loading student results', async () => {
    mocks.rpc.mockResolvedValue({ data: { items: [], total: 1501, limit: 50, offset: 1000 }, error: null });
    expect((await questionBankApi.list('owner', { search: ' ECG ', offset: 1000 })).total).toBe(1501);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('admin_list_question_bank', { p_search: 'ECG', p_limit: 50, p_offset: 1000 });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('requires selected identity for item analysis and keeps edition scope explicit', async () => {
    await expect(questionBankApi.getAnalysis('owner', '', null)).rejects.toThrow(); expect(mocks.rpc).not.toHaveBeenCalled();
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await questionBankApi.getAnalysis('owner', 'bank', 'edition');
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('admin_get_question_item_analysis', { p_bank_id: 'bank', p_edition_id: 'edition' });
  });
  it('preserves version order and reads a bounded page for one bank identity', async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    await questionBankApi.listVersions('owner', 'bank', 50);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('admin_list_question_bank_versions', { p_bank_id: 'bank', p_limit: 50, p_offset: 50 });
  });
  it('returns only server-listed drafts whose attempt count is known to be zero', async () => {
    mocks.drafts.mockResolvedValue([{ id: 'draft', status: 'draft', attempts_count: 0 }, { id: 'unknown', status: 'draft', attempts_count: null }, { id: 'live', status: 'published', attempts_count: 0 }]);
    expect(await questionBankApi.getDrafts('owner')).toEqual([{ id: 'draft', status: 'draft', attempts_count: 0 }]);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it('does not retry an uncertain mutation and preserves the lock code', async () => {
    const error = { code: '55P03' }; mocks.rpc.mockResolvedValue({ data: null, error });
    await expect(questionBankApi.reuseVersion('owner', { p_version_id: 'version-2', p_simulado_id: 'draft', p_question_number: 8 })).rejects.toBe(error);
    expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('admin_add_bank_version_to_simulado', { p_version_id: 'version-2', p_simulado_id: 'draft', p_question_number: 8 });
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('discards identity data if logout happens while the RPC is in flight', async () => {
    mocks.getSession.mockResolvedValueOnce({ data: { session: { user: { id: 'owner' } } }, error: null }).mockResolvedValueOnce({ data: { session: null }, error: null });
    mocks.rpc.mockResolvedValue({ data: { items: [], total: 0, limit: 50, offset: 0 }, error: null });
    await expect(questionBankApi.list('owner', {})).rejects.toThrow(/conta/i);
  });
});
