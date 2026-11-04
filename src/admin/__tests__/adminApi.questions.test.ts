import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: vi.fn(), rpc: vi.fn() } }));
import { supabase } from '@/integrations/supabase/client';
import { adminApi } from '@/admin/services/adminApi';

describe('admin question readers after column revoke', () => {
  beforeEach(() => vi.resetAllMocks());
  it('uses the guarded admin RPC for publication audit/export data', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ id: 'q1', question_number: 1, text: 'Text',
      explanation: 'Comment', options: [{ label: 'A', text: 'Answer', is_correct: true }] }], error: null } as never);
    expect(await adminApi.getQuestionsForGabaritoAudit('sim1')).toEqual([
      { questionNumber: 1, enunciado: 'Text', comentario: 'Comment', options: [{ label: 'A', text: 'Answer', isCorrect: true }] },
    ]);
    expect(supabase.rpc).toHaveBeenCalledWith('admin_get_simulado_questions', { p_simulado_id: 'sim1' });
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('fails closed when admin RPC denies access', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: new Error('forbidden') } as never);
    await expect(adminApi.getQuestionsForGabaritoAudit('sim1')).rejects.toThrow('forbidden');
    expect(supabase.from).not.toHaveBeenCalled();
  });
});
