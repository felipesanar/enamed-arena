import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));
import { adminCutoffApi } from './adminCutoffApi';
describe('cutoff RPC boundary', () => {
  beforeEach(() => vi.resetAllMocks());
  it('sends one atomic RPC and preserves server row errors', async () => {
    const result = { ok: false, imported: 0, errors: [{ row: 1, field: 'practice_scenario', message: 'Reference key already exists' }] };
    rpc.mockResolvedValue({ data: result, error: null });
    expect(await adminCutoffApi.import('edition', 'Fonte', [])).toEqual(result);
    expect(rpc).toHaveBeenCalledExactlyOnceWith('admin_import_cutoffs', { p_reference_edition_id: 'edition', p_source: 'Fonte', p_rows: [] });
  });
  it('does not retry an uncertain request', async () => {
    rpc.mockRejectedValue(new TypeError('network'));
    await expect(adminCutoffApi.import('e', 'f', [])).rejects.toThrow();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it('paginates every catalog table past the server cap', async () => {
    const range = vi.fn().mockResolvedValueOnce({ data: Array.from({ length: 1000 }, (_, i) => ({ id: String(i), name: 'n' })), error: null }).mockResolvedValue({ data: [{ id: 'last', name: 'last' }], error: null });
    from.mockReturnValue({ select: () => ({ order: () => ({ range }) }) });
    const result = await adminCutoffApi.catalog();
    expect(result.institutions).toHaveLength(1001);
    expect(range).toHaveBeenCalledWith(1000, 1999);
    expect(from).toHaveBeenCalledWith('enamed_specialties');
  });
});
