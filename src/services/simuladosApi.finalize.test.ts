import { beforeEach, describe, expect, it, vi } from 'vitest';
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc } }));
import { simuladosApi } from '@/services/simuladosApi';

describe('submitAttempt', () => {
  beforeEach(() => rpc.mockReset());
  it.each([false, true])('passes auto-submit=%s explicitly', async (auto) => {
    const row = { score_percentage: 10, total_correct: 10, total_answered: 10, total_questions: 100, is_within_window: true };
    rpc.mockResolvedValue({ data: [row], error: null });
    expect(await simuladosApi.submitAttempt('attempt', auto)).toEqual(row);
    expect(rpc).toHaveBeenCalledWith('finalize_attempt_with_results', { p_attempt_id: 'attempt', p_auto_submit: auto });
  });
  it('defaults to manual and never accepts an empty result', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await expect(simuladosApi.submitAttempt('attempt')).rejects.toThrow('nao retornou resultado');
    expect(rpc).toHaveBeenCalledWith('finalize_attempt_with_results', { p_attempt_id: 'attempt', p_auto_submit: false });
  });
  it('preserves structured RPC errors', async () => {
    const error = { code: 'P0001', message: 'Cannot submit: 90 question(s) unanswered' };
    rpc.mockResolvedValue({ data: null, error });
    await expect(simuladosApi.submitAttempt('attempt')).rejects.toBe(error);
  });
});
