import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the supabase client before importing the module under test
vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
    },
  };
});

import { supabase } from "@/integrations/supabase/client";
import { simuladosApi } from "./simuladosApi";

const missingRpc = (name: string, args: string) => ({ code: 'PGRST202', details: null, hint: null,
  message: `Could not find the function public.${name}(${args}) in the schema cache` });

describe('question image origins', () => {
  it.each([
    ['https://sanarflix.com.br/image.png', true],
    ['https://app.sanarflix.com.br/image.png', true],
    ['https://a.b.sanarflix.com.br/image.png', true],
    ['https://x.supabase.co/storage/image.png', true],
    ['https://x.supabase.in/image.png', true],
    ['https://simulados.sanar.com.br/image.png', true],
    ['https://preview.lovable.app/image.png', true],
    ['https://preview.lovableproject.com/image.png', true],
    ['https://sanaflix.com/image.png', false],
    ['https://app.sanaflix.com/image.png', false],
    ['http://sanarflix.com.br/image.png', false],
    ['https://sanarflix.com.br.evil/image.png', false],
    ['https://evil-sanarflix.com.br/image.png', false],
    ['https://sanarflix.com.br@evil.com/image.png', false],
  ])('filters all question image fields for %s', async (url, allowed) => {
    const builder = { select: vi.fn(() => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder),
      limit: vi.fn(async () => ({ data: [{ id: 'q1', question_number: 1, text: 'Question', area: 'CM',
        image_url: url, image_url_2: url, question_options: [] }], error: null })) };
    vi.mocked(supabase.from).mockReturnValue(builder as never);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ question_id: 'q1', explanation: 'Released', explanation_image_url: url }], error: null } as never);
    const [question] = await simuladosApi.getQuestions('s1', true);
    expect(question.imageUrl).toBe(allowed ? url : null);
    expect(question.imageUrl2).toBe(allowed ? url : null);
    expect(question.explanationImageUrl).toBe(allowed ? url : null);
  });
});

describe('submitAttempt rollout compatibility', () => {
  const grade = { score_percentage: 0, total_correct: 0, total_answered: 2, total_questions: 2, is_within_window: true };
  beforeEach(() => { vi.mocked(supabase.rpc).mockReset(); vi.mocked(supabase.from).mockReset(); });
  it.each([false, true])('keeps the supported boolean signature and server DTO for auto=%s', async auto => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [grade], error: null } as never);
    expect(await simuladosApi.submitAttempt('a1', auto)).toEqual(grade);
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('finalize_attempt_with_results', { p_attempt_id: 'a1', p_auto_submit: auto });
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('retries only the undispatched missing signature manually and preserves grade zero', async () => {
    let dispatched = 0;
    // The service awaits the RPC thenable; the test boundary supplies a Promise.
    vi.mocked(supabase.rpc as unknown as (name: string, args?: Record<string, unknown>) => Promise<unknown>).mockImplementation(async (_name, args) => {
      if ('p_auto_submit' in args!) return { data: null, status: 404,
        error: missingRpc('finalize_attempt_with_results', 'p_attempt_id, p_auto_submit') } as never;
      dispatched++;
      return { data: [grade], error: null } as never;
    });
    expect(await simuladosApi.submitAttempt('a1')).toEqual(grade);
    expect(dispatched).toBe(1); // PGRST202 did not dispatch a mutation, not an acknowledgement.
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'finalize_attempt_with_results', { p_attempt_id: 'a1' });
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('does not mask an unsupported auto-finalization', async () => {
    const error = missingRpc('finalize_attempt_with_results', 'p_attempt_id, p_auto_submit');
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error, status: 404 } as never);
    await expect(simuladosApi.submitAttempt('a1', true)).rejects.toBe(error);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
  it.each([
    { code: '42501', message: 'unauthorized', status: 401 },
    { code: '42501', message: 'forbidden', status: 403 },
    { code: 'XX000', message: 'server error', status: 500 },
    { code: '404', message: 'Not Found' },
    { code: '42883', message: 'function internal_helper does not exist' },
    { code: 'PGRST203', message: 'ambiguous function' },
    { code: 'PGRST202', message: 'generic schema cache error' },
    missingRpc('another_rpc', 'p_attempt_id, p_auto_submit'),
    missingRpc('finalize_attempt_with_results', 'p_attempt_id'),
  ])('does not retry other failures: $code/$message', async error => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
    await expect(simuladosApi.submitAttempt('a1')).rejects.toBe(error);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('propagates timeout/network rejection without a second mutation', async () => {
    const error = new Error('network timeout');
    vi.mocked(supabase.rpc).mockRejectedValue(error);
    await expect(simuladosApi.submitAttempt('a1')).rejects.toBe(error);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
  it.each(['blank answers rejected', 'legacy failure'])('propagates the one-argument failure without a third attempt: %s', async message => {
    const error = { code: 'P0001', message };
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: null, error: missingRpc('finalize_attempt_with_results', 'p_attempt_id, p_auto_submit') } as never)
      .mockResolvedValueOnce({ data: null, error } as never);
    await expect(simuladosApi.submitAttempt('a1')).rejects.toBe(error);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.from).not.toHaveBeenCalled();
  });
  it('preserves the server idempotent result with no extra mutation', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [grade], error: null } as never);
    expect(await simuladosApi.submitAttempt('already-submitted')).toEqual(grade);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
});

