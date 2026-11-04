import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { adminApi } from '@/admin/services/adminApi';
const values = { id: null, simulado_id: 's', code: 'sala', label: 'Sala', opens_at: '2027-01-01T11:00:00Z', closes_at: '2027-01-01T15:00:00Z', is_active: true };
describe('presencial ranking rule compatibility', () => {
  beforeEach(() => rpc.mockReset());
  it.each([undefined, null, 'unexpected', 'legacy_online_window', 'session_window_v1'])('maps real rule without inferring legacy: %s', async ranking_rule => {
    rpc.mockResolvedValue({ data: [{ ...values, ranking_rule }], error: null });
    const [row] = await adminApi.presencialSessions();
    expect(row.ranking_rule).toBe(['legacy_online_window', 'session_window_v1'].includes(ranking_rule as string) ? ranking_rule : null);
  });
  it('keeps eight legacy args and sends a ninth only when explicit', async () => {
    rpc.mockResolvedValue({ data: 'id', error: null });
    await adminApi.presencialSessionUpsert(values);
    expect(Object.keys(rpc.mock.calls[0][1])).toHaveLength(8);
    await adminApi.presencialSessionUpsert({ ...values, ranking_rule: 'session_window_v1' });
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_ranking_rule: 'session_window_v1' });
  });
  it('does not retry a missing nine-argument RPC with a legacy request', async () => {
    rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202' } });
    await expect(adminApi.presencialSessionUpsert({ ...values, ranking_rule: 'session_window_v1' })).rejects.toEqual({ code: 'PGRST202' });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
