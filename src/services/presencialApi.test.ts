import { describe, it, expect, vi, beforeEach } from 'vitest';

const invoke = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: (...a: unknown[]) => invoke(...a) } },
}));
vi.mock('@/lib/analytics', () => ({ trackEvent: vi.fn() }));

import { presencialApi } from './presencialApi';

describe('presencialApi', () => {
  beforeEach(() => { invoke.mockReset(); });

  it('checkin envia action e campos normalizados', async () => {
    invoke.mockResolvedValue({ data: { status: 'no_account' }, error: null });
    const res = await presencialApi.checkin({
      code: 'S7-REC', name: '  Fulano  ', email: '  FULANO@GMAIL.COM ',
    });
    expect(invoke).toHaveBeenCalledWith('presencial', {
      body: { action: 'checkin', code: 's7-rec', name: 'Fulano', email: 'fulano@gmail.com' },
    });
    expect(res).toEqual({ status: 'no_account' });
  });

  it('propaga a mensagem de erro devolvida no corpo', async () => {
    invoke.mockResolvedValue({ data: { error: 'Esta sala não está aberta.' }, error: null });
    await expect(
      presencialApi.checkin({ code: 's7-rec', name: 'A', email: 'a@b.com' }),
    ).rejects.toThrow('Esta sala não está aberta.');
  });

  it('submit envia token e respostas', async () => {
    const result = {
      total_questions: 2, total_correct: 1, score_percentage: 50,
      by_area: [], is_linked: true, is_within_window: true,
    };
    invoke.mockResolvedValue({ data: result, error: null });
    const res = await presencialApi.submit({
      token: 'tok', answers: [{ question_id: 'q1', selected_option_id: 'o1' }],
    });
    expect(invoke).toHaveBeenCalledWith('presencial', {
      body: {
        action: 'submit', token: 'tok',
        answers: [{ question_id: 'q1', selected_option_id: 'o1' }],
      },
    });
    expect(res).toEqual(result);
  });
});
