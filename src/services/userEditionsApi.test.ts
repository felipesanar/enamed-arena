import { beforeEach, describe, expect, it, vi } from 'vitest';
import { userEditionsApi } from '@/services/userEditionsApi';

const { rpc, from } = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from } }));
beforeEach(() => vi.clearAllMocks());

describe('userEditionsApi', () => {
  it('sends explicit nullable values without deriving a graduation date', async () => {
    rpc.mockResolvedValue({ error: null });
    await userEditionsApi.setTargetEdition(null, null);
    expect(rpc).toHaveBeenCalledWith('set_target_edition_guarded', {
      p_edition_id: null, p_expected_graduation_term: null,
    });
    await userEditionsApi.setTargetEdition('edition', '2027.2');
    expect(rpc).toHaveBeenLastCalledWith('set_target_edition_guarded', {
      p_edition_id: 'edition', p_expected_graduation_term: '2027.2',
    });
  });
  it('propagates the guarded RPC error', async () => {
    const error = new Error('invalid edition');
    rpc.mockResolvedValue({ error });
    await expect(userEditionsApi.setTargetEdition('missing', null)).rejects.toBe(error);
  });
  it('reads only target fields for the specified authenticated profile', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: { target_edition_id: 'e', expected_graduation_term: null }, error: null });
    const eq = vi.fn(() => ({ maybeSingle }));
    const select = vi.fn(() => ({ eq }));
    from.mockReturnValue({ select });
    expect(await userEditionsApi.getTarget('u')).toEqual({ targetEditionId: 'e', expectedGraduationTerm: null });
    expect(select).toHaveBeenCalledWith('target_edition_id,expected_graduation_term');
    expect(eq).toHaveBeenCalledWith('user_id', 'u');
  });
  it('preserves undecided values and propagates read failures', async () => {
    const maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    expect(await userEditionsApi.getTarget('u')).toEqual({ targetEditionId: null, expectedGraduationTerm: null });
    const error = new Error('read failed');
    maybeSingle.mockResolvedValueOnce({ data: null, error });
    await expect(userEditionsApi.getTarget('u')).rejects.toBe(error);
  });
});