describe('getQuestions comments compatibility', () => {
  const missing = missingRpc('get_question_explanations', 'p_simulado_id');
  function mockCore() {
    const builder = { select: vi.fn((_columns: string) => builder), eq: vi.fn(() => builder), order: vi.fn(() => builder),
      limit: vi.fn(async () => ({ data: [{ id: 'q1', question_number: 1, text: 'Core text', area: 'CM', theme: 'T',
        explanation: 'REST secret', correct_option_id: 'wrong-rest-secret',
        question_options: [{ id: 'o1', question_id: 'q1', label: 'A', text: 'Core option', is_correct: true }] }], error: null })) };
    vi.mocked(supabase.from).mockReturnValue(builder as never);
    return builder;
  }
  beforeEach(() => { vi.mocked(supabase.rpc).mockReset(); vi.mocked(supabase.from).mockReset(); });
  it('returns core with an explicit missing-comment flag and no secret REST fallback', async () => {
    const builder = mockCore();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error: missing, status: 404 } as never);
    const [question] = await simuladosApi.getQuestions('s1', true);
    expect(question).toMatchObject({ id: 'q1', text: 'Core text', correctOptionId: '', explanationUnavailable: true,
      options: [{ id: 'o1', label: 'A', text: 'Core option' }] });
    expect(question.explanation).toBeUndefined();
    expect(supabase.from).toHaveBeenCalledExactlyOnceWith('questions');
    expect(builder.select.mock.lastCall?.[0]).not.toMatch(/explanation|is_correct|correct_option/);
    expect(supabase.rpc).toHaveBeenCalledExactlyOnceWith('get_question_explanations', { p_simulado_id: 's1' });
  });
  it('quiz never requests explanations or includes comments/answer keys', async () => {
    mockCore();
    const [question] = await simuladosApi.getQuestions('s1', false);
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(question.explanation).toBeUndefined();
    expect(question.correctOptionId).toBe('');
    expect(question).not.toHaveProperty('explanationUnavailable');
  });
  it('preserves the guarded correction response on the new backend', async () => {
    mockCore();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ question_id: 'q1', correct_option_id: 'o1', explanation: 'Released' }], error: null } as never);
    expect((await simuladosApi.getQuestions('s1', true))[0]).toMatchObject({ correctOptionId: 'o1', explanation: 'Released' });
  });
  it.each([{ code: '42501', message: 'forbidden', status: 403 }, { code: '500', message: 'server error' },
    { code: '404', message: 'Not Found' }, missingRpc('another_rpc', 'p_simulado_id')])('propagates comment failures: $code', async error => {
    mockCore();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: null, error } as never);
    await expect(simuladosApi.getQuestions('s1', true)).rejects.toBe(error);
    expect(supabase.from).toHaveBeenCalledTimes(1);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });
  it('propagates network failures for comments', async () => {
    mockCore();
    const error = new Error('network timeout');
    vi.mocked(supabase.rpc).mockRejectedValue(error);
    await expect(simuladosApi.getQuestions('s1', true)).rejects.toBe(error);
    expect(supabase.from).toHaveBeenCalledTimes(1);
  });
  it('keeps the existing release gate when the guarded RPC returns no authorized rows', async () => {
    mockCore();
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never);
    expect(await simuladosApi.getQuestions('s1', true)).toEqual([]);
  });
});

