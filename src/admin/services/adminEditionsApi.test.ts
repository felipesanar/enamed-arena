import { beforeEach, describe, expect, it, vi } from 'vitest';
const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { adminEditionsApi } from './adminEditionsApi';

describe('admin editions RPC boundary', () => {
  beforeEach(() => rpc.mockReset());
  it('passes clone contract without client-generated IDs or writes', async () => {
    rpc.mockResolvedValue({ data: 'new-id', error: null });
    expect(await adminEditionsApi.clone({ sourceSimuladoId: 'source', editionId: 'dest', windowStart: 'a', windowEnd: 'b', resultsReleaseAt: 'c', copyQuestions: true })).toBe('new-id');
    expect(rpc).toHaveBeenCalledWith('admin_clone_simulado', { p_source: 'source', p_edition_id: 'dest', p_window_start: 'a', p_window_end: 'b', p_results_release_at: 'c', p_copy_questions: true });
  });
  it('does not swallow server publication failures', async () => {
    rpc.mockResolvedValue({ error: new Error('Incomplete questions') });
    await expect(adminEditionsApi.publish('s')).rejects.toThrow('Incomplete questions');
    expect(rpc).toHaveBeenCalledWith('admin_publish_simulado', { p_simulado_id: 's' });
  });
});
