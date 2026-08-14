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

  // Regressão de uso real: num status não-2xx o supabase-js devolve um
  // FunctionsHttpError cuja mensagem é "Edge Function returned a non-2xx status
  // code". Sem ler o corpo, era ISSO que aparecia na tela do aluno.
  it('em erro HTTP, usa a mensagem em pt-BR do corpo em vez da do transporte', async () => {
    const httpError = Object.assign(
      new Error('Edge Function returned a non-2xx status code'),
      { context: new Response(JSON.stringify({ error: 'Esta sala não está aberta para envio de gabarito.' }), { status: 403 }) },
    );
    invoke.mockResolvedValue({ data: null, error: httpError });
    await expect(
      presencialApi.checkin({ code: 's7-presencial', name: 'A', email: 'a@b.com' }),
    ).rejects.toThrow('Esta sala não está aberta para envio de gabarito.');
  });

  it('em erro HTTP sem corpo legível, cai numa mensagem acionável em pt-BR', async () => {
    const httpError = Object.assign(
      new Error('Edge Function returned a non-2xx status code'),
      { context: new Response('<html>502</html>', { status: 502 }) },
    );
    invoke.mockResolvedValue({ data: null, error: httpError });
    await expect(
      presencialApi.checkin({ code: 's7-presencial', name: 'A', email: 'a@b.com' }),
    ).rejects.toThrow(/chame o fiscal/i);
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