describe('edition performance RPC arguments', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(supabase.rpc).mockResolvedValue({ data: [], error: null } as never); });
  it('preserves legacy arguments', async () => {
    await simuladosApi.getUserPerformanceSummary('u');
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_user_performance_summary', { p_user_id: 'u' });
    await simuladosApi.getUserPerformanceHistory('u', 12);
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_user_performance_history', { p_user_id: 'u', p_limit: 12 });
    await simuladosApi.getUserAttemptBehaviorStats('u');
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_user_attempt_behavior_stats', { p_user_id: 'u' });
  });
  it('passes real scoped arguments without an arbitrary history limit', async () => {
    await simuladosApi.getUserPerformanceSummary('u', 'edition');
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_user_performance_summary', {
      p_user_id: 'u', p_edition_id: 'edition', p_include_training: false,
    });
    await simuladosApi.getUserPerformanceHistory('u', null, 'edition');
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_user_performance_history', {
      p_user_id: 'u', p_limit: null, p_edition_id: 'edition', p_include_training: false,
    });
    await simuladosApi.getUserAttemptBehaviorStats('u', 'edition');
    expect(supabase.rpc).toHaveBeenLastCalledWith('get_user_attempt_behavior_stats', { p_user_id: 'u', p_edition_id: 'edition' });
  });
});

// Chainable query builder mock for the `attempts` table: select/eq/in/order/limit/maybeSingle
// all return `this` (except the terminal ones), mirroring how `supabase.from(...)` is awaited
// directly in simuladosApi (e.g. `await supabase.from('attempts').select('*').eq(...)`).
function setupAttemptQueryMock() {
  const eq = vi.fn(() => builder);
  const inFn = vi.fn(() => builder);
  const order = vi.fn(() => builder);
  const limit = vi.fn(() => builder);
  const select = vi.fn(() => builder);
  const maybeSingle = vi.fn(() => Promise.resolve({ data: null, error: null }));

  const builder: any = {
    select,
    eq,
    in: inFn,
    order,
    limit,
    maybeSingle,
    then: (resolve: any) => resolve({ data: [], error: null }),
  };

  (supabase.from as any).mockReturnValue(builder);

  return { eq, inFn, order, limit, select, maybeSingle };
}

describe("simuladosApi — filtro de modalidade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("usa .eq quando recebe uma única modalidade", async () => {
    const { eq } = setupAttemptQueryMock();
    await simuladosApi.getUserAttempts("user-1", "online");
    expect(eq).toHaveBeenCalledWith("attempt_type", "online");
  });

  it("usa .in quando recebe um array de modalidades", async () => {
    const { inFn } = setupAttemptQueryMock();
    await simuladosApi.getUserAttempts("user-1", ["online", "presencial"]);
    expect(inFn).toHaveBeenCalledWith("attempt_type", ["online", "presencial"]);
  });

  it("getAttempt também aceita array", async () => {
    const { inFn } = setupAttemptQueryMock();
    await simuladosApi.getAttempt("sim-1", "user-1", ["online", "presencial"]);
    expect(inFn).toHaveBeenCalledWith("attempt_type", ["online", "presencial"]);
  });

  it("rejeita array vazio em vez de devolver zero linhas silenciosamente (getUserAttempts)", async () => {
    setupAttemptQueryMock();
    await expect(simuladosApi.getUserAttempts("user-1", [])).rejects.toThrow(
      /filter array vazio/i,
    );
  });

  it("rejeita array vazio em vez de devolver zero linhas silenciosamente (getAttempt)", async () => {
    setupAttemptQueryMock();
    await expect(simuladosApi.getAttempt("sim-1", "user-1", [])).rejects.toThrow(
      /filter array vazio/i,
    );
  });
});

describe("simuladosApi.updateAttempt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when the caller tries to update protected (score/status) columns directly", async () => {
    // Non-progress updates must never hit the table from the client.
    // After the hardening, they must throw synchronously with a clear message.
    await expect(
      simuladosApi.updateAttempt("attempt-id", { score_percentage: 90 }),
    ).rejects.toThrow(/not allowed/i);

    await expect(
      simuladosApi.updateAttempt("attempt-id", { status: "submitted" }),
    ).rejects.toThrow(/not allowed/i);

    await expect(
      simuladosApi.updateAttempt("attempt-id", { finished_at: new Date().toISOString() }),
    ).rejects.toThrow(/not allowed/i);
  });
});

describe('simuladosApi edition metadata opt-in', () => {
  const row = { id: 's1', slug: 'simulado-1', sequence_number: 1, duration_minutes: 300,
    edition_id: 'e1', source_simulado_id: 'source', exam_editions: { code: '2027.1', label: 'ENAMED 2027.1' } };
  function mockRow(value: unknown = row) {
    const builder = {
      select: vi.fn(() => builder), in: vi.fn(() => builder), order: vi.fn(() => builder),
      eq: vi.fn(() => builder), maybeSingle: vi.fn(async () => ({ data: value, error: null })),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: [value], error: null }),
    };
    vi.mocked(supabase.from).mockReturnValue(builder as never);
    return builder;
  }
  beforeEach(() => vi.clearAllMocks());

  it('keeps the old select and ignores new metadata by default', async () => {
    const query = mockRow();
    const result = await simuladosApi.listSimulados();
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.in).toHaveBeenCalledWith('status', ['published', 'test']);
    expect(result[0].editionCode).toBeUndefined();
  });

  it('opts into the real FK relationship without filtering away history', async () => {
    const query = mockRow();
    const result = await simuladosApi.listSimulados(true);
    expect(query.select).toHaveBeenCalledWith('*, exam_editions!simulados_edition_id_fkey(code, label)');
    expect(query.in).toHaveBeenCalledWith('status', ['published', 'test', 'archived']);
    expect(query.eq).not.toHaveBeenCalled();
    expect(result[0]).toMatchObject({ editionId: 'e1', editionCode: '2027.1', editionLabel: 'ENAMED 2027.1', sourceSimuladoId: 'source' });
  });

  it.each(['simulado-1', '123e4567-e89b-42d3-a456-426614174000'])('preserves slug/UUID lookup %s', async (ref) => {
    const query = mockRow();
    expect((await simuladosApi.getSimulado(ref, true))?.editionCode).toBe('2027.1');
    expect(query.eq).toHaveBeenCalledWith(ref === 'simulado-1' ? 'slug' : 'id', ref);
    expect(query.select).toHaveBeenCalledWith('*, exam_editions!simulados_edition_id_fkey(code, label)');
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each(['simulado-1', '123e4567-e89b-42d3-a456-426614174000'])('keeps direct lookup neutral without a join when disabled: %s', async ref => {
    const query = mockRow();
    const result = await simuladosApi.getSimulado(ref, false);
    expect(query.select).toHaveBeenCalledWith('*');
    expect(query.eq).toHaveBeenCalledWith(ref === 'simulado-1' ? 'slug' : 'id', ref);
    expect(result?.editionCode).toBeUndefined();
    expect(result?.editionLabel).toBeUndefined();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it.each([null, [], [{ code: '2027.1' }], { code: 2027, label: false }])('does not trust malformed relation %j', async (exam_editions) => {
    mockRow({ ...row, exam_editions });
    const [result] = await simuladosApi.listSimulados(true);
    expect(result.editionCode).toBeUndefined();
    expect(result.editionLabel).toBeUndefined();
  });
});
